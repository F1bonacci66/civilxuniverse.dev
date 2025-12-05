#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
IFC to CSV Exporter (dataviewer2023 format)
Экспорт IFC файла в CSV в формате dataviewer2023

Формат CSV: ModelName,ElementId,Category,ParameterName,ParameterValue

Требования:
- Python 3.7+
- ifcopenshell (pip install ifcopenshell)

Использование:
    python ifc_to_csv_dataviewer.py input.ifc [output.csv]
    py -3.12 ifc_to_csv_dataviewer.py input.ifc [output.csv]  # для Python 3.12
    или используйте ifc_to_csv_dataviewer.bat
"""

import sys
import os
from pathlib import Path
import csv
from typing import Dict, List, Any, Set

# Попытка импорта ifcopenshell
try:
    import ifcopenshell
    import ifcopenshell.util.element
    version = getattr(ifcopenshell, 'version', 'unknown')
    print(f"[OK] ifcopenshell найден (версия: {version})")
except ImportError as e:
    print("="*70)
    print("ОШИБКА: ifcopenshell не установлен!")
    print("="*70)
    print("\nifcopenshell требует установки скомпилированных библиотек.")
    print("\nРЕКОМЕНДУЕМЫЙ СПОСОБ УСТАНОВКИ (Windows):")
    print("-" * 70)
    print("1. Установите через conda (самый простой способ):")
    print("   conda install -c conda-forge ifcopenshell")
    print("\n2. Или установите через pip (может не работать без компилятора):")
    print("   pip install ifcopenshell")
    print("\n3. Или скачайте готовый wheel файл с GitHub:")
    print("   https://github.com/IfcOpenShell/IfcOpenShell/releases")
    print("   Найдите файл для Python 3.8 Windows x64:")
    print("   ifcopenshell-X.X.X-cp38-cp38-win_amd64.whl")
    print("   Затем установите: pip install путь_к_файлу.whl")
    print("-" * 70)
    print("\nАЛЬТЕРНАТИВА:")
    print("Если вы хотите использовать локальные исходники из IfcOpenShell,")
    print("их нужно сначала скомпилировать. См. документацию:")
    print("https://github.com/IfcOpenShell/IfcOpenShell/wiki")
    print("="*70)
    print(f"\nДетали ошибки: {e}")
    print("="*70)
    sys.exit(1)


class IFCDataviewerCSVExporter:
    """Класс для экспорта IFC в CSV в формате dataviewer2023"""
    
    def __init__(self, ifc_file: str):
        """
        Инициализация экспортера
        
        Args:
            ifc_file: Путь к IFC файлу
        """
        self.ifc_file = Path(ifc_file)
        if not self.ifc_file.exists():
            raise FileNotFoundError(f"IFC файл не найден: {ifc_file}")
        
        print(f"Загрузка IFC файла: {self.ifc_file}")
        try:
            self.ifc = ifcopenshell.open(str(self.ifc_file))
            print(f"[OK] Файл успешно загружен (IFC версия: {self.ifc.schema})")
        except Exception as e:
            raise Exception(f"Ошибка при открытии IFC файла: {e}")
        
        # Имя модели - имя файла без расширения
        self.model_name = self.ifc_file.stem
    
    def escape_csv_value(self, value: Any) -> str:
        """
        Экранирование значения для CSV (аналогично dataviewer2023)
        
        Args:
            value: Значение для экранирования
            
        Returns:
            Экранированное значение
        """
        if value is None:
            return ""
        
        # Преобразуем в строку
        str_value = str(value)
        
        if not str_value:
            return ""
        
        # Если значение содержит запятую, кавычку или перенос строки, заключаем в кавычки
        if "," in str_value or '"' in str_value or "\n" in str_value or "\r" in str_value:
            # Заменяем двойные кавычки на две двойные кавычки
            str_value = str_value.replace('"', '""')
            return f'"{str_value}"'
        
        return str_value
    
    def get_element_global_id(self, element) -> str:
        """
        Получить GlobalId элемента (или внутренний ID как запасной вариант)
        
        Args:
            element: Элемент IFC
            
        Returns:
            GlobalId элемента или внутренний ID
        """
        if hasattr(element, 'GlobalId') and element.GlobalId:
            return element.GlobalId
        # Если GlobalId нет, используем внутренний ID
        return f"ID_{element.id()}"
    
    def get_element_category(self, element) -> str:
        """
        Получить категорию элемента (тип IFC)
        
        Args:
            element: Элемент IFC
            
        Returns:
            Категория (тип элемента)
        """
        return element.is_a()
    
    def get_all_attributes(self, element) -> Dict[str, Any]:
        """
        Извлечь все базовые атрибуты элемента
        
        Args:
            element: Элемент IFC
            
        Returns:
            Словарь атрибутов
        """
        attributes = {}
        
        # Получаем все атрибуты элемента
        try:
            attr_names = element.__class__.attribute_names()
            for i, attr_name in enumerate(attr_names):
                try:
                    # Пропускаем GlobalId, так как он уже используется как ElementId
                    if attr_name == 'GlobalId':
                        continue
                    
                    # Извлекаем все атрибуты, кроме служебных связей
                    # Пропускаем только сложные связи, которые не содержат полезной информации
                    skip_attrs = ['GlobalId', 'OwnerHistory']
                    
                    if attr_name not in skip_attrs:
                        attr_value = element[i]
                        
                        # Пропускаем None значения
                        if attr_value is None:
                            continue
                        
                        # Обрабатываем простые значения (строки, числа, булевы)
                        if isinstance(attr_value, (str, int, float, bool)):
                            attributes[attr_name] = attr_value
                        elif isinstance(attr_value, ifcopenshell.entity_instance):
                            # Для связанных объектов пытаемся извлечь полезную информацию
                            try:
                                # Пробуем Name, GlobalId, или тип
                                if hasattr(attr_value, 'Name') and attr_value.Name:
                                    attributes[f"Attr_{attr_name}"] = attr_value.Name
                                elif hasattr(attr_value, 'GlobalId') and attr_value.GlobalId:
                                    attributes[f"Attr_{attr_name}"] = attr_value.GlobalId
                                elif hasattr(attr_value, 'is_a'):
                                    attributes[f"Attr_{attr_name}"] = f"{attr_value.is_a()}"
                                else:
                                    attributes[f"Attr_{attr_name}"] = str(attr_value.id())
                            except:
                                try:
                                    attributes[f"Attr_{attr_name}"] = str(attr_value.id())
                                except:
                                    pass
                        elif isinstance(attr_value, (list, tuple)):
                            # Для списков преобразуем в строку
                            if attr_value:
                                try:
                                    # Проверяем тип элементов списка
                                    first_item = attr_value[0] if attr_value else None
                                    if first_item and isinstance(first_item, ifcopenshell.entity_instance):
                                        # Если список объектов, извлекаем их Name или GlobalId
                                        values = []
                                        for item in attr_value[:50]:  # Ограничиваем для производительности
                                            try:
                                                if hasattr(item, 'Name') and item.Name:
                                                    values.append(str(item.Name))
                                                elif hasattr(item, 'GlobalId') and item.GlobalId:
                                                    values.append(item.GlobalId)
                                                elif hasattr(item, 'is_a'):
                                                    values.append(item.is_a())
                                                else:
                                                    values.append(str(item.id()))
                                            except:
                                                pass
                                        if values:
                                            attributes[f"Attr_{attr_name}"] = ", ".join(values)
                                    else:
                                        # Простые значения
                                        str_values = [str(v) for v in attr_value[:100]]
                                        attributes[f"Attr_{attr_name}"] = ", ".join(str_values)
                                except:
                                    # Если не удалось обработать список, просто конвертируем в строку
                                    try:
                                        attributes[f"Attr_{attr_name}"] = str(len(attr_value))
                                    except:
                                        pass
                except Exception as e:
                    # Игнорируем ошибки при чтении атрибутов
                    pass
        except Exception as e:
            # Игнорируем ошибки
            pass
        
        return attributes
    
    def get_all_properties(self, element) -> Dict[str, Any]:
        """
        Извлечь все свойства элемента (Property Sets и Quantity Sets)
        
        Args:
            element: Элемент IFC
            
        Returns:
            Словарь свойств
        """
        properties = {}
        
        try:
            # Получаем все Property Sets и Quantity Sets
            # should_inherit=True означает, что будут наследоваться свойства от типа
            psets = ifcopenshell.util.element.get_psets(element, should_inherit=True, verbose=False)
            
            for pset_name, pset_data in psets.items():
                if not pset_data or not isinstance(pset_data, dict):
                    continue
                    
                # Обрабатываем каждое свойство в Property Set
                for prop_name, prop_value in pset_data.items():
                    # Пропускаем служебное поле 'id'
                    if prop_name == 'id':
                        continue
                    
                    # Формируем имя параметра: PsetName_PropertyName
                    param_name = f"{pset_name}_{prop_name}"
                    
                    # Обрабатываем значение
                    if prop_value is None:
                        properties[param_name] = ""
                    elif isinstance(prop_value, (list, tuple)):
                        # Для списков преобразуем в строку
                        str_values = []
                        for v in prop_value:
                            if v is None:
                                continue
                            str_values.append(str(v))
                        properties[param_name] = ", ".join(str_values) if str_values else ""
                    elif isinstance(prop_value, dict):
                        # Если значение - словарь (вложенная структура), преобразуем в строку
                        properties[param_name] = str(prop_value)
                    else:
                        # Простое значение
                        properties[param_name] = prop_value
            
            # Также получаем отдельно Property Sets и Quantity Sets для полноты
            try:
                psets_only = ifcopenshell.util.element.get_psets(element, psets_only=True, should_inherit=True)
                qtos_only = ifcopenshell.util.element.get_psets(element, qtos_only=True, should_inherit=True)
                
                # Если были получены отдельно, добавляем их тоже (могут быть дополнительные)
                for pset_name, pset_data in psets_only.items():
                    if pset_name not in psets:  # Добавляем только если еще нет
                        for prop_name, prop_value in pset_data.items():
                            if prop_name == 'id':
                                continue
                            param_name = f"Pset_{pset_name}_{prop_name}"
                            if param_name not in properties:
                                if prop_value is None:
                                    properties[param_name] = ""
                                elif isinstance(prop_value, (list, tuple)):
                                    properties[param_name] = ", ".join(str(v) for v in prop_value if v is not None)
                                else:
                                    properties[param_name] = prop_value
                
                for qto_name, qto_data in qtos_only.items():
                    for prop_name, prop_value in qto_data.items():
                        if prop_name == 'id':
                            continue
                        param_name = f"Qto_{qto_name}_{prop_name}"
                        if param_name not in properties:
                            if prop_value is None:
                                properties[param_name] = ""
                            elif isinstance(prop_value, (list, tuple)):
                                properties[param_name] = ", ".join(str(v) for v in prop_value if v is not None)
                            else:
                                properties[param_name] = prop_value
            except:
                pass
        
        except Exception as e:
            # Игнорируем ошибки при извлечении свойств
            pass
        
        return properties
    
    def get_all_elements(self):
        """
        Получить все элементы из IFC файла
        Использует by_type("IfcProduct") для эффективной фильтрации
        
        Returns:
            Список всех элементов IfcProduct и подтипов
        """
        print("Извлечение всех элементов...")
        
        # ✅ ПРАВИЛО 1.1: Используем by_type() вместо итерации по всем элементам
        # Получаем все элементы IfcProduct (включает подтипы: стены, двери, окна и т.д.)
        elements = self.ifc.by_type("IfcProduct")
        
        # Фильтруем элементы, исключая служебные (IfcFeatureElement и другие)
        # ✅ ПРАВИЛО 1.2: Фильтруем на раннем этапе
        filtered_elements = []
        skip_types = {
            "IfcFeatureElement",  # Отверстия и другие особенности
            "IfcFeatureElementSubtraction",
            "IfcOpeningElement",
            "IfcProject",  # Служебные элементы проекта
            "IfcSite",
            "IfcBuilding",
            "IfcBuildingStorey",
            "IfcSpace",
            "IfcAnnotation",  # Аннотации (линии, тексты и т.д.)
            "IfcGrid",  # Сетки/оси
            "IfcRelSpaceBoundary"  # Границы пространств
        }
        
        for element in elements:
            element_type = element.is_a()
            # Пропускаем служебные элементы
            if element_type not in skip_types and not element_type.startswith("IfcAnnotation"):
                filtered_elements.append(element)
        
        print(f"[OK] Найдено элементов: {len(filtered_elements)} (отфильтровано: {len(elements) - len(filtered_elements)})")
        
        return filtered_elements
    
    def export_to_csv(self, output_file: str = None) -> str:
        """
        Экспортировать все элементы в CSV файл в формате dataviewer2023
        
        Args:
            output_file: Путь к выходному CSV файлу (если None, создается рядом с IFC файлом)
            
        Returns:
            Путь к созданному CSV файлу
        """
        if output_file is None:
            output_file = str(self.ifc_file.with_suffix('.csv'))
        
        output_path = Path(output_file)
        
        # Получаем все элементы
        elements = self.get_all_elements()
        
        if not elements:
            print("[WARNING] Предупреждение: В файле не найдено элементов для экспорта")
            return None
        
        # Извлекаем данные для CSV
        print("Извлечение параметров элементов...")
        csv_rows = []
        
        processed_count = 0
        for element in elements:
            processed_count += 1
            if processed_count % 100 == 0:
                print(f"  Обработано элементов: {processed_count}/{len(elements)}")
            
            try:
                # Получаем основные данные элемента
                global_id = self.get_element_global_id(element)
                category = self.get_element_category(element)
                
                # Получаем все атрибуты
                attributes = self.get_all_attributes(element)
                
                # Получаем все свойства
                # ✅ ПРАВИЛО 2.1: Используем get_psets() с should_inherit=True для полных данных
                properties = self.get_all_properties(element)
                
                # Объединяем все параметры
                all_params = {}
                all_params.update(attributes)
                all_params.update(properties)
                
                # Если нет ни атрибутов, ни свойств, добавляем хотя бы базовую информацию
                if not all_params:
                    # Добавляем хотя бы базовые атрибуты
                    if hasattr(element, 'Name') and element.Name:
                        all_params['Name'] = element.Name
                    if hasattr(element, 'Description') and element.Description:
                        all_params['Description'] = element.Description
                    if hasattr(element, 'ObjectType') and element.ObjectType:
                        all_params['ObjectType'] = element.ObjectType
                    # Если все еще пусто, добавляем хотя бы тип элемента как параметр
                    if not all_params:
                        all_params['ElementType'] = category
                
                # Создаем строки CSV для каждого параметра
                for param_name, param_value in sorted(all_params.items()):
                    escaped_value = self.escape_csv_value(param_value)
                    csv_rows.append({
                        'ModelName': self.model_name,
                        'ElementId': global_id,
                        'Category': category,
                        'ParameterName': param_name,
                        'ParameterValue': escaped_value
                    })
            except Exception as e:
                # ✅ ПРАВИЛО 6.2: Обрабатываем ошибки для отдельных элементов
                print(f"[WARNING] Ошибка при обработке элемента {element.id()}: {e}")
                continue
        
        print(f"[OK] Извлечено параметров: {len(csv_rows)}")
        
        # ✅ ПРАВИЛО 7.2: Батчевая запись в CSV файл
        print(f"Запись в CSV файл: {output_path}")
        with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['ModelName', 'ElementId', 'Category', 'ParameterName', 'ParameterValue']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(csv_rows)  # ✅ Батчевая запись вместо writerow() в цикле
        
        print(f"[OK] CSV файл успешно создан: {output_path}")
        print(f"[OK] Экспортировано записей: {len(csv_rows)}")
        print(f"[OK] Обработано элементов: {processed_count}")
        
        return str(output_path)


def main():
    """Основная функция"""
    if len(sys.argv) < 2:
        print("="*60)
        print("IFC to CSV Exporter (dataviewer2023 format)")
        print("="*60)
        print("\nИспользование: python ifc_to_csv_dataviewer.py <input.ifc> [output.csv]")
        print("\nПримеры:")
        print("  python ifc_to_csv_dataviewer.py model.ifc")
        print("  python ifc_to_csv_dataviewer.py model.ifc output.csv")
        print("\nФормат CSV:")
        print("  ModelName,ElementId,Category,ParameterName,ParameterValue")
        print("="*60)
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    try:
        # Создаем экспортер
        exporter = IFCDataviewerCSVExporter(input_file)
        
        # Экспортируем в CSV
        result_file = exporter.export_to_csv(output_file)
        
        if result_file:
            print("\n" + "="*60)
            print("Экспорт завершен успешно!")
            print(f"Результат: {result_file}")
            print("="*60)
        
    except Exception as e:
        print(f"\n[ERROR] ОШИБКА: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

