"""
Сервис для построения pivot-таблиц из CSV данных
"""
import re
from sqlalchemy.orm import Session
from sqlalchemy import func, case, distinct, and_, or_, Numeric, cast
from sqlalchemy.types import Numeric as NumericType, String
from typing import List, Dict, Any, Optional
from uuid import UUID
from collections import defaultdict

from app.models.upload import CSVDataRow
from app.schemas.pivot import PivotRequest, PivotResponse, PivotCell, PivotAggregation


class PivotService:
    """Сервис для построения pivot-таблиц"""
    
    @staticmethod
    def extract_numeric_value(value: Any) -> Optional[float]:
        """
        Извлечь числовое значение из строки, которая может содержать единицы измерения.
        
        Обрабатывает различные форматы:
        - "32 m²" -> 32.0
        - "13.59 m³" -> 13.59
        - "1,234.56 m³" -> 1234.56 (запятая как разделитель тысяч)
        - "1 234,56 m²" -> 1234.56 (пробел как разделитель тысяч, запятая как десятичный разделитель)
        - "16000" -> 16000.0 (обычное число)
        - "32" -> 32.0
        
        Args:
            value: Значение для обработки (может быть строкой, числом или None)
            
        Returns:
            Числовое значение (float) или None, если не удалось извлечь число
        """
        if value is None:
            return None
        
        # Если уже число, возвращаем как float
        if isinstance(value, (int, float)):
            return float(value)
        
        # Преобразуем в строку
        value_str = str(value).strip()
        
        if not value_str or value_str == '':
            return None
        
        # Удаляем единицы измерения и другие нечисловые символы в конце
        # Паттерн: число (может содержать пробелы, запятые, точки) + опциональные единицы измерения
        # Единицы измерения: m², m³, м², м³, мм, см, м, кг, т, и т.д.
        
        # Сначала пытаемся найти число в начале строки
        # Паттерн для чисел: может начинаться с минуса, содержит цифры, точки, запятые, пробелы
        # Примеры: "32", "32.5", "1,234.56", "1 234,56", "-32.5"
        
        # Ищем первое число в строке, которое может содержать разделители тысяч и десятичный разделитель
        # Паттерны для различных форматов:
        # - "32" -> просто число
        # - "32.5" -> число с десятичной точкой
        # - "1,234.56" -> запятая как разделитель тысяч, точка как десятичный разделитель
        # - "1 234,56" -> пробел как разделитель тысяч, запятая как десятичный разделитель
        # - "32,5" -> запятая как десятичный разделитель (европейский формат)
        # - "1,234" -> запятая как разделитель тысяч
        
        # Более сложный паттерн: ищем число с опциональными разделителями
        # Паттерн: -?\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d+)?|^\d+[.,]\d+
        # Но проще: ищем последовательность цифр с разделителями
        
        # Сначала пытаемся найти число с разделителями тысяч и десятичным разделителем
        # Паттерн для "1,234.56" или "1 234,56" или "32.5" или "32,5"
        match = re.search(r'-?\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d+)?|-?\d+[.,]\d+|-?\d+', value_str)
        if match:
            number_str = match.group(0)
            
            # Определяем формат числа
            has_dot = '.' in number_str
            has_comma = ',' in number_str
            has_space = ' ' in number_str
            
            if has_dot and has_comma:
                # "1,234.56" - запятая тысячи, точка десятичный
                number_str = number_str.replace(',', '')
            elif has_space and has_comma:
                # "1 234,56" - пробел тысячи, запятая десятичный
                number_str = number_str.replace(' ', '').replace(',', '.')
            elif has_comma:
                # Только запятая - определяем по количеству цифр после запятой
                parts = number_str.split(',')
                if len(parts) == 2:
                    if len(parts[1]) <= 2:
                        # Десятичный разделитель (например, "32,5")
                        number_str = number_str.replace(',', '.')
                    else:
                        # Разделитель тысяч (например, "1,234")
                        number_str = number_str.replace(',', '')
                else:
                    # Множественные запятые - разделители тысяч
                    number_str = number_str.replace(',', '')
            elif has_space:
                # Только пробел - разделитель тысяч
                number_str = number_str.replace(' ', '')
            
            try:
                return float(number_str)
            except (ValueError, TypeError):
                pass
        
        # Если не удалось извлечь через regex, пытаемся просто преобразовать
        try:
            # Удаляем все нечисловые символы кроме точки, запятой, минуса и пробелов
            cleaned = re.sub(r'[^\d\s,.\-]', '', value_str)
            # Заменяем запятые на точки
            cleaned = cleaned.replace(',', '.').replace(' ', '')
            return float(cleaned)
        except (ValueError, TypeError):
            return None
    
    # Маппинг полей модели на SQLAlchemy атрибуты
    FIELD_MAP = {
        "model_name": CSVDataRow.model_name,
        "element_id": CSVDataRow.element_id,
        "category": CSVDataRow.category,
        "parameter_name": CSVDataRow.parameter_name,
        "parameter_value": CSVDataRow.parameter_value,
    }
    
    # Маппинг функций агрегации
    AGGREGATION_FUNCTIONS = {
        "COUNT": func.count,
        "COUNT_DISTINCT": lambda x: func.count(func.distinct(x)),
        "SUM": func.sum,
        "AVG": func.avg,
        "MIN": func.min,
        "MAX": func.max,
    }
    
    def build_pivot(self, request: PivotRequest, db: Session) -> PivotResponse:
        """
        Построить pivot-таблицу из данных CSV
        
        Args:
            request: Параметры pivot-таблицы
            db: Сессия БД
            
        Returns:
            Результат pivot-таблицы
        """
        # Если указаны selected_parameters, сначала делаем unpivot
        if request.selected_parameters and len(request.selected_parameters) > 0:
            return self._build_pivot_with_unpivot(request, db)
        else:
            return self._build_pivot_direct(request, db)
    
    def _build_pivot_direct(self, request: PivotRequest, db: Session) -> PivotResponse:
        """
        Построить pivot-таблицу напрямую без unpivot
        """
        # Строим базовый запрос с фильтрами
        query = db.query(CSVDataRow)
        
        # Применяем фильтры изоляции данных
        if request.user_id:
            query = query.filter(CSVDataRow.user_id == request.user_id)
        
        if request.project_id:
            query = query.filter(CSVDataRow.project_id == request.project_id)
        
        if request.version_id:
            query = query.filter(CSVDataRow.version_id == request.version_id)
        
        if request.file_upload_id:
            query = query.filter(CSVDataRow.file_upload_id == request.file_upload_id)
        
        # Применяем дополнительные фильтры
        if request.filters:
            for field, value in request.filters.items():
                if field in self.FIELD_MAP:
                    field_attr = self.FIELD_MAP[field]
                    if isinstance(value, list):
                        query = query.filter(field_attr.in_(value))
                    else:
                        query = query.filter(field_attr == value)
        
        # Если нет агрегаций, используем COUNT по умолчанию
        if not request.values:
            request.values = [PivotAggregation(field="id", function="COUNT", display_name="Количество")]
        
        # Получаем SQLAlchemy атрибуты для группировки
        group_by_fields = []
        for field in request.rows + request.columns:
            if field in self.FIELD_MAP:
                group_by_fields.append(self.FIELD_MAP[field])
        
        # Строим SELECT с группировкой и агрегациями
        select_fields = []
        
        # Добавляем поля для группировки (rows)
        for field in request.rows:
            if field in self.FIELD_MAP:
                select_fields.append(self.FIELD_MAP[field].label(f"row_{field}"))
        
        # Добавляем поля для группировки (columns)
        for field in request.columns:
            if field in self.FIELD_MAP:
                select_fields.append(self.FIELD_MAP[field].label(f"col_{field}"))
        
        # Добавляем агрегации
        aggregation_labels = []
        for agg in request.values:
            if agg.field in self.FIELD_MAP:
                field_attr = self.FIELD_MAP[agg.field]
            elif agg.field == "id":
                # Для COUNT используем любое поле или ID
                field_attr = CSVDataRow.id
            else:
                # Пытаемся использовать значение из JSON data
                # Для простоты используем parameter_value
                field_attr = CSVDataRow.parameter_value
            
            agg_func = self.AGGREGATION_FUNCTIONS.get(agg.function, func.count)
            
            # Для числовых агрегаций (SUM, AVG, MIN, MAX) нужно преобразовать в число
            if agg.function in ["SUM", "AVG", "MIN", "MAX"]:
                # Извлекаем число из строки, которая может содержать единицы измерения
                # Используем PostgreSQL regexp_replace для удаления единиц измерения и нечисловых символов
                
                # Шаг 1: Извлекаем первое число из строки используя regexp_substr (PostgreSQL 10+)
                # Паттерн: -?\d+[\s,.]?\d* (число с опциональным минусом, точкой/запятой, пробелами)
                # Если regexp_substr недоступен, используем regexp_replace для очистки
                
                # Удаляем все символы кроме цифр, точек, запятых, минусов и пробелов
                # field_attr уже строка (Text), но для безопасности приводим к String
                cleaned_value = func.regexp_replace(
                    cast(field_attr, String),
                    r'[^\d\s,.\-]',  # Удаляем все кроме цифр, пробелов, запятых, точек, минусов
                    '',
                    'g'  # Флаг 'g' для замены всех вхождений
                )
                
                # Удаляем пробелы
                cleaned_value = func.regexp_replace(cleaned_value, r'\s+', '', 'g')
                
                # Заменяем запятые на точки (упрощенный подход: считаем запятые десятичными разделителями)
                # Если в строке есть и точка, и запятая, то запятые - разделители тысяч, их нужно удалить
                # Но для упрощения: заменяем все запятые на точки, PostgreSQL сам разберется
                cleaned_value = func.regexp_replace(cleaned_value, ',', '.', 'g')
                
                # Если получилось несколько точек (например, "1.234.56"), оставляем только последнюю
                # Это сложно сделать в SQL, поэтому просто пытаемся преобразовать
                # PostgreSQL вернет ошибку или NULL, если формат неправильный
                
                # Преобразуем в число
                try:
                    numeric_cast = cast(cleaned_value, NumericType(15, 6))
                    agg_expr = agg_func(
                        case(
                            (numeric_cast.isnot(None), numeric_cast),
                            else_=0
                        )
                    )
                except:
                    # Если не удалось преобразовать, используем 0
                    agg_expr = agg_func(0)
            else:
                agg_expr = agg_func(field_attr)
            
            label = agg.display_name or f"{agg.function}({agg.field})"
            select_fields.append(agg_expr.label(label))
            aggregation_labels.append(label)
        
        # Строим финальный запрос
        query = query.with_entities(*select_fields)
        
        if group_by_fields:
            query = query.group_by(*group_by_fields)
        
        # Применяем лимит
        if request.limit:
            query = query.limit(request.limit)
        
        # Выполняем запрос
        results = query.all()
        
        # Обрабатываем результаты
        rows_set = set()
        columns_set = set()
        cells_map = defaultdict(lambda: defaultdict(dict))
        
        for row in results:
            # Формируем ключ строки
            row_key_parts = []
            for field in request.rows:
                label = f"row_{field}"
                value = getattr(row, label, None)
                row_key_parts.append(str(value) if value is not None else "(пусто)")
            row_key = " | ".join(row_key_parts) if row_key_parts else "Все"
            rows_set.add(row_key)
            
            # Формируем ключ колонки
            col_key_parts = []
            for field in request.columns:
                label = f"col_{field}"
                value = getattr(row, label, None)
                col_key_parts.append(str(value) if value is not None else "(пусто)")
            col_key = " | ".join(col_key_parts) if col_key_parts else "Все"
            columns_set.add(col_key)
            
            # Сохраняем значения агрегаций
            for label in aggregation_labels:
                value = getattr(row, label, None)
                cells_map[row_key][col_key][label] = value
        
        # Преобразуем в список ячеек
        cells = []
        for row_key in sorted(rows_set):
            for col_key in sorted(columns_set):
                if row_key in cells_map and col_key in cells_map[row_key]:
                    cells.append(PivotCell(
                        row_key=row_key,
                        column_key=col_key,
                        values=cells_map[row_key][col_key]
                    ))
        
        # Гарантируем, что rows_fields и columns_fields всегда установлены
        rows_fields = request.rows if request.rows else []
        columns_fields = request.columns if request.columns else []
        
        return PivotResponse(
            rows=sorted(list(rows_set)),
            columns=sorted(list(columns_set)),
            cells=cells,
            aggregations=request.values,
            total_rows=len(cells),
            rows_fields=rows_fields,
            columns_fields=columns_fields
        )
    
    def _build_pivot_with_unpivot(self, request: PivotRequest, db: Session) -> PivotResponse:
        """
        Построить pivot-таблицу с предварительным unpivot выбранных параметров
        
        Логика:
        1. Сначала делаем unpivot - преобразуем длинную таблицу в широкую
           (каждый выбранный параметр становится колонкой)
        2. Затем на широкой таблице строим обычный pivot
        """
        # Строим базовый запрос с фильтрами
        base_query = db.query(CSVDataRow)
        
        # Применяем фильтры изоляции данных
        if request.user_id:
            base_query = base_query.filter(CSVDataRow.user_id == request.user_id)
        if request.project_id:
            base_query = base_query.filter(CSVDataRow.project_id == request.project_id)
        if request.version_id:
            base_query = base_query.filter(CSVDataRow.version_id == request.version_id)
        if request.file_upload_id:
            base_query = base_query.filter(CSVDataRow.file_upload_id == request.file_upload_id)
        
        # Фильтруем только выбранные параметры
        base_query = base_query.filter(CSVDataRow.parameter_name.in_(request.selected_parameters))
        
        # Применяем дополнительные фильтры
        if request.filters:
            for field, value in request.filters.items():
                if field in self.FIELD_MAP:
                    field_attr = self.FIELD_MAP[field]
                    if isinstance(value, list):
                        base_query = base_query.filter(field_attr.in_(value))
                    else:
                        base_query = base_query.filter(field_attr == value)
        
        # Определяем поля для группировки при unpivot (элементы, которые не параметры)
        # Обычно это element_id, category, model_name
        unpivot_group_by_fields = []
        unpivot_select_fields = []
        
        # Добавляем базовые поля, которые должны быть в результирующей таблице
        for field in ["element_id", "category", "model_name"]:
            if field in self.FIELD_MAP:
                field_attr = self.FIELD_MAP[field]
                unpivot_group_by_fields.append(field_attr)
                unpivot_select_fields.append(field_attr.label(f"unpivot_{field}"))
        
        # Создаем CASE выражения для каждого выбранного параметра (unpivot)
        # Используем MAX для получения одного значения на элемент
        for param_name in request.selected_parameters:
            # Для каждого параметра создаем колонку через CASE
            param_col = func.max(
                case(
                    (CSVDataRow.parameter_name == param_name, CSVDataRow.parameter_value),
                    else_=None
                )
            ).label(param_name)  # Используем имя параметра как название колонки
            unpivot_select_fields.append(param_col)
        
        # Строим unpivot запрос
        unpivot_query = base_query.with_entities(*unpivot_select_fields)
        if unpivot_group_by_fields:
            unpivot_query = unpivot_query.group_by(*unpivot_group_by_fields)
        
        # Отладочная информация: выводим SQL запрос
        try:
            sql_query = str(unpivot_query.statement.compile(compile_kwargs={"literal_binds": True}))
            print(f"📊 SQL запрос unpivot:\n{sql_query[:500]}...")  # Первые 500 символов
        except Exception as e:
            print(f"⚠️ Не удалось вывести SQL: {e}")
        
        # Выполняем unpivot запрос - получаем широкую таблицу
        unpivot_results = unpivot_query.all()
        
        # Проверяем, есть ли данные в базе для выбранных параметров
        if len(unpivot_results) == 0:
            print(f"⚠️ ВНИМАНИЕ: Нет результатов после unpivot!")
            print(f"   Проверьте, что в базе есть данные с параметрами: {request.selected_parameters}")
            # Проверяем, есть ли вообще данные с этими параметрами
            check_query = base_query.filter(
                CSVDataRow.parameter_name.in_(request.selected_parameters)
            )
            count = check_query.count()
            print(f"   Всего строк с выбранными параметрами: {count}")
        
        # Отладочная информация
        print(f"📊 Unpivot результатов: {len(unpivot_results)}")
        if unpivot_results:
            # Проверяем структуру первой строки
            first_row = unpivot_results[0]
            print(f"📊 Структура первой строки: {type(first_row)}")
            if hasattr(first_row, '_asdict'):
                row_dict = first_row._asdict()
                print(f"📊 Ключи первой строки: {list(row_dict.keys())}")
                # Показываем значения для выбранных параметров
                for param in request.selected_parameters:
                    param_value = row_dict.get(param)
                    print(f"📊 Значение параметра '{param}': {param_value} (тип: {type(param_value)})")
            elif hasattr(first_row, '_fields'):
                print(f"📊 Поля первой строки: {first_row._fields}")
            print(f"📊 Выбранные параметры: {request.selected_parameters}")
        
        # Теперь на данных unpivot строим обычный pivot
        # Для этого нужно обработать данные в памяти и создать pivot структуру
        
        # Применяем фильтры к результатам unpivot (если есть)
        filtered_unpivot_results = unpivot_results
        if request.filters:
            print(f"📊 Применение фильтров: {request.filters}")
            filtered_unpivot_results = []
            for row_idx, row in enumerate(unpivot_results):
                row_dict = row._asdict() if hasattr(row, '_asdict') else {}
                should_include = True
                
                # Проверяем каждый фильтр
                for filter_field, filter_values in request.filters.items():
                    if not isinstance(filter_values, list):
                        continue
                    
                    # Получаем значение поля из row
                    value = None
                    if filter_field in ["element_id", "category", "model_name"]:
                        attr_name = f"unpivot_{filter_field}"
                        if hasattr(row, '_asdict'):
                            value = row_dict.get(attr_name)
                        else:
                            value = getattr(row, attr_name, None)
                    elif request.selected_parameters and filter_field in request.selected_parameters:
                        if hasattr(row, '_asdict'):
                            value = row_dict.get(filter_field)
                        else:
                            value = getattr(row, filter_field, None)
                    
                    # Отладочное логирование для первых строк
                    if row_idx < 3:
                        print(f"📊 Фильтр '{filter_field}': value={value} (тип: {type(value)}), filter_values={filter_values[:3]}...")
                    
                    # Проверяем, входит ли значение в список фильтров
                    if value is not None:
                        value_str = str(value).strip()
                        # Преобразуем filter_values в строки для сравнения
                        filter_values_str = [str(fv).strip() for fv in filter_values]
                        if value_str not in filter_values_str:
                            should_include = False
                            if row_idx < 3:
                                print(f"   ❌ Не проходит фильтр: '{value_str}' не в {filter_values_str[:3]}...")
                            break
                        else:
                            if row_idx < 3:
                                print(f"   ✅ Проходит фильтр: '{value_str}' в {filter_values_str[:3]}...")
                    else:
                        # Если значение None, проверяем, есть ли "(пусто)" или "" в фильтрах
                        filter_values_str = [str(fv).strip() for fv in filter_values]
                        if "(пусто)" not in filter_values_str and "" not in filter_values_str:
                            should_include = False
                            if row_idx < 3:
                                print(f"   ❌ Не проходит фильтр: значение None/пустое, а фильтр не содержит '(пусто)' или ''")
                            break
                
                if should_include:
                    filtered_unpivot_results.append(row)
            
            print(f"📊 Фильтрация unpivot результатов: {len(unpivot_results)} -> {len(filtered_unpivot_results)}")
            if len(filtered_unpivot_results) == 0 and len(unpivot_results) > 0:
                print(f"⚠️ ВНИМАНИЕ: Все строки отфильтрованы! Проверьте фильтры.")
                # Показываем примеры значений для первого фильтра
                if request.filters:
                    first_filter_field = list(request.filters.keys())[0]
                    first_filter_values = request.filters[first_filter_field]
                    print(f"   Первый фильтр: поле='{first_filter_field}', значения={first_filter_values[:5]}")
                    # Показываем примеры значений из первых строк unpivot
                    for i, row in enumerate(unpivot_results[:5]):
                        row_dict = row._asdict() if hasattr(row, '_asdict') else {}
                        if first_filter_field in ["element_id", "category", "model_name"]:
                            attr_name = f"unpivot_{first_filter_field}"
                            sample_value = row_dict.get(attr_name) if hasattr(row, '_asdict') else getattr(row, attr_name, None)
                        elif request.selected_parameters and first_filter_field in request.selected_parameters:
                            sample_value = row_dict.get(first_filter_field) if hasattr(row, '_asdict') else getattr(row, first_filter_field, None)
                        else:
                            sample_value = None
                        print(f"   Пример значения из строки {i}: '{sample_value}' (тип: {type(sample_value)})")
        
        # Если нет агрегаций, используем COUNT по умолчанию
        if not request.values:
            request.values = [PivotAggregation(field="id", function="COUNT", display_name="Количество")]
        
        # Обрабатываем результаты unpivot (после фильтрации) и строим pivot
        rows_set = set()
        columns_set = set()
        cells_map = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))  # row_key -> col_key -> label -> [values]
        
        print(f"📊 Начало обработки {len(filtered_unpivot_results)} результатов unpivot (после фильтрации)")
        print(f"📊 Rows в запросе: {request.rows}")
        print(f"📊 Columns в запросе: {request.columns}")
        print(f"📊 Values в запросе:")
        for v in request.values:
            label = v.display_name or f"{v.function}({v.field})"
            print(f"   - field: {v.field}, function: {v.function}, display_name: {v.display_name}, label: {label}")
        if filtered_unpivot_results:
            print(f"📊 Первая строка unpivot: {filtered_unpivot_results[0]._asdict() if hasattr(filtered_unpivot_results[0], '_asdict') else 'нет данных'}")
        
        for row_idx, row in enumerate(filtered_unpivot_results):
            # Формируем ключ строки из полей rows
            row_key_parts = []
            for field in request.rows:
                # Пытаемся найти значение в unpivot результатах
                if field.startswith("unpivot_"):
                    attr_name = field
                elif field in self.FIELD_MAP:
                    attr_name = f"unpivot_{field}"
                else:
                    # Если поле - это один из выбранных параметров
                    attr_name = field
                
                try:
                    # Пробуем получить через _asdict (SQLAlchemy Row)
                    if hasattr(row, '_asdict'):
                        row_dict = row._asdict()
                        value = row_dict.get(attr_name)
                        if value is None and field in request.selected_parameters:
                            value = row_dict.get(field)
                    else:
                        value = getattr(row, attr_name, None)
                        if value is None and field in request.selected_parameters:
                            value = getattr(row, field, None)
                    row_key_parts.append(str(value) if value is not None else "(пусто)")
                except Exception as e:
                    if row_idx < 3:  # Логируем только первые ошибки
                        print(f"⚠️ Ошибка получения row поля '{field}': {e}")
                    row_key_parts.append("(пусто)")
            
            row_key = " | ".join(row_key_parts) if row_key_parts else "Все"
            rows_set.add(row_key)
            
            # Формируем ключ колонки из полей columns
            col_key_parts = []
            for field in request.columns:
                if field in self.FIELD_MAP:
                    attr_name = f"unpivot_{field}"
                    try:
                        if hasattr(row, '_asdict'):
                            row_dict = row._asdict()
                            value = row_dict.get(attr_name)
                        else:
                            value = getattr(row, attr_name, None)
                        col_key_parts.append(str(value) if value is not None else "(пусто)")
                    except Exception as e:
                        if row_idx < 3:
                            print(f"⚠️ Ошибка получения col поля '{field}': {e}")
                        col_key_parts.append("(пусто)")
                elif field in request.selected_parameters:
                    # Если колонка - это один из параметров
                    try:
                        if hasattr(row, '_asdict'):
                            row_dict = row._asdict()
                            value = row_dict.get(field)
                        else:
                            value = getattr(row, field, None)
                        col_key_parts.append(str(value) if value is not None else "(пусто)")
                    except Exception as e:
                        if row_idx < 3:
                            print(f"⚠️ Ошибка получения col параметра '{field}': {e}")
                        col_key_parts.append("(пусто)")
                else:
                    col_key_parts.append("(пусто)")
            
            col_key = " | ".join(col_key_parts) if col_key_parts else "Все"
            columns_set.add(col_key)
            
            # Вычисляем агрегации для значений
            for agg in request.values:
                label = agg.display_name or f"{agg.function}({agg.field})"
                
                # Определяем значение для агрегации
                value = None
                
                if agg.field in request.selected_parameters:
                    # Если агрегируем по параметру из unpivot
                    # Параметр должен быть доступен как атрибут с его именем (label в SQL)
                    value = None
                    
                    # Пробуем разные способы получения значения
                    value = None
                    
                    # Способ 1: через _asdict() (SQLAlchemy Row - это основной способ)
                    if hasattr(row, '_asdict'):
                        try:
                            row_dict = row._asdict()
                            value = row_dict.get(agg.field)
                            
                            # Отладочная информация для первых строк
                            if row_idx < 3:
                                print(f"📊 Получение значения для '{agg.field}':")
                                print(f"   row_dict.keys(): {list(row_dict.keys())}")
                                print(f"   value из row_dict: {value} (тип: {type(value)})")
                        except Exception as e:
                            if row_idx < 3:
                                print(f"⚠️ Ошибка _asdict для '{agg.field}': {e}")
                    
                    # Способ 2: прямое обращение через атрибут (если _asdict не сработал)
                    if value is None:
                        try:
                            value = getattr(row, agg.field, None)
                            if row_idx < 3:
                                print(f"   value через getattr: {value}")
                        except AttributeError:
                            if row_idx < 3:
                                print(f"   AttributeError при getattr для '{agg.field}'")
                            pass
                    
                    # Способ 3: через индекс (если это RowProxy)
                    if value is None and hasattr(row, '__getitem__'):
                        try:
                            # Проверяем, есть ли такой ключ
                            if hasattr(row, 'keys') and agg.field in row.keys():
                                value = row[agg.field]
                            else:
                                # Пробуем по индексу
                                param_index = request.selected_parameters.index(agg.field)
                                base_fields_count = len(["element_id", "category", "model_name"])
                                total_index = base_fields_count + param_index
                                if hasattr(row, '__len__') and total_index < len(row):
                                    value = row[total_index]
                        except (KeyError, IndexError, ValueError, TypeError):
                            pass
                    
                    # Способ 4: через _fields (если это NamedTuple)
                    if value is None and hasattr(row, '_fields'):
                        try:
                            if agg.field in row._fields:
                                value = getattr(row, agg.field, None)
                        except Exception:
                            pass
                    
                    # Логирование для отладки (только первые несколько раз)
                    if len(cells_map) < 3:  # Логируем только первые 3 строки
                        if value is None:
                            print(f"⚠️ Не удалось получить значение для параметра '{agg.field}' из строки")
                            if hasattr(row, '_asdict'):
                                print(f"   Доступные ключи: {list(row._asdict().keys())}")
                        else:
                            print(f"✅ Получено значение для '{agg.field}': {value} (тип: {type(value)})")
                    
                    # Для COUNT по параметру - считаем количество записей с непустым значением
                    if agg.function == "COUNT":
                        # COUNT считает количество строк, где значение параметра НЕ NULL/пустое
                        # Проверяем, есть ли значение
                        if value is not None and value != '':
                            if label not in cells_map[row_key][col_key]:
                                cells_map[row_key][col_key][label] = []
                            cells_map[row_key][col_key][label].append(1)  # Каждая строка с значением = 1
                            
                            # Отладочная информация для первых строк
                            if row_idx < 3:
                                print(f"📊 COUNT: row_key={row_key}, col_key={col_key}, value={value}, добавлена 1 для {label}")
                        else:
                            # Если значение NULL/пустое, не считаем для COUNT
                            if row_idx < 3:
                                print(f"⚠️ COUNT: пропущена строка с пустым значением для '{agg.field}'")
                    else:
                        # Для других функций (SUM, AVG, MIN, MAX) работаем со значениями
                        original_value = value
                        # Пытаемся преобразовать в число для числовых агрегаций
                        # Используем функцию извлечения чисел, которая обрабатывает единицы измерения
                        if value is not None and agg.function in ["SUM", "AVG", "MIN", "MAX"]:
                            value = self.extract_numeric_value(value)
                        
                        # Сохраняем значение для дальнейшей агрегации
                        if label not in cells_map[row_key][col_key]:
                            cells_map[row_key][col_key][label] = []
                        
                        # Отладочная информация для первых строк
                        if row_idx < 3 and agg.function == "SUM":
                            print(f"📊 SUM: row_key={row_key}, col_key={col_key}, original_value={original_value}, converted_value={value}, добавлено для {label}")
                        
                        if value is not None:
                            cells_map[row_key][col_key][label].append(value)
                        # Для COUNT_DISTINCT тоже добавляем, даже если None
                        elif agg.function == "COUNT_DISTINCT":
                            cells_map[row_key][col_key][label].append(None)
                elif agg.field in self.FIELD_MAP:
                    # Если поле из базовых полей (category, element_id и т.д.)
                    field_attr_name = f"unpivot_{agg.field}"
                    try:
                        value = getattr(row, field_attr_name, None)
                    except:
                        value = None
                    
                    # Инициализируем список, если его нет
                    if label not in cells_map[row_key][col_key]:
                        cells_map[row_key][col_key][label] = []
                    
                    # Для COUNT считаем количество записей (добавляем 1)
                    if agg.function == "COUNT":
                        if value is not None and value != '':
                            cells_map[row_key][col_key][label].append(1)
                    # Для других функций (SUM, AVG, MIN, MAX) - базовые поля обычно строковые,
                    # поэтому COUNT_DISTINCT имеет смысл, но для числовых функций нужно значение
                    # Но для базовых полей (category, model_name) SUM/AVG не имеют смысла
                    # Поэтому для них тоже считаем как COUNT
                    elif agg.function in ["SUM", "AVG", "MIN", "MAX"]:
                        # Для базовых полей SUM/AVG не имеют смысла, но если запрошено - пытаемся преобразовать в число
                        # Используем функцию извлечения чисел, которая обрабатывает единицы измерения
                        num_value = self.extract_numeric_value(value)
                        if num_value is not None:
                            cells_map[row_key][col_key][label].append(num_value)
                    else:
                        # Для COUNT_DISTINCT и других функций
                        cells_map[row_key][col_key][label].append(value)
                else:
                    # Для других полей (например, "id" для COUNT)
                    if label not in cells_map[row_key][col_key]:
                        cells_map[row_key][col_key][label] = []
                    cells_map[row_key][col_key][label].append(1)
        
        # Применяем функции агрегации к накопленным значениям
        final_cells_map = defaultdict(lambda: defaultdict(dict))
        for row_key, cols in cells_map.items():
            for col_key, aggs in cols.items():
                for label, values_list in aggs.items():
                    # Находим соответствующую агрегацию
                    agg = next((a for a in request.values if (a.display_name or f"{a.function}({a.field})") == label), None)
                    if agg:
                        # Отладочное логирование для первых ячеек
                        if len(final_cells_map) < 3 and len(final_cells_map.get(row_key, {})) < 3:
                            print(f"📊 Агрегация для '{label}':")
                            print(f"   Функция: {agg.function}")
                            print(f"   Поле: {agg.field}")
                            print(f"   Количество значений в списке: {len(values_list)}")
                            print(f"   Первые 5 значений: {values_list[:5]}")
                            print(f"   Все значения одинаковы: {len(set(values_list)) == 1 if values_list else False}")
                            if values_list:
                                print(f"   Уникальные значения: {sorted(set(values_list))[:5]}")
                        
                        if agg.function == "COUNT":
                            result = len(values_list)
                            final_cells_map[row_key][col_key][label] = result
                            if len(final_cells_map) < 3 and len(final_cells_map.get(row_key, {})) < 3:
                                print(f"   COUNT результат: {result}")
                        elif agg.function == "SUM":
                            result = sum(values_list)
                            final_cells_map[row_key][col_key][label] = result
                            if len(final_cells_map) < 3 and len(final_cells_map.get(row_key, {})) < 3:
                                print(f"   SUM результат: {result} (сумма {len(values_list)} значений)")
                        elif agg.function == "AVG":
                            final_cells_map[row_key][col_key][label] = sum(values_list) / len(values_list) if values_list else 0
                        elif agg.function == "MIN":
                            final_cells_map[row_key][col_key][label] = min(values_list) if values_list else 0
                        elif agg.function == "MAX":
                            final_cells_map[row_key][col_key][label] = max(values_list) if values_list else 0
                        elif agg.function == "COUNT_DISTINCT":
                            final_cells_map[row_key][col_key][label] = len(set(values_list))
                    else:
                        final_cells_map[row_key][col_key][label] = len(values_list)
        
        # Преобразуем в список ячеек
        cells = []
        
        # Если columns_set пустой, добавляем "Все"
        if not columns_set:
            columns_set.add("Все")
        
        # Если rows_set пустой, добавляем "Все"
        if not rows_set:
            rows_set.add("Все")
        
        print(f"📊 Создание ячеек: {len(rows_set)} row_keys, {len(columns_set)} col_keys")
        print(f"📊 rows_set: {sorted(list(rows_set))[:5]}...")  # Первые 5
        print(f"📊 columns_set: {sorted(list(columns_set))}")
        print(f"📊 final_cells_map содержит: {len(final_cells_map)} row_keys")
        if final_cells_map:
            sample_row_key = list(final_cells_map.keys())[0]
            print(f"📊 Пример row_key: '{sample_row_key}', содержит {len(final_cells_map[sample_row_key])} col_keys")
            if final_cells_map[sample_row_key]:
                sample_col_key = list(final_cells_map[sample_row_key].keys())[0]
                print(f"📊 Пример col_key: '{sample_col_key}', values: {final_cells_map[sample_row_key][sample_col_key]}")
                
                # Показываем все ячейки для примера
                print(f"📊 Все ячейки для '{sample_row_key}':")
                for col_k, vals in final_cells_map[sample_row_key].items():
                    print(f"   col_key='{col_k}': {vals}")
        
        for row_key in sorted(rows_set):
            for col_key in sorted(columns_set):
                if row_key in final_cells_map and col_key in final_cells_map[row_key]:
                    cell_values = final_cells_map[row_key][col_key]
                    
                    # Отладочное логирование для первых ячеек
                    if len(cells) < 3:
                        print(f"📊 Создание ячейки: row_key='{row_key}', col_key='{col_key}'")
                        print(f"   cell_values: {cell_values}")
                        print(f"   cell_values keys: {list(cell_values.keys())}")
                        print(f"   aggregations: {[(agg.display_name or f'{agg.function}({agg.field})', agg.field, agg.function) for agg in request.values]}")
                    
                    cells.append(PivotCell(
                        row_key=row_key,
                        column_key=col_key,
                        values=cell_values
                    ))
                else:
                    # Если ячейка не найдена, создаем с пустыми значениями
                    # Это может быть нормально, если нет данных для этой комбинации
                    if len(cells) < 10:  # Логируем только первые
                        print(f"⚠️ Ячейка не найдена: row_key='{row_key}', col_key='{col_key}'")
                        if row_key in final_cells_map:
                            print(f"   Доступные col_keys для '{row_key}': {list(final_cells_map[row_key].keys())}")
        
        # Гарантируем, что rows_fields и columns_fields всегда установлены
        rows_fields = request.rows if request.rows else []
        columns_fields = request.columns if request.columns else []
        
        return PivotResponse(
            rows=sorted(list(rows_set)),
            columns=sorted(list(columns_set)),
            cells=cells,
            aggregations=request.values,
            total_rows=len(cells),
            rows_fields=rows_fields,
            columns_fields=columns_fields
        )
    
    def get_filter_values(self, request: PivotRequest, field: str, db: Session) -> List[str]:
        """
        Получить уникальные значения для поля после unpivot
        
        Args:
            request: Параметры запроса (project_id, version_id, selected_parameters, filters)
            field: Поле для получения значений
            db: Сессия БД
            
        Returns:
            Список уникальных значений поля
        """
        import sys
        sys.stdout.flush()
        print(f"🔍 get_filter_values вызван для поля '{field}' с фильтрами: {request.filters}", flush=True)
        sys.stdout.flush()
        
        # Строим базовый запрос с фильтрами
        base_query = db.query(CSVDataRow)
        
        # Применяем фильтры изоляции данных
        if request.user_id:
            base_query = base_query.filter(CSVDataRow.user_id == request.user_id)
        if request.project_id:
            base_query = base_query.filter(CSVDataRow.project_id == request.project_id)
        if request.version_id:
            base_query = base_query.filter(CSVDataRow.version_id == request.version_id)
        if request.file_upload_id:
            base_query = base_query.filter(CSVDataRow.file_upload_id == request.file_upload_id)
        
        # Если есть selected_parameters, делаем unpivot и получаем значения из результата
        if request.selected_parameters and len(request.selected_parameters) > 0:
            # Фильтруем только выбранные параметры
            base_query = base_query.filter(CSVDataRow.parameter_name.in_(request.selected_parameters))
            
            # Строим unpivot запрос (как в _build_pivot_with_unpivot)
            unpivot_group_by_fields = []
            unpivot_select_fields = []
            
            for f in ["element_id", "category", "model_name"]:
                if f in self.FIELD_MAP:
                    field_attr = self.FIELD_MAP[f]
                    unpivot_group_by_fields.append(field_attr)
                    unpivot_select_fields.append(field_attr.label(f"unpivot_{f}"))
            
            for param_name in request.selected_parameters:
                param_col = func.max(
                    case(
                        (CSVDataRow.parameter_name == param_name, CSVDataRow.parameter_value),
                        else_=None
                    )
                ).label(param_name)
                unpivot_select_fields.append(param_col)
            
            unpivot_query = base_query.with_entities(*unpivot_select_fields)
            if unpivot_group_by_fields:
                unpivot_query = unpivot_query.group_by(*unpivot_group_by_fields)
            
            # Выполняем unpivot запрос
            unpivot_results = unpivot_query.all()
            
            # Применяем фильтры к результатам unpivot (если есть)
            filtered_unpivot_results = unpivot_results
            import sys
            sys.stdout.flush()
            print(f"🔍 get_filter_values: request.filters = {request.filters} (тип: {type(request.filters)})", flush=True)
            sys.stdout.flush()
            print(f"🔍 get_filter_values: len(unpivot_results) = {len(unpivot_results)}", flush=True)
            sys.stdout.flush()
            if request.filters:
                sys.stdout.flush()
                print(f"📊 Применение фильтров к {len(unpivot_results)} строкам unpivot: {request.filters}", flush=True)
                sys.stdout.flush()
                print(f"📊 selected_parameters: {request.selected_parameters}", flush=True)
                sys.stdout.flush()
                filtered_unpivot_results = []
                filtered_count = 0
                excluded_count = 0
                
                for row_idx, row in enumerate(unpivot_results):
                    row_dict = row._asdict() if hasattr(row, '_asdict') else {}
                    should_include = True
                    
                    # Проверяем каждый фильтр
                    for filter_field, filter_values in request.filters.items():
                        if not isinstance(filter_values, list):
                            continue
                        
                        # Получаем значение поля из row
                        value = None
                        if filter_field in ["element_id", "category", "model_name"]:
                            attr_name = f"unpivot_{filter_field}"
                            if hasattr(row, '_asdict'):
                                value = row_dict.get(attr_name)
                            else:
                                value = getattr(row, attr_name, None)
                            if row_idx < 3:
                                print(f"  📊 Строка {row_idx}: filter_field='{filter_field}' (базовое поле), attr_name='{attr_name}', value={value}")
                        elif request.selected_parameters and filter_field in request.selected_parameters:
                            if hasattr(row, '_asdict'):
                                value = row_dict.get(filter_field)
                            else:
                                value = getattr(row, filter_field, None)
                            if row_idx < 3:
                                print(f"  📊 Строка {row_idx}: filter_field='{filter_field}' (параметр из unpivot), value={value}")
                        else:
                            if row_idx < 3:
                                row_dict_keys = list(row_dict.keys()) if hasattr(row, '_asdict') else []
                                print(f"  ⚠️ Строка {row_idx}: filter_field='{filter_field}' не найден! Доступные поля: {row_dict_keys[:10]}")
                        
                        # Отладочное логирование для первых строк
                        if row_idx < 3:
                            print(f"  📊 Строка {row_idx}: filter_field='{filter_field}', value={value} (тип: {type(value)}), filter_values={filter_values[:3]}...")
                        
                        # Проверяем, входит ли значение в список фильтров
                        if value is not None:
                            value_str = str(value).strip()
                            filter_values_str = [str(fv).strip() for fv in filter_values]
                            if value_str not in filter_values_str:
                                should_include = False
                                if row_idx < 3:
                                    print(f"    ❌ Не проходит фильтр: '{value_str}' не в {filter_values_str[:3]}...")
                                excluded_count += 1
                                break
                            else:
                                if row_idx < 3:
                                    print(f"    ✅ Проходит фильтр: '{value_str}' в {filter_values_str[:3]}...")
                        else:
                            # Если значение None, проверяем, есть ли "(пусто)" или "" в фильтрах
                            filter_values_str = [str(fv).strip() for fv in filter_values]
                            if "(пусто)" not in filter_values_str and "" not in filter_values_str:
                                should_include = False
                                if row_idx < 3:
                                    print(f"    ❌ Не проходит фильтр: значение None, а '(пусто)' не в фильтрах")
                                excluded_count += 1
                                break
                    
                    if should_include:
                        filtered_unpivot_results.append(row)
                        filtered_count += 1
                
                print(f"📊 Результат фильтрации: {filtered_count} строк прошли, {excluded_count} исключено, всего {len(filtered_unpivot_results)} строк")
            
            # Извлекаем уникальные значения для запрошенного поля из отфильтрованных результатов
            unique_values = set()
            
            print(f"📊 Извлечение значений для поля '{field}' из {len(filtered_unpivot_results)} отфильтрованных строк (было {len(unpivot_results)} до фильтрации)")
            
            for row_idx, row in enumerate(filtered_unpivot_results):
                value = None
                # Определяем, как получить значение поля
                if field in ["element_id", "category", "model_name"]:
                    attr_name = f"unpivot_{field}"
                    if hasattr(row, '_asdict'):
                        value = row._asdict().get(attr_name)
                    else:
                        value = getattr(row, attr_name, None)
                elif field in request.selected_parameters:
                    # Параметр из unpivot
                    if hasattr(row, '_asdict'):
                        value = row._asdict().get(field)
                    else:
                        value = getattr(row, field, None)
                else:
                    # Поле не найдено - логируем для отладки
                    if row_idx < 3:
                        row_dict = row._asdict() if hasattr(row, '_asdict') else {}
                        available_fields = list(row_dict.keys()) if hasattr(row, '_asdict') else []
                        print(f"  ⚠️ Поле '{field}' не найдено в строке {row_idx}. Доступные поля: {available_fields[:10]}")
                
                if value is not None and value != '':
                    unique_values.add(str(value))
            
            result = sorted(list(unique_values))
            print(f"✅ Возвращено {len(result)} уникальных значений для поля '{field}' (с фильтрами: {request.filters})")
            return result
        else:
            # Если нет selected_parameters, получаем значения напрямую из CSVDataRow
            if field in self.FIELD_MAP:
                field_attr = self.FIELD_MAP[field]
                values_query = base_query.with_entities(distinct(field_attr)).filter(
                    field_attr.isnot(None),
                    field_attr != ""
                )
                unique_values = sorted([str(v[0]) for v in values_query.all() if v[0]])
                return unique_values
            else:
                return []
    
    def get_available_fields(self, request: PivotRequest, db: Session) -> List[Dict[str, Any]]:
        """
        Получить список доступных полей и их уникальных значений
        
        Args:
            request: Параметры для фильтрации (project_id, version_id, etc.)
            db: Сессия БД
            
        Returns:
            Список доступных полей с примерами значений
        """
        # Строим базовый запрос с фильтрами
        query = db.query(CSVDataRow)
        
        if request.user_id:
            query = query.filter(CSVDataRow.user_id == request.user_id)
        if request.project_id:
            query = query.filter(CSVDataRow.project_id == request.project_id)
        if request.version_id:
            query = query.filter(CSVDataRow.version_id == request.version_id)
        if request.file_upload_id:
            query = query.filter(CSVDataRow.file_upload_id == request.file_upload_id)
        
        fields_info = []
        
        for field_name, field_attr in self.FIELD_MAP.items():
            # Получаем уникальные значения для поля
            try:
                unique_values = query.with_entities(field_attr).filter(
                    field_attr.isnot(None)
                ).distinct().limit(100).all()
                
                values = [val[0] for val in unique_values if val[0] is not None]
            except Exception as e:
                # Если возникла ошибка, используем пустой список
                print(f"Ошибка получения значений для поля {field_name}: {e}")
                values = []
            
            fields_info.append({
                "field": field_name,
                "display_name": self._get_field_display_name(field_name),
                "type": "string",  # Для MVP все поля строковые
                "sample_values": values[:10],  # Первые 10 значений для примера
                "unique_count": len(values)
            })
        
        return fields_info
    
    @staticmethod
    def _get_field_display_name(field: str) -> str:
        """Получить отображаемое название поля"""
        display_names = {
            "model_name": "Название модели",
            "element_id": "ID элемента",
            "category": "Категория",
            "parameter_name": "Название параметра",
            "parameter_value": "Значение параметра",
        }
        return display_names.get(field, field)

