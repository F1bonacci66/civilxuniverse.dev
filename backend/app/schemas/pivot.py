"""
Pydantic схемы для Pivot-аналитики
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from uuid import UUID


class PivotField(BaseModel):
    """Поле для pivot-таблицы"""
    field: str = Field(..., description="Название поля (model_name, category, parameter_name, etc.)")
    display_name: Optional[str] = Field(None, description="Отображаемое название поля")


class PivotAggregation(BaseModel):
    """Агрегация для значений"""
    field: str = Field(..., description="Поле для агрегации")
    function: Literal["SUM", "COUNT", "AVG", "MIN", "MAX", "COUNT_DISTINCT"] = Field(
        "COUNT", 
        description="Функция агрегации"
    )
    display_name: Optional[str] = Field(None, description="Отображаемое название")


class PivotRequest(BaseModel):
    """Запрос на создание pivot-таблицы"""
    # Фильтры для изоляции данных
    user_id: Optional[UUID] = Field(None, description="ID пользователя")
    project_id: Optional[UUID] = Field(None, description="ID проекта")
    version_id: Optional[UUID] = Field(None, description="ID версии")
    file_upload_id: Optional[UUID] = Field(None, description="ID файла")
    
    # Структура pivot-таблицы
    rows: List[str] = Field(default_factory=list, description="Поля для строк (группировка по строкам)")
    columns: List[str] = Field(default_factory=list, description="Поля для колонок (группировка по колонкам)")
    values: List[PivotAggregation] = Field(default_factory=list, description="Агрегации для значений")
    
    # Выбранные параметры для unpivot (обратного pivot)
    selected_parameters: Optional[List[str]] = Field(None, description="Параметры для преобразования в колонки (unpivot)")
    
    # Дополнительные фильтры
    filters: Optional[Dict[str, Any]] = Field(None, description="Дополнительные фильтры (category, parameter_name, etc.)")
    
    # Лимиты
    limit: int = Field(1000, ge=1, le=10000, description="Максимальное количество строк результата")


class PivotCell(BaseModel):
    """Ячейка pivot-таблицы"""
    row_key: str = Field(..., description="Ключ строки (значения полей rows)")
    column_key: str = Field(..., description="Ключ колонки (значения полей columns)")
    values: Dict[str, Any] = Field(..., description="Значения агрегаций (ключ - display_name агрегации)")


class PivotResponse(BaseModel):
    """Ответ с результатами pivot-таблицы"""
    rows: List[str] = Field(..., description="Список уникальных значений для строк")
    columns: List[str] = Field(..., description="Список уникальных значений для колонок")
    cells: List[PivotCell] = Field(..., description="Ячейки pivot-таблицы")
    aggregations: List[PivotAggregation] = Field(..., description="Использованные агрегации")
    total_rows: int = Field(..., description="Общее количество строк в результате")
    rows_fields: Optional[List[str]] = Field(None, description="Список полей, используемых для строк (для иерархического отображения)")
    columns_fields: Optional[List[str]] = Field(None, description="Список полей, используемых для колонок (для иерархического отображения)")


# Схемы для сохраненных pivot-отчетов
class PivotReportBase(BaseModel):
    """Базовая схема для pivot-отчета"""
    name: str = Field(..., min_length=1, max_length=255, description="Название отчета")
    description: Optional[str] = Field(None, max_length=1000, description="Описание отчета")
    project_id: UUID = Field(..., description="ID проекта")
    version_id: UUID = Field(..., description="ID версии")
    rows: List[str] = Field(default_factory=list, description="Поля для строк")
    columns: List[str] = Field(default_factory=list, description="Поля для колонок")
    values: List[PivotAggregation] = Field(default_factory=list, description="Агрегации для значений")
    selected_parameters: Optional[List[str]] = Field(None, description="Выбранные параметры для unpivot")
    filters: Optional[Dict[str, Any]] = Field(None, description="Дополнительные фильтры")
    pivot_data: Optional[PivotResponse] = Field(None, description="Результаты pivot-таблицы")


class PivotReportCreate(PivotReportBase):
    """Схема для создания pivot-отчета"""
    pass


class PivotReportUpdate(BaseModel):
    """Схема для обновления pivot-отчета"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    rows: Optional[List[str]] = None
    columns: Optional[List[str]] = None
    values: Optional[List[PivotAggregation]] = None
    selected_parameters: Optional[List[str]] = None
    filters: Optional[Dict[str, Any]] = None
    pivot_data: Optional[PivotResponse] = None


class PivotReportResponse(PivotReportBase):
    """Схема ответа для pivot-отчета"""
    id: UUID
    user_id: Optional[UUID] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
