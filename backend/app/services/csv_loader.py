"""
Сервис для загрузки CSV данных в базу данных
"""
import csv
import os
import json
from typing import List, Dict, Optional
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import text

from app.models.upload import CSVDataRow, FileUpload
from app.core.storage import storage_service


class CSVLoaderService:
    """Сервис для загрузки данных CSV в БД"""
    
    def __init__(self):
        self.storage_service = storage_service
        self.batch_size = 1000  # Размер батча для вставки данных
    
    async def load_csv_to_db(
        self,
        db: Session,
        file_upload: FileUpload,
        csv_file_path: Optional[str] = None,
    ) -> Dict:
        """
        Загрузить CSV файл в базу данных
        
        Args:
            db: Сессия БД
            file_upload: Запись FileUpload для CSV файла
            csv_file_path: Путь к CSV файлу (если None, скачиваем из хранилища)
            
        Returns:
            Результат загрузки с количеством загруженных строк
        """
        print(f"📥 Начинаем загрузку CSV данных в БД для file_upload_id={file_upload.id}")
        
        tmp_file_path = None
        try:
            # Если путь не указан, скачиваем файл из хранилища
            if not csv_file_path:
                csv_file_path = await self._download_csv_file(file_upload)
                tmp_file_path = csv_file_path  # Помечаем для удаления
            
            if not os.path.exists(csv_file_path):
                raise FileNotFoundError(f"CSV файл не найден: {csv_file_path}")
            
            # Проверяем, что файл уже не загружен
            existing_count = db.query(CSVDataRow).filter(
                CSVDataRow.file_upload_id == file_upload.id
            ).count()
            
            if existing_count > 0:
                print(f"⚠️ Данные для file_upload_id={file_upload.id} уже загружены ({existing_count} строк)")
                return {
                    "success": True,
                    "rows_loaded": existing_count,
                    "message": "Данные уже загружены",
                    "skipped": True
                }
            
            # Парсим CSV файл
            print(f"📖 Парсим CSV файл: {csv_file_path}")
            rows_data = self._parse_csv_file(csv_file_path)
            
            if not rows_data:
                raise ValueError("CSV файл пуст или не содержит данных")
            
            print(f"✅ Распарсено строк: {len(rows_data)}")
            
            # Загружаем данные в БД батчами
            total_loaded = await self._insert_rows_batch(
                db=db,
                file_upload=file_upload,
                rows_data=rows_data
            )
            
            print(f"✅ Загружено строк в БД: {total_loaded}")
            
            return {
                "success": True,
                "rows_loaded": total_loaded,
                "total_rows": len(rows_data),
                "file_upload_id": str(file_upload.id)
            }
            
        except Exception as e:
            error_msg = f"Ошибка при загрузке CSV данных: {str(e)}"
            print(f"❌ {error_msg}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": error_msg,
                "rows_loaded": 0
            }
        finally:
            # Удаляем временный файл, если мы его скачивали
            if tmp_file_path and os.path.exists(tmp_file_path):
                try:
                    os.unlink(tmp_file_path)
                    print(f"🗑️ Временный файл удален: {tmp_file_path}")
                except Exception as e:
                    print(f"⚠️ Не удалось удалить временный файл: {e}")
    
    async def _download_csv_file(self, file_upload: FileUpload) -> str:
        """Скачать CSV файл из хранилища во временный файл"""
        import tempfile
        
        tmp_dir = tempfile.mkdtemp()
        tmp_file_path = os.path.join(tmp_dir, file_upload.original_filename)
        
        storage_path = file_upload.storage_path
        if storage_path.startswith("local://"):
            storage_path = storage_path[8:]
        
        # Скачиваем файл
        if self.storage_service._use_local_storage:
            local_storage_path = self.storage_service._local_storage_path
            source_path = os.path.join(local_storage_path, storage_path)
            if os.path.exists(source_path):
                import shutil
                shutil.copy2(source_path, tmp_file_path)
            else:
                raise FileNotFoundError(f"Файл не найден в локальном хранилище: {source_path}")
        else:
            # Скачиваем из MinIO/S3
            self.storage_service.download_file(storage_path, tmp_file_path)
        
        return tmp_file_path
    
    def _parse_csv_file(self, csv_file_path: str) -> List[Dict]:
        """
        Парсить CSV файл и вернуть список словарей
        
        Ожидаемые колонки:
        - ModelName
        - ElementId
        - Category
        - ParameterName
        - ParameterValue
        """
        rows_data = []
        
        # Пробуем разные кодировки
        encodings = ['utf-8-sig', 'utf-8', 'cp1251']
        csv_content = None
        used_encoding = None
        
        for encoding in encodings:
            try:
                with open(csv_file_path, 'r', encoding=encoding, newline='') as f:
                    csv_content = f.read()
                    used_encoding = encoding
                    break
            except UnicodeDecodeError:
                continue
        
        if csv_content is None:
            raise ValueError("Не удалось прочитать CSV файл ни в одной из кодировок")
        
        print(f"📝 Используем кодировку: {used_encoding}")
        
        # Парсим CSV
        from io import StringIO
        csv_reader = csv.DictReader(StringIO(csv_content))
        
        row_number = 0
        for row in csv_reader:
            row_number += 1
            
            # Создаем словарь с данными строки
            row_data = {
                'row_number': row_number,
                'model_name': row.get('ModelName', '').strip() if row.get('ModelName') else None,
                'element_id': row.get('ElementId', '').strip() if row.get('ElementId') else None,
                'category': row.get('Category', '').strip() if row.get('Category') else None,
                'parameter_name': row.get('ParameterName', '').strip() if row.get('ParameterName') else None,
                'parameter_value': row.get('ParameterValue', '').strip() if row.get('ParameterValue') else None,
            }
            
            # Сохраняем все данные в JSON для гибкости
            row_data['data'] = json.dumps(row, ensure_ascii=False)
            
            rows_data.append(row_data)
        
        return rows_data
    
    async def _insert_rows_batch(
        self,
        db: Session,
        file_upload: FileUpload,
        rows_data: List[Dict]
    ) -> int:
        """
        Вставить строки данных в БД батчами
        
        Использует bulk insert для производительности
        """
        total_inserted = 0
        
        # Разбиваем на батчи
        for i in range(0, len(rows_data), self.batch_size):
            batch = rows_data[i:i + self.batch_size]
            
            # Подготавливаем данные для вставки
            values_to_insert = []
            for row_data in batch:
                values_to_insert.append({
                    'file_upload_id': str(file_upload.id),
                    'user_id': str(file_upload.user_id),
                    'project_id': str(file_upload.project_id),
                    'version_id': str(file_upload.version_id),
                    'row_number': row_data['row_number'],
                    'model_name': row_data['model_name'],
                    'element_id': row_data['element_id'],
                    'category': row_data['category'],
                    'parameter_name': row_data['parameter_name'],
                    'parameter_value': row_data['parameter_value'],
                    'data': row_data['data'],
                })
            
            # Используем bulk insert для производительности
            try:
                # Для PostgreSQL используем insert().values() для массовой вставки
                stmt = insert(CSVDataRow).values(values_to_insert)
                db.execute(stmt)
                db.commit()
                
                total_inserted += len(batch)
                print(f"  ✅ Загружено батч: {len(batch)} строк (всего: {total_inserted}/{len(rows_data)})")
                
            except Exception as e:
                db.rollback()
                print(f"❌ Ошибка при вставке батча: {e}")
                raise
        
        return total_inserted
    
    def get_csv_statistics(self, db: Session, file_upload_id: str) -> Dict:
        """
        Получить статистику по загруженным CSV данным
        
        Returns:
            Словарь со статистикой
        """
        from sqlalchemy import func
        
        stats = db.query(
            func.count(CSVDataRow.id).label('total_rows'),
            func.count(func.distinct(CSVDataRow.element_id)).label('unique_elements'),
            func.count(func.distinct(CSVDataRow.category)).label('unique_categories'),
            func.count(func.distinct(CSVDataRow.parameter_name)).label('unique_parameters'),
        ).filter(
            CSVDataRow.file_upload_id == file_upload_id
        ).first()
        
        if not stats or stats.total_rows == 0:
            return {
                "total_rows": 0,
                "unique_elements": 0,
                "unique_categories": 0,
                "unique_parameters": 0
            }
        
        return {
            "total_rows": stats.total_rows,
            "unique_elements": stats.unique_elements,
            "unique_categories": stats.unique_categories,
            "unique_parameters": stats.unique_parameters
        }

