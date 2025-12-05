"""
API эндпоинты для загрузки файлов
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import os
import tempfile
from pathlib import Path

from app.core.database import get_db
from app.core.storage import storage_service
from app.models.upload import FileUpload, FileMetadata
from app.schemas.upload import (
    FileUploadResponse,
    UploadFileResponse,
    UploadProgressResponse,
    FileMetadataResponse,
)
from uuid import uuid4

from app.utils.identifiers import (
    resolve_project_by_identifier,
    resolve_version_by_identifier,
    resolve_project_uuid,
    resolve_version_uuid,
)
from app.utils.conversion_status import describe_conversion_step

router = APIRouter()


def get_file_type(filename: str) -> str:
    """Определить тип файла по расширению"""
    ext = Path(filename).suffix.lower()
    if ext == ".rvt":
        return "RVT"
    elif ext == ".ifc":
        return "IFC"
    elif ext == ".csv":
        return "CSV"
    return "OTHER"


@router.post("")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    projectId: str = Form(...),
    versionId: str = Form(...),
    projectName: Optional[str] = Form(None),  # Название проекта для пути
    versionName: Optional[str] = Form(None),  # Название версии для пути
    exportSettingsId: Optional[str] = Form(None),
    autoConvert: Optional[bool] = Form(False),
    userId: str = Form("00000000-0000-0000-0000-000000000000"),  # TODO: получать из JWT токена
    db: Session = Depends(get_db),
):
    """
    Загрузить файл
    
    Args:
        file: Файл для загрузки
        projectId: ID проекта (camelCase для совместимости с frontend)
        versionId: ID версии проекта
        exportSettingsId: ID настроек экспорта (опционально)
        autoConvert: Автоматически начать конвертацию после загрузки
        userId: ID пользователя
        db: Сессия БД
    """
    print(f"📤 Начало загрузки файла: {file.filename}")
    tmp_file_path = None
    try:
        # Проверяем, что filename есть
        if not file.filename:
            print("❌ Имя файла не указано")
            raise HTTPException(status_code=400, detail="Имя файла не указано")
        
        print(f"📋 Параметры загрузки: projectId={projectId}, versionId={versionId}, autoConvert={autoConvert}")
        
        # Валидация UUID
        def validate_uuid(uuid_str: str, field_name: str) -> UUID:
            """Валидировать и преобразовать строку в UUID"""
            if not uuid_str or uuid_str.strip() == "":
                raise HTTPException(status_code=400, detail=f"{field_name} не указан")
            try:
                return UUID(uuid_str)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Неверный формат {field_name}: {uuid_str}")
        
        # Валидируем идентификаторы
        project_obj = resolve_project_by_identifier(projectId, db)
        version_obj = resolve_version_by_identifier(versionId, db, project_obj.id)
        user_uuid = validate_uuid(userId, "userId")
        project_uuid = project_obj.id
        version_uuid = version_obj.id
        
        # Определяем тип файла
        file_type = get_file_type(file.filename)
        print(f"📁 Тип файла: {file_type}")
        
        # Создаем временный файл
        print("💾 Начинаем чтение файла...")
        file_suffix = Path(file.filename).suffix or ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_suffix) as tmp_file:
            # Сохраняем содержимое файла
            content = await file.read()
            print(f"✅ Файл прочитан, размер: {len(content)} байт ({len(content) / 1024 / 1024:.2f} MB)")
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
            file_size = len(content)
        print(f"💾 Файл сохранен во временный файл: {tmp_file_path}")
        
        # Генерируем путь в хранилище с нормальными названиями
        from app.utils.storage import build_storage_path
        
        object_name = build_storage_path(
            project_id=project_uuid,
            version_id=version_uuid,
            filename=file.filename,
            project_name=projectName,  # Используем название из frontend или None
            version_name=versionName,  # Используем название из frontend или None
            use_original_filename=True,
        )
        
        # Загружаем файл в хранилище
        print(f"☁️  Начинаем загрузку в хранилище: {object_name}")
        try:
            storage_path = storage_service.upload_file(
                tmp_file_path,
                object_name,
                content_type=file.content_type,
            )
            print(f"✅ Файл загружен в хранилище: {storage_path}")
        except Exception as storage_error:
            if tmp_file_path and os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
            import traceback
            print(f"ERROR in storage.upload_file: {str(storage_error)}\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Ошибка загрузки в хранилище: {str(storage_error)}")
        
        # Получаем bucket (с fallback)
        storage_bucket = storage_service.bucket or "local"
        
        # Создаем запись в БД
        try:
            db_file_upload = FileUpload(
                user_id=user_uuid,
                project_id=project_uuid,
                version_id=version_uuid,
                original_filename=file.filename,
                file_type=file_type,
                file_size=file_size,
                mime_type=file.content_type,
                storage_path=storage_path,
                storage_bucket=storage_bucket,
                upload_status="completed",
            )
            db.add(db_file_upload)
            db.commit()
            db.refresh(db_file_upload)
            print(f"✅ Запись в БД создана: {db_file_upload.id}")
        except Exception as db_error:
            import traceback
            print(f"ERROR in DB operation: {str(db_error)}\n{traceback.format_exc()}")
            # Пытаемся удалить файл из хранилища при ошибке БД
            try:
                if storage_path.startswith("local://"):
                    storage_path_clean = storage_path[8:]
                    storage_service.delete_file(storage_path_clean)
            except:
                pass
            raise HTTPException(status_code=500, detail=f"Ошибка сохранения в БД: {str(db_error)}")
        
        # Удаляем временный файл
        if tmp_file_path and os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)
        
        # Если нужно автоматически начать конвертацию
        conversion_job = None
        if autoConvert:
            from app.models.upload import ConversionJob
            from app.api.v1.conversion import run_conversion_task
            
            # Определяем тип конвертации в зависимости от типа файла
            if file_type == "RVT":
                conversion_type = "RVT_TO_CSV"
            elif file_type == "IFC":
                conversion_type = "IFC_TO_CSV"
            else:
                conversion_type = None
            
            if conversion_type:
                # Создаем задачу конвертации
                conversion_job_obj = ConversionJob(
                    file_upload_id=db_file_upload.id,
                    user_id=user_uuid,
                    conversion_type=conversion_type,
                    status="queued",
                    progress=0,
                    input_file_id=db_file_upload.id,
                )
                db.add(conversion_job_obj)
                db.commit()
                db.refresh(conversion_job_obj)
                
                # Запускаем конвертацию в фоне через BackgroundTasks
                print(f"📋 Добавляем задачу конвертации в BackgroundTasks: job_id={conversion_job_obj.id}, type={conversion_type}")
                background_tasks.add_task(
                    run_conversion_task,
                    conversion_job_obj.id,  # Передаем ID задачи, а не file_upload_id
                )
                print(f"✅ Задача конвертации добавлена в очередь")
                
                conversion_job = conversion_job_obj
        
        # Преобразуем в схему ответа с camelCase для frontend
        try:
            # Преобразуем datetime в строки
            uploaded_at_str = db_file_upload.uploaded_at.isoformat() if db_file_upload.uploaded_at else None
            completed_at_str = db_file_upload.completed_at.isoformat() if db_file_upload.completed_at else None
            
            file_upload_camel = {
                "id": str(db_file_upload.id),
                "userId": str(db_file_upload.user_id),
                "projectId": str(db_file_upload.project_id),
                "versionId": str(db_file_upload.version_id),
                "originalFilename": db_file_upload.original_filename,
                "fileType": db_file_upload.file_type,
                "fileSize": db_file_upload.file_size,
                "mimeType": db_file_upload.mime_type,
                "storagePath": db_file_upload.storage_path,
                "storageBucket": db_file_upload.storage_bucket,
                "uploadStatus": db_file_upload.upload_status,
                "errorMessage": db_file_upload.error_message,
                "modelId": str(db_file_upload.model_id) if db_file_upload.model_id else None,
                "uploadedAt": uploaded_at_str,
                "completedAt": completed_at_str,
            }
            
            # Преобразуем conversionJob в camelCase, если есть
            conversion_job_camel = None
            if conversion_job:
                conversion_job_camel = {
                    "id": str(conversion_job.id),
                    "userId": str(conversion_job.user_id),
                    "conversionType": conversion_job.conversion_type,
                    "status": conversion_job.status,
                    "progress": conversion_job.progress or 0,
                    "inputFileId": str(conversion_job.input_file_id),
                    "outputFileId": str(conversion_job.output_file_id) if conversion_job.output_file_id else None,
                    "exportSettingsId": str(conversion_job.export_settings_id) if conversion_job.export_settings_id else None,
                    "startedAt": conversion_job.started_at.isoformat() if conversion_job.started_at else None,
                    "completedAt": conversion_job.completed_at.isoformat() if conversion_job.completed_at else None,
                    "durationSeconds": conversion_job.duration_seconds,
                    "errorMessage": conversion_job.error_message,
                    "parentJobId": str(conversion_job.parent_job_id) if conversion_job.parent_job_id else None,
                    "nextJobId": str(conversion_job.next_job_id) if conversion_job.next_job_id else None,
                }
            
            # Создаем ответ с camelCase
            response_dict = {
                "fileUpload": file_upload_camel,
                "conversionJob": conversion_job_camel,
            }
            
            # Возвращаем JSON напрямую, чтобы сохранить camelCase
            from fastapi.responses import JSONResponse
            return JSONResponse(content=response_dict)
        except Exception as response_error:
            import traceback
            print(f"ERROR in response formatting: {str(response_error)}\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Ошибка форматирования ответа: {str(response_error)}")
    except HTTPException:
        # Пробрасываем HTTPException как есть
        raise
    except Exception as e:
        # Удаляем временный файл в случае ошибки
        if tmp_file_path and os.path.exists(tmp_file_path):
            try:
                os.unlink(tmp_file_path)
            except:
                pass
        
        # Логируем полную ошибку для отладки
        import traceback
        error_detail = f"Ошибка загрузки файла: {str(e)}\n{traceback.format_exc()}"
        print(f"ERROR in upload_file: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки файла: {str(e)}")


@router.get("/{file_upload_id}", response_model=FileUploadResponse)
async def get_file_upload(
    file_upload_id: UUID,
    db: Session = Depends(get_db),
):
    """Получить информацию о файле"""
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    if not file_upload:
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    return FileUploadResponse.model_validate(file_upload)


@router.get("", response_model=List[FileUploadResponse])
async def list_file_uploads(
    projectId: Optional[str] = Query(None, alias="projectId"),
    versionId: Optional[str] = Query(None, alias="versionId"),
    db: Session = Depends(get_db),
):
    """Получить список загруженных файлов"""
    try:
        query = db.query(FileUpload)
        
        if projectId:
            project_uuid = resolve_project_uuid(projectId, db)
            query = query.filter(FileUpload.project_id == project_uuid)
        
        if versionId:
            version_uuid = resolve_version_uuid(
                versionId,
                db,
                project_uuid if projectId else None,
            )
            query = query.filter(FileUpload.version_id == version_uuid)
        
        file_uploads = query.order_by(FileUpload.uploaded_at.desc()).all()
        
        # Преобразуем в response модели, используя from_orm для безопасной сериализации
        result = []
        for fu in file_uploads:
            try:
                # Используем model_validate с from_attributes=True (уже настроено в схеме)
                # Это не будет пытаться загружать relationships автоматически
                result.append(FileUploadResponse.model_validate(fu))
            except Exception as e:
                print(f"Warning: Error serializing FileUpload {fu.id}: {e}")
                import traceback
                traceback.print_exc()
                # Пропускаем проблемные записи, но продолжаем обработку
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in list_file_uploads: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении списка файлов: {str(e)}")


@router.get("/{file_upload_id}/progress")
async def get_upload_progress(
    file_upload_id: UUID,
    db: Session = Depends(get_db),
):
    """Получить статус загрузки и конвертации файла"""
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    if not file_upload:
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    # Получаем последнюю задачу конвертации, если есть
    from app.models.upload import ConversionJob
    from sqlalchemy import desc, nullslast
    conversion_job = (
        db.query(ConversionJob)
        .filter(ConversionJob.file_upload_id == file_upload_id)
        .order_by(nullslast(desc(ConversionJob.started_at)), desc(ConversionJob.id))
        .first()
    )
    
    # Преобразуем в camelCase для frontend
    from fastapi.responses import JSONResponse
    
    step_label, step_code = describe_conversion_step(conversion_job)
    progress_dict = {
        "fileUploadId": str(file_upload_id),
        "uploadStatus": file_upload.upload_status,
        "uploadProgress": 100 if file_upload.upload_status == "completed" else 0,
        "conversionStatus": conversion_job.status if conversion_job else None,
        "conversionProgress": conversion_job.progress if conversion_job else None,
        "errorMessage": file_upload.error_message or (conversion_job.error_message if conversion_job else None),
        "currentStep": step_label,
        "currentStepCode": step_code,
    }
    
    return JSONResponse(content=progress_dict)


@router.delete("/{file_upload_id}")
async def delete_file_upload(
    file_upload_id: UUID,
    db: Session = Depends(get_db),
):
    """Удалить файл"""
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    if not file_upload:
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    # Удаляем файл из хранилища
    try:
        storage_service.delete_file(file_upload.storage_path)
    except Exception as e:
        # Логируем ошибку, но продолжаем удаление из БД
        print(f"Ошибка удаления файла из хранилища: {e}")
    
    # Удаляем запись из БД
    db.delete(file_upload)
    db.commit()
    
    return {"message": "Файл удален"}


@router.get("/{file_upload_id}/download")
async def download_file(
    file_upload_id: UUID,
    db: Session = Depends(get_db),
):
    """Скачать файл"""
    file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
    if not file_upload:
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    try:
        # Извлекаем путь из storage_path (может быть local://path или minio://bucket/path)
        storage_path = file_upload.storage_path
        if storage_path.startswith("local://"):
            storage_path = storage_path[8:]
        elif storage_path.startswith("minio://"):
            # Извлекаем путь после minio://bucket/
            parts = storage_path.split("/", 2)
            if len(parts) > 2:
                storage_path = parts[2]
        
        # Используем поток для скачивания (более эффективно для больших файлов)
        file_stream = storage_service.get_file_stream(storage_path)
        
        return StreamingResponse(
            file_stream,
            media_type=file_upload.mime_type or "application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{file_upload.original_filename}"',
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка скачивания файла: {str(e)}")


@router.get("/{file_upload_id}/metadata", response_model=FileMetadataResponse)
async def get_file_metadata(
    file_upload_id: UUID,
    db: Session = Depends(get_db),
):
    """Получить метаданные файла"""
    file_metadata = db.query(FileMetadata).filter(FileMetadata.file_upload_id == file_upload_id).first()
    if not file_metadata:
        raise HTTPException(status_code=404, detail="Метаданные файла не найдены")
    
    return FileMetadataResponse.model_validate(file_metadata)
