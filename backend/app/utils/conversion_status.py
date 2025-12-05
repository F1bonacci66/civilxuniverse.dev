from __future__ import annotations

from typing import Optional, Tuple

from app.models.upload import ConversionJob


def describe_conversion_step(job: Optional[ConversionJob]) -> Tuple[Optional[str], Optional[str]]:
    """
    Возвращает понятное описание текущего шага конвертации.

    Returns:
        (label, code)
    """
    if not job:
        return None, None
    
    status = job.status or "pending"
    progress = job.progress or 0
    conversion_type = job.conversion_type or "RVT_TO_CSV"
    
    if status == "queued":
        return "В очереди на выполнение", "queued"
    if status == "pending":
        return "Ожидает запуска", "pending"
    if status == "failed":
        return "Ошибка при конвертации", "failed"
    if status == "cancelled":
        return "Задача отменена", "cancelled"
    if status == "completed":
        return "Конвертация завершена", "completed"
    
    # Статус processing — уточняем по типу
    if conversion_type == "RVT_TO_IFC":
        if progress < 20:
            return "Подготовка RVT файла", "rvt_prep"
        if progress < 70:
            return "Конвертация RVT→IFC", "rvt_to_ifc"
        if progress < 100:
            return "Сохранение IFC файла", "ifc_upload"
        return "Конвертация RVT→IFC завершается", "rvt_to_ifc_finalize"
    
    if conversion_type == "IFC_TO_CSV":
        if progress < 30:
            return "Подготовка IFC файла", "ifc_prep"
        if progress < 60:
            return "Конвертация IFC→CSV", "ifc_to_csv"
        if progress < 90:
            return "Разбиение CSV на части", "csv_chunking"
        if progress < 100:
            return "Сохранение CSV данных", "csv_upload"
        return "Конвертация IFC→CSV завершается", "ifc_to_csv_finalize"
    
    # Цепочка RVT→CSV
    if conversion_type == "RVT_TO_CSV":
        if progress < 10:
            return "Инициализация цепочки RVT→IFC→CSV", "chain_init"
        if progress < 55:
            return "Шаг 1/2: RVT→IFC", "chain_rvt_to_ifc"
        if progress < 95:
            return "Шаг 2/2: IFC→CSV", "chain_ifc_to_csv"
        if progress < 100:
            return "Финализация цепочки", "chain_finalize"
        return "Цепочка завершена", "chain_completed"
    
    return "Обработка", "processing"



