"""
API эндпоинты для конвертации файлов
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import case, desc
from uuid import UUID
from datetime import datetime
import asyncio

from app.core.config import settings
from app.core.database import get_db
from app.models.upload import ConversionJob, FileUpload, ConversionLog
from app.schemas.upload import ConversionJobResponse, StartConversionRequest
from app.services.conversion import ConversionService
from app.utils.conversion_status import describe_conversion_step
from app.utils.identifiers import (
    resolve_project_by_identifier,
    resolve_version_by_identifier,
)
from typing import Optional

router = APIRouter()
conversion_service = ConversionService()
MAX_PARALLEL_JOBS = getattr(settings, "CONVERSION_MAX_PARALLEL_JOBS", 3)
conversion_semaphore = asyncio.Semaphore(MAX_PARALLEL_JOBS)

# Флаг для фонового процесса проверки очереди
_queue_processor_running = False


def _serialize_conversion_job(job: ConversionJob) -> dict:
    step_label, step_code = describe_conversion_step(job)
    return {
        "id": str(job.id),
        "fileUploadId": str(job.file_upload_id),
        "userId": str(job.user_id),
        "conversionType": job.conversion_type,
        "status": job.status,
        "priority": job.priority,
        "progress": job.progress or 0,
        "inputFileId": str(job.input_file_id),
        "outputFileId": str(job.output_file_id) if job.output_file_id else None,
        "exportSettingsId": str(job.export_settings_id) if job.export_settings_id else None,
        "startedAt": job.started_at.isoformat() if job.started_at else None,
        "completedAt": job.completed_at.isoformat() if job.completed_at else None,
        "durationSeconds": job.duration_seconds,
        "errorMessage": job.error_message,
        "errorStack": job.error_stack,
        "parentJobId": str(job.parent_job_id) if job.parent_job_id else None,
        "nextJobId": str(job.next_job_id) if job.next_job_id else None,
        "currentStep": step_label,
        "currentStepCode": step_code,
    }


async def _process_queue_after_completion(db: Session):
    """Обработать очередь после завершения конвертации"""
    try:
        processed_job = await conversion_service.process_queue(db)
        if processed_job:
            print(f"✅ Задача из очереди запущена: {processed_job.id}")
            # Запускаем конвертацию в фоне
            import asyncio
            asyncio.create_task(run_conversion_task(processed_job.id))
    except Exception as e:
        print(f"⚠️ Ошибка при обработке очереди: {e}")


async def _queue_processor_loop():
    """Фоновый процесс для проверки очереди каждые 10 секунд"""
    global _queue_processor_running
    _queue_processor_running = True
    from app.core.database import SessionLocal
    
    print("🔄 Фоновый процесс проверки очереди запущен")
    
    while _queue_processor_running:
        try:
            await asyncio.sleep(10)  # Проверяем каждые 10 секунд
            
            db = SessionLocal()
            try:
                processed_job = await conversion_service.process_queue(db)
                if processed_job:
                    print(f"✅ Задача из очереди запущена (периодическая проверка): {processed_job.id}")
                    # Задача уже запущена в process_queue(), не нужно запускать повторно
            except Exception as e:
                print(f"⚠️ Ошибка при периодической проверке очереди: {e}")
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"⚠️ Ошибка в фоновом процессе проверки очереди: {e}")
            await asyncio.sleep(10)  # Ждем перед следующей попыткой


async def run_conversion_task(
    job_id: UUID,
):
    """Фоновая задача для выполнения конвертации"""
    print(f"🚀 Запуск конвертации, job_id: {job_id}")
    async with conversion_semaphore:
        await _execute_conversion_job(job_id)


async def _execute_conversion_job(job_id: UUID):
    """Выполнить конвертацию внутри ограничителя параллельности"""
    from app.core.database import SessionLocal
    
    db = SessionLocal()
    try:
        # Получаем задачу из БД
        job = db.query(ConversionJob).filter(ConversionJob.id == job_id).first()
        if not job:
            print(f"❌ Задача конвертации {job_id} не найдена")
            return
        
        print(f"✅ Задача найдена: type={job.conversion_type}, status={job.status}")
        
        # Если задача в очереди, проверяем занятость сервера перед запуском
        if job.status == "queued" and job.conversion_type == "RVT_TO_CSV":
            from app.services.rvt_csv_exporter import RVTCSVExporterService
            try:
                exporter = RVTCSVExporterService()
                if exporter.use_remote and exporter.remote_service:
                    is_busy = await exporter.remote_service.is_busy()
                    if is_busy:
                        # Сервер все еще занят, проверяем также статус в БД
                        active_job = db.query(ConversionJob).filter(
                            ConversionJob.status == "processing",
                            ConversionJob.conversion_type == "RVT_TO_CSV",
                            ConversionJob.id != job.id,  # Исключаем текущую задачу
                        ).first()
                        if active_job:
                            print(f"⏸️ Задача {job.id} в очереди, сервер занят задачей {active_job.id}, пропускаем")
                            return
                        # В БД нет активных задач, но сервер говорит что занят - проверяем еще раз
                        status = await exporter.remote_service.check_status()
                        if status.get("busy", False):
                            print(f"⏸️ Задача {job.id} в очереди, сервер занят (статус API), пропускаем")
                            return
                    # Сервер свободен, обновляем статус и продолжаем
                    job.status = "processing"
                    job.started_at = datetime.utcnow()
                    db.commit()
                    print(f"✅ Задача {job.id} извлечена из очереди, сервер свободен, начинаем конвертацию")
            except Exception as e:
                print(f"⚠️ Ошибка при проверке статуса сервера для задачи в очереди: {e}")
                # Если не удалось проверить, оставляем задачу в очереди
                return
        
        # Получаем файл
        file_upload = db.query(FileUpload).filter(FileUpload.id == job.file_upload_id).first()
        if not file_upload:
            print(f"❌ Файл {job.file_upload_id} не найден")
            job.status = "failed"
            job.error_message = "Файл не найден"
            db.commit()
            return
        
        print(f"✅ Файл найден: {file_upload.original_filename}, path={file_upload.storage_path}")
        
        # Запускаем конвертацию в зависимости от типа
        if job.conversion_type == "RVT_TO_CSV":
            print(f"🔄 Запускаем прямую конвертацию RVT→CSV")
            await conversion_service._convert_rvt_to_csv(
                db, job, file_upload, job.export_settings_id
            )
        elif job.conversion_type == "RVT_TO_IFC":
            print(f"🔄 Запускаем конвертацию RVT→IFC")
            await conversion_service._convert_rvt_to_ifc(
                db, job, file_upload, job.export_settings_id
            )
        elif job.conversion_type == "IFC_TO_CSV":
            print(f"🔄 Запускаем конвертацию IFC→CSV")
            await conversion_service._convert_ifc_to_csv(
                db, job, file_upload
            )
        else:
            print(f"❌ Неизвестный тип конвертации: {job.conversion_type}")
        
        print(f"✅ Конвертация завершена для job_id: {job_id}")
        
        # После завершения конвертации проверяем очередь
        try:
            await _process_queue_after_completion(db)
        except Exception as queue_error:
            print(f"⚠️ Ошибка при обработке очереди после завершения конвертации: {queue_error}")
    except Exception as e:
        import traceback
        error_msg = f"❌ Ошибка выполнения конвертации: {e}\n{traceback.format_exc()}"
        print(error_msg)
        # Обновляем статус задачи на failed
        try:
            job = db.query(ConversionJob).filter(ConversionJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                job.error_stack = traceback.format_exc()
                db.commit()
                print(f"✅ Статус задачи обновлен на failed")
        except Exception as update_error:
            print(f"❌ Ошибка обновления статуса: {update_error}")
    finally:
        db.close()
        print(f"🔒 Сессия БД закрыта для job_id: {job_id}")


@router.post("/start")
async def start_conversion(
    request: StartConversionRequest,
    background_tasks: BackgroundTasks,
    user_id: str = "00000000-0000-0000-0000-000000000000",  # TODO: получать из JWT токена
    db: Session = Depends(get_db),
):
    """
    Начать конвертацию файла
    
    Args:
        request: Данные запроса на конвертацию
        background_tasks: Фоновые задачи FastAPI
        user_id: ID пользователя
        db: Сессия БД
    """
    try:
        # Создаем задачу конвертации
        file_upload = db.query(FileUpload).filter(FileUpload.id == request.file_upload_id).first()
        if not file_upload:
            raise HTTPException(status_code=404, detail="Файл не найден")
        
        # Создаем запись задачи
        job = ConversionJob(
            file_upload_id=request.file_upload_id,
            user_id=UUID(user_id),
            conversion_type=request.conversion_type,
            status="queued",
            progress=0,
            input_file_id=request.file_upload_id,
            export_settings_id=request.export_settings_id,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Запускаем конвертацию в фоне
        background_tasks.add_task(
            run_conversion_task,
            job.id,  # Передаем ID задачи
        )
        
        return JSONResponse(content=_serialize_conversion_job(job))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка запуска конвертации: {str(e)}")


@router.get("/project/{project_identifier}")
async def get_project_conversions(
    project_identifier: str,
    version_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Получить статусы конвертаций для проекта/версии"""
    try:
        project = resolve_project_by_identifier(project_identifier, db)
    except HTTPException as exc:
        if exc.status_code == 404:
            # Проект ещё не создан/синхронизирован — возвращаем пустой список без ошибки
            return JSONResponse(content=[])
        raise

    project_uuid = project.id
    
    version_uuid: Optional[UUID] = None
    if version_id:
        try:
            version = resolve_version_by_identifier(version_id, db, project_uuid)
            version_uuid = version.id
        except HTTPException as exc:
            if exc.status_code == 404:
                # Версия ещё не создана (например, UI только что инициировал загрузку)
                return JSONResponse(content=[])
            raise
    
    query = (
        db.query(ConversionJob, FileUpload)
        .join(FileUpload, ConversionJob.file_upload_id == FileUpload.id)
        .filter(FileUpload.project_id == project_uuid)
    )
    if version_uuid:
        query = query.filter(FileUpload.version_id == version_uuid)
    if active_only:
        query = query.filter(ConversionJob.status.in_(["pending", "queued", "processing"]))
    
    status_order = case(
        (ConversionJob.status == "processing", 0),
        (ConversionJob.status == "queued", 1),
        (ConversionJob.status == "pending", 2),
        (ConversionJob.status == "failed", 3),
        (ConversionJob.status == "completed", 4),
        else_=5,
    )
    
    query = query.order_by(
        status_order,
        desc(ConversionJob.started_at),
        desc(ConversionJob.completed_at),
        desc(ConversionJob.id),
    )
    
    if limit:
        query = query.limit(limit)
    
    rows = query.all()
    result = []
    for job, file_upload in rows:
        step_label, step_code = describe_conversion_step(job)
        result.append(
            {
                "job": _serialize_conversion_job(job),
                "file": {
                    "id": str(file_upload.id),
                    "projectId": str(file_upload.project_id),
                    "versionId": str(file_upload.version_id),
                    "originalFilename": file_upload.original_filename,
                    "fileType": file_upload.file_type,
                    "fileSize": file_upload.file_size,
                    "uploadedAt": file_upload.uploaded_at.isoformat() if file_upload.uploaded_at else None,
                },
                "currentStep": step_label,
                "currentStepCode": step_code,
            }
        )
    
    return JSONResponse(content=result)


@router.get("/queue/status")
async def get_queue_status(
    db: Session = Depends(get_db),
):
    """
    Получить статус очереди конвертаций
    
    Returns:
        dict с информацией о очереди:
        - queued_count: количество задач в очереди
        - processing_count: количество активных задач
        - windows_server_busy: занят ли Windows сервер
        - next_job_id: ID следующей задачи в очереди
    """
    from app.services.rvt_csv_exporter import RVTCSVExporterService
    
    # Подсчитываем задачи в очереди
    queued_count = db.query(ConversionJob).filter(
        ConversionJob.status == "queued",
        ConversionJob.conversion_type == "RVT_TO_CSV",
    ).count()
    
    # Подсчитываем активные задачи
    processing_count = db.query(ConversionJob).filter(
        ConversionJob.status == "processing",
        ConversionJob.conversion_type == "RVT_TO_CSV",
    ).count()
    
    # Получаем следующую задачу в очереди
    next_job = db.query(ConversionJob).filter(
        ConversionJob.status == "queued",
        ConversionJob.conversion_type == "RVT_TO_CSV",
    ).order_by(ConversionJob.id).first()
    
    # Проверяем статус Windows сервера с таймаутом (5 секунд)
    windows_server_busy = None
    available_slots = None
    total_slots = None
    try:
        exporter = RVTCSVExporterService()
        if exporter.use_remote and exporter.remote_service:
            # Используем asyncio.wait_for для предотвращения зависания
            try:
                windows_server_busy = await asyncio.wait_for(
                    exporter.remote_service.is_busy(),
                    timeout=5.0
                )
                # Получаем информацию о слотах для более точного определения нагрузки
                status = await asyncio.wait_for(
                    exporter.remote_service.check_status(),
                    timeout=5.0
                )
                available_slots = status.get("available_slots")
                total_slots = status.get("total_slots")
            except asyncio.TimeoutError:
                print(f"⚠️ Таймаут при проверке статуса Windows сервера (5 секунд)")
                windows_server_busy = None
                available_slots = None
                total_slots = None
    except Exception as e:
        print(f"⚠️ Ошибка при проверке статуса Windows сервера: {e}")
        windows_server_busy = None
        available_slots = None
        total_slots = None
    
    return JSONResponse(content={
        "queuedCount": queued_count,
        "processingCount": processing_count,
        "windowsServerBusy": windows_server_busy,
        "availableSlots": available_slots,
        "totalSlots": total_slots,
        "nextJobId": str(next_job.id) if next_job else None,
        "hasQueue": queued_count > 0,
    })


@router.get("/{job_id}/logs")
async def get_conversion_logs(
    job_id: UUID,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Получить логи выполнения конвертации"""
    job = db.query(ConversionJob).filter(ConversionJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Задача конвертации не найдена")
    
    logs = (
        db.query(ConversionLog)
        .filter(ConversionLog.conversion_job_id == job_id)
        .order_by(desc(ConversionLog.created_at))
        .limit(limit)
        .all()
    )
    
    content = [
        {
            "id": str(log.id),
            "conversionJobId": str(log.conversion_job_id),
            "logLevel": log.log_level,
            "message": log.message,
            "metadata": log.log_metadata,
            "createdAt": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
    
    return JSONResponse(content=content)


@router.get("/{job_id}")
async def get_conversion_job(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """Получить статус конвертации"""
    job = db.query(ConversionJob).filter(ConversionJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Задача конвертации не найдена")
    
    return JSONResponse(content=_serialize_conversion_job(job))


@router.post("/{job_id}/cancel")
async def cancel_conversion(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """Отменить конвертацию"""
    job = db.query(ConversionJob).filter(ConversionJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Задача конвертации не найдена")
    
    if job.status in ["completed", "failed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Невозможно отменить завершенную задачу")
    
    job.status = "cancelled"
    db.commit()
    
    return {"message": "Конвертация отменена"}

