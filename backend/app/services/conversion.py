"""
Сервис для конвертации файлов (RVT→CSV, IFC→CSV, RVT→IFC)
"""
import asyncio
import os
import tempfile
import shutil
from pathlib import Path
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional, List
from datetime import datetime

from app.models.upload import ConversionJob, FileUpload, ConversionLog
from app.services.rvt_to_ifc import RVT2IFCService
from app.services.ifc_to_csv import IFC2CSVService
from app.services.rvt_csv_exporter import RVTCSVExporterService
from app.services.csv_transformer import CSVWideToLongTransformer
from app.services.csv_chunker import CSVChunkerService
from app.services.csv_loader import CSVLoaderService
from app.core.storage import storage_service


class ConversionService:
    """Сервис управления конвертацией"""
    
    def __init__(self):
        self.rvt_to_ifc = RVT2IFCService()
        self.ifc_to_csv = IFC2CSVService()
        # Не создаем экземпляр здесь, создаем при каждом использовании для динамической проверки переменных
        self._rvt_csv_exporter = None
        self.csv_transformer = CSVWideToLongTransformer()
    
    @property
    def rvt_csv_exporter(self):
        """Получить экземпляр RVTCSVExporterService (создается при каждом обращении для динамической проверки переменных)"""
        # Создаем новый экземпляр при каждом обращении для гарантии свежей проверки переменных
        return RVTCSVExporterService()
    
    async def start_conversion(
        self,
        db: Session,
        file_upload_id: UUID,
        conversion_type: str,
        user_id: UUID,
        export_settings_id: Optional[UUID] = None,
    ) -> ConversionJob:
        """
        Начать конвертацию файла
        
        Args:
            db: Сессия БД
            file_upload_id: ID загруженного файла
            conversion_type: Тип конвертации (RVT_TO_IFC, IFC_TO_CSV, RVT_TO_CSV)
            user_id: ID пользователя
            export_settings_id: ID настроек экспорта
            
        Returns:
            Созданная задача конвертации
        """
        # Получаем файл
        file_upload = db.query(FileUpload).filter(FileUpload.id == file_upload_id).first()
        if not file_upload:
            raise ValueError("Файл не найден")
        
        # Для RVT_TO_CSV проверяем, занят ли Windows сервер
        should_queue = False
        if conversion_type == "RVT_TO_CSV":
            try:
                exporter = self.rvt_csv_exporter
                if exporter.use_remote and exporter.remote_service:
                    is_busy = await exporter.remote_service.is_busy()
                    if is_busy:
                        should_queue = True
                        self._log_conversion(
                            db,
                            ConversionJob(file_upload_id=file_upload_id, user_id=user_id, conversion_type=conversion_type),
                            "Windows сервер занят, задача поставлена в очередь",
                            level="INFO",
                        )
            except Exception as e:
                # Если не удалось проверить статус, считаем сервер занятым (безопаснее)
                should_queue = True
                print(f"⚠️ [ConversionService] Не удалось проверить статус Windows сервера: {e}, ставим в очередь")
        
        # Создаем задачу конвертации
        initial_status = "queued" if should_queue else "pending"
        job = ConversionJob(
            file_upload_id=file_upload_id,
            user_id=user_id,
            conversion_type=conversion_type,
            status=initial_status,
            progress=0,
            input_file_id=file_upload_id,
            export_settings_id=export_settings_id,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        
        # Если задача в очереди, не запускаем сразу
        if should_queue:
            self._log_conversion(
                db,
                job,
                f"Задача поставлена в очередь. Текущий статус Windows сервера: занят",
                level="INFO",
            )
            return job
        
        # Запускаем конвертацию асинхронно
        if conversion_type == "RVT_TO_CSV":
            await self._convert_rvt_to_csv(db, job, file_upload, export_settings_id)
        elif conversion_type == "RVT_TO_IFC":
            await self._convert_rvt_to_ifc(db, job, file_upload, export_settings_id)
        elif conversion_type == "IFC_TO_CSV":
            await self._convert_ifc_to_csv(db, job, file_upload)
        
        return job
    
    def _log_conversion(
        self,
        db: Session,
        job: ConversionJob,
        message: str,
        level: str = "INFO",
        metadata: Optional[dict] = None,
    ):
        """Сохранить лог операции конвертации"""
        try:
            log = ConversionLog(
                conversion_job_id=job.id,
                log_level=level,
                message=message,
                log_metadata=metadata,
            )
            db.add(log)
            db.commit()
        except Exception:
            db.rollback()
            raise
    
    def _update_job_progress(
        self,
        db: Session,
        job: ConversionJob,
        progress: Optional[int] = None,
        status: Optional[str] = None,
    ):
        """Обновить прогресс и статус задачи"""
        changed = False
        if progress is not None and job.progress != progress:
            job.progress = progress
            changed = True
        if status and job.status != status:
            job.status = status
            changed = True
        if changed:
            db.commit()
    
    async def _convert_rvt_to_csv(
        self,
        db: Session,
        job: ConversionJob,
        file_upload: FileUpload,
        export_settings_id: Optional[UUID] = None,
    ):
        """Конвертировать RVT напрямую в CSV с помощью RvtExporterCfg1.exe."""
        tmp_dir = None
        try:
            job.status = "processing"
            job.progress = 5
            job.started_at = datetime.utcnow()
            db.commit()
            self._log_conversion(db, job, "Запущена конвертация RVT→CSV (RvtExporterCfg1.exe)")

            if export_settings_id:
                self._log_conversion(
                    db,
                    job,
                    "Переданы настройки экспорта, но прямой RVT→CSV использует профиль по умолчанию",
                    metadata={"exportSettingsId": str(export_settings_id)},
                )

            tmp_dir = tempfile.mkdtemp()
            local_rvt_name = Path(file_upload.original_filename or f"{job.id}.rvt").name
            local_rvt_path = os.path.join(tmp_dir, local_rvt_name)

            storage_path = file_upload.storage_path
            if storage_path.startswith("local://"):
                storage_path = storage_path[8:]

            if storage_service._use_local_storage:
                source_path = os.path.join(storage_service._local_storage_path, storage_path)
                if not os.path.exists(source_path):
                    raise FileNotFoundError(f"RVT файл не найден в локальном хранилище: {source_path}")
                shutil.copy2(source_path, local_rvt_path)
            else:
                storage_service.download_file(storage_path, local_rvt_path)

            job.progress = 20
            db.commit()
            # Проверяем файл перед передачей экспортёру
            file_size = os.path.getsize(local_rvt_path) if os.path.exists(local_rvt_path) else 0
            self._log_conversion(
                db,
                job,
                "RVT файл подготовлен для экспортера",
                metadata={
                    "localPath": local_rvt_path,
                    "fileSize": file_size,
                    "fileSizeMB": round(file_size / 1024 / 1024, 2) if file_size > 0 else 0,
                    "exists": os.path.exists(local_rvt_path),
                    "readable": os.access(local_rvt_path, os.R_OK) if os.path.exists(local_rvt_path) else False,
                },
            )

            # Логируем перед запуском экспортёра
            self._log_conversion(
                db,
                job,
                "Запускаем экспортёр RvtExporterCfg1.exe",
                metadata={
                    "rvtFilePath": local_rvt_path,
                    "outputDir": tmp_dir,
                    "rvtFileSize": os.path.getsize(local_rvt_path) if os.path.exists(local_rvt_path) else 0,
                },
            )
            
            try:
                print(f"🔵 [ConversionService] Вызываем экспортёр с параметрами:")
                print(f"   rvt_file_path: {local_rvt_path}")
                print(f"   output_dir: {tmp_dir}")
                # Создаем callback для логирования из экспортёра
                def log_from_exporter(message: str, level: str = "INFO", metadata: dict = None):
                    self._log_conversion(db, job, message, level=level, metadata=metadata)
                
                # Проверяем, что метаданные не None перед передачей
                # Если None, передаем None (не строку "None"), чтобы они не были добавлены в запрос
                project_id = str(file_upload.project_id) if file_upload.project_id is not None else None
                version_id = str(file_upload.version_id) if file_upload.version_id is not None else None
                user_id = str(file_upload.user_id) if file_upload.user_id is not None else None
                file_upload_id = str(file_upload.id) if file_upload.id is not None else None
                
                exporter_result = await asyncio.to_thread(
                    self.rvt_csv_exporter.convert,
                    rvt_file_path=local_rvt_path,
                    output_dir=tmp_dir,
                    log_callback=log_from_exporter,
                    project_id=project_id,
                    version_id=version_id,
                    user_id=user_id,
                    file_upload_id=file_upload_id,
                    model_name=Path(file_upload.original_filename or "").stem or Path(local_rvt_path).stem,
                )
                
                # Проверяем, что exporter_result не None
                if exporter_result is None:
                    raise Exception("Экспортёр вернул None вместо результата")
                
                print(f"✅ [ConversionService] Экспортёр вернул результат:")
                print(f"   success: {exporter_result.get('success')}")
                print(f"   returncode: {exporter_result.get('returncode')}")
                print(f"   error: {exporter_result.get('error')}")
                print(f"   stdout length: {len(exporter_result.get('stdout', ''))}")
                print(f"   stderr length: {len(exporter_result.get('stderr', ''))}")
            except Exception as e:
                import traceback
                error_trace = traceback.format_exc()
                print(f"❌ [ConversionService] Исключение при вызове экспортёра: {e}")
                print(f"   Traceback: {error_trace}")
                raise
            
            # Логируем результат экспортёра и stdout/stderr ПЕРЕД проверкой success
            # Это важно, чтобы логи сохранились даже при ошибке
            stdout = exporter_result.get("stdout", "")
            stderr = exporter_result.get("stderr", "")
            command = exporter_result.get("command", "")
            returncode = exporter_result.get("returncode", 0)
            success = exporter_result.get("success", False)
            
            self._log_conversion(
                db,
                job,
                "Экспортёр завершил работу",
                metadata={
                    "success": success,
                    "returncode": returncode,
                    "hasOutputPath": bool(exporter_result.get("output_path")),
                    "outputPath": exporter_result.get("output_path"),
                    "error": exporter_result.get("error"),
                    "stdoutLength": len(stdout),
                    "stderrLength": len(stderr),
                    "command": command[:500] if command else "",  # Ограничиваем длину команды
                },
            )
            
            # Логируем stdout/stderr экспортёра для диагностики (даже при ошибке)
            if stdout:
                # Логируем полный stdout (может быть длинным, но важно для диагностики)
                # Разбиваем на части, если слишком длинный
                max_length = 5000
                if len(stdout) > max_length:
                    # Логируем первые и последние части
                    stdout_start = stdout[:max_length]
                    stdout_end = stdout[-max_length:]
                    self._log_conversion(
                        db,
                        job,
                        "Экспортёр stdout (начало)",
                        metadata={
                            "stdout": stdout_start,
                            "fullLength": len(stdout),
                            "part": "start",
                        },
                    )
                    self._log_conversion(
                        db,
                        job,
                        "Экспортёр stdout (конец)",
                        metadata={
                            "stdout": stdout_end,
                            "fullLength": len(stdout),
                            "part": "end",
                        },
                    )
                else:
                    self._log_conversion(
                        db,
                        job,
                        "Экспортёр stdout",
                        metadata={
                            "stdout": stdout,
                            "fullLength": len(stdout),
                        },
                    )
            if stderr:
                # Логируем полный stderr
                max_length = 5000
                if len(stderr) > max_length:
                    stderr_start = stderr[:max_length]
                    stderr_end = stderr[-max_length:]
                    self._log_conversion(
                        db,
                        job,
                        "Экспортёр stderr (начало)",
                        metadata={
                            "stderr": stderr_start,
                            "fullLength": len(stderr),
                            "part": "start",
                        },
                    )
                    self._log_conversion(
                        db,
                        job,
                        "Экспортёр stderr (конец)",
                        metadata={
                            "stderr": stderr_end,
                            "fullLength": len(stderr),
                            "part": "end",
                        },
                    )
                else:
                    self._log_conversion(
                        db,
                        job,
                        "Экспортёр stderr",
                        metadata={
                            "stderr": stderr,
                            "fullLength": len(stderr),
                        },
                    )
            
            # Проверяем success ПОСЛЕ логирования stdout/stderr
            if not success:
                # Конвертация не завершилась успешно - не копируем CSV и не удаляем временную директорию
                # Временная директория останется для диагностики
                raise Exception(exporter_result.get("error", "Экспорт RVT→CSV завершился с ошибкой"))

            # Проверяем, обработан ли CSV на Windows сервере
            processed_on_windows = exporter_result.get("processed_on_windows", False)
            
            # Если CSV обработан на Windows сервере, пропускаем проверку stdout
            if not processed_on_windows:
                # Проверяем, что есть "Successfully exported" в stdout
                # НО: при удаленной конвертации stdout будет пустым, поэтому проверяем только для локальной конвертации
                stdout = exporter_result.get("stdout", "")
                is_remote_conversion = not stdout and success and exporter_result.get("output_path")
                
                if not is_remote_conversion:
                    # Для локальной конвертации проверяем наличие "Successfully exported" в stdout
                    has_success = "successfully exported" in stdout.lower() if stdout else False
                    if not has_success:
                        # Нет "Successfully exported" - это ошибка, даже если success=True
                        raise Exception("Экспорт не завершился успешно: нет 'Successfully exported' в логах")
            
            if processed_on_windows:
                # CSV уже обработан и загружен в БД на Windows сервере
                # Не нужно обрабатывать CSV на Linux сервере
                rows_loaded = exporter_result.get("rows_loaded", 0)
                total_parts = exporter_result.get("total_parts", 0)
                
                self._log_conversion(
                    db,
                    job,
                    "CSV обработан и загружен в БД на Windows сервере",
                    metadata={
                        "rows_loaded": rows_loaded,
                        "total_parts": total_parts,
                    },
                )
                
                # Финализируем задачу
                job.status = "completed"
                job.progress = 100
                job.completed_at = datetime.utcnow()
                if job.started_at:
                    started = job.started_at.replace(tzinfo=None) if job.started_at.tzinfo else job.started_at
                    completed = job.completed_at.replace(tzinfo=None) if job.completed_at.tzinfo else job.completed_at
                    job.duration_seconds = int((completed - started).total_seconds())
                db.commit()
                self._log_conversion(
                    db,
                    job,
                    "Конвертация завершена",
                    metadata={"rows_loaded": rows_loaded, "total_parts": total_parts},
                )
                return  # Завершаем выполнение, CSV уже обработан
            
            # CSV не обработан на Windows сервере - обрабатываем на Linux сервере (старое поведение)
            # Получаем путь к CSV файлу (это исходный путь, не скопированный)
            raw_csv_source_path = exporter_result.get("output_path")
            
            # Копируем CSV из исходной директории в tmp_dir только после успешного завершения
            if not raw_csv_source_path or not os.path.exists(raw_csv_source_path):
                raise FileNotFoundError(f"CSV файл не найден после успешного экспорта: {raw_csv_source_path}")
            
            # Проверяем, находится ли файл уже в tmp_dir (для удаленной конвертации)
            raw_csv_source_path_normalized = os.path.normpath(raw_csv_source_path)
            tmp_dir_normalized = os.path.normpath(tmp_dir)
            
            if raw_csv_source_path_normalized.startswith(tmp_dir_normalized):
                # Файл уже находится в tmp_dir (удаленная конвертация), не копируем
                raw_csv_path = raw_csv_source_path
                self._log_conversion(
                    db,
                    job,
                    "CSV файл уже находится в временной директории (удаленная конвертация)",
                    metadata={
                        "csvPath": raw_csv_path,
                        "tmpDir": tmp_dir,
                        "sourceExists": os.path.exists(raw_csv_source_path),
                    },
                )
            else:
                # Файл находится в другой директории (локальная конвертация), копируем
                csv_filename = Path(raw_csv_source_path).name
                raw_csv_path = os.path.join(tmp_dir, csv_filename)
                
                self._log_conversion(
                    db,
                    job,
                    "Копируем CSV файл из исходной директории",
                    metadata={
                        "sourcePath": raw_csv_source_path,
                        "destinationPath": raw_csv_path,
                        "sourceExists": os.path.exists(raw_csv_source_path),
                    },
                )
                
                shutil.copy2(raw_csv_source_path, raw_csv_path)
            
            # Проверяем, что файл скопировался
            if not os.path.exists(raw_csv_path):
                raise FileNotFoundError(f"CSV файл не был скопирован: {raw_csv_path}")
            
            self._log_conversion(
                db,
                job,
                "CSV файл успешно скопирован",
                metadata={
                    "csvPath": raw_csv_path,
                    "csvSize": os.path.getsize(raw_csv_path),
                },
            )
            
            # Проверяем размер CSV файла
            csv_size = 0
            csv_lines = 0
            if raw_csv_path and os.path.exists(raw_csv_path):
                csv_size = os.path.getsize(raw_csv_path)
                try:
                    with open(raw_csv_path, 'r', encoding='utf-8-sig') as f:
                        csv_lines = sum(1 for _ in f)
                except Exception:
                    pass
            
            job.progress = 45
            db.commit()
            self._log_conversion(
                db,
                job,
                "RvtExporterCfg1.exe завершил работу",
                metadata={
                    "csvPath": raw_csv_path,
                    "csvSize": csv_size,
                    "csvLines": csv_lines,
                },
            )

            # Сохраняем исходный CSV файл от экспортёра в хранилище
            if raw_csv_path and os.path.exists(raw_csv_path):
                try:
                    from app.utils.storage import build_storage_path, extract_names_from_storage_path
                    
                    model_stem = Path(file_upload.original_filename or "").stem or Path(local_rvt_path).stem
                    raw_csv_filename = f"{model_stem}_raw.csv"
                    
                    storage_path = file_upload.storage_path
                    project_name, version_name = extract_names_from_storage_path(storage_path)
                    
                    self._log_conversion(
                        db,
                        job,
                        "Начинаем сохранение исходного CSV файла",
                        metadata={
                            "rawCsvSourcePath": raw_csv_path,
                            "rawCsvFilename": raw_csv_filename,
                            "projectName": project_name,
                            "versionName": version_name,
                            "csvSize": csv_size,
                        },
                    )
                    
                    raw_csv_object_name = build_storage_path(
                        project_id=file_upload.project_id,
                        version_id=file_upload.version_id,
                        filename=raw_csv_filename,
                        project_name=project_name,
                        version_name=version_name,
                        use_original_filename=True,
                    )
                    
                    self._log_conversion(
                        db,
                        job,
                        "Путь для сохранения исходного CSV сформирован",
                        metadata={
                            "rawCsvObjectName": raw_csv_object_name,
                        },
                    )
                    
                    storage_path_result = storage_service.upload_file(
                        raw_csv_path,
                        raw_csv_object_name,
                        content_type="text/csv",
                    )
                    
                    # Проверяем, что файл действительно сохранился
                    if storage_service._use_local_storage:
                        # Для локального хранилища проверяем физическое существование файла
                        local_storage_path = storage_service._local_storage_path
                        # Извлекаем путь из storage_path_result (может быть local://path или просто path)
                        object_path = storage_path_result
                        if object_path.startswith("local://"):
                            object_path = object_path[8:]
                        local_file_path = os.path.join(local_storage_path, object_path)
                        
                        if not os.path.exists(local_file_path):
                            raise FileNotFoundError(
                                f"Файл не найден после сохранения: {local_file_path} "
                                f"(storage_path_result: {storage_path_result}, object_path: {object_path})"
                            )
                        actual_size = os.path.getsize(local_file_path)
                        if actual_size != csv_size:
                            self._log_conversion(
                                db,
                                job,
                                "ВНИМАНИЕ: Размер сохраненного файла не совпадает с исходным",
                                level="WARNING",
                                metadata={
                                    "expectedSize": csv_size,
                                    "actualSize": actual_size,
                                    "filePath": local_file_path,
                                },
                            )
                        else:
                            self._log_conversion(
                                db,
                                job,
                                "Файл успешно сохранен и проверен",
                                metadata={
                                    "filePath": local_file_path,
                                    "fileSize": actual_size,
                                },
                            )
                    
                    self._log_conversion(
                        db,
                        job,
                        "Исходный CSV файл загружен в хранилище",
                        metadata={
                            "storagePath": storage_path_result,
                            "objectName": raw_csv_object_name,
                        },
                    )
                    
                    raw_csv_file_upload = FileUpload(
                        user_id=file_upload.user_id,
                        project_id=file_upload.project_id,
                        version_id=file_upload.version_id,
                        original_filename=raw_csv_filename,
                        file_type="CSV",
                        file_size=csv_size,
                        mime_type="text/csv",
                        storage_path=storage_path_result,
                        storage_bucket=storage_service.bucket or "local",
                        upload_status="completed",
                    )
                    db.add(raw_csv_file_upload)
                    db.commit()
                    db.refresh(raw_csv_file_upload)
                    
                    self._log_conversion(
                        db,
                        job,
                        "Исходный CSV файл от экспортёра сохранён",
                        metadata={
                            "rawCsvFileId": str(raw_csv_file_upload.id),
                            "rawCsvPath": storage_path_result,
                            "rawCsvSize": csv_size,
                            "rawCsvObjectName": raw_csv_object_name,
                        },
                    )
                except Exception as save_error:
                    # Логируем ошибку, но не прерываем процесс конвертации
                    import traceback
                    error_trace = traceback.format_exc()
                    self._log_conversion(
                        db,
                        job,
                        f"ОШИБКА при сохранении исходного CSV файла: {str(save_error)}",
                        level="ERROR",
                        metadata={
                            "error": str(save_error),
                            "traceback": error_trace,
                            "rawCsvPath": raw_csv_path if raw_csv_path else None,
                        },
                    )
                    # Не прерываем процесс - продолжаем с нормализованным CSV
            else:
                self._log_conversion(
                    db,
                    job,
                    "Исходный CSV файл не найден для сохранения",
                    level="WARNING",
                    metadata={
                        "rawCsvPath": raw_csv_path,
                        "exists": os.path.exists(raw_csv_path) if raw_csv_path else False,
                    },
                )

            model_stem = Path(file_upload.original_filename or "").stem or Path(local_rvt_path).stem
            normalized_csv_name = f"{model_stem}_normalized.csv"
            normalized_csv_path = os.path.join(tmp_dir, normalized_csv_name)

            transform_stats = self.csv_transformer.transform(
                source_path=raw_csv_path,
                destination_path=normalized_csv_path,
                model_name=model_stem,
            )

            job.progress = 55
            db.commit()
            self._log_conversion(
                db,
                job,
                "CSV нормализован для загрузки в БД",
                metadata=transform_stats,
            )

            await self._process_csv_output(
                db=db,
                job=job,
                source_file_upload=file_upload,
                csv_file_path=normalized_csv_path,
                tmp_dir=tmp_dir,
            )
        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            if job.started_at:
                started = job.started_at.replace(tzinfo=None) if job.started_at.tzinfo else job.started_at
                completed = job.completed_at.replace(tzinfo=None) if job.completed_at.tzinfo else job.completed_at
                job.duration_seconds = int((completed - started).total_seconds())
            db.commit()
            self._log_conversion(db, job, f"Ошибка конвертации RVT→CSV: {e}", level="ERROR")
            # ВАЖНО: При ошибке НЕ удаляем временную директорию сразу
            # Она может содержать важные файлы для диагностики (CSV, RVT, логи)
            # Временная директория будет удалена позже системой очистки или вручную
            self._log_conversion(
                db,
                job,
                "Временная директория сохранена для диагностики",
                metadata={
                    "tmpDir": tmp_dir,
                    "exists": os.path.exists(tmp_dir) if tmp_dir else False,
                },
            )
            raise
        finally:
            # Удаляем временную директорию ТОЛЬКО после успешного завершения конвертации
            # Если была ошибка, директория уже не будет удалена (осталась для диагностики)
            # Проверяем, что конвертация завершилась успешно (job.status == "completed")
            if tmp_dir and os.path.exists(tmp_dir):
                # Проверяем статус задачи - удаляем только при успешном завершении
                db.refresh(job)
                if job.status == "completed":
                    try:
                        shutil.rmtree(tmp_dir, ignore_errors=True)
                        self._log_conversion(
                            db,
                            job,
                            "Временная директория удалена после успешного завершения",
                            metadata={"tmpDir": tmp_dir},
                        )
                    except Exception as cleanup_error:
                        self._log_conversion(
                            db,
                            job,
                            f"Ошибка при удалении временной директории: {cleanup_error}",
                            level="WARNING",
                            metadata={"tmpDir": tmp_dir},
                        )
                else:
                    # Конвертация не завершилась успешно - директория остается для диагностики
                    self._log_conversion(
                        db,
                        job,
                        "Временная директория сохранена (конвертация не завершилась успешно)",
                        metadata={
                            "tmpDir": tmp_dir,
                            "jobStatus": job.status,
                        },
                    )
    
    async def _convert_rvt_to_ifc(
        self,
        db: Session,
        job: ConversionJob,
        file_upload: FileUpload,
        export_settings_id: Optional[UUID],
    ):
        """Конвертировать RVT в IFC"""
        tmp_dir = None
        try:
            job.status = "processing"
            job.progress = 10
            job.started_at = datetime.utcnow()
            db.commit()
            self._log_conversion(db, job, "Начата подготовка IFC файла")
            self._log_conversion(db, job, "Начата подготовка RVT файла")
            
            # Получаем настройки экспорта
            export_settings_dict = None
            if export_settings_id:
                from app.models.upload import ExportSettings
                export_settings = db.query(ExportSettings).filter(ExportSettings.id == export_settings_id).first()
                if export_settings and export_settings.settings:
                    # settings уже JSON, используем напрямую
                    if isinstance(export_settings.settings, dict):
                        export_settings_dict = export_settings.settings
                    else:
                        import json
                        export_settings_dict = json.loads(export_settings.settings) if isinstance(export_settings.settings, str) else export_settings.settings
            
            # Создаем временную директорию
            tmp_dir = tempfile.mkdtemp()
            
            # Получаем файл из хранилища
            job.progress = 20
            db.commit()
            self._log_conversion(db, job, "Получаем исходный IFC файл")
            self._log_conversion(db, job, "Получаем исходный RVT файл")
            
            storage_path = file_upload.storage_path
            if storage_path.startswith("local://"):
                storage_path = storage_path[8:]
            
            # Путь к файлу в хранилище
            if storage_service._use_local_storage:
                local_storage_path = storage_service._local_storage_path
                rvt_file_path = os.path.join(local_storage_path, storage_path)
            else:
                # Скачиваем файл из MinIO/S3
                rvt_file_path = os.path.join(tmp_dir, file_upload.original_filename)
                storage_service.download_file(storage_path, rvt_file_path)
            
            if not os.path.exists(rvt_file_path):
                raise FileNotFoundError(f"RVT файл не найден: {rvt_file_path}")
            
            # Путь для выходного IFC файла
            ifc_filename = Path(file_upload.original_filename).with_suffix(".ifc").name
            ifc_file_path = os.path.join(tmp_dir, ifc_filename)
            
            job.progress = 30
            db.commit()
            self._log_conversion(db, job, "IFC файл готов к конвертации", metadata={"filePath": ifc_file_path})
            self._log_conversion(db, job, "RVT файл готов к конвертации", metadata={"filePath": rvt_file_path})
            
            # Запускаем конвертацию
            result = await asyncio.to_thread(
                self.rvt_to_ifc.convert,
                rvt_file_path=rvt_file_path,
                output_ifc_path=ifc_file_path,
                export_settings=export_settings_dict,
            )
            
            if not result.get("success"):
                raise Exception(result.get("error", "Конвертация RVT→IFC завершилась с ошибкой"))
            
            if not os.path.exists(ifc_file_path):
                raise FileNotFoundError("IFC файл не был создан после конвертации")
            
            job.progress = 70
            db.commit()
            self._log_conversion(db, job, "Конвертация RVT→IFC завершена, загружаем результирующий файл")
            
            # Загружаем IFC файл в хранилище
            ifc_file_size = os.path.getsize(ifc_file_path)
            
            # Извлекаем названия проекта и версии из пути исходного файла
            from app.utils.storage import extract_names_from_storage_path, sanitize_filename
            project_name, version_name = extract_names_from_storage_path(file_upload.storage_path)
            
            # Если не удалось извлечь, используем короткие ID
            if not project_name:
                project_name = f"project_{str(file_upload.project_id).replace('-', '')[:8]}"
            else:
                project_name = sanitize_filename(project_name)
            
            if not version_name:
                version_name = f"version_{str(file_upload.version_id).replace('-', '')[:8]}"
            else:
                version_name = sanitize_filename(version_name)
            
            # Создаем путь для IFC файла в папке conversions
            conversions_dir = f"projects/{project_name}/versions/{version_name}/conversions/{str(job.id)}"
            object_name = f"{conversions_dir}/{sanitize_filename(ifc_filename)}"
            
            storage_path_result = storage_service.upload_file(
                ifc_file_path,
                object_name,
                content_type="application/octet-stream",
            )
            
            job.progress = 90
            db.commit()
            
            # Создаем запись FileUpload для IFC файла
            ifc_file_upload = FileUpload(
                user_id=file_upload.user_id,
                project_id=file_upload.project_id,
                version_id=file_upload.version_id,
                original_filename=ifc_filename,
                file_type="IFC",
                file_size=ifc_file_size,
                mime_type="application/octet-stream",
                storage_path=storage_path_result,
                storage_bucket=storage_service.bucket or "local",
                upload_status="completed",
            )
            db.add(ifc_file_upload)
            db.commit()
            self._log_conversion(db, job, "IFC файл сохранен", metadata={"outputFileId": str(ifc_file_upload.id)})
            db.refresh(ifc_file_upload)
            
            # Обновляем задачу конвертации
            job.status = "completed"
            job.progress = 100
            job.output_file_id = ifc_file_upload.id
            job.completed_at = datetime.utcnow()
            if job.started_at:
                # Убеждаемся, что оба datetime имеют одинаковый тип (naive)
                started = job.started_at
                completed = job.completed_at
                if started.tzinfo is not None:
                    started = started.replace(tzinfo=None)
                if completed.tzinfo is not None:
                    completed = completed.replace(tzinfo=None)
                job.duration_seconds = int((completed - started).total_seconds())
            db.commit()
            
        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            if job.started_at:
                # Убеждаемся, что оба datetime имеют одинаковый тип (naive)
                started = job.started_at
                completed = job.completed_at
                if started.tzinfo is not None:
                    started = started.replace(tzinfo=None)
                if completed.tzinfo is not None:
                    completed = completed.replace(tzinfo=None)
                job.duration_seconds = int((completed - started).total_seconds())
            db.commit()
            self._log_conversion(db, job, f"Ошибка конвертации RVT→IFC: {e}", level="ERROR")
            raise
        finally:
            # Удаляем временную директорию
            if tmp_dir and os.path.exists(tmp_dir):
                shutil.rmtree(tmp_dir, ignore_errors=True)

    async def _process_csv_output(
        self,
        db: Session,
        job: ConversionJob,
        source_file_upload: FileUpload,
        csv_file_path: str,
        tmp_dir: str,
    ):
        """Общая постобработка CSV: разбиение, загрузка в хранилище и БД."""
        if not os.path.exists(csv_file_path):
            raise FileNotFoundError(f"CSV файл не найден: {csv_file_path}")

        csv_filename = Path(csv_file_path).name
        csv_base_name = Path(csv_filename).stem

        csv_chunker = CSVChunkerService(max_rows_per_chunk=800000)
        chunk_files, manifest = csv_chunker.split_csv_file(
            csv_file_path=csv_file_path,
            output_dir=tmp_dir,
            base_filename=csv_base_name,
        )

        job.progress = max(job.progress or 0, 60)
        db.commit()
        self._log_conversion(
            db,
            job,
            "Разбиваем CSV данные на части",
            metadata={"parts": len(chunk_files)},
        )

        from app.utils.storage import build_storage_path, extract_names_from_storage_path

        storage_path = source_file_upload.storage_path
        project_name, version_name = extract_names_from_storage_path(storage_path)

        csv_file_uploads: List[FileUpload] = []
        total_csv_size = 0

        for chunk_file_path in chunk_files:
            chunk_filename = os.path.basename(chunk_file_path)
            chunk_file_size = os.path.getsize(chunk_file_path)
            total_csv_size += chunk_file_size

            object_name = build_storage_path(
                project_id=source_file_upload.project_id,
                version_id=source_file_upload.version_id,
                filename=chunk_filename,
                project_name=project_name,
                version_name=version_name,
                use_original_filename=True,
            )

            storage_path_result = storage_service.upload_file(
                chunk_file_path,
                object_name,
                content_type="text/csv",
            )

            chunk_file_upload = FileUpload(
                user_id=source_file_upload.user_id,
                project_id=source_file_upload.project_id,
                version_id=source_file_upload.version_id,
                original_filename=chunk_filename,
                file_type="CSV",
                file_size=chunk_file_size,
                mime_type="text/csv",
                storage_path=storage_path_result,
                storage_bucket=storage_service.bucket or "local",
                upload_status="completed",
            )
            db.add(chunk_file_upload)
            csv_file_uploads.append(chunk_file_upload)

        if not csv_file_uploads:
            raise ValueError("Не удалось сформировать части CSV для загрузки")

        db.commit()
        for chunk_upload in csv_file_uploads:
            db.refresh(chunk_upload)

        self._log_conversion(
            db,
            job,
            "CSV части загружены в хранилище",
            metadata={"parts": len(csv_file_uploads), "totalSize": total_csv_size},
        )

        if manifest["total_parts"] > 1:
            manifest_filename = f"{csv_base_name}_manifest.json"
            manifest_path = os.path.join(tmp_dir, manifest_filename)
            import json

            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest, f, ensure_ascii=False, indent=2)

            manifest_object_name = build_storage_path(
                project_id=source_file_upload.project_id,
                version_id=source_file_upload.version_id,
                filename=manifest_filename,
                project_name=project_name,
                version_name=version_name,
                use_original_filename=True,
            )

            storage_service.upload_file(
                manifest_path,
                manifest_object_name,
                content_type="application/json",
            )
            self._log_conversion(
                db,
                job,
                "Manifest сохранен",
                metadata={"manifest": manifest_filename},
            )

        main_csv_file_upload = csv_file_uploads[0]

        job.progress = max(job.progress or 0, 85)
        db.commit()

        # Загружаем CSV данные в БД
        total_rows_loaded = 0
        csv_loader = CSVLoaderService()
        for chunk_file_upload, chunk_file_path in zip(csv_file_uploads, chunk_files):
            load_result = await csv_loader.load_csv_to_db(
                db=db,
                file_upload=chunk_file_upload,
                csv_file_path=chunk_file_path,
            )
            if load_result.get("success"):
                total_rows_loaded += load_result.get("rows_loaded", 0)
            else:
                self._log_conversion(
                    db,
                    job,
                    f"Ошибка загрузки CSV части {chunk_file_upload.original_filename}: {load_result.get('error')}",
                    level="ERROR",
                )

        self._log_conversion(
            db,
            job,
            "CSV данные загружены в БД",
            metadata={"rows": total_rows_loaded},
        )

        # Финализируем задачу
        job.status = "completed"
        job.progress = 100
        job.output_file_id = main_csv_file_upload.id
        job.completed_at = datetime.utcnow()
        if job.started_at:
            started = job.started_at.replace(tzinfo=None) if job.started_at.tzinfo else job.started_at
            completed = job.completed_at.replace(tzinfo=None) if job.completed_at.tzinfo else job.completed_at
            job.duration_seconds = int((completed - started).total_seconds())
        db.commit()
        self._log_conversion(
            db,
            job,
            "CSV результат сохранен",
            metadata={"outputFileId": str(main_csv_file_upload.id)},
        )
    
    async def _convert_ifc_to_csv(
        self,
        db: Session,
        job: ConversionJob,
        file_upload: FileUpload,
    ):
        """Конвертировать IFC в CSV"""
        tmp_dir = None
        try:
            job.status = "processing"
            job.progress = 10
            job.started_at = datetime.utcnow()
            db.commit()
            
            # Создаем временную директорию
            tmp_dir = tempfile.mkdtemp()
            
            # Получаем файл из хранилища
            job.progress = 20
            db.commit()
            
            storage_path = file_upload.storage_path
            if storage_path.startswith("local://"):
                storage_path = storage_path[8:]
            
            # Путь к файлу в хранилище
            if storage_service._use_local_storage:
                local_storage_path = storage_service._local_storage_path
                ifc_file_path = os.path.join(local_storage_path, storage_path)
            else:
                # Скачиваем файл из MinIO/S3
                ifc_file_path = os.path.join(tmp_dir, file_upload.original_filename)
                storage_service.download_file(storage_path, ifc_file_path)
            
            if not os.path.exists(ifc_file_path):
                raise FileNotFoundError(f"IFC файл не найден: {ifc_file_path}")
            
            # Путь для выходного CSV файла
            csv_filename = Path(file_upload.original_filename).with_suffix(".csv").name
            csv_file_path = os.path.join(tmp_dir, csv_filename)
            original_filename = file_upload.original_filename
            model_display_name = original_filename or Path(ifc_file_path).name
            
            job.progress = 30
            db.commit()
            
            # Запускаем конвертацию
            result = await asyncio.to_thread(
                self.ifc_to_csv.convert,
                ifc_file_path=ifc_file_path,
                output_csv_path=csv_file_path,
                model_name=model_display_name,
            )
            
            if not result.get("success"):
                raise Exception(result.get("error", "Конвертация IFC→CSV завершилась с ошибкой"))
            
            if not os.path.exists(csv_file_path):
                raise FileNotFoundError("CSV файл не был создан после конвертации")
            
            job.progress = 50
            db.commit()
            self._log_conversion(db, job, "Конвертация IFC→CSV завершена, выполняем постобработку")
            await self._process_csv_output(
                db=db,
                job=job,
                source_file_upload=file_upload,
                csv_file_path=csv_file_path,
                tmp_dir=tmp_dir,
            )
            
        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            if job.started_at:
                # Убеждаемся, что оба datetime имеют одинаковый тип (naive)
                started = job.started_at
                completed = job.completed_at
                if started.tzinfo is not None:
                    started = started.replace(tzinfo=None)
                if completed.tzinfo is not None:
                    completed = completed.replace(tzinfo=None)
                job.duration_seconds = int((completed - started).total_seconds())
            db.commit()
            self._log_conversion(db, job, f"Ошибка конвертации IFC→CSV: {e}", level="ERROR")
            raise
        finally:
            # Удаляем временную директорию
            if tmp_dir and os.path.exists(tmp_dir):
                shutil.rmtree(tmp_dir, ignore_errors=True)
    
    async def process_queue(self, db: Session) -> Optional[ConversionJob]:
        """
        Обработать очередь конвертаций
        
        Проверяет, есть ли задачи в очереди (status="queued") и есть ли свободные слоты на Windows сервере.
        Если оба условия выполнены, запускает задачи (до количества свободных слотов).
        
        Args:
            db: Сессия БД
            
        Returns:
            ConversionJob если задача была запущена, None если очередь пуста или нет свободных слотов
        """
        # Проверяем, есть ли задачи в очереди для RVT_TO_CSV
        queued_jobs = db.query(ConversionJob).filter(
            ConversionJob.status == "queued",
            ConversionJob.conversion_type == "RVT_TO_CSV",
        ).order_by(ConversionJob.id).all()  # Берем все задачи в очереди
        
        if not queued_jobs:
            return None
        
        # Проверяем количество свободных слотов на Windows сервере
        try:
            exporter = self.rvt_csv_exporter
            if exporter.use_remote and exporter.remote_service:
                available_slots = await exporter.remote_service.get_available_slots()
                
                if available_slots <= 0:
                    # Нет свободных слотов
                    return None
                
                # Запускаем столько задач, сколько есть свободных слотов
                jobs_to_start = min(len(queued_jobs), available_slots)
                
                started_job = None
                for i in range(jobs_to_start):
                    queued_job = queued_jobs[i]
                    
                    # Получаем файл
                    file_upload = db.query(FileUpload).filter(FileUpload.id == queued_job.file_upload_id).first()
                    if not file_upload:
                        queued_job.status = "failed"
                        queued_job.error_message = "Файл не найден"
                        db.commit()
                        continue
                    
                    # Обновляем статус задачи
                    queued_job.status = "processing"
                    queued_job.started_at = datetime.utcnow()
                    db.commit()
                    db.refresh(queued_job)
                    
                    self._log_conversion(
                        db,
                        queued_job,
                        "Задача извлечена из очереди, начинается конвертация",
                        level="INFO",
                    )
                    
                    # Запускаем конвертацию
                    # Запускаем задачи асинхронно, не ждем завершения
                    try:
                        # Используем asyncio.create_task для фонового выполнения
                        task = asyncio.create_task(
                            self._convert_rvt_to_csv(db, queued_job, file_upload, queued_job.export_settings_id)
                        )
                        # Добавляем обработку ошибок для задачи
                        def handle_task_error(task):
                            try:
                                task.result()
                            except Exception as e:
                                print(f"⚠️ [ConversionService] Ошибка в фоновой задаче конвертации job_id={queued_job.id}: {e}")
                        
                        task.add_done_callback(handle_task_error)
                        if started_job is None:
                            started_job = queued_job
                    except Exception as e:
                        print(f"⚠️ [ConversionService] Ошибка при запуске конвертации: {e}")
                        queued_job.status = "failed"
                        queued_job.error_message = str(e)
                        db.commit()
                
                return started_job
            else:
                # Локальный конвертер, не проверяем очередь
                return None
        except Exception as e:
            print(f"⚠️ [ConversionService] Ошибка при проверке статуса Windows сервера: {e}")
            return None
