"""
Обертка для использования удаленного API конвертации RVT→CSV
Используется на Linux сервере для отправки запросов на Windows сервер
"""
import httpx
import os
import asyncio
from pathlib import Path
from typing import Optional
from app.core.config import settings


class RemoteRVTConverterService:
    """Сервис для удаленной конвертации RVT→CSV через API"""
    
    def __init__(self):
        self.api_url = os.getenv("RVT_CONVERTER_API_URL", "").rstrip('/')
        if not self.api_url:
            raise ValueError("RVT_CONVERTER_API_URL не настроен")
        # Таймауты для надежного скачивания файлов
        # Для обычного GET запроса read таймаут применяется ко всему запросу
        # Увеличен до 30 минут для очень больших файлов (400+ MB)
        # Write timeout увеличен для загрузки больших RVT файлов (до 400+ MB)
        # Расчет: 400 MB при скорости 1 MB/s = 400 секунд (6.7 минут)
        # Добавляем запас: 1200 секунд (20 минут) для надежности
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(
                connect=60.0,      # 60 секунд на подключение
                read=1800.0,       # 30 минут на чтение всего ответа (для очень больших CSV файлов)
                write=1200.0,      # 20 минут на запись (для загрузки больших RVT файлов до 400+ MB)
                pool=60.0          # 60 секунд на получение соединения из пула
            )
        )
    
    async def convert_async(
        self,
        rvt_file_path: str,
        output_dir: str,
        job_id: Optional[str] = None,
        log_callback=None,
        project_id: Optional[str] = None,
        version_id: Optional[str] = None,
        user_id: Optional[str] = None,
        file_upload_id: Optional[str] = None,
        model_name: Optional[str] = None,
    ) -> dict:
        """
        Конвертировать RVT файл в CSV через удаленный API (асинхронно)
        
        Args:
            rvt_file_path: Путь к локальному RVT файлу
            output_dir: Директория для сохранения CSV
            job_id: ID задачи (опционально)
            log_callback: Функция для логирования (опционально)
            project_id: ID проекта (для обработки CSV на Windows сервере)
            version_id: ID версии проекта (для обработки CSV на Windows сервере)
            user_id: ID пользователя (для обработки CSV на Windows сервере)
            file_upload_id: ID исходного FileUpload (для обработки CSV на Windows сервере)
            model_name: Имя модели (для обработки CSV на Windows сервере)
        
        Returns:
            dict с результатом конвертации
        """
        # Логируем метаданные в начале функции
        if log_callback:
            log_callback(f"🚀 convert_async вызван с метаданными:")
            log_callback(f"  project_id={project_id}")
            log_callback(f"  version_id={version_id}")
            log_callback(f"  user_id={user_id}")
            log_callback(f"  file_upload_id={file_upload_id}")
            log_callback(f"  model_name={model_name}")
        
        rvt_path = Path(rvt_file_path)
        if not rvt_path.exists():
            return {
                "success": False,
                "error": f"RVT файл не найден: {rvt_file_path}",
            }
        
        if log_callback:
            log_callback(f"Отправка RVT файла на удаленный сервер конвертации: {self.api_url}")
        
        # Проверяем размер файла перед отправкой
        file_size = rvt_path.stat().st_size
        if log_callback:
            log_callback(f"Размер RVT файла: {file_size} байт ({file_size / 1024 / 1024:.2f} MB)")
        
        # Загружаем файл
        try:
            # Читаем файл в память для передачи через HTTP
            # Это гарантирует, что файл будет полностью прочитан перед отправкой
            if log_callback:
                log_callback(f"Чтение RVT файла в память...")
            
            with open(rvt_path, "rb") as f:
                file_content = f.read()
            
            if log_callback:
                log_callback(f"Файл прочитан: {len(file_content)} байт")
            
            # Проверяем, что файл прочитан полностью
            if len(file_content) != file_size:
                error_msg = f"Размер прочитанного файла ({len(file_content)}) не совпадает с размером на диске ({file_size})"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                return {
                    "success": False,
                    "error": error_msg,
                }
            
            # Формируем данные для multipart/form-data
            files = {"file": (rvt_path.name, file_content, "application/octet-stream")}
            data = {}
            if job_id:
                data["job_id"] = job_id
            # Передаем метаданные для обработки CSV на Windows сервере
            # Проверяем, что значения не None и не пустые строки (включая "None")
            if project_id and project_id != "None":
                data["project_id"] = project_id
            if version_id and version_id != "None":
                data["version_id"] = version_id
            if user_id and user_id != "None":
                data["user_id"] = user_id
            if file_upload_id and file_upload_id != "None":
                data["file_upload_id"] = file_upload_id
            if model_name and model_name != "None":
                data["model_name"] = model_name
            
            # Логируем данные, которые отправляем на Windows сервер
            if log_callback:
                log_callback(f"📤 Отправка данных на Windows сервер:")
                log_callback(f"  data={data}")
                log_callback(f"  files keys={list(files.keys())}")
            
            if log_callback:
                file_size_mb = len(file_content) / 1024 / 1024
                estimated_upload_time = (len(file_content) / 1024 / 1024) * 1.5  # Примерно 1.5 сек на МБ
                log_callback(f"Отправка файла на сервер конвертации: {self.api_url}/convert")
                log_callback(f"Имя файла: {rvt_path.name}, размер: {len(file_content)} байт ({file_size_mb:.2f} MB)")
                log_callback(f"Таймауты: connect=60s, write=1200s (20 мин), read=1800s (30 мин)")
                log_callback(f"Ожидаемое время загрузки: ~{estimated_upload_time:.1f} секунд")
            
            # Используем endpoint /convert (FastAPI endpoint)
            # После исправления файл сохраняется ДО проверки экспортера
            import time
            upload_start_time = time.time()
            try:
                if log_callback:
                    log_callback(f"Начинаем POST запрос к {self.api_url}/convert...")
                
                response = await self.client.post(
                    f"{self.api_url}/convert",
                    files=files,
                    data=data,
                )
                
                upload_duration = time.time() - upload_start_time
                if log_callback:
                    log_callback(f"Файл отправлен за {upload_duration:.2f} секунд")
                    log_callback(f"Ответ от сервера получен: статус {response.status_code}")
            except httpx.ConnectError as e:
                upload_duration = time.time() - upload_start_time
                error_msg = f"Ошибка подключения к серверу (запрос длился {upload_duration:.2f} сек): {type(e).__name__}: {str(e)}"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                    log_callback(f"Не удалось подключиться к {self.api_url}. Проверьте, что сервис конвертера запущен и доступен.", level="ERROR")
                raise httpx.ConnectError(error_msg, request=e.request) from e
            except httpx.ConnectTimeout as e:
                upload_duration = time.time() - upload_start_time
                error_msg = f"Таймаут подключения (запрос длился {upload_duration:.2f} сек, превышен лимит 60 сек): {type(e).__name__}: {str(e)}"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                    log_callback(f"Сервер {self.api_url} не отвечает в течение 60 секунд. Проверьте доступность сервера.", level="ERROR")
                raise httpx.ConnectTimeout(error_msg, request=e.request) from e
            except httpx.WriteTimeout as e:
                upload_duration = time.time() - upload_start_time
                error_msg = f"Таймаут записи (запрос длился {upload_duration:.2f} сек, превышен лимит 1200 сек / 20 минут): {type(e).__name__}: {str(e)}"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                    log_callback(f"Загрузка файла на сервер {self.api_url} заняла слишком много времени. Файл слишком большой или сеть медленная. Для файлов >400 MB может потребоваться больше времени.", level="ERROR")
                raise httpx.WriteTimeout(error_msg, request=e.request) from e
            except Exception as e:
                upload_duration = time.time() - upload_start_time
                error_type = type(e).__name__
                error_str = str(e) if str(e) else 'Пустое сообщение об ошибке'
                error_msg = f"Ошибка при отправке файла (запрос длился {upload_duration:.2f} сек): {error_type}: {error_str}"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                    import traceback
                    log_callback(f"Traceback: {traceback.format_exc()[:1000]}", level="ERROR")
                raise
            
            if log_callback:
                log_callback(f"Ответ от сервера получен: статус {response.status_code}")
            
            response.raise_for_status()
            
            # Парсим JSON ответ
            try:
                result = response.json()
            except Exception as e:
                error_msg = f"Ошибка парсинга JSON ответа от сервера: {str(e)}"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                    log_callback(f"Содержимое ответа: {response.text[:500]}", level="ERROR")
                return {
                    "success": False,
                    "error": error_msg,
                }
            
            # Проверяем, что result не None и является словарем
            if result is None:
                error_msg = "Сервер вернул пустой ответ"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                return {
                    "success": False,
                    "error": error_msg,
                }
            
            if not isinstance(result, dict):
                error_msg = f"Сервер вернул неожиданный формат ответа: {type(result)}"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                    log_callback(f"Содержимое ответа: {result}", level="ERROR")
                return {
                    "success": False,
                    "error": error_msg,
                }
            
            if log_callback:
                log_callback(f"Результат конвертации: success={result.get('success')}, job_id={result.get('job_id')}")
                log_callback(f"Полный ответ от Windows сервера: {result}")
                log_callback(f"Метаданные в функции: project_id={project_id}, version_id={version_id}, user_id={user_id}, file_upload_id={file_upload_id}")
            
            # КРИТИЧЕСКИ ВАЖНО: Проверяем метаданные ДО проверки success
            # Если метаданные переданы, CSV обработан на Windows сервере
            metadata_provided = bool(project_id and version_id and user_id and file_upload_id)
            
            if log_callback:
                log_callback(f"🔍 ПРОВЕРКА МЕТАДАННЫХ: metadata_provided={metadata_provided}")
                log_callback(f"  project_id={project_id} (bool={bool(project_id)})")
                log_callback(f"  version_id={version_id} (bool={bool(version_id)})")
                log_callback(f"  user_id={user_id} (bool={bool(user_id)})")
                log_callback(f"  file_upload_id={file_upload_id} (bool={bool(file_upload_id)})")
            
            if not result.get("success"):
                error = result.get("error", "Неизвестная ошибка")
                if log_callback:
                    log_callback(f"Ошибка конвертации: {error}", level="ERROR")
                # Даже при ошибке файл должен быть сохранен (после исправления)
                # Проверяем, есть ли информация о сохраненном файле
                if "файл сохранен" in error.lower() or "file_path" in result:
                    if log_callback:
                        log_callback(f"Файл сохранен на сервере, но конвертация не выполнена", level="WARNING")
                    return {
                        "success": True,  # Файл сохранен
                        "job_id": result.get("job_id"),
                        "file_path": result.get("file_path", ""),
                        "message": "Файл сохранен, но конвертация не выполнена",
                        "error": error
                    }
                return {
                    "success": False,
                    "error": error,
                }
            
            # Если метаданные переданы, CSV обработан на Windows сервере (или должна была быть попытка)
            # В этом случае НЕ скачиваем CSV файл
            # metadata_provided уже проверен выше
            if metadata_provided:
                rows_loaded = result.get("rows_loaded") or 0
                total_parts = result.get("total_parts") or 0
                if log_callback:
                    log_callback(f"✅ Метаданные переданы - CSV обработан на Windows сервере, не скачиваем файл")
                    log_callback(f"Результат: rows_loaded={rows_loaded}, total_parts={total_parts}")
                
                # Возвращаем результат без скачивания CSV
                return {
                    "success": True,
                    "job_id": result["job_id"],
                    "output_path": None,  # CSV не скачивается, обработан на Windows сервере
                    "rows_loaded": rows_loaded or 0,
                    "total_parts": total_parts or 0,
                    "processed_on_windows": True,
                }
            
            # Если метаданные не переданы, скачиваем CSV файл (старое поведение для совместимости)
            if log_callback:
                log_callback(f"Конвертация завершена, скачивание CSV файла...")
            
            # Скачиваем CSV файл (всегда, не только если есть log_callback)
            job_id = result["job_id"]
            if log_callback:
                log_callback(f"Скачивание CSV файла для job_id: {job_id}")
            
            # Единое решение для всех файлов: обычный GET запрос без stream
            # Это надежнее и быстрее, чем потоковое чтение, которое может зависать
            if log_callback:
                log_callback(f"Выполняем GET запрос: {self.api_url}/download/{job_id}")
            
            import time
            import asyncio
            request_start_time = time.time()
            
            # Обычный GET запрос - httpx автоматически читает весь контент
            # Используем asyncio.wait_for для дополнительной защиты от зависаний
            try:
                if log_callback:
                    log_callback(f"Начинаем скачивание CSV файла (таймаут: 15 минут)...")
                
                # Выполняем запрос с дополнительным таймаутом через asyncio
                # Таймаут asyncio должен быть больше, чем таймаут httpx, чтобы httpx успел обработать ошибку
                csv_response = await asyncio.wait_for(
                    self.client.get(f"{self.api_url}/download/{job_id}"),
                    timeout=1920.0  # 32 минуты максимальное время ожидания (больше чем httpx read timeout 30 мин)
                )
                
                request_duration = time.time() - request_start_time
                if log_callback:
                    log_callback(f"GET запрос выполнен за {request_duration:.2f} секунд, статус: {csv_response.status_code}")
                
                csv_response.raise_for_status()
                
                if log_callback:
                    log_callback(f"Статус ответа проверен успешно")
            except asyncio.TimeoutError:
                request_duration = time.time() - request_start_time
                error_msg = f"Таймаут asyncio при скачивании CSV файла (запрос длился {request_duration:.2f} сек, превышен лимит 32 минуты)"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                raise TimeoutError(error_msg)
            except httpx.ReadTimeout as e:
                request_duration = time.time() - request_start_time
                error_msg = f"Таймаут чтения HTTP при скачивании CSV файла (запрос длился {request_duration:.2f} сек, превышен лимит 30 минут): {type(e).__name__}: {str(e)}"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                raise TimeoutError(error_msg)
            except httpx.ConnectTimeout as e:
                request_duration = time.time() - request_start_time
                error_msg = f"Таймаут подключения HTTP при скачивании CSV файла (запрос длился {request_duration:.2f} сек): {type(e).__name__}: {str(e)}"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                raise TimeoutError(error_msg)
            except httpx.TimeoutException as e:
                request_duration = time.time() - request_start_time
                error_msg = f"Таймаут HTTP при скачивании CSV файла (запрос длился {request_duration:.2f} сек): {type(e).__name__}: {str(e)}"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                raise TimeoutError(error_msg)
            except Exception as e:
                request_duration = time.time() - request_start_time
                error_type = type(e).__name__
                error_msg = f"Ошибка при скачивании CSV файла (запрос длился {request_duration:.2f} сек): {error_type}: {str(e)}"
                if log_callback:
                    log_callback(error_msg, level="ERROR")
                    import traceback
                    log_callback(f"Traceback: {traceback.format_exc()[:1000]}", level="ERROR")
                raise
            
            # Получаем размер файла из заголовков или из контента
            content_length = csv_response.headers.get("content-length")
            file_size_bytes = int(content_length) if content_length else len(csv_response.content)
            
            if log_callback:
                size_mb = file_size_bytes / 1024 / 1024
                log_callback(f"Размер CSV файла: {size_mb:.2f} MB")
                log_callback(f"Файл получен, сохраняем на диск...")
            
            # Сохраняем CSV файл
            output_dir_path = Path(output_dir)
            output_dir_path.mkdir(parents=True, exist_ok=True)
            csv_path = output_dir_path / f"{rvt_path.stem}.csv"
            
            with open(csv_path, "wb") as csv_file:
                csv_file.write(csv_response.content)
            
            if log_callback:
                file_size = csv_path.stat().st_size
                log_callback(f"CSV файл сохранен: {csv_path} ({file_size / 1024 / 1024:.2f} MB)")
            
            return {
                "success": True,
                "output_path": str(csv_path),
            }
        
        except httpx.HTTPStatusError as e:
            error_msg = f"Ошибка HTTP запроса (статус {e.response.status_code}): {str(e)}"
            if log_callback:
                log_callback(error_msg, level="ERROR")
                try:
                    error_detail = e.response.text
                    log_callback(f"Детали ошибки от сервера: {error_detail[:500]}", level="ERROR")
                except:
                    pass
            return {
                "success": False,
                "error": error_msg,
            }
        except httpx.HTTPError as e:
            error_type = type(e).__name__
            error_str = str(e) if str(e) else 'Пустое сообщение об ошибке'
            error_msg = f"Ошибка HTTP запроса ({error_type}): {error_str}"
            if log_callback:
                log_callback(error_msg, level="ERROR")
                # Дополнительная информация для диагностики
                if hasattr(e, 'request'):
                    log_callback(f"URL запроса: {e.request.url if e.request else 'N/A'}", level="ERROR")
                if hasattr(e, 'response'):
                    log_callback(f"Статус ответа: {e.response.status_code if e.response else 'N/A'}", level="ERROR")
                # Дополнительная информация об ошибке подключения
                if isinstance(e, (httpx.ConnectError, httpx.ConnectTimeout)):
                    log_callback(f"Не удалось подключиться к серверу: {self.api_url}", level="ERROR")
                    log_callback(f"Проверьте, что сервис конвертера запущен и доступен", level="ERROR")
            return {
                "success": False,
                "error": error_msg,
            }
        except Exception as e:
            import traceback
            error_msg = f"Ошибка конвертации: {str(e)}"
            error_trace = traceback.format_exc()
            if log_callback:
                log_callback(error_msg, level="ERROR")
                log_callback(f"Traceback: {error_trace[:1000]}", level="ERROR")
            return {
                "success": False,
                "error": error_msg,
            }
    
    def convert(
        self,
        rvt_file_path: str,
        output_dir: str,
        job_id: Optional[str] = None,
        log_callback=None,
        project_id: Optional[str] = None,
        version_id: Optional[str] = None,
        user_id: Optional[str] = None,
        file_upload_id: Optional[str] = None,
        model_name: Optional[str] = None,
    ) -> dict:
        """
        Конвертировать RVT файл в CSV через удаленный API (синхронная обертка)
        
        Args:
            rvt_file_path: Путь к локальному RVT файлу
            output_dir: Директория для сохранения CSV
            job_id: ID задачи (опционально)
            log_callback: Функция для логирования (опционально)
            project_id: ID проекта (для обработки CSV на Windows сервере)
            version_id: ID версии проекта (для обработки CSV на Windows сервере)
            user_id: ID пользователя (для обработки CSV на Windows сервере)
            file_upload_id: ID исходного FileUpload (для обработки CSV на Windows сервере)
            model_name: Имя модели (для обработки CSV на Windows сервере)
        
        Returns:
            dict с результатом конвертации
        """
        # Логируем метаданные в синхронном методе
        if log_callback:
            log_callback(f"🔵 [RemoteRVTConverter] convert вызван с метаданными:")
            log_callback(f"  project_id={project_id}")
            log_callback(f"  version_id={version_id}")
            log_callback(f"  user_id={user_id}")
            log_callback(f"  file_upload_id={file_upload_id}")
            log_callback(f"  model_name={model_name}")
        
        # Запускаем асинхронную функцию в event loop
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        return loop.run_until_complete(
            self.convert_async(
                rvt_file_path, 
                output_dir, 
                job_id, 
                log_callback,
                project_id=project_id,
                version_id=version_id,
                user_id=user_id,
                file_upload_id=file_upload_id,
                model_name=model_name,
            )
        )
    
    async def health_check(self) -> dict:
        """Проверить доступность API"""
        try:
            response = await self.client.get(f"{self.api_url}/health")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
            }
    
    async def check_status(self) -> dict:
        """
        Проверить статус занятости Windows сервера
        
        Returns:
            dict с информацией о пуле слотов:
            {
                "busy": bool,  # Занят ли сервер полностью (нет свободных слотов)
                "available_slots": int,  # Количество свободных слотов
                "total_slots": int,  # Общее количество слотов
                "active_conversions": [  # Список активных конвертаций
                    {
                        "slot_id": int,
                        "job_id": str,
                        "started_at": str,
                        "file_upload_id": str,
                    }
                ],
                # Обратная совместимость:
                "job_id": str | None,
                "started_at": str | None,
                "file_upload_id": str | None,
            }
        """
        try:
            response = await self.client.get(f"{self.api_url}/status")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            # Если не удалось получить статус, считаем сервер недоступным
            return {
                "busy": True,  # Безопаснее считать занятым, если не можем проверить
                "available_slots": 0,
                "total_slots": 1,
                "error": str(e),
            }
    
    async def is_busy(self) -> bool:
        """
        Проверить, занят ли Windows сервер (нет свободных слотов)
        
        Returns:
            True если сервер занят (нет свободных слотов), False если есть свободные слоты
        """
        status = await self.check_status()
        return status.get("busy", True)  # По умолчанию считаем занятым, если не можем проверить
    
    async def get_available_slots(self) -> int:
        """
        Получить количество свободных слотов
        
        Returns:
            Количество свободных слотов (0 если все заняты или ошибка)
        """
        status = await self.check_status()
        return status.get("available_slots", 0)
    
    async def close(self):
        """Закрыть клиент"""
        await self.client.aclose()

