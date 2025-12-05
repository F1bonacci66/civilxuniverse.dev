"""
Сервис конвертации IFC в XKT и извлечения метаданных
"""
import subprocess
import os
import json
from pathlib import Path
from typing import Optional, Dict, Any
from app.core.config import settings


class IFC2XKTService:
    """Сервис для конвертации IFC файлов в XKT и извлечения метаданных"""
    
    def __init__(self):
        # Путь к xeokit-converter (может быть в PATH или указан явно)
        self.xeokit_converter = os.getenv(
            "XEOKIT_CONVERTER_PATH",
            "xeokit-convert"  # По умолчанию ищем в PATH
        )
        self.conversion_timeout = int(os.getenv("IFC_TO_XKT_TIMEOUT_SECONDS", "1800"))  # 30 минут
    
    def convert(
        self,
        ifc_file_path: str,
        output_dir: str,
        output_filename: Optional[str] = None,
    ) -> dict:
        """
        Конвертировать IFC файл в XKT
        
        Args:
            ifc_file_path: Путь к IFC файлу
            output_dir: Директория для сохранения XKT файла
            output_filename: Имя выходного XKT файла (опционально, по умолчанию берется из IFC)
            
        Returns:
            dict с результатом конвертации:
            {
                "success": bool,
                "xkt_path": str (путь к созданному XKT файлу),
                "error": str (если success=False)
            }
        """
        print(f"🔄 Начинаем конвертацию IFC→XKT: {ifc_file_path}")
        
        if not os.path.exists(ifc_file_path):
            error_msg = f"IFC файл не найден: {ifc_file_path}"
            print(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
            }
        
        # Создаем выходную директорию, если не существует
        output_dir_path = Path(output_dir)
        output_dir_path.mkdir(parents=True, exist_ok=True)
        
        # Определяем имя выходного файла
        if not output_filename:
            ifc_stem = Path(ifc_file_path).stem
            output_filename = f"{ifc_stem}.xkt"
        
        xkt_path = output_dir_path / output_filename
        
        try:
            # Формируем команду для xeokit-converter
            # Формат: xeokit-convert {input_ifc} -o {output_dir} -f {output_filename}
            cmd = [
                self.xeokit_converter,
                ifc_file_path,
                "-o", str(output_dir),
            ]
            
            # Если указано имя файла, добавляем параметр
            if output_filename:
                cmd.extend(["-f", output_filename])
            
            print(f"🚀 Запускаем команду: {' '.join(cmd)}")
            print(f"📝 Выходной XKT файл: {xkt_path}")
            
            # Запускаем конвертацию
            process = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=self.conversion_timeout,
                cwd=str(output_dir_path),
            )
            
            print(f"📊 Результат конвертации: returncode={process.returncode}")
            if process.stdout:
                stdout_preview = process.stdout[:1000] if len(process.stdout) > 1000 else process.stdout
                print(f"📤 stdout: {stdout_preview}")
                if len(process.stdout) > 1000:
                    print(f"   ... (всего {len(process.stdout)} символов)")
            if process.stderr:
                stderr_preview = process.stderr[:1000] if len(process.stderr) > 1000 else process.stderr
                print(f"⚠️ stderr: {stderr_preview}")
                if len(process.stderr) > 1000:
                    print(f"   ... (всего {len(process.stderr)} символов)")
            
            # Проверяем, создан ли XKT файл
            # xeokit-converter может создавать файл с другим именем, ищем по расширению
            if not xkt_path.exists():
                # Ищем XKT файлы в выходной директории
                xkt_files = list(output_dir_path.glob("*.xkt"))
                if xkt_files:
                    # Берем самый новый файл
                    xkt_path = max(xkt_files, key=lambda p: p.stat().st_mtime)
                    print(f"📦 Найден XKT файл: {xkt_path.name}")
                else:
                    error_msg = f"XKT файл не был создан после конвертации. Проверены: {output_dir}"
                    if process.returncode != 0:
                        error_msg += f"\nКод возврата: {process.returncode}"
                    if process.stderr:
                        error_msg += f"\nstderr: {process.stderr[:500]}"
                    print(f"❌ {error_msg}")
                    return {
                        "success": False,
                        "error": error_msg,
                    }
            
            # Проверяем размер файла
            xkt_size = xkt_path.stat().st_size
            if xkt_size == 0:
                error_msg = f"XKT файл пустой: {xkt_path}"
                print(f"❌ {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                }
            
            print(f"✅ Конвертация IFC→XKT завершена успешно")
            print(f"   XKT файл: {xkt_path}")
            print(f"   Размер: {xkt_size} байт ({xkt_size / 1024 / 1024:.2f} MB)")
            
            return {
                "success": True,
                "xkt_path": str(xkt_path),
            }
        
        except subprocess.TimeoutExpired:
            error_msg = f"Конвертация IFC→XKT превысила таймаут {self.conversion_timeout} секунд"
            print(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
            }
        except FileNotFoundError:
            error_msg = f"xeokit-converter не найден: {self.xeokit_converter}. Убедитесь, что он установлен и доступен в PATH."
            print(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
            }
        except Exception as e:
            error_msg = f"Ошибка при конвертации IFC→XKT: {str(e)}"
            print(f"❌ {error_msg}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return {
                "success": False,
                "error": error_msg,
            }
    
    def extract_metadata(
        self,
        ifc_file_path: str,
        file_upload_id: Optional[str] = None,
        model_name: Optional[str] = None,
    ) -> dict:
        """
        Извлечь метаданные из IFC файла
        
        Args:
            ifc_file_path: Путь к IFC файлу
            file_upload_id: ID загруженного файла (опционально)
            model_name: Имя модели (опционально)
            
        Returns:
            dict с метаданными в формате metadata.json:
            {
                "file_upload_id": str,
                "model_name": str,
                "elements": {
                    "element_id": {
                        "category": str,
                        "family": str,
                        "type": str,
                        "parameters": {
                            "parameter_name": "parameter_value"
                        }
                    }
                }
            }
        """
        print(f"📋 Начинаем извлечение метаданных из IFC: {ifc_file_path}")
        
        if not os.path.exists(ifc_file_path):
            error_msg = f"IFC файл не найден: {ifc_file_path}"
            print(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
            }
        
        try:
            # Импортируем IfcOpenShell
            try:
                import ifcopenshell
            except ImportError:
                error_msg = "IfcOpenShell не установлен. Установите: pip install ifcopenshell"
                print(f"❌ {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                }
            
            # Открываем IFC файл
            ifc_file = ifcopenshell.open(ifc_file_path)
            
            # Определяем имя модели
            if not model_name:
                model_name = Path(ifc_file_path).stem
            
            # Инициализируем структуру метаданных
            metadata = {
                "file_upload_id": file_upload_id or "",
                "model_name": model_name,
                "elements": {},
            }
            
            # Извлекаем информацию о всех элементах
            print(f"📊 Извлечение информации об элементах...")
            
            # Получаем все элементы (IfcProduct и его подклассы)
            products = ifc_file.by_type("IfcProduct")
            
            element_count = 0
            for product in products:
                try:
                    # Получаем GlobalId как element_id
                    element_id = product.GlobalId if hasattr(product, "GlobalId") else None
                    if not element_id:
                        continue
                    
                    # Получаем тип элемента (Category)
                    category = product.is_a() if hasattr(product, "is_a") else "Unknown"
                    
                    # Получаем Name
                    name = product.Name if hasattr(product, "Name") and product.Name else None
                    
                    # Получаем Type (IfcTypeObject)
                    element_type = None
                    if hasattr(product, "IsTypedBy") and product.IsTypedBy:
                        for rel in product.IsTypedBy:
                            if hasattr(rel, "RelatingType") and rel.RelatingType:
                                element_type_obj = rel.RelatingType
                                element_type = element_type_obj.Name if hasattr(element_type_obj, "Name") and element_type_obj.Name else element_type_obj.is_a()
                    
                    # Получаем Family (IfcTypeProduct)
                    family = None
                    if hasattr(product, "IsTypedBy") and product.IsTypedBy:
                        for rel in product.IsTypedBy:
                            if hasattr(rel, "RelatingType") and rel.RelatingType:
                                type_obj = rel.RelatingType
                                if hasattr(type_obj, "is_a") and "IfcTypeProduct" in type_obj.is_a():
                                    family = type_obj.Name if hasattr(type_obj, "Name") and type_obj.Name else type_obj.is_a()
                    
                    # Инициализируем элемент в метаданных
                    element_data = {
                        "category": category,
                        "family": family or "",
                        "type": element_type or "",
                        "name": name or "",
                        "parameters": {},
                    }
                    
                    # Извлекаем параметры (Property Sets)
                    # Shared Properties (IfcPropertySet)
                    if hasattr(product, "IsDefinedBy") and product.IsDefinedBy:
                        for rel in product.IsDefinedBy:
                            if hasattr(rel, "RelatingPropertyDefinition"):
                                prop_def = rel.RelatingPropertyDefinition
                                if hasattr(prop_def, "is_a") and "IfcPropertySet" in prop_def.is_a():
                                    if hasattr(prop_def, "HasProperties") and prop_def.HasProperties:
                                        for prop in prop_def.HasProperties:
                                            prop_name = prop.Name if hasattr(prop, "Name") and prop.Name else None
                                            if prop_name:
                                                # Получаем значение свойства
                                                prop_value = None
                                                if hasattr(prop, "NominalValue") and prop.NominalValue:
                                                    nominal_value = prop.NominalValue
                                                    if hasattr(nominal_value, "wrappedValue"):
                                                        prop_value = nominal_value.wrappedValue
                                                    elif hasattr(nominal_value, "Value"):
                                                        prop_value = nominal_value.Value
                                                elif hasattr(prop, "EnumerationValues") and prop.EnumerationValues:
                                                    # Для перечислений берем первое значение
                                                    if prop.EnumerationValues:
                                                        prop_value = prop.EnumerationValues[0]
                                                
                                                if prop_value is not None:
                                                    element_data["parameters"][prop_name] = str(prop_value)
                    
                    # Instance Properties (IfcElementQuantity)
                    if hasattr(product, "IsDefinedBy") and product.IsDefinedBy:
                        for rel in product.IsDefinedBy:
                            if hasattr(rel, "RelatingPropertyDefinition"):
                                prop_def = rel.RelatingPropertyDefinition
                                if hasattr(prop_def, "is_a") and "IfcElementQuantity" in prop_def.is_a():
                                    if hasattr(prop_def, "Quantities") and prop_def.Quantities:
                                        for qty in prop_def.Quantities:
                                            qty_name = qty.Name if hasattr(qty, "Name") and qty.Name else None
                                            if qty_name:
                                                # Получаем значение количества
                                                qty_value = None
                                                if hasattr(qty, "LengthValue") and qty.LengthValue:
                                                    qty_value = qty.LengthValue
                                                elif hasattr(qty, "AreaValue") and qty.AreaValue:
                                                    qty_value = qty.AreaValue
                                                elif hasattr(qty, "VolumeValue") and qty.VolumeValue:
                                                    qty_value = qty.VolumeValue
                                                elif hasattr(qty, "CountValue") and qty.CountValue:
                                                    qty_value = qty.CountValue
                                                
                                                if qty_value is not None:
                                                    element_data["parameters"][qty_name] = str(qty_value)
                    
                    # Сохраняем элемент в метаданных
                    metadata["elements"][element_id] = element_data
                    element_count += 1
                    
                    # Логируем прогресс каждые 1000 элементов
                    if element_count % 1000 == 0:
                        print(f"   Обработано элементов: {element_count}")
                
                except Exception as e:
                    # Пропускаем элементы с ошибками, но логируем
                    print(f"⚠️ Ошибка при обработке элемента: {e}")
                    continue
            
            print(f"✅ Извлечение метаданных завершено: {element_count} элементов")
            
            return {
                "success": True,
                "metadata": metadata,
            }
        
        except Exception as e:
            error_msg = f"Ошибка при извлечении метаданных: {str(e)}"
            print(f"❌ {error_msg}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return {
                "success": False,
                "error": error_msg,
            }

