"""
Сервис конвертации IFC в CSV
"""
import subprocess
import os
from pathlib import Path
from typing import Optional
from app.core.config import settings


class IFC2CSVService:
    """Сервис для конвертации IFC файлов в CSV"""
    
    def __init__(self):
        self.python_executable = settings.PYTHON_EXECUTABLE
        self.script_path = settings.IFC_TO_CSV_SCRIPT_PATH
    
    def convert(
        self,
        ifc_file_path: str,
        output_csv_path: Optional[str] = None,
        model_name: Optional[str] = None,
    ) -> dict:
        """
        Конвертировать IFC файл в CSV
        
        Args:
            ifc_file_path: Путь к IFC файлу
            output_csv_path: Путь для сохранения CSV файла (опционально)
            model_name: Чистое название модели, которое нужно использовать в CSV
            
        Returns:
            Результат конвертации
        """
        print(f"🔄 Начинаем конвертацию IFC→CSV: {ifc_file_path}")
        
        # Проверяем существование скрипта
        script_path_abs = os.path.abspath(self.script_path)
        if not os.path.exists(script_path_abs):
            error_msg = f"Python скрипт не найден: {script_path_abs}"
            print(f"❌ {error_msg}")
            raise FileNotFoundError(error_msg)
        
        if not os.path.exists(ifc_file_path):
            error_msg = f"IFC файл не найден: {ifc_file_path}"
            print(f"❌ {error_msg}")
            raise FileNotFoundError(error_msg)
        
        # Если путь вывода не указан, создаем рядом с IFC файлом
        if not output_csv_path:
            output_csv_path = str(Path(ifc_file_path).with_suffix(".csv"))
        
        print(f"📝 Выходной CSV файл: {output_csv_path}")
        
        try:
            # Формируем команду
            cmd = [
                self.python_executable,
                script_path_abs,
                ifc_file_path,
                output_csv_path,
            ]
            
            if model_name:
                cmd.extend(["--model-name", model_name])
            
            print(f"🚀 Запускаем команду: {' '.join(cmd)}")
            
            # Запускаем скрипт
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding='utf-8',
                errors='replace',
            )
            
            stdout, stderr = process.communicate()
            
            print(f"📊 Результат конвертации: returncode={process.returncode}")
            if stdout:
                print(f"📤 stdout: {stdout[:500]}...")  # Первые 500 символов
            if stderr:
                print(f"⚠️ stderr: {stderr[:500]}...")  # Первые 500 символов
            
            if process.returncode == 0 and os.path.exists(output_csv_path):
                csv_size = os.path.getsize(output_csv_path)
                print(f"✅ Конвертация завершена успешно. Размер CSV: {csv_size} байт")
                return {
                    "success": True,
                    "output_path": output_csv_path,
                    "stdout": stdout,
                    "stderr": stderr,
                }
            else:
                error_msg = stderr or "Конвертация завершилась с ошибкой"
                print(f"❌ Ошибка конвертации: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                    "stdout": stdout,
                    "stderr": stderr,
                    "returncode": process.returncode,
                }
        except Exception as e:
            error_msg = f"Исключение при конвертации: {str(e)}"
            print(f"❌ {error_msg}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": error_msg,
            }

