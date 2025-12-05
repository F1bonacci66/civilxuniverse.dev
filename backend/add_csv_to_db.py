"""
Скрипт для добавления CSV файла в БД без конвертации из RVT

Использование:
1. Скопировать CSV файл на Linux сервер
2. Запустить скрипт с параметрами:
   python add_csv_to_db.py \
     --csv-file /path/to/file.csv \
     --project-id 3c2533ba-60fc-4d68-b76b-6e167f152a75 \
     --version-id db340683-41c8-49c6-96ce-a2b4ca4133a5 \
     --model-name SOB_GLP_PD_K2_KR_2022
"""
import sys
import os
import asyncio
import argparse
import tempfile
import shutil
from pathlib import Path

# Добавляем путь к приложению
# На сервере скрипт должен быть в /opt/civilx-backend/
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_path = os.path.join(script_dir, "app")
if os.path.exists(backend_path):
    # Если скрипт в /opt/civilx-backend/, то app/ находится там же
    sys.path.insert(0, script_dir)
else:
    # Если скрипт в корне проекта, ищем backend
    backend_path = os.path.join(script_dir, "civilx-website", "backend")
    if os.path.exists(backend_path):
        sys.path.insert(0, backend_path)
    else:
        # Пробуем найти app/ в текущей директории
        sys.path.insert(0, script_dir)

from app.core.database import SessionLocal
from app.models.upload import FileUpload, CSVDataRow
from app.models.universe_user import UniverseUser
from app.services.csv_transformer import CSVWideToLongTransformer
from app.services.csv_chunker import CSVChunkerService
from app.services.csv_loader import CSVLoaderService
from app.core.storage import storage_service
from app.utils.storage import build_storage_path


async def main():
    parser = argparse.ArgumentParser(description="Добавить CSV файл в БД")
    parser.add_argument("--csv-file", required=True, help="Путь к CSV файлу")
    parser.add_argument("--project-id", required=True, help="ID проекта")
    parser.add_argument("--version-id", required=True, help="ID версии проекта")
    parser.add_argument("--model-name", required=True, help="Имя модели")
    parser.add_argument("--user-email", help="Email пользователя (если не указан, используется первый пользователь)")
    parser.add_argument("--skip-transform", action="store_true", help="Пропустить трансформацию (CSV уже в формате ModelName,ElementId,Category,ParameterName,ParameterValue)")
    
    args = parser.parse_args()
    
    # Проверяем существование файла
    csv_file_path = Path(args.csv_file)
    if not csv_file_path.exists():
        print(f"❌ Файл не найден: {csv_file_path}")
        return 1
    
    print(f"📁 CSV файл: {csv_file_path}")
    print(f"📊 Размер: {csv_file_path.stat().st_size / 1024 / 1024:.2f} MB")
    print()
    
    db = SessionLocal()
    try:
        # Получаем user_id
        user_id = None
        if args.user_email:
            user = db.query(UniverseUser).filter(UniverseUser.email == args.user_email).first()
            if not user:
                print(f"❌ Пользователь с email {args.user_email} не найден")
                return 1
            user_id = str(user.id)
            print(f"👤 Пользователь: {user.email} ({user.name})")
        else:
            # Используем первого активного пользователя
            user = db.query(UniverseUser).filter(UniverseUser.is_active == True).first()
            if not user:
                print("❌ Не найден активный пользователь в БД")
                print("   Используйте --user-email для указания пользователя")
                return 1
            user_id = str(user.id)
            print(f"👤 Используется пользователь: {user.email} ({user.name})")
        
        print()
        
        # Создаем временную директорию для обработки
        tmp_dir = tempfile.mkdtemp(prefix="csv_import_")
        print(f"📂 Временная директория: {tmp_dir}")
        print()
        
        try:
            # Шаг 1: Трансформация wide → long (если нужно)
            if args.skip_transform:
                print("⏭️  Шаг 1: Пропуск трансформации (CSV уже в long формате)...")
                # Копируем исходный файл во временную директорию для обработки
                transformed_csv_path = os.path.join(tmp_dir, csv_file_path.name)
                shutil.copy2(str(csv_file_path), transformed_csv_path)
                csv_base_name = csv_file_path.stem
                print(f"✅ Файл скопирован во временную директорию: {transformed_csv_path}")
                print()
            else:
                print("🔄 Шаг 1: Трансформация CSV (wide → long)...")
                transformed_csv_path = os.path.join(tmp_dir, f"{csv_file_path.stem}_transformed.csv")
                
                transformer = CSVWideToLongTransformer()
                transform_result = transformer.transform(
                    source_path=str(csv_file_path),
                    destination_path=transformed_csv_path,
                    model_name=args.model_name,
                )
                print(f"✅ Трансформация завершена: {transform_result['rows']} строк, {transform_result['parameters']} параметров")
                print()
                csv_base_name = Path(transformed_csv_path).stem
            
            # Шаг 2: Разбиение на части (если нужно)
            print("✂️ Шаг 2: Разбиение CSV на части...")
            chunker = CSVChunkerService(max_rows_per_chunk=800000)
            chunk_files, manifest = chunker.split_csv_file(
                csv_file_path=transformed_csv_path,
                output_dir=tmp_dir,
                base_filename=csv_base_name,
            )
            print(f"✅ Разбиение завершено: {len(chunk_files)} частей")
            print()
            
            # Шаг 3: Сохранение файлов в хранилище и создание FileUpload записей
            print("💾 Шаг 3: Сохранение файлов в хранилище...")
            csv_file_uploads = []
            
            for i, chunk_file_path in enumerate(chunk_files):
                chunk_filename = os.path.basename(chunk_file_path)
                
                # Создаем путь в хранилище используя build_storage_path
                object_name = build_storage_path(
                    project_id=args.project_id,
                    version_id=args.version_id,
                    filename=chunk_filename,
                    project_name=None,  # Используем короткий ID
                    version_name=None,  # Используем короткий ID
                    use_original_filename=True,
                )
                
                # Загружаем файл в хранилище
                storage_path_full = storage_service.upload_file(
                    chunk_file_path,
                    object_name,
                    content_type="text/csv",
                )
                
                # Создаем FileUpload запись
                file_size = os.path.getsize(chunk_file_path)
                file_upload = FileUpload(
                    user_id=user_id,
                    project_id=args.project_id,
                    version_id=args.version_id,
                    original_filename=chunk_filename,
                    file_type="CSV",
                    file_size=file_size,
                    mime_type="text/csv",
                    storage_path=storage_path_full,
                    storage_bucket=storage_service.bucket or "local",
                    upload_status="completed",
                )
                db.add(file_upload)
                db.flush()  # Получаем ID без коммита
                csv_file_uploads.append(file_upload)
                
                print(f"  ✅ Часть {i+1}/{len(chunk_files)}: {chunk_filename} ({file_size / 1024 / 1024:.2f} MB)")
            
            db.commit()
            print(f"✅ Создано {len(csv_file_uploads)} записей FileUpload")
            print()
            
            # Шаг 4: Загрузка данных в БД
            print("📥 Шаг 4: Загрузка данных в БД...")
            csv_loader = CSVLoaderService()
            total_rows_loaded = 0
            
            for i, (file_upload, chunk_file_path) in enumerate(zip(csv_file_uploads, chunk_files)):
                print(f"  📥 Загружаем часть {i+1}/{len(csv_file_uploads)}: {file_upload.original_filename}")
                
                load_result = await csv_loader.load_csv_to_db(
                    db=db,
                    file_upload=file_upload,
                    csv_file_path=chunk_file_path,
                )
                
                if load_result.get("success"):
                    rows_loaded = load_result.get('rows_loaded', 0)
                    total_rows_loaded += rows_loaded
                    print(f"  ✅ Часть {i+1} загружена: {rows_loaded:,} строк")
                else:
                    print(f"  ❌ Ошибка при загрузке части {i+1}: {load_result.get('error')}")
                    return 1
                
                print()
            
            print("=" * 60)
            print(f"✅ Загрузка завершена успешно!")
            print(f"   Проект: {args.project_id}")
            print(f"   Версия: {args.version_id}")
            print(f"   Модель: {args.model_name}")
            print(f"   Частей CSV: {len(csv_file_uploads)}")
            print(f"   Всего строк: {total_rows_loaded:,}")
            print("=" * 60)
            
            return 0
            
        finally:
            # Удаляем временную директорию
            if os.path.exists(tmp_dir):
                shutil.rmtree(tmp_dir)
                print(f"🗑️ Временная директория удалена: {tmp_dir}")
    
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return 1
    
    finally:
        db.close()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

