"""
Сервис для разбиения больших CSV файлов на части
"""
import csv
import os
import json
from pathlib import Path
from typing import List, Dict, Optional, Tuple


class CSVChunkerService:
    """Сервис для разбиения больших CSV файлов на части"""
    
    # Максимальное количество строк в одном файле (800k для совместимости с Excel)
    MAX_ROWS_PER_CHUNK = 800000
    
    def __init__(self, max_rows_per_chunk: int = None):
        """
        Инициализация сервиса
        
        Args:
            max_rows_per_chunk: Максимальное количество строк в одном файле (по умолчанию 800k)
        """
        self.max_rows_per_chunk = max_rows_per_chunk or self.MAX_ROWS_PER_CHUNK
    
    def count_csv_rows(self, csv_file_path: str) -> int:
        """
        Подсчитать количество строк в CSV файле (без заголовка)
        
        Args:
            csv_file_path: Путь к CSV файлу
            
        Returns:
            Количество строк данных (без заголовка)
        """
        row_count = 0
        encodings = ['utf-8-sig', 'utf-8', 'cp1251']
        
        for encoding in encodings:
            try:
                with open(csv_file_path, 'r', encoding=encoding, newline='') as f:
                    reader = csv.reader(f)
                    # Пропускаем заголовок
                    next(reader, None)
                    # Считаем строки
                    for _ in reader:
                        row_count += 1
                break
            except (UnicodeDecodeError, StopIteration):
                continue
        
        return row_count
    
    def split_csv_file(
        self,
        csv_file_path: str,
        output_dir: str,
        base_filename: str,
    ) -> Tuple[List[str], Dict]:
        """
        Разбить CSV файл на несколько частей
        
        Args:
            csv_file_path: Путь к исходному CSV файлу
            output_dir: Директория для сохранения частей
            base_filename: Базовое имя файла (без расширения)
            
        Returns:
            Tuple (список путей к частям, manifest с метаданными)
        """
        print(f"📊 Начинаем разбиение CSV файла: {csv_file_path}")
        
        # Проверяем количество строк
        total_rows = self.count_csv_rows(csv_file_path)
        print(f"📊 Всего строк в CSV: {total_rows}")
        
        # Если строк меньше лимита, не разбиваем
        if total_rows <= self.max_rows_per_chunk:
            print(f"✅ Файл не требует разбиения ({total_rows} строк <= {self.max_rows_per_chunk})")
            return [csv_file_path], {
                "total_rows": total_rows,
                "total_parts": 1,
                "parts": [
                    {
                        "part_number": 1,
                        "filename": os.path.basename(csv_file_path),
                        "rows": total_rows,
                        "is_original": True
                    }
                ]
            }
        
        # Разбиваем на части
        print(f"✂️ Разбиваем файл на части (макс. {self.max_rows_per_chunk} строк в каждой)...")
        
        chunk_files = []
        manifest_parts = []
        
        # Пробуем разные кодировки для чтения
        encodings = ['utf-8-sig', 'utf-8', 'cp1251']
        csv_file_handle = None
        used_encoding = None
        
        for encoding in encodings:
            try:
                csv_file_handle = open(csv_file_path, 'r', encoding=encoding, newline='')
                used_encoding = encoding
                break
            except UnicodeDecodeError:
                continue
        
        if csv_file_handle is None:
            raise ValueError("Не удалось прочитать CSV файл ни в одной из кодировок")
        
        try:
            reader = csv.DictReader(csv_file_handle)
            fieldnames = reader.fieldnames
            
            if not fieldnames:
                raise ValueError("CSV файл не содержит заголовков")
            
            current_chunk = 1
            current_row_count = 0
            current_chunk_file = None
            current_writer = None
            
            for row in reader:
                # Если нужно начать новый файл
                if current_row_count == 0 or current_row_count >= self.max_rows_per_chunk:
                    # Закрываем предыдущий файл, если есть
                    if current_chunk_file:
                        current_chunk_file.close()
                        chunk_files.append(current_chunk_path)
                        manifest_parts.append({
                            "part_number": current_chunk - 1,
                            "filename": os.path.basename(current_chunk_path),
                            "rows": current_row_count,
                            "is_original": False
                        })
                        print(f"  ✅ Создана часть {current_chunk - 1}: {current_row_count} строк")
                    
                    # Создаем новый файл
                    chunk_filename = f"{base_filename}_part{current_chunk}.csv"
                    current_chunk_path = os.path.join(output_dir, chunk_filename)
                    current_chunk_file = open(current_chunk_path, 'w', encoding='utf-8-sig', newline='')
                    current_writer = csv.DictWriter(current_chunk_file, fieldnames=fieldnames)
                    current_writer.writeheader()
                    current_row_count = 0
                    current_chunk += 1
                
                # Записываем строку
                current_writer.writerow(row)
                current_row_count += 1
            
            # Закрываем последний файл
            if current_chunk_file:
                current_chunk_file.close()
                chunk_files.append(current_chunk_path)
                manifest_parts.append({
                    "part_number": current_chunk - 1,
                    "filename": os.path.basename(current_chunk_path),
                    "rows": current_row_count,
                    "is_original": False
                })
                print(f"  ✅ Создана часть {current_chunk - 1}: {current_row_count} строк")
        
        finally:
            csv_file_handle.close()
        
        total_parts = len(chunk_files)
        print(f"✅ Файл разбит на {total_parts} частей")
        
        # Создаем manifest
        manifest = {
            "total_rows": total_rows,
            "total_parts": total_parts,
            "max_rows_per_chunk": self.max_rows_per_chunk,
            "original_filename": os.path.basename(csv_file_path),
            "parts": manifest_parts
        }
        
        # Сохраняем manifest в JSON
        manifest_path = os.path.join(output_dir, f"{base_filename}_manifest.json")
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        
        print(f"📄 Manifest сохранен: {manifest_path}")
        
        return chunk_files, manifest
    
    def get_manifest(self, manifest_path: str) -> Dict:
        """
        Загрузить manifest из файла
        
        Args:
            manifest_path: Путь к manifest.json
            
        Returns:
            Словарь с метаданными
        """
        with open(manifest_path, 'r', encoding='utf-8') as f:
            return json.load(f)







