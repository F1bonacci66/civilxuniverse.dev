"""
Сервис запускает RvtExporterCfg1.exe для конвертации RVT → CSV.
Поддерживает как локальный запуск (через Wine на Linux), так и удаленный API (на Windows сервере).
"""
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional, Set

from app.core.config import settings

# Импортируем RemoteRVTConverterService для возможного использования
try:
    from app.services.remote_rvt_converter import RemoteRVTConverterService
    _REMOTE_SERVICE_AVAILABLE = True
except ImportError:
    _REMOTE_SERVICE_AVAILABLE = False


class RVTCSVExporterService:
    """Обертка над внешним RvtExporterCfg1.exe или удаленным API."""

    def __init__(self):
        # Проверяем, используется ли удаленный конвертер (динамически, не при импорте)
        rvt_converter_url = os.getenv("RVT_CONVERTER_API_URL", "").strip()
        self.use_remote = bool(rvt_converter_url) and _REMOTE_SERVICE_AVAILABLE
        
        if self.use_remote:
            try:
                self.remote_service = RemoteRVTConverterService()
                print(f"🔵 [RVTCSVExporter] Используется удаленный API: {rvt_converter_url}")
            except Exception as e:
                print(f"⚠️ [RVTCSVExporter] Ошибка инициализации удаленного конвертера: {e}")
                self.use_remote = False
                self.remote_service = None
        else:
            self.remote_service = None
            if not rvt_converter_url:
                print(f"🔵 [RVTCSVExporter] RVT_CONVERTER_API_URL не установлен, используется локальный конвертер")
            self.exporter_path = Path(settings.RVT2CSV_EXPORTER_PATH).expanduser()
            self.workdir = Path(
                settings.RVT2CSV_EXPORTER_WORKDIR or self.exporter_path.parent
            ).expanduser()
            self.timeout = settings.RVT2CSV_EXPORT_TIMEOUT_SECONDS or 900
            self.wine_prefix = Path(settings.RVT2CSV_WINE_PREFIX).expanduser()
            self.is_windows = sys.platform == "win32"

    def convert(
        self, 
        rvt_file_path: str, 
        output_dir: str, 
        log_callback=None,
        project_id: Optional[str] = None,
        version_id: Optional[str] = None,
        user_id: Optional[str] = None,
        file_upload_id: Optional[str] = None,
        model_name: Optional[str] = None,
    ) -> dict:
        """
        Запустить экспорт RVT → CSV.

        Args:
            rvt_file_path: Путь к локальной копии RVT файла.
            output_dir: Директория, куда нужно скопировать результат CSV.
            log_callback: Функция для логирования (опционально).
            project_id: ID проекта (для обработки CSV на Windows сервере).
            version_id: ID версии проекта (для обработки CSV на Windows сервере).
            user_id: ID пользователя (для обработки CSV на Windows сервере).
            file_upload_id: ID исходного FileUpload (для обработки CSV на Windows сервере).
            model_name: Имя модели (для обработки CSV на Windows сервере).

        Returns:
            dict со статусом и путём к CSV файлу.
        """
        # Если используется удаленный API, делегируем ему
        if self.use_remote and self.remote_service:
            if log_callback:
                log_callback(f"🔵 [RVTCSVExporter] Передаем метаданные в remote_service.convert:")
                log_callback(f"  project_id={project_id}")
                log_callback(f"  version_id={version_id}")
                log_callback(f"  user_id={user_id}")
                log_callback(f"  file_upload_id={file_upload_id}")
                log_callback(f"  model_name={model_name}")
            return self.remote_service.convert(
                rvt_file_path, 
                output_dir, 
                log_callback=log_callback,
                project_id=project_id,
                version_id=version_id,
                user_id=user_id,
                file_upload_id=file_upload_id,
                model_name=model_name,
            )
        
        # Локальная конвертация (через Wine на Linux или нативно на Windows)
        if not self.exporter_path.exists():
            raise FileNotFoundError(
                f"Экспортер RvtExporterCfg1.exe не найден: {self.exporter_path}"
            )

        if not self.workdir.exists():
            raise FileNotFoundError(
                f"Рабочая директория экспортера не найдена: {self.workdir}"
            )

        print(f"🔵 [RVTCSVExporter] Начало конвертации")
        print(f"   rvt_file_path: {rvt_file_path}")
        print(f"   output_dir: {output_dir}")
        print(f"   exporter_path: {self.exporter_path}")
        print(f"   workdir: {self.workdir}")
        
        rvt_path = Path(rvt_file_path)
        if not rvt_path.exists():
            print(f"❌ [RVTCSVExporter] RVT файл не найден: {rvt_file_path}")
            raise FileNotFoundError(f"RVT файл не найден: {rvt_file_path}")
        
        # Проверяем доступность файла
        if not os.access(rvt_path, os.R_OK):
            print(f"❌ [RVTCSVExporter] RVT файл недоступен для чтения: {rvt_file_path}")
            raise PermissionError(f"RVT файл недоступен для чтения: {rvt_file_path}")
        
        # Логируем информацию о файле
        file_size = rvt_path.stat().st_size
        file_info = {
            "filePath": str(rvt_file_path),
            "fileSize": file_size,
            "fileSizeMB": round(file_size / 1024 / 1024, 2),
            "exists": rvt_path.exists(),
            "readable": os.access(rvt_path, os.R_OK),
            "workdir": str(self.workdir),
            "exporterPath": str(self.exporter_path),
        }
        print(f"📁 [RVTCSVExporter] RVT файл для экспорта: {rvt_file_path}")
        print(f"   Размер: {file_size} байт ({file_size / 1024 / 1024:.2f} MB)")
        print(f"   Существует: {rvt_path.exists()}")
        print(f"   Доступен для чтения: {os.access(rvt_path, os.R_OK)}")
        print(f"   Рабочая директория экспортёра: {self.workdir}")
        print(f"   Путь к экспортёру: {self.exporter_path}")

        output_dir_path = Path(output_dir)
        output_dir_path.mkdir(parents=True, exist_ok=True)
        
        # Для Wine: пробуем несколько стратегий размещения файла
        # 1. Копируем в директорию экспортёра (/opt/civilx-exporter) - экспортёр может ожидать файл там
        # 2. Если не получилось, копируем в /app/wine_work
        # 3. Также пробуем использовать исходную директорию /tmp/tmpXXXXXX/ - возможно, экспортёр лучше работает с файлами там
        original_rvt_path = rvt_path
        workdir_rvt_path = None
        exporter_dir_rvt_path = None
        copy_success = False
        if not self.is_windows:
            # Стратегия 1: Пробуем использовать исходную директорию (где файл уже есть)
            # Экспортёр может лучше работать с файлами в их исходном расположении
            if original_rvt_path.parent.exists() and os.access(original_rvt_path.parent, os.W_OK):
                print(f"📋 Стратегия 1: Используем исходную директорию для RVT файла:")
                print(f"   Исходный путь: {original_rvt_path}")
                print(f"   Директория доступна для записи: {os.access(original_rvt_path.parent, os.W_OK)}")
                # Файл уже в исходной директории, пробуем использовать его там
                if original_rvt_path.exists() and os.access(original_rvt_path, os.R_OK):
                    print(f"   ✅ Используем файл в исходной директории: {original_rvt_path}")
                    rvt_path = original_rvt_path
                    copy_success = True
            
            # Стратегия 2: Копируем в директорию экспортёра, если исходная директория не подошла
            if not copy_success:
                try:
                    # Пробуем сделать директорию экспортёра доступной для записи
                    # Используем sudo или меняем владельца через Docker
                    if os.access(self.workdir, os.W_OK):
                        exporter_dir_rvt_path = self.workdir / rvt_path.name
                        print(f"📋 Стратегия 2: Пробуем скопировать RVT файл в директорию экспортёра:")
                        print(f"   Из: {rvt_path}")
                        print(f"   В: {exporter_dir_rvt_path}")
                        shutil.copy2(rvt_path, exporter_dir_rvt_path)
                        if exporter_dir_rvt_path.exists() and exporter_dir_rvt_path.stat().st_size == file_size:
                            print(f"   ✅ Файл скопирован в директорию экспортёра ({file_size} байт)")
                            rvt_path = exporter_dir_rvt_path
                            copy_success = True
                        else:
                            print(f"   ⚠️ Копирование в директорию экспортёра не удалось")
                            exporter_dir_rvt_path = None
                    else:
                        print(f"   ⚠️ Директория экспортёра недоступна для записи: {self.workdir}")
                        print(f"   Пробуем изменить права доступа...")
                        try:
                            # Пробуем создать временную директорию для экспорта в /opt/civilx-exporter
                            temp_export_dir = self.workdir / "temp_export"
                            temp_export_dir.mkdir(parents=True, exist_ok=True)
                            if os.access(temp_export_dir, os.W_OK):
                                exporter_dir_rvt_path = temp_export_dir / rvt_path.name
                                print(f"   ✅ Создана временная директория: {temp_export_dir}")
                                shutil.copy2(rvt_path, exporter_dir_rvt_path)
                                if exporter_dir_rvt_path.exists():
                                    rvt_path = exporter_dir_rvt_path
                                    copy_success = True
                        except Exception as e:
                            print(f"   ⚠️ Не удалось создать временную директорию: {e}")
                except Exception as e:
                    print(f"   ⚠️ Ошибка при копировании в директорию экспортёра: {e}")
                    exporter_dir_rvt_path = None
            
            # Стратегия 3: Используем /app/wine_work как запасной вариант
            if not copy_success:
                # Используем /app/wine_work для копирования файла
                # Это гарантирует, что Wine сможет получить доступ к файлу
                wine_work_dir = Path("/app/wine_work")
                print(f"📋 Стратегия 3: Подготовка директории /app/wine_work для Wine:")
                print(f"   Целевая директория: {wine_work_dir}")
                print(f"   /app существует: {Path('/app').exists()}")
                print(f"   /app доступен для записи: {os.access('/app', os.W_OK)}")
                try:
                    # Создаем директорию, если она не существует
                    if not wine_work_dir.exists():
                        print(f"   Создаем директорию: {wine_work_dir}")
                        wine_work_dir.mkdir(parents=True, exist_ok=True)
                    else:
                        print(f"   Директория уже существует: {wine_work_dir}")
                    print(f"   Директория создана/существует: {wine_work_dir.exists()}")
                    print(f"   Директория доступна для записи: {os.access(wine_work_dir, os.W_OK)}")
                except Exception as e:
                    print(f"   ❌ Ошибка при создании директории: {e}")
                    import traceback
                    print(f"   Traceback: {traceback.format_exc()}")
                    raise
                
                workdir_rvt_path = wine_work_dir / rvt_path.name
                # Всегда копируем, даже если файл уже в нужной директории (для надежности)
                print(f"📋 Копируем RVT файл в /app/wine_work для Wine:")
                print(f"   Из: {rvt_path}")
                print(f"   В: {workdir_rvt_path}")
                try:
                    # Убеждаемся, что рабочая директория доступна для записи
                    if not os.access(wine_work_dir, os.W_OK):
                        raise PermissionError(f"Рабочая директория для Wine недоступна для записи: {wine_work_dir}")
                    shutil.copy2(rvt_path, workdir_rvt_path)
                    # Проверяем, что файл скопировался
                    if not workdir_rvt_path.exists():
                        raise FileNotFoundError(f"Файл не был скопирован: {workdir_rvt_path}")
                    copy_size = workdir_rvt_path.stat().st_size
                    if copy_size != file_size:
                        raise ValueError(f"Размер скопированного файла не совпадает: {copy_size} != {file_size}")
                    print(f"   ✅ Файл скопирован успешно ({copy_size} байт)")
                    copy_success = True
                    # Используем путь в доступной директории
                    rvt_path = workdir_rvt_path
                except Exception as e:
                    print(f"   ⚠️ Не удалось скопировать файл: {e}")
                    import traceback
                    print(f"   Traceback: {traceback.format_exc()}")
                    print(f"   Продолжаем с исходным путем")

        # Делаем снимок CSV файлов в обеих директориях: рядом с RVT и в рабочей директории
        # Также делаем снимок в исходной директории, если файл был скопирован
        pre_existing_csv_rvt_dir = self._snapshot_csv_files(rvt_path.parent)
        pre_existing_csv_workdir = self._snapshot_csv_files(self.workdir)
        pre_existing_csv_original_dir = None
        if original_rvt_path and original_rvt_path != rvt_path and original_rvt_path.parent.exists():
            pre_existing_csv_original_dir = self._snapshot_csv_files(original_rvt_path.parent)
        start_time = time.time()

        env = os.environ.copy()
        if not self.is_windows:
            self._ensure_wine_prefix()
            # ВАЖНО: Подавляем некоторые ошибки Wine, которые не критичны
            # EXCEPTION_WINE_CXX_EXCEPTION часто встречается в Wine и не всегда критичен
            # err+module подавляет ошибки загрузки модулей, которые мы уже обрабатываем
            # Оставляем только критичные ошибки и предупреждения о файлах
            env.setdefault("WINEDEBUG", "err+file,warn+file,err+module,warn+module,-all")
            env.setdefault("WINEPREFIX", str(self.wine_prefix))
            # Устанавливаем локаль для корректной работы с путями
            env.setdefault("LC_ALL", "en_US.UTF-8")
            env.setdefault("LANG", "en_US.UTF-8")
            
            # ВАЖНО: Используем msvcrt=native для лучшей совместимости с FreeImage и файловыми операциями
            # msvcrt.dll уже установлен в Wine prefix через vcrun6
            # Native версия может помочь FreeImage правильно открыть файлы
            if "WINEDLLOVERRIDES" not in env:
                env["WINEDLLOVERRIDES"] = "msvcrt=native"
            else:
                # Добавляем msvcrt=native к существующим переопределениям
                existing = env["WINEDLLOVERRIDES"]
                if "msvcrt" not in existing:
                    env["WINEDLLOVERRIDES"] = f"{existing};msvcrt=native"
            
            # Отключаем некоторые проверки Wine, которые могут мешать
            env.setdefault("WINEDISABLE", "desktop")
            
            # ВАЖНО: Устанавливаем WINEDLLPATH для поиска DLL
            # Включаем системную директорию Wine prefix и рабочую директорию процесса
            wine_system32 = str(self.wine_prefix / "drive_c" / "windows" / "system32")
            # WINEDLLPATH будет установлен позже, когда будет известна рабочая директория процесса
            # Пока сохраняем системную директорию для использования
            env["_WINE_SYSTEM32_PATH"] = wine_system32
            
            print(f"   🔧 Настройки Wine:")
            print(f"      WINEPREFIX: {env.get('WINEPREFIX')}")
            print(f"      WINEDLLOVERRIDES: {env.get('WINEDLLOVERRIDES')} (msvcrt=native для FreeImage)")
            print(f"      WINEDEBUG: {env.get('WINEDEBUG')} (подавлены некритичные ошибки)")
            print(f"      ✅ Используется msvcrt=native для лучшей совместимости с FreeImage")

        # Для Wine: определяем рабочую директорию процесса
        # ВАЖНО: Экспортёр должен запускаться из директории, где находится файл
        # Это может помочь FreeImage правильно открыть файл
        process_cwd = None
        rvt_path_for_command = rvt_path
        is_relative_path_used = False  # Флаг: используется ли относительный путь
        print(f"🔍 Определение рабочей директории для процесса:")
        print(f"   is_windows: {self.is_windows}")
        print(f"   copy_success: {copy_success}")
        print(f"   exporter_dir_rvt_path: {exporter_dir_rvt_path}")
        print(f"   workdir_rvt_path: {workdir_rvt_path}")
        print(f"   rvt_path: {rvt_path}")
        print(f"   original_rvt_path: {original_rvt_path}")
        
        if not self.is_windows:
            # ВАЖНО: Согласно примеру пользователя, путь должен быть абсолютным и в кавычках
            # Пример: RvtExporterCfg1.exe "C:\Projects\Демонстрация\Паркинг\тест\SOB_GLP_PD_K2_KR_2022.rvt"
            # КРИТИЧЕСКИ ВАЖНО: Пробуем скопировать RVT файл в директорию экспортёра
            # и использовать относительный путь. Это может помочь FreeImage правильно открыть файл
            # так как все файлы (экспортёр, зависимости, RVT) будут в одной директории
            
            # Пробуем скопировать RVT файл в директорию экспортёра
            # Если не получится, используем /app/wine_work, который точно доступен для записи
            exporter_rvt_path = None
            try:
                if os.access(self.workdir, os.W_OK):
                    exporter_rvt_path = self.workdir / rvt_path.name
                    print(f"📋 Копируем RVT файл в директорию экспортёра для лучшей совместимости с Wine:")
                    print(f"   Из: {rvt_path}")
                    print(f"   В: {exporter_rvt_path}")
                    shutil.copy2(rvt_path, exporter_rvt_path)
                    if exporter_rvt_path.exists() and exporter_rvt_path.stat().st_size == file_size:
                        print(f"   ✅ Файл скопирован в директорию экспортёра")
                        print(f"   📝 Логируем через callback: RVT файл скопирован")
                        if log_callback:
                            try:
                                log_callback("RVT файл скопирован в директорию экспортёра", metadata={
                                    "sourcePath": str(rvt_path),
                                    "destinationPath": str(exporter_rvt_path),
                                    "fileSize": file_size,
                                })
                                print(f"   ✅ Callback выполнен успешно")
                            except Exception as e:
                                print(f"   ⚠️ Ошибка при вызове callback: {e}")
                        else:
                            print(f"   ⚠️ Callback не передан")
                        # Используем файл в директории экспортёра
                        # ВАЖНО: Передаем только имя файла (относительный путь), а не полный путь
                        # Это поможет FreeImage правильно открыть файл, так как он будет в той же директории
                        rvt_path_for_command = Path(rvt_path.name)  # Только имя файла!
                        process_cwd = str(self.workdir)
                        is_relative_path_used = True  # Используется относительный путь
                        print(f"   ✅ Запускаем экспортёр из директории экспортёра: {process_cwd}")
                        print(f"   Используем относительный путь к файлу: {rvt_path.name}")
                        if log_callback:
                            log_callback("Используется относительный путь к RVT файлу", metadata={
                                "processCwd": process_cwd,
                                "rvtPathForCommand": str(rvt_path_for_command),
                                "isRelativePath": True,
                            })
                        print(f"   Это должно помочь FreeImage правильно открыть файл")
                    else:
                        raise ValueError("Размер скопированного файла не совпадает")
                else:
                    raise PermissionError(f"Директория экспортёра недоступна для записи: {self.workdir}")
            except Exception as e:
                print(f"   ⚠️ Не удалось скопировать файл в директорию экспортёра: {e}")
                print(f"   Пробуем скопировать в /app/wine_work (гарантированно доступен для записи)")
                # Если не удалось скопировать в директорию экспортёра, используем /app/wine_work
                wine_work_dir = Path("/app/wine_work")
                try:
                    if not wine_work_dir.exists():
                        wine_work_dir.mkdir(parents=True, exist_ok=True)
                    exporter_rvt_path = wine_work_dir / rvt_path.name
                    shutil.copy2(rvt_path, exporter_rvt_path)
                    if exporter_rvt_path.exists() and exporter_rvt_path.stat().st_size == file_size:
                        print(f"   ✅ Файл скопирован в /app/wine_work")
                        # Используем файл в /app/wine_work
                        rvt_path_for_command = Path(rvt_path.name)  # Только имя файла!
                        process_cwd = str(wine_work_dir)
                        is_relative_path_used = True  # Используется относительный путь
                        print(f"   ✅ Запускаем экспортёр из /app/wine_work: {process_cwd}")
                        print(f"   Используем относительный путь к файлу: {rvt_path.name}")
                        print(f"   ВАЖНО: Экспортёр будет запущен из /app/wine_work, но зависимости в /opt/civilx-exporter")
                        print(f"   Это может не сработать, если экспортёр не найдет DLL")
                    else:
                        raise ValueError("Размер скопированного файла не совпадает")
                except Exception as e2:
                    print(f"   ⚠️ Не удалось скопировать файл в /app/wine_work: {e2}")
                    print(f"   Используем исходный путь")
                    # Если не удалось скопировать, используем исходный путь
                    process_cwd = str(self.workdir)  # Запускаем из директории экспортёра
                    rvt_path_for_command = rvt_path  # Используем абсолютный путь
                    print(f"   ✅ Запускаем экспортёр из директории экспортёра: {process_cwd}")
                    print(f"   Используем абсолютный путь к файлу: {rvt_path_for_command}")
                    exporter_rvt_path = None
        else:
            # Для Windows используем стандартный подход
            process_cwd = str(output_dir_path)
            rvt_path_for_command = rvt_path
            print(f"📂 Рабочая директория для процесса: {process_cwd}")

        # ВАЖНО: Если используется msvcrt=native, Wine ищет msvcrt.dll в системных путях
        # Вариант 1: Копируем msvcrt.dll в системную директорию Wine prefix (если там его нет или он старый)
        # Вариант 3: Настраиваем WINEDLLPATH для поиска DLL в рабочей директории
        if not self.is_windows and env.get("WINEDLLOVERRIDES", "").find("msvcrt=native") != -1:
            msvcrt_source = self.wine_prefix / "drive_c" / "windows" / "system32" / "msvcrt.dll"
            wine_system32 = self.wine_prefix / "drive_c" / "windows" / "system32"
            
            # Вариант 1: Убеждаемся, что msvcrt.dll есть в системной директории Wine prefix
            if msvcrt_source.exists():
                try:
                    # Проверяем размер и дату модификации, чтобы убедиться, что файл актуальный
                    source_size = msvcrt_source.stat().st_size
                    source_mtime = msvcrt_source.stat().st_mtime
                    print(f"   🔧 Проверка msvcrt.dll в системной директории Wine:")
                    print(f"      Путь: {msvcrt_source}")
                    print(f"      Размер: {source_size} байт")
                    print(f"      ✅ msvcrt.dll присутствует в системной директории Wine prefix")
                except Exception as e:
                    print(f"      ⚠️ Ошибка при проверке msvcrt.dll: {e}")
            
            # Вариант 3: Настраиваем WINEDLLPATH для поиска DLL
            # Включаем системную директорию Wine prefix и рабочую директорию процесса (если установлена)
            dll_paths = [wine_system32]
            if process_cwd:
                dll_paths.append(Path(process_cwd))
                # Также копируем msvcrt.dll в рабочую директорию для дополнительной надёжности
                msvcrt_dest = Path(process_cwd) / "msvcrt.dll"
                if msvcrt_source.exists():
                    try:
                        # Удаляем старый файл, если существует, чтобы гарантировать свежую копию
                        if msvcrt_dest.exists():
                            print(f"   🔧 Обнаружен существующий msvcrt.dll в рабочей директории, перезаписываем:")
                            msvcrt_dest.unlink()
                        print(f"   🔧 Копируем msvcrt.dll в рабочую директорию для дополнительной надёжности:")
                        print(f"      Из: {msvcrt_source}")
                        print(f"      В: {msvcrt_dest}")
                        shutil.copy2(msvcrt_source, msvcrt_dest)
                        if msvcrt_dest.exists():
                            file_size = msvcrt_dest.stat().st_size
                            print(f"      ✅ msvcrt.dll скопирован в рабочую директорию (размер: {file_size} байт)")
                            if log_callback:
                                log_callback("msvcrt.dll скопирован в рабочую директорию", metadata={
                                    "source": str(msvcrt_source),
                                    "destination": str(msvcrt_dest),
                                    "fileSize": file_size,
                                })
                    except Exception as e:
                        print(f"      ⚠️ Не удалось скопировать msvcrt.dll в рабочую директорию: {e}")
                        if log_callback:
                            log_callback("Не удалось скопировать msvcrt.dll в рабочую директорию", level="WARNING", metadata={"error": str(e)})
            
            # Устанавливаем WINEDLLPATH с путями для поиска DLL
            wine_dllpath = ":".join(str(p) for p in dll_paths)
            env["WINEDLLPATH"] = wine_dllpath
            print(f"   🔧 WINEDLLPATH настроен для поиска DLL:")
            for path in dll_paths:
                print(f"      - {path}")
            if log_callback:
                log_callback("WINEDLLPATH настроен", metadata={"paths": [str(p) for p in dll_paths]})
        
        cmd, use_shell = self._build_command(os.fspath(rvt_path_for_command), process_cwd=process_cwd)
        
        # Формируем строку команды для логирования
        cmd_str = cmd if isinstance(cmd, str) else " ".join(cmd)
        print(f"🚀 Команда экспортёра: {cmd_str}")
        print(f"   Используется shell: {use_shell}")
        print(f"   Wine prefix: {self.wine_prefix}")
        print(f"   📂 Рабочая директория процесса (cwd): {process_cwd}")
        print(f"   Доступна для записи: {os.access(Path(process_cwd), os.W_OK)}")
        
        # Проверяем, что RVT файл доступен для чтения
        rvt_file_check_path = os.path.join(process_cwd, rvt_path_for_command.name) if isinstance(rvt_path_for_command, Path) else (os.path.join(process_cwd, rvt_path_for_command) if process_cwd else rvt_path_for_command)
        print(f"   Файл в рабочей директории существует: {os.path.exists(rvt_file_check_path)}")
        if os.path.exists(rvt_file_check_path):
            file_stat = os.stat(rvt_file_check_path)
            print(f"   Размер RVT файла: {file_stat.st_size} байт")
            print(f"   Права доступа: {oct(file_stat.st_mode)}")
            print(f"   Доступен для чтения: {os.access(rvt_file_check_path, os.R_OK)}")
        
        # ВАЖНО: Проверяем, может ли Wine открыть файл через winepath
        # Это поможет понять, правильно ли Wine видит путь к файлу
        if not self.is_windows and process_cwd:
            # Проверяем, может ли Wine увидеть файл через winepath
            try:
                # Пробуем использовать winepath для конвертации пути
                # Если файл в рабочей директории, проверяем его доступность
                if isinstance(rvt_path_for_command, Path) and not rvt_path_for_command.is_absolute():
                    # Относительный путь - файл должен быть в process_cwd
                    test_file_path = os.path.join(process_cwd, str(rvt_path_for_command))
                else:
                    test_file_path = str(rvt_path_for_command) if isinstance(rvt_path_for_command, Path) else rvt_path_for_command
                
                # Проверяем, может ли Wine увидеть файл
                # Используем winepath для конвертации пути
                winepath_cmd = ["winepath", "-w", test_file_path]
                try:
                    winepath_result = subprocess.run(
                        winepath_cmd,
                        capture_output=True,
                        text=True,
                        timeout=5,
                        env=env,
                    )
                    if winepath_result.returncode == 0:
                        wine_path_result = winepath_result.stdout.strip()
                        print(f"   ✅ Wine видит файл через winepath: {wine_path_result}")
                    else:
                        print(f"   ⚠️ winepath не смог конвертировать путь: {winepath_result.stderr}")
                except FileNotFoundError:
                    print(f"   ⚠️ winepath не найден - пропускаем проверку")
                except Exception as e:
                    print(f"   ⚠️ Ошибка при проверке winepath: {e}")
            except Exception as e:
                print(f"   ⚠️ Не удалось проверить доступность файла через Wine: {e}")
        
        # Проверяем, может ли экспортёр создать базу данных в рабочей директории
        # Экспортёр создает временную базу данных для работы с RVT файлом
        print(f"   Проверка возможности создания базы данных экспортёра:")
        test_db_path = os.path.join(process_cwd, "test_db.tmp")
        try:
            with open(test_db_path, 'w') as f:
                f.write("test")
            os.remove(test_db_path)
            print(f"   ✅ Может создавать файлы в рабочей директории")
        except Exception as e:
            print(f"   ⚠️ Не может создавать файлы в рабочей директории: {e}")
        
        try:
            process = subprocess.run(
                cmd,
                cwd=process_cwd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
                env=env,
                shell=use_shell,
                **self._get_process_flags(),
            )
        except subprocess.TimeoutExpired as exc:
            return {
                "success": False,
                "error": f"Экспорт превысил таймаут {self.timeout} с",
                "stdout": exc.stdout,
                "stderr": exc.stderr,
                "command": cmd_str,
            }

        stdout = process.stdout or ""
        stderr = process.stderr or ""
        
        print(f"📊 Экспортёр завершился с кодом: {process.returncode}")
        print(f"   stdout длина: {len(stdout)} символов")
        print(f"   stderr длина: {len(stderr)} символов")
        
        # Детальный анализ ошибок в stderr
        if stderr:
            # Подсчитываем критические ошибки
            freeimage_count = stderr.lower().count("freeimage_loadu")
            wsopen_count = stderr.lower().count("_wsopen_dispatch")
            wine_cxx_count = stderr.lower().count("exception_wine_cxx_exception")
            database_error_count = stderr.lower().count("database") + stdout.lower().count("database")
            
            print(f"   🔍 Анализ ошибок в stderr:")
            print(f"      FreeImage_LoadU ошибок: {freeimage_count}")
            print(f"      _wsopen_dispatch ошибок: {wsopen_count}")
            print(f"      EXCEPTION_WINE_CXX_EXCEPTION ошибок: {wine_cxx_count}")
            print(f"      Упоминаний database: {database_error_count}")
            
            # Ищем конкретные ошибки доступа к файлу
            if "error (3)" in stderr.lower():
                print(f"      ⚠️ Обнаружены ошибки 'error (3)' - это PATH_NOT_FOUND в Wine")
                print(f"      Это означает, что Wine не может найти файл по указанному пути")
            
            # Ищем информацию о том, что файл был открыт
            if "opened" in stderr.lower() or "opening" in stderr.lower():
                print(f"      ℹ️ Обнаружены упоминания об открытии файлов в stderr")
        
        # Анализируем stdout для понимания, что произошло
        if stdout:
            print(f"   stdout (первые 500 символов): {stdout[:500]}")
            
            # Проверяем наличие "Successfully exported"
            if "successfully exported" in stdout.lower():
                print(f"   ✅ Обнаружен 'Successfully exported' в stdout")
            else:
                print(f"   ⚠️ 'Successfully exported' НЕ найден в stdout")
            
            # Проверяем наличие ошибок FreeImage
            if "freeimage_loadu" in stdout.lower():
                freeimage_errors = stdout.lower().count("freeimage_loadu")
                print(f"   ⚠️ Обнаружено {freeimage_errors} ошибок FreeImage_LoadU в stdout")
                print(f"      Это означает, что экспортёр не может открыть RVT файл для чтения данных")
            
            # Проверяем наличие ошибок database
            if "database" in stdout.lower():
                print(f"   ⚠️ Обнаружены упоминания 'database' в stdout")
                if "not null" in stdout.lower():
                    print(f"      ⚠️ Обнаружена ошибка 'database NOT NULL'")
                    print(f"      Это может означать проблему с базой данных экспортёра")
            # Проверяем наличие ключевых сообщений
            stdout_lower = stdout.lower()
            if "freeimage_loadu" in stdout_lower:
                freeimage_count = stdout_lower.count("freeimage_loadu")
                print(f"   ⚠️ FreeImage_LoadU ошибок: {freeimage_count}")
                print(f"   Это может означать, что экспортёр не может открыть RVT файл для чтения данных")
            if "database not null" in stdout_lower:
                print(f"   ⚠️ database NOT NULL - это допустимая ошибка, но может указывать на проблему с БД экспортёра")
            if "successfully exported" in stdout_lower:
                print(f"   ✅ Successfully exported - экспортёр завершился успешно")
            else:
                print(f"   ⚠️ Нет 'Successfully exported' в stdout")
        
        if stderr:
            print(f"   stderr (первые 500 символов): {stderr[:500]}")
            # Проверяем наличие критических ошибок Wine
            stderr_lower = stderr.lower()
            if "_wsopen_dispatch" in stderr_lower:
                wsopen_count = stderr_lower.count("_wsopen_dispatch")
                print(f"   ⚠️ _wsopen_dispatch ошибок: {wsopen_count}")
                print(f"   Это означает, что Wine не может открыть файл (error 3 = PATH_NOT_FOUND)")
            if "exception_wine_cxx_exception" in stderr_lower:
                exception_count = stderr_lower.count("exception_wine_cxx_exception")
                print(f"   ⚠️ EXCEPTION_WINE_CXX_EXCEPTION ошибок: {exception_count}")
                print(f"   Это означает, что произошла C++ исключение в Wine")
        
        # Проверяем, создалась ли база данных экспортёра в рабочей директории
        # Экспортёр может создавать временные файлы БД
        print(f"   Проверка файлов, созданных экспортёром в рабочей директории:")
        if process_cwd and os.path.exists(process_cwd):
            created_files = []
            for file in os.listdir(process_cwd):
                file_path = os.path.join(process_cwd, file)
                if os.path.isfile(file_path):
                    try:
                        file_stat = os.stat(file_path)
                        # Проверяем файлы, созданные недавно (в течение последних 5 минут)
                        if file_stat.st_mtime > time.time() - 300:
                            created_files.append({
                                "name": file,
                                "size": file_stat.st_size,
                                "mtime": file_stat.st_mtime,
                            })
                    except Exception:
                        pass
            if created_files:
                print(f"   Найдено файлов, созданных экспортёром: {len(created_files)}")
                for f in created_files:
                    print(f"      - {f['name']}: {f['size']} байт")
            else:
                print(f"   ⚠️ Не найдено файлов, созданных экспортёром в рабочей директории")

        # Фильтруем не критичные ошибки Xvfb из stderr
        # "X connection broken" может появляться, если Xvfb завершается после экспортёра
        # Это не критично, если экспортёр успешно завершился (returncode == 0)
        xvfb_errors = [
            "X connection to :",
            "broken (explicit kill or server shutdown)",
            "Fatal server error",
        ]
        critical_stderr = ""
        if stderr:
            # Разделяем stderr на строки и фильтруем не критичные ошибки Xvfb
            stderr_lines = stderr.split("\n")
            critical_lines = [
                line for line in stderr_lines
                if line.strip() and not any(xvfb_err in line for xvfb_err in xvfb_errors)
            ]
            critical_stderr = "\n".join(critical_lines)

        # Проверяем stdout на наличие ошибок, даже если returncode == 0
        stdout_errors = []
        if stdout:
            stdout_lower = stdout.lower()
            # ВАЖНО: Согласно инструкции, ошибки FreeImage_LoadU и database NOT NULL допустимы
            # Цель экспорта - получить в логах "Successfully exported"
            # Проверяем на реальные ошибки, игнорируя допустимые:
            # - FreeImage_LoadU: failed to open input file - допустима
            # - database NOT NULL - допустима
            
            # Проверяем на критические ошибки (игнорируя допустимые)
            critical_errors = []
            if "failed to open" in stdout_lower or "failed to load" in stdout_lower:
                # Игнорируем FreeImage ошибки - они допустимы
                if "freeimage" not in stdout_lower:
                    critical_errors.append("Ошибка открытия/загрузки файла")
            
            # Проверяем на ошибки базы данных (игнорируя database NOT NULL)
            if "database error" in stdout_lower and "database not null" not in stdout_lower:
                critical_errors.append("Ошибка базы данных экспортёра")
            
            # Проверяем на другие критические ошибки
            if "error" in stdout_lower:
                # Проверяем, что это действительно критическая ошибка
                error_keywords = ["exception", "cannot", "unable", "invalid", "fatal"]
                has_critical_error = any(keyword in stdout_lower for keyword in error_keywords)
                has_success = "successfully" in stdout_lower or "success" in stdout_lower
                # Если есть "Successfully exported", игнорируем другие ошибки
                if has_critical_error and not has_success:
                    critical_errors.append("Обнаружена критическая ошибка в выводе экспортёра")
            
            stdout_errors = critical_errors

        if process.returncode != 0:
            error_msg = critical_stderr or stderr or "RvtExporterCfg1 завершился с ошибкой"
            if stdout_errors:
                error_msg += f". Также в stdout: {', '.join(stdout_errors)}"
            return {
                "success": False,
                "error": error_msg,
                "stdout": stdout,
                "stderr": stderr,
                "returncode": process.returncode,
                "command": cmd_str,
            }

        # Ищем CSV в нескольких директориях: рядом с RVT, в рабочей директории процесса (cwd), в рабочей директории экспортёра, и в output_dir
        # ВАЖНО: Экспортёр создает CSV рядом с RVT файлом (в той же директории)
        # КРИТИЧЕСКИ ВАЖНО: Если используется исходная директория (например, /tmp/tmpXXXXXX/), CSV создаётся там
        # Эта директория может быть удалена после завершения экспортёра, поэтому нужно найти CSV ДО удаления
        print(f"🔍 Поиск CSV файла после экспорта:")
        print(f"   RVT файл находится в: {rvt_path.parent}")
        print(f"   Исходный путь RVT: {original_rvt_path.parent if original_rvt_path else 'N/A'}")
        print(f"   Имя RVT файла: {rvt_path.name}")
        print(f"   Ожидаемое имя CSV: {rvt_path.stem}_rvt.csv или {rvt_path.stem}.csv")
        
        csv_path = None
        
        # ВАЖНО: Всегда проверяем исходную директорию ПЕРВОЙ, даже если rvt_path == original_rvt_path
        # Это критично, потому что исходная директория может быть временной и будет удалена
        if original_rvt_path and original_rvt_path.parent.exists():
            print(f"   🔍 [ПРИОРИТЕТ] Проверяем исходную директорию (где был RVT изначально): {original_rvt_path.parent}")
            csv_path = self._resolve_output_csv(
                search_dir=original_rvt_path.parent,
                before_snapshot=pre_existing_csv_original_dir or set(),
                rvt_path=original_rvt_path,
                start_time=start_time,
            )
            if csv_path and csv_path.exists():
                print(f"   ✅ CSV найден в исходной директории: {csv_path}")
                print(f"   ⚠️ ВАЖНО: Эта директория может быть временной и будет удалена!")
        
        # Если не нашли в исходной директории, ищем в директории, где находится RVT файл сейчас
        if not csv_path or not csv_path.exists():
            print(f"   🔍 Проверяем директорию, где находится RVT файл сейчас: {rvt_path.parent}")
            csv_path = self._resolve_output_csv(
                search_dir=rvt_path.parent,
                before_snapshot=pre_existing_csv_rvt_dir,
                rvt_path=rvt_path,
                start_time=start_time,
            )
            if csv_path and csv_path.exists():
                print(f"   ✅ CSV найден в директории RVT: {csv_path}")
            else:
                print(f"   ⚠️ CSV не найден в директории RVT: {rvt_path.parent}")
        
        search_locations = [str(rvt_path.parent)]
        if original_rvt_path and original_rvt_path != rvt_path:
            search_locations.insert(0, str(original_rvt_path.parent))
        
        # ВАЖНО: Если process_cwd установлен (например, /opt/civilx-exporter или /app/wine_work), ищем CSV там
        # Это критично, так как если файл был скопирован в директорию экспортёра, CSV может быть создан там
        # КРИТИЧЕСКИ ВАЖНО: Если используется относительный путь, CSV создается в process_cwd
        if process_cwd:
            process_cwd_path = Path(process_cwd)
            # Проверяем process_cwd ПРИОРИТЕТНО, если используется относительный путь
            # (это означает, что файл был скопирован в директорию экспортёра)
            if is_relative_path_used or (not csv_path or not csv_path.exists()):
                if process_cwd_path.exists():
                    if str(process_cwd_path) != str(rvt_path.parent):
                        print(f"   🔍 [ПРИОРИТЕТ] Проверяем рабочую директорию процесса (cwd): {process_cwd}")
                        print(f"      Используется относительный путь: {is_relative_path_used}")
                        print(f"      CSV должен быть создан в этой директории")
                        print(f"   📝 Логируем через callback: Поиск CSV в рабочей директории")
                        if log_callback:
                            try:
                                log_callback("Поиск CSV в рабочей директории процесса (приоритет)", metadata={
                                    "processCwd": process_cwd,
                                    "isRelativePathUsed": is_relative_path_used,
                                })
                                print(f"   ✅ Callback выполнен успешно")
                            except Exception as e:
                                print(f"   ⚠️ Ошибка при вызове callback: {e}")
                        else:
                            print(f"   ⚠️ Callback не передан")
                        pre_existing_csv_process_cwd = self._snapshot_csv_files(process_cwd_path)
                        csv_path = self._resolve_output_csv(
                            search_dir=process_cwd_path,
                            before_snapshot=pre_existing_csv_process_cwd,
                            rvt_path=rvt_path,
                            start_time=start_time,
                        )
                        if csv_path and csv_path.exists():
                            print(f"   ✅ CSV найден в рабочей директории процесса: {csv_path}")
                            if log_callback:
                                log_callback("CSV найден в рабочей директории процесса", metadata={
                                    "csvPath": str(csv_path),
                                    "csvSize": csv_path.stat().st_size,
                                })
                        else:
                            print(f"   ⚠️ CSV не найден в рабочей директории процесса: {process_cwd}")
                            # Выводим список всех CSV файлов в этой директории для диагностики
                            all_csvs = list(process_cwd_path.glob("*.csv"))
                            print(f"      Всего CSV файлов в {process_cwd}: {len(all_csvs)}")
                            csv_list = []
                            for csv_file in all_csvs:
                                try:
                                    size = csv_file.stat().st_size
                                    mtime = csv_file.stat().st_mtime
                                    print(f"      - {csv_file.name}: {size} байт, mtime={mtime:.2f}")
                                    csv_list.append({
                                        "name": csv_file.name,
                                        "size": size,
                                        "mtime": mtime,
                                    })
                                except Exception as e:
                                    print(f"      - {csv_file.name}: ошибка при проверке: {e}")
                            if log_callback:
                                log_callback("CSV не найден в рабочей директории процесса", level="WARNING", metadata={
                                    "processCwd": process_cwd,
                                    "foundCsvFiles": csv_list,
                                })
                search_locations.append(str(process_cwd_path))
        
        # Если не нашли рядом с RVT, ищем в рабочей директории экспортёра
        if not csv_path or not csv_path.exists():
            csv_path = self._resolve_output_csv(
                search_dir=self.workdir,
                before_snapshot=pre_existing_csv_workdir,
                rvt_path=rvt_path,
                start_time=start_time,
            )
            search_locations.append(str(self.workdir))
        
        # Если не нашли, ищем в output_dir (где запускался процесс)
        if not csv_path or not csv_path.exists():
            pre_existing_csv_output_dir = self._snapshot_csv_files(output_dir_path)
            csv_path = self._resolve_output_csv(
                search_dir=output_dir_path,
                before_snapshot=pre_existing_csv_output_dir,
                rvt_path=rvt_path,
                start_time=start_time,
            )
            search_locations.append(str(output_dir_path))

        if not csv_path or not csv_path.exists():
            # Собираем информацию о всех CSV файлах в директориях поиска для диагностики
            found_csvs = []
            for search_dir in search_locations:
                search_path = Path(search_dir)
                if search_path.exists():
                    for csv_file in search_path.glob("*.csv"):
                        found_csvs.append({
                            "path": str(csv_file),
                            "size": csv_file.stat().st_size if csv_file.exists() else 0,
                            "mtime": csv_file.stat().st_mtime if csv_file.exists() else 0,
                        })
            
            # Также ищем в исходной директории (original_rvt_path.parent), если файл был скопирован
            # Экспортёр может создать CSV в исходной директории, где был RVT файл до копирования
            if original_rvt_path and original_rvt_path != rvt_path:
                original_dir = original_rvt_path.parent
                if original_dir.exists() and str(original_dir) not in search_locations:
                    print(f"   🔍 Также проверяем исходную директорию (где был RVT до копирования): {original_dir}")
                    # Проверяем, есть ли там новый CSV
                    original_csv = self._resolve_output_csv(
                        search_dir=original_dir,
                        before_snapshot=pre_existing_csv_original_dir or set(),
                        rvt_path=original_rvt_path,
                        start_time=start_time,
                    )
                    if original_csv and original_csv.exists():
                        print(f"   ✅ CSV найден в исходной директории: {original_csv}")
                        csv_path = original_csv
                        search_locations.append(str(original_dir))
                    else:
                        # Добавляем все CSV из исходной директории в список найденных для диагностики
                        for csv_file in original_dir.glob("*.csv"):
                            found_csvs.append({
                                "path": str(csv_file),
                                "size": csv_file.stat().st_size if csv_file.exists() else 0,
                                "mtime": csv_file.stat().st_mtime if csv_file.exists() else 0,
                            })
            
            print(f"🔍 CSV файл не найден в стандартных местах. Искали в: {search_locations}")
            print(f"   Найдено CSV файлов: {len(found_csvs)}")
            for csv_info in found_csvs:
                print(f"   - {csv_info['path']} ({csv_info['size']} байт, mtime: {csv_info['mtime']})")
            
            error_msg = f"Не удалось найти CSV файл после экспорта. Искали в: {', '.join(search_locations)}"
            if found_csvs:
                error_msg += f". Найдены CSV файлы: {found_csvs}"
            
            return {
                "success": False,
                "error": error_msg,
                "stdout": stdout,
                "stderr": stderr,
                "command": cmd_str,
            }

        # Проверяем, что CSV файл не пустой (не только заголовок)
        print(f"📊 Проверка CSV файла: {csv_path}")
        print(f"   Файл существует: {csv_path.exists()}")
        if csv_path.exists():
            file_size = csv_path.stat().st_size
            print(f"   Размер файла: {file_size} байт")
            if log_callback:
                log_callback("Проверка CSV файла", metadata={
                    "csvPath": str(csv_path),
                    "fileSize": file_size,
                    "exists": True,
                })
        try:
            import csv
            with open(csv_path, 'r', encoding='utf-8-sig', newline='') as f:
                reader = csv.reader(f)
                # Пропускаем заголовок
                header = next(reader, None)
                if not header:
                    # Файл пустой
                    lines_count = 0
                    print(f"   ⚠️ Файл пустой (нет заголовка)")
                    if log_callback:
                        log_callback("CSV файл пустой (нет заголовка)", level="WARNING", metadata={
                            "csvPath": str(csv_path),
                        })
                else:
                    # Считаем строки данных
                    data_rows = sum(1 for _ in reader)
                    lines_count = data_rows + 1  # +1 для заголовка
                    print(f"   Заголовок найден: {len(header)} колонок")
                    print(f"   Строк данных: {data_rows}")
                    print(f"   Всего строк: {lines_count}")
                    if log_callback:
                        log_callback("CSV файл проверен", metadata={
                            "csvPath": str(csv_path),
                            "headerColumns": len(header),
                            "dataRows": data_rows,
                            "totalRows": lines_count,
                        })
                
                # Детальный анализ проблемы с пустым CSV
                print(f"   📊 Детальный анализ CSV файла:")
                print(f"      Размер файла: {csv_path.stat().st_size} байт")
                print(f"      Заголовок: {len(header)} колонок")
                print(f"      Строк данных: {data_rows}")
                print(f"      Всего строк: {lines_count}")
                
                # Проверяем, что находится в CSV файле (первые несколько строк после заголовка)
                if lines_count > 1:
                    # Есть данные - это хорошо
                    print(f"   ✅ CSV файл содержит данные")
                else:
                    # Только заголовок - это проблема
                    print(f"   ⚠️ CSV файл содержит только заголовок")
                    # Читаем первые несколько строк файла для диагностики
                    with open(csv_path, 'r', encoding='utf-8-sig', newline='') as f:
                        all_lines = f.readlines()
                        print(f"      Всего строк в файле (включая пустые): {len(all_lines)}")
                        print(f"      Первые 5 строк файла:")
                        for i, line in enumerate(all_lines[:5], 1):
                            print(f"         {i}: {line[:100].strip() if line.strip() else '(пустая строка)'}")
                
                if lines_count <= 1:
                    # Только заголовок или пустой файл
                    # ВАЖНО: Согласно требованиям, цель экспорта - получить "Successfully exported" И CSV с данными (> 0 строк)
                    # Если CSV пустой, даже при "Successfully exported", это проблема
                    has_success = "successfully exported" in stdout.lower() if stdout else False
                    
                    # Анализируем, почему данные не извлечены
                    print(f"   🔍 Анализ причины отсутствия данных:")
                    if "freeimage_loadu" in (stdout.lower() if stdout else ""):
                        print(f"      ⚠️ FreeImage_LoadU ошибки - экспортёр не может открыть RVT файл для чтения данных")
                        print(f"      Это может означать, что FreeImage в Wine не может работать с RVT файлами")
                    if "_wsopen_dispatch" in (stderr.lower() if stderr else ""):
                        print(f"      ⚠️ _wsopen_dispatch ошибки - Wine не может открыть файл")
                        print(f"      Это может означать проблему с доступом к файлу через Wine")
                    if "exception_wine_cxx_exception" in (stderr.lower() if stderr else ""):
                        print(f"      ⚠️ EXCEPTION_WINE_CXX_EXCEPTION - C++ исключения в Wine")
                        print(f"      Это может означать, что экспортёр использует функции, которые не работают через Wine")
                    if "database not null" in (stdout.lower() if stdout else ""):
                        print(f"      ⚠️ database NOT NULL - проблема с базой данных экспортёра")
                        print(f"      Это может означать, что экспортёр не может создать/использовать БД для работы с RVT")
                    
                    if has_success:
                        # Есть "Successfully exported", но CSV пустой
                        # Это означает, что экспортёр не смог прочитать данные из RVT файла
                        # Возможно, проблема с FreeImage или доступом к файлу через Wine
                        real_errors = []
                        if stdout_errors:
                            real_errors.append(f"Ошибки в stdout: {', '.join(stdout_errors)}")
                        
                        error_msg = f"CSV файл пустой или содержит только заголовок ({lines_count} строк), несмотря на 'Successfully exported'"
                        error_msg += ". Экспортёр не смог прочитать данные из RVT файла."
                        if real_errors:
                            error_msg += f" {'. '.join(real_errors)}"
                        error_msg += " Возможно, проблема с доступом к файлу через Wine или FreeImage не может открыть RVT файл."
                        
                        return {
                            "success": False,
                            "error": error_msg,
                            "stdout": stdout,
                            "stderr": stderr,
                            "command": cmd_str,
                        }
                    else:
                        # Нет "Successfully exported" - это реальная ошибка
                        real_errors = []
                        if stdout_errors:
                            real_errors.append(f"Ошибки в stdout: {', '.join(stdout_errors)}")
                        
                        error_msg = f"CSV файл пустой или содержит только заголовок ({lines_count} строк)"
                        if real_errors:
                            error_msg += f". {'. '.join(real_errors)}"
                        else:
                            error_msg += ". Экспорт не завершился успешно (нет 'Successfully exported' в логах)."
                        
                        return {
                            "success": False,
                            "error": error_msg,
                            "stdout": stdout,
                            "stderr": stderr,
                            "command": cmd_str,
                        }
        except Exception as e:
            return {
                "success": False,
                "error": f"Не удалось прочитать CSV файл: {str(e)}",
                "stdout": stdout,
                "stderr": stderr,
                "command": cmd_str,
            }

        # ВАЖНО: Копирование CSV в output_dir НЕ происходит здесь
        # Копирование должно происходить только после проверки успешности конвертации
        # (наличие "Successfully exported" и CSV с данными)
        # Возвращаем путь к найденному CSV файлу, копирование будет выполнено в conversion.py
        
        # Очищаем скопированные RVT файлы из рабочих директорий, если они были скопированы
        # Это безопасно, так как RVT файл больше не нужен после завершения экспорта
        cleanup_paths = []
        if workdir_rvt_path and workdir_rvt_path.exists() and workdir_rvt_path != original_rvt_path:
            cleanup_paths.append(workdir_rvt_path)
        # Также очищаем файл из директории экспортёра, если он был скопирован туда
        if 'exporter_rvt_path' in locals() and exporter_rvt_path and exporter_rvt_path.exists() and exporter_rvt_path != original_rvt_path:
            cleanup_paths.append(exporter_rvt_path)
        
        for cleanup_path in cleanup_paths:
            try:
                print(f"🧹 Удаляем временную копию RVT файла: {cleanup_path}")
                cleanup_path.unlink()
                print(f"   ✅ Файл удален")
            except Exception as e:
                print(f"   ⚠️ Не удалось удалить временный файл: {e}")

        # Возвращаем путь к найденному CSV файлу (не копируем его)
        return {
            "success": True,
            "output_path": str(csv_path),  # Возвращаем исходный путь, не destination_path
            "stdout": stdout,
            "stderr": stderr,
            "command": cmd_str,
        }

    def _build_command(self, rvt_path_str: str, process_cwd: str = None) -> tuple:
        """
        Строит команду для запуска экспортёра.
        Согласно инструкции, путь к RVT файлу должен быть в кавычках.
        
        Args:
            rvt_path_str: путь к RVT файлу (может быть относительным, если process_cwd установлен)
            process_cwd: рабочая директория процесса (если None, используется абсолютный путь)
        
        Returns:
            tuple: (команда, use_shell) - команда может быть list или str, use_shell - bool
        """
        if self.is_windows:
            # Для Windows: путь в кавычках не нужен при использовании list в subprocess
            return ([str(self.exporter_path), rvt_path_str], False)
        
        wine_binary = self._resolve_wine_binary()
        # Для Wine: согласно инструкции, путь должен быть в кавычках
        # Используем shell=True и передаём команду как строку с кавычками
        # Экранируем кавычки в пути для безопасности
        import shlex
        
        # ВАЖНО: Согласно инструкции, путь к RVT файлу должен быть в кавычках
        # Пример: RvtExporterCfg1.exe "C:\Projects\Демонстрация\Паркинг\тест\SOB_GLP_PD_K2_KR_2022.rvt"
        # Пробуем использовать относительный путь, если process_cwd установлен - это может помочь FreeImage
        
        # Получаем абсолютный путь к файлу для проверки
        if process_cwd and not os.path.isabs(rvt_path_str):
            # Если путь относительный, получаем полный путь для проверки
            full_path = os.path.join(process_cwd, rvt_path_str)
        else:
            # Уже абсолютный путь
            full_path = os.path.abspath(rvt_path_str)
        
        print(f"🔧 Конвертация пути для Wine:")
        print(f"   Исходный путь: {rvt_path_str}")
        if process_cwd and not os.path.isabs(rvt_path_str):
            print(f"   Рабочая директория (cwd): {process_cwd}")
        print(f"   Абсолютный путь к файлу: {full_path}")
        print(f"   Файл существует: {os.path.exists(full_path)}")
        print(f"   Файл доступен для чтения: {os.access(full_path, os.R_OK)}")
        
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"Файл не найден: {full_path}")
        if not os.access(full_path, os.R_OK):
            raise PermissionError(f"Файл недоступен для чтения: {full_path}")
        
        # ВАЖНО: Согласно требованиям пользователя, путь должен быть абсолютным и в кавычках
        # Пример: RvtExporterCfg1.exe "C:\Projects\Демонстрация\Паркинг\тест\SOB_GLP_PD_K2_KR_2022.rvt"
        # КРИТИЧЕСКИ ВАЖНО: Пробуем использовать относительный путь, если файл в process_cwd
        # Это может помочь FreeImage правильно открыть файл и избежать ошибок _wsopen_dispatch
        
        # Если файл находится в рабочей директории процесса, используем относительный путь
        # Это может помочь избежать проблем с PATH_NOT_FOUND (error 3) и _wsopen_dispatch
        use_relative_path = False
        if process_cwd:
            try:
                # Проверяем, находится ли файл в рабочей директории
                common_path = os.path.commonpath([full_path, process_cwd])
                if common_path == process_cwd:
                    # Файл находится в рабочей директории - используем относительный путь
                    relative_path = os.path.relpath(full_path, process_cwd)
                    wine_path = relative_path.replace('/', '\\')
                    use_relative_path = True
                    print(f"   ✅ Файл в рабочей директории - используем относительный путь: {wine_path}")
                    print(f"   ℹ️ Это может помочь FreeImage и Wine правильно открыть файл")
            except (ValueError, OSError):
                # Пути на разных дисках или другая ошибка - используем абсолютный путь
                pass
        
        if not use_relative_path:
            # Файл не в рабочей директории - используем абсолютный путь через Z: драйв
            wine_path = full_path.replace('/', '\\').lstrip('\\')
            if not wine_path.startswith('Z:'):
                wine_path = 'Z:\\' + wine_path
            print(f"   ✅ Используем абсолютный путь через Z: драйв: {wine_path}")
            print(f"   ℹ️ Это может помочь избежать ошибок PATH_NOT_FOUND в Wine")
        
        # ВАЖНО: НЕ экранируем обратные слэши здесь - они будут экранированы при формировании команды
        # Путь должен быть в формате Z:\opt\civilx-exporter\model1.rvt или model1.rvt (одинарные обратные слэши)
        print(f"   ✅ Путь для Wine (без экранирования): {wine_path}")
        
        # Если process_cwd установлен, также логируем, что мы запускаем из этой директории
        if process_cwd:
            print(f"   ✅ Запускаем из рабочей директории: {process_cwd}")
            print(f"   Используем абсолютный путь для Wine: {wine_path}")
            print(f"   Это должно помочь Wine правильно найти файл и избежать ошибок PATH_NOT_FOUND")
        else:
            print(f"   Windows-стиль путь для Wine (абсолютный): {wine_path}")
        
        print(f"   Путь будет передан в кавычках: \"{wine_path}\"")
        
        # Экранируем путь к экспортёру
        quoted_exporter = shlex.quote(str(self.exporter_path))
        # Экранируем Windows-стиль путь для shell и добавляем двойные кавычки для экспортёра
        # ВАЖНО: wine_path уже содержит одинарные обратные слэши (Z:\opt\...)
        # Экранируем их для shell (двойные обратные слэши) и экранируем специальные символы
        escaped_rvt = wine_path.replace('\\', '\\\\').replace('"', '\\"').replace('$', '\\$').replace('`', '\\`')
        print(f"   ✅ Путь экранирован для shell: {escaped_rvt}")
        # Формируем команду: xvfb-run с опциями для стабильной работы
        # --auto-servernum: автоматический выбор номера дисплея
        # --server-args: дополнительные опции для Xvfb (screen 0, глубина цвета 24)
        # -a: автоматический выбор дисплея (устаревшая опция, но оставляем для совместимости)
        cmd_str = f'xvfb-run --auto-servernum --server-args="-screen 0 1024x768x24" {shlex.quote(wine_binary)} {quoted_exporter} "{escaped_rvt}"'
        print(f"   Сформированная команда: {cmd_str}")
        return (cmd_str, True)

    def _resolve_wine_binary(self) -> str:
        """Найти доступный wine-бинарь в Linux окружении."""
        candidates = [
            shutil.which("wine"),
            shutil.which("wine64"),
            "/usr/lib/wine/wine64",
            "/usr/lib/wine/wine",
        ]
        for candidate in candidates:
            if candidate and Path(candidate).exists():
                return candidate
        raise FileNotFoundError(
            "Не найден исполняемый файл wine/wine64 для запуска экспортера"
        )

    @staticmethod
    def _snapshot_csv_files(directory: Path) -> Set[Path]:
        if not directory.exists():
            return set()
        return {path for path in directory.glob("*.csv")}

    def _resolve_output_csv(
        self,
        search_dir: Path,
        before_snapshot: Set[Path],
        rvt_path: Path,
        start_time: float,
    ) -> Optional[Path]:
        """Попробовать найти новый CSV, созданный экспортером."""
        if not search_dir.exists():
            print(f"   ⚠️ Директория не существует: {search_dir}")
            return None

        candidates = []
        all_csvs = list(search_dir.glob("*.csv"))
        print(f"   🔍 Ищем CSV в {search_dir}: найдено {len(all_csvs)} CSV файлов")
        
        # Ищем CSV файлы, которые были созданы после start_time
        for csv_file in all_csvs:
            is_new = csv_file not in before_snapshot
            try:
                file_mtime = csv_file.stat().st_mtime
                is_recent = file_mtime >= start_time
                file_size = csv_file.stat().st_size
                print(f"      - {csv_file.name}: размер={file_size} байт, mtime={file_mtime:.2f} (start_time={start_time:.2f}), новый={is_new}, недавний={is_recent}")
                
                if is_new or is_recent:
                    if is_new:
                        # Новый файл - проверяем время создания
                        if is_recent:
                            candidates.append(csv_file)
                    else:
                        # Существующий файл - проверяем обновление времени модификации
                        if is_recent:
                            candidates.append(csv_file)
            except (OSError, ValueError) as e:
                print(f"      - {csv_file.name}: ошибка при проверке: {e}")
                # Если не удалось получить время модификации, добавляем файл
                candidates.append(csv_file)

        print(f"   🔍 Кандидаты на CSV: {len(candidates)} файлов")
        for candidate in candidates:
            print(f"      - {candidate.name} (stem={candidate.stem}, rvt_stem={rvt_path.stem})")

        # Сначала ищем файл с тем же stem, что и у RVT
        for candidate in candidates:
            if candidate.stem == rvt_path.stem:
                print(f"   ✅ Найден CSV с совпадающим stem: {candidate}")
                return candidate
        
        # Также проверяем варианты с суффиксами (_rvt, _export и т.д.)
        rvt_stem = rvt_path.stem
        for candidate in candidates:
            if candidate.stem.startswith(rvt_stem) or rvt_stem in candidate.stem:
                print(f"   ✅ Найден CSV с похожим именем: {candidate}")
                return candidate

        if candidates:
            print(f"   ✅ Используем первый найденный CSV: {candidates[0]}")
            return candidates[0]
        else:
            print(f"   ⚠️ CSV файлы не найдены в {search_dir}")
            return None

    def _ensure_wine_prefix(self) -> None:
        """Убедиться, что каталог WINEPREFIX существует и доступен."""
        try:
            self.wine_prefix.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise RuntimeError(
                f"Не удалось подготовить каталог WINEPREFIX: {self.wine_prefix}"
            ) from exc
        
        # ВАЖНО: Инициализируем Wine prefix, если он не инициализирован
        # Это необходимо для корректной работы Wine
        if not self.is_windows:
            self._initialize_wine_prefix()
            # Устанавливаем vcrun6 через winetricks для поддержки msvcrt=native
            # Это необходимо для работы с нативной версией msvcrt.dll
            self._ensure_vcrun6_installed()
            # Настраиваем Wine через реестр для использования msvcrt=native
            self._configure_wine_dll_override()
    
    def _initialize_wine_prefix(self) -> None:
        """Инициализировать Wine prefix, если он не инициализирован."""
        import subprocess as sp
        
        # Проверяем, инициализирован ли Wine prefix
        # Если есть файл system.reg, значит prefix уже инициализирован
        system_reg = self.wine_prefix / "system.reg"
        if system_reg.exists():
            print(f"   ✅ Wine prefix уже инициализирован: {self.wine_prefix}")
            return
        
        # Инициализируем Wine prefix
        print(f"   🔧 Инициализируем Wine prefix: {self.wine_prefix}")
        try:
            wine_binary = self._resolve_wine_binary()
        except FileNotFoundError:
            print(f"   ⚠️ Wine не найден, пропускаем инициализацию prefix")
            return
        
        env = os.environ.copy()
        env["WINEPREFIX"] = str(self.wine_prefix)
        env["DISPLAY"] = ":99"  # Для xvfb
        env["DEBIAN_FRONTEND"] = "noninteractive"
        
        try:
            # Используем wineboot для инициализации prefix
            wineboot_cmd = [wine_binary, "wineboot", "--init"]
            print(f"   Команда: {' '.join(wineboot_cmd)}")
            print(f"   WINEPREFIX: {env['WINEPREFIX']}")
            
            wineboot_result = sp.run(
                wineboot_cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=60,
                check=True,
            )
            print(f"   ✅ Wine prefix инициализирован успешно.")
            if wineboot_result.stdout:
                print(f"   stdout: {wineboot_result.stdout[:500]}")
            if wineboot_result.stderr:
                print(f"   stderr: {wineboot_result.stderr[:500]}")
        except sp.CalledProcessError as e:
            print(f"   ⚠️ Ошибка при инициализации Wine prefix: {e}")
            print(f"   stdout: {e.stdout[:500]}")
            print(f"   stderr: {e.stderr[:500]}")
            print(f"   ⚠️ Продолжаем без инициализации prefix")
        except Exception as e:
            print(f"   ⚠️ Неизвестная ошибка при инициализации Wine prefix: {e}")
            print(f"   ⚠️ Продолжаем без инициализации prefix")
    
    def _ensure_vcrun6_installed(self) -> None:
        """Убедиться, что vcrun6 установлен через winetricks для поддержки msvcrt=native."""
        import subprocess as sp
        
        # Проверяем, установлен ли winetricks
        try:
            winetricks_result = sp.run(
                ["which", "winetricks"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if winetricks_result.returncode != 0:
                print(f"   ⚠️ winetricks не найден, пропускаем установку vcrun6")
                print(f"   ⚠️ Для использования msvcrt=native необходимо установить winetricks")
                return
        except Exception as e:
            print(f"   ⚠️ Ошибка при проверке winetricks: {e}")
            return
        
        # Проверяем, установлен ли уже vcrun6
        # Проверяем наличие msvcrt.dll в system32
        msvcrt_path = self.wine_prefix / "drive_c" / "windows" / "system32" / "msvcrt.dll"
        if msvcrt_path.exists():
            print(f"   ✅ msvcrt.dll уже установлен в Wine prefix: {msvcrt_path}")
            return
        
        # Устанавливаем vcrun6 через winetricks
        print(f"   🔧 Устанавливаем vcrun6 через winetricks для поддержки msvcrt=native...")
        env = os.environ.copy()
        env["WINEPREFIX"] = str(self.wine_prefix)
        env["DISPLAY"] = ":99"  # Для xvfb
        env["DEBIAN_FRONTEND"] = "noninteractive"
        
        try:
            # Запускаем winetricks vcrun6 в неинтерактивном режиме
            winetricks_cmd = ["winetricks", "--unattended", "vcrun6"]
            print(f"   Команда: {' '.join(winetricks_cmd)}")
            print(f"   WINEPREFIX: {env['WINEPREFIX']}")
            
            winetricks_result = sp.run(
                winetricks_cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=300,  # 5 минут на установку
            )
            
            if winetricks_result.returncode == 0:
                print(f"   ✅ vcrun6 успешно установлен через winetricks")
                if msvcrt_path.exists():
                    print(f"   ✅ msvcrt.dll найден: {msvcrt_path}")
                else:
                    print(f"   ⚠️ msvcrt.dll не найден после установки vcrun6")
            else:
                print(f"   ⚠️ Ошибка при установке vcrun6 через winetricks:")
                print(f"      returncode: {winetricks_result.returncode}")
                print(f"      stdout: {winetricks_result.stdout[:500]}")
                print(f"      stderr: {winetricks_result.stderr[:500]}")
        except sp.TimeoutExpired:
            print(f"   ⚠️ Установка vcrun6 превысила таймаут (5 минут)")
        except Exception as e:
            print(f"   ⚠️ Ошибка при установке vcrun6: {e}")
            import traceback
            print(f"   Traceback: {traceback.format_exc()}")
    
    def _configure_wine_dll_override(self) -> None:
        """Настроить Wine через реестр для использования msvcrt=native."""
        import subprocess as sp
        
        # Проверяем, установлен ли wine
        try:
            wine_binary = self._resolve_wine_binary()
        except FileNotFoundError:
            print(f"   ⚠️ Wine не найден, пропускаем настройку DLL override")
            return
        
        # ВАЖНО: Настраиваем реестр БЕЗ msvcrt=native, чтобы Wine мог запуститься
        # Используем builtin версию для настройки реестра, затем переключимся на native
        print(f"   🔧 Настраиваем Wine через реестр для использования msvcrt=native...")
        env = os.environ.copy()
        env["WINEPREFIX"] = str(self.wine_prefix)
        env["DISPLAY"] = ":99"  # Для xvfb
        env["DEBIAN_FRONTEND"] = "noninteractive"
        # ВАЖНО: НЕ устанавливаем WINEDLLOVERRIDES=msvcrt=native здесь, чтобы Wine мог запуститься
        # Используем builtin версию для настройки реестра
        
        try:
            # Используем wine reg add для установки DLL override
            # Формат: wine reg add "HKCU\\Software\\Wine\\DllOverrides" /v msvcrt /t REG_SZ /d native /f
            reg_cmd = [
                wine_binary,
                "reg",
                "add",
                "HKCU\\Software\\Wine\\DllOverrides",
                "/v", "msvcrt",
                "/t", "REG_SZ",
                "/d", "native",
                "/f"
            ]
            print(f"   Команда: {' '.join(reg_cmd)}")
            print(f"   WINEPREFIX: {env['WINEPREFIX']}")
            print(f"   ⚠️ Используем builtin версию Wine для настройки реестра (без msvcrt=native)")
            
            reg_result = sp.run(
                reg_cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=30,
                check=True,
            )
            print(f"   ✅ DLL override для msvcrt установлен успешно через реестр.")
            print(f"   stdout: {reg_result.stdout}")
            if reg_result.stderr:
                print(f"   stderr: {reg_result.stderr}")
            
            # Проверяем, что настройка применилась
            verify_cmd = [
                wine_binary,
                "reg",
                "query",
                "HKCU\\Software\\Wine\\DllOverrides",
                "/v", "msvcrt"
            ]
            verify_result = sp.run(
                verify_cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if verify_result.returncode == 0 and "native" in verify_result.stdout:
                print(f"   ✅ Подтверждено: msvcrt установлен в native в реестре Wine")
            else:
                print(f"   ⚠️ Не удалось подтвердить настройку реестра")
        except sp.CalledProcessError as e:
            print(f"   ⚠️ Ошибка при настройке DLL override через реестр: {e}")
            print(f"   stdout: {e.stdout}")
            print(f"   stderr: {e.stderr}")
            print(f"   ⚠️ Продолжаем без настройки реестра, используем WINEDLLOVERRIDES")
        except Exception as e:
            print(f"   ⚠️ Неизвестная ошибка при настройке DLL override: {e}")
            print(f"   ⚠️ Продолжаем без настройки реестра, используем WINEDLLOVERRIDES")

    def _get_process_flags(self) -> dict:
        """Скрыть окно консоли на Windows."""
        if sys.platform != "win32":
            return {}

        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = subprocess.SW_HIDE

        return {
            "creationflags": subprocess.CREATE_NO_WINDOW
            | subprocess.CREATE_NEW_PROCESS_GROUP,
            "startupinfo": startupinfo,
        }

