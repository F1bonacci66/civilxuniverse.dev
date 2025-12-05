"""
API endpoints для Pivot-аналитики
"""
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from uuid import UUID
import json
import urllib.parse

from app.core.database import get_db
from app.schemas.pivot import (
    PivotRequest, 
    PivotResponse,
    PivotCell,
    PivotAggregation,
    PivotReportCreate,
    PivotReportUpdate,
    PivotReportResponse,
)
from app.services.pivot_service import PivotService
from app.models.pivot import PivotReport
from app.utils.identifiers import (
    resolve_project_by_identifier,
    resolve_version_by_identifier,
    resolve_project_uuid,
    resolve_version_uuid,
)

router = APIRouter(prefix="/pivot", tags=["pivot"])


def _normalize_project_version_payload(payload: dict, db: Session) -> dict:
    """
    Преобразовать project_id/version_id из коротких ID/UUID/slug в реальные UUID.
    """
    data = payload.copy()
    project_identifier = data.get("project_id")
    version_identifier = data.get("version_id")

    project = None
    if project_identifier:
        project = resolve_project_by_identifier(project_identifier, db)
        data["project_id"] = str(project.id)

    if version_identifier:
        version = resolve_version_by_identifier(
            version_identifier,
            db,
            project.id if project else None,
        )
        data["version_id"] = str(version.id)
        if not project:
            data["project_id"] = str(version.project_id)

    return data


@router.post("", response_model=PivotResponse)
async def create_pivot_table(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    # TODO: user_id: UUID = Depends(get_current_user_id),
):
    """
    Создать pivot-таблицу из данных CSV
    
    Args:
        request: Параметры pivot-таблицы
        db: Сессия БД
        
    Returns:
        Результат pivot-таблицы
    """
    # TODO: Получать user_id из JWT токена и применять фильтр безопасности
    # user_id = UUID("00000000-0000-0000-0000-000000000000")  # Временная заглушка
    
    try:
        normalized_payload = _normalize_project_version_payload(payload, db)
        pivot_request = PivotRequest(**normalized_payload)

        # Логирование входящего запроса
        print(f"📥 POST /api/datalab/pivot")
        print(f"   Values в запросе:")
        for v in pivot_request.values:
            print(f"      - field: {v.field}, function: {v.function}, display_name: {v.display_name}")
        if pivot_request.filters:
            print(f"   Filters в запросе:")
            for field, values in pivot_request.filters.items():
                print(f"      - {field}: {values[:5] if isinstance(values, list) else values}... (всего: {len(values) if isinstance(values, list) else 'не список'})")
        if pivot_request.selected_parameters:
            print(f"   Selected parameters: {pivot_request.selected_parameters}")
        
        pivot_service = PivotService()
        result = pivot_service.build_pivot(pivot_request, db)
        
        # Логирование результата
        print(f"📤 POST /api/datalab/pivot -> 200")
        
        # Безопасное получение атрибутов (на случай, если они не установлены)
        rows_fields = getattr(result, 'rows_fields', None)
        columns_fields = getattr(result, 'columns_fields', None)
        
        print(f"   rows_fields в результате: {rows_fields}")
        print(f"   columns_fields в результате: {columns_fields}")
        print(f"   rows в запросе: {pivot_request.rows}")
        print(f"   columns в запросе: {pivot_request.columns}")
        if result.aggregations:
            print(f"   Aggregations в ответе:")
            for agg in result.aggregations:
                label = agg.display_name or f"{agg.function}({agg.field})"
                print(f"      - field: {agg.field}, function: {agg.function}, display_name: {agg.display_name}, label: {label}")
        if result.cells:
            print(f"   Первая ячейка values keys: {list(result.cells[0].values.keys())}")
        
        # Проверяем, что rows_fields и columns_fields установлены
        print(f"   Проверка result.rows_fields: {rows_fields} (тип: {type(rows_fields)})")
        print(f"   Проверка result.columns_fields: {columns_fields} (тип: {type(columns_fields)})")
        
        # Явно проверяем и устанавливаем поля, если они не установлены
        if rows_fields is None:
            print(f"   ⚠️ ВНИМАНИЕ: result.rows_fields is None! Устанавливаем из request.rows: {pivot_request.rows}")
            rows_fields = pivot_request.rows
        if columns_fields is None:
            print(f"   ⚠️ ВНИМАНИЕ: result.columns_fields is None! Устанавливаем из request.columns: {pivot_request.columns}")
            columns_fields = pivot_request.columns
        
        # Создаем новый объект с гарантированно установленными полями
        # Сначала безопасно получаем все данные через model_dump
        # Проверяем наличие атрибутов перед вызовом model_dump
        try:
            # Проверяем, есть ли у объекта все необходимые атрибуты
            if not hasattr(result, 'rows_fields') or not hasattr(result, 'columns_fields'):
                print(f"   ⚠️ У объекта отсутствуют rows_fields или columns_fields, создаем dict вручную")
                # Создаем dict вручную, чтобы избежать ошибки при model_dump
                result_dict = {
                    'rows': getattr(result, 'rows', []),
                    'columns': getattr(result, 'columns', []),
                    'cells': [cell.model_dump() if hasattr(cell, 'model_dump') else (cell.dict() if hasattr(cell, 'dict') else cell) for cell in getattr(result, 'cells', [])],
                    'aggregations': [agg.model_dump() if hasattr(agg, 'model_dump') else (agg.dict() if hasattr(agg, 'dict') else agg) for agg in getattr(result, 'aggregations', [])],
                    'total_rows': getattr(result, 'total_rows', 0),
                }
            else:
                # Если атрибуты есть, используем model_dump
                result_dict = result.model_dump()
        except (AttributeError, Exception) as e:
            # Если model_dump не работает, создаем dict вручную
            print(f"   ⚠️ Ошибка при model_dump: {e}, создаем dict вручную")
            result_dict = {
                'rows': getattr(result, 'rows', []),
                'columns': getattr(result, 'columns', []),
                'cells': [cell.model_dump() if hasattr(cell, 'model_dump') else (cell.dict() if hasattr(cell, 'dict') else cell) for cell in getattr(result, 'cells', [])],
                'aggregations': [agg.model_dump() if hasattr(agg, 'model_dump') else (agg.dict() if hasattr(agg, 'dict') else agg) for agg in getattr(result, 'aggregations', [])],
                'total_rows': getattr(result, 'total_rows', 0),
            }
        
        # Устанавливаем rows_fields и columns_fields
        result_dict['rows_fields'] = rows_fields or pivot_request.rows
        result_dict['columns_fields'] = columns_fields or pivot_request.columns
        
        # Создаем новый объект PivotResponse
        try:
            result = PivotResponse(**result_dict)
        except Exception as e:
            print(f"   ⚠️ Ошибка при создании PivotResponse: {e}")
            # Если не удалось создать, пробуем через model_copy (для Pydantic v2)
            try:
                result = result.model_copy(update={
                    'rows_fields': rows_fields or pivot_request.rows,
                    'columns_fields': columns_fields or pivot_request.columns
                })
            except (AttributeError, Exception):
                # Последняя попытка - создаем новый объект напрямую
                result = PivotResponse(
                    rows=result_dict.get('rows', []),
                    columns=result_dict.get('columns', []),
                    cells=[PivotCell(**cell) if isinstance(cell, dict) else cell for cell in result_dict.get('cells', [])],
                    aggregations=[PivotAggregation(**agg) if isinstance(agg, dict) else agg for agg in result_dict.get('aggregations', [])],
                    total_rows=result_dict.get('total_rows', 0),
                    rows_fields=rows_fields or pivot_request.rows,
                    columns_fields=columns_fields or pivot_request.columns
                )
        
        # Сериализуем в dict для проверки
        result_dict = result.model_dump()
        print(f"   result.model_dump() содержит rows_fields: {'rows_fields' in result_dict}")
        print(f"   result.model_dump() содержит columns_fields: {'columns_fields' in result_dict}")
        if 'rows_fields' in result_dict:
            print(f"   result_dict['rows_fields']: {result_dict['rows_fields']}")
        if 'columns_fields' in result_dict:
            print(f"   result_dict['columns_fields']: {result_dict['columns_fields']}")
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка построения pivot-таблицы: {str(e)}"
        )


@router.get("/filter-values")
async def get_filter_values(
    project_id: str = Query(..., alias="project_id"),
    version_id: str = Query(..., alias="version_id"),
    field: str = Query(..., description="Поле для получения уникальных значений"),
    selected_parameters: Optional[List[str]] = Query(None, alias="selected_parameters"),
    filters: Optional[str] = Query(None, description="JSON строка с фильтрами для каскадной фильтрации (Record<string, string[]>)"),
    db: Session = Depends(get_db),
):
    """
    Получить уникальные значения для поля после unpivot
    
    Args:
        project_id: ID проекта
        version_id: ID версии
        field: Поле для получения значений (значения для этого поля будут отфильтрованы на основе других фильтров)
        selected_parameters: Выбранные параметры для unpivot (если есть)
        filters: JSON строка с фильтрами для каскадной фильтрации (исключая поле field)
        db: Сессия БД
        
    Returns:
        Список уникальных значений поля (отфильтрованных на основе других фильтров)
    """
    try:
        project = resolve_project_by_identifier(project_id, db)
        version = resolve_version_by_identifier(version_id, db, project.id)
        
        # Парсим фильтры из JSON строки
        parsed_filters: Optional[Dict[str, List[str]]] = None
        import sys
        sys.stdout.flush()
        print(f"🔍 API: get_filter_values вызван для field='{field}', filters (raw)='{filters}'", flush=True)
        sys.stdout.flush()
        if filters:
            try:
                # FastAPI автоматически декодирует URL-encoded строки, но нужно проверить, что это JSON
                # Если фильтры все еще URL-encoded, декодируем их
                try:
                    decoded_filters = urllib.parse.unquote(filters)
                    if decoded_filters != filters:
                        print(f"🔍 API: Фильтры были URL-encoded, декодированы: '{decoded_filters}'", flush=True)
                        filters = decoded_filters
                except:
                    pass
                parsed_filters = json.loads(filters)
                sys.stdout.flush()
                print(f"📊 API: Получены фильтры из JSON: {parsed_filters} (тип: {type(parsed_filters)})", flush=True)
                sys.stdout.flush()
                # Удаляем фильтр для текущего поля, чтобы избежать циклической зависимости
                if field in parsed_filters:
                    sys.stdout.flush()
                    print(f"📊 API: Удаляем фильтр для текущего поля '{field}' из {parsed_filters}", flush=True)
                    sys.stdout.flush()
                    del parsed_filters[field]
                # Если после удаления фильтры пусты, устанавливаем None
                if not parsed_filters:
                    sys.stdout.flush()
                    print(f"📊 API: После удаления поля '{field}' фильтры пусты, устанавливаем None", flush=True)
                    sys.stdout.flush()
                    parsed_filters = None
                else:
                    sys.stdout.flush()
                    print(f"📊 API: Фильтры после обработки: {parsed_filters}", flush=True)
                    sys.stdout.flush()
            except json.JSONDecodeError as e:
                # Если не удалось распарсить, игнорируем фильтры
                sys.stdout.flush()
                print(f"❌ API: Ошибка парсинга фильтров: {e}, filters='{filters}'", flush=True)
                sys.stdout.flush()
                parsed_filters = None
            except Exception as e:
                sys.stdout.flush()
                print(f"❌ API: Неожиданная ошибка при парсинге фильтров: {e}, filters='{filters}'", flush=True)
                sys.stdout.flush()
                parsed_filters = None
        else:
            sys.stdout.flush()
            print(f"⚠️ API: Фильтры не переданы (filters=None или пустая строка)", flush=True)
            sys.stdout.flush()
        
        request = PivotRequest(
            project_id=project.id,
            version_id=version.id,
            selected_parameters=selected_parameters or [],
            filters=parsed_filters,
        )
        
        sys.stdout.flush()
        print(f"📊 API: Создан PivotRequest для поля '{field}' с filters={request.filters} (тип: {type(request.filters)})", flush=True)
        sys.stdout.flush()
        pivot_service = PivotService()
        values = pivot_service.get_filter_values(request, field, db)
        sys.stdout.flush()
        print(f"📊 API: Возвращено {len(values)} значений для поля '{field}' (с фильтрами: {request.filters})", flush=True)
        sys.stdout.flush()
        return {"values": values}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка получения значений фильтра: {str(e)}"
        )


@router.get("/fields")
async def get_available_fields(
    user_id: Optional[str] = Query(None, alias="user_id"),
    project_id: Optional[str] = Query(None, alias="project_id"),
    version_id: Optional[str] = Query(None, alias="version_id"),
    file_upload_id: Optional[str] = Query(None, alias="file_upload_id"),
    db: Session = Depends(get_db),
):
    """
    Получить список доступных полей для pivot-таблицы
    
    Args:
        user_id: ID пользователя (для фильтрации)
        project_id: ID проекта (для фильтрации)
        version_id: ID версии (для фильтрации)
        file_upload_id: ID файла (для фильтрации)
        db: Сессия БД
        
    Returns:
        Список доступных полей с примерами значений
    """
    try:
        from uuid import UUID
        project_uuid = resolve_project_uuid(project_id, db) if project_id else None
        version_uuid = resolve_version_uuid(version_id, db, project_uuid) if version_id else None
        # Преобразуем строки в UUID, если они переданы
        request = PivotRequest(
            user_id=UUID(user_id) if user_id else None,
            project_id=project_uuid,
            version_id=version_uuid,
            file_upload_id=UUID(file_upload_id) if file_upload_id else None,
        )
        
        pivot_service = PivotService()
        fields = pivot_service.get_available_fields(request, db)
        return {"fields": fields}
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Неверный формат UUID: {str(e)}"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка получения полей: {str(e)}"
        )


# ============================================
# Endpoints для сохраненных pivot-отчетов
# ============================================

@router.get("/reports", response_model=List[PivotReportResponse])
async def list_pivot_reports(
    project_id: Optional[str] = Query(None, alias="project_id"),
    version_id: Optional[str] = Query(None, alias="version_id"),
    db: Session = Depends(get_db),
    # TODO: user_id: UUID = Depends(get_current_user_id),
):
    """
    Получить список сохраненных pivot-отчетов
    
    Args:
        project_id: ID проекта (обязательно)
        version_id: ID версии (обязательно)
        db: Сессия БД
        
    Returns:
        Список сохраненных отчетов
    """
    if not project_id or not version_id:
        raise HTTPException(
            status_code=400,
            detail="Необходимо указать project_id и version_id"
        )
    
    project = resolve_project_by_identifier(project_id, db)
    version = resolve_version_by_identifier(version_id, db, project.id)
    
    # TODO: Добавить фильтрацию по user_id когда будет авторизация
    reports = db.query(PivotReport).filter(
        PivotReport.project_id == project.id,
        PivotReport.version_id == version.id,
    ).order_by(PivotReport.updated_at.desc()).all()
    
    # Преобразуем модели в ответы
    result = []
    for r in reports:
        # Конвертируем JSONB values обратно в PivotAggregation
        from app.schemas.pivot import PivotAggregation, PivotResponse
        values = [PivotAggregation(**v) if isinstance(v, dict) else v for v in (r.values or [])]
        
        # Конвертируем JSONB pivot_data обратно в PivotResponse
        pivot_data = None
        if r.pivot_data:
            pivot_data = PivotResponse(**r.pivot_data) if isinstance(r.pivot_data, dict) else r.pivot_data
        
        # Получаем selected_parameters из filters (временное решение) или из отдельного поля
        selected_parameters = None
        if hasattr(r, 'selected_parameters') and r.selected_parameters:
            selected_parameters = r.selected_parameters
        elif r.filters and isinstance(r.filters, dict) and 'selected_parameters' in r.filters:
            selected_parameters = r.filters.get('selected_parameters')
        
        result.append(PivotReportResponse(
            id=r.id,
            name=r.name,
            description=r.description,
            project_id=r.project_id,
            version_id=r.version_id,
            user_id=r.user_id,
            rows=r.rows or [],
            columns=r.columns or [],
            values=values,
            selected_parameters=selected_parameters or [],
            filters=r.filters,
            pivot_data=pivot_data,
            created_at=r.created_at.isoformat() if r.created_at else "",
            updated_at=r.updated_at.isoformat() if r.updated_at else "",
        ))
    
    return result


@router.get("/reports/{report_id}", response_model=PivotReportResponse)
async def get_pivot_report(
    report_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Получить сохраненный pivot-отчет по ID
    
    Args:
        report_id: ID отчета
        db: Сессия БД
        
    Returns:
        Сохраненный отчет
    """
    report = db.query(PivotReport).filter(PivotReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Отчет не найден")
    
    # Конвертируем JSONB values обратно в PivotAggregation
    from app.schemas.pivot import PivotAggregation, PivotResponse
    values = [PivotAggregation(**v) if isinstance(v, dict) else v for v in (report.values or [])]
    
    # Конвертируем JSONB pivot_data обратно в PivotResponse
    pivot_data = None
    if report.pivot_data:
        pivot_data = PivotResponse(**report.pivot_data) if isinstance(report.pivot_data, dict) else report.pivot_data
    
    # Получаем selected_parameters из filters (временное решение) или из отдельного поля
    selected_parameters = None
    if hasattr(report, 'selected_parameters') and report.selected_parameters:
        selected_parameters = report.selected_parameters
    elif report.filters and isinstance(report.filters, dict) and 'selected_parameters' in report.filters:
        selected_parameters = report.filters.get('selected_parameters')
    
    return PivotReportResponse(
        id=report.id,
        name=report.name,
        description=report.description,
        project_id=report.project_id,
        version_id=report.version_id,
        user_id=report.user_id,
        rows=report.rows or [],
        columns=report.columns or [],
        values=values,
        selected_parameters=selected_parameters or [],
        filters=report.filters,
        pivot_data=pivot_data,
        created_at=report.created_at.isoformat() if report.created_at else "",
        updated_at=report.updated_at.isoformat() if report.updated_at else "",
    )


@router.post("/reports", response_model=PivotReportResponse, status_code=201)
async def create_pivot_report(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    # TODO: user_id: UUID = Depends(get_current_user_id),
):
    """
    Создать новый сохраненный pivot-отчет
    
    Args:
        report_data: Данные отчета
        db: Сессия БД
        
    Returns:
        Созданный отчет
    """
    # TODO: Получать user_id из JWT токена
    from uuid import UUID

    normalized_payload = _normalize_project_version_payload(payload, db)
    report_data = PivotReportCreate(**normalized_payload)

    user_id = UUID("00000000-0000-0000-0000-000000000000")  # Временная заглушка
    
    # Проверяем, что проект и версия существуют
    from app.models.project import Project, ProjectVersion
    project = db.query(Project).filter(Project.id == report_data.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    
    version = db.query(ProjectVersion).filter(ProjectVersion.id == report_data.version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Версия проекта не найдена")
    
    # Проверяем, что версия принадлежит проекту
    if version.project_id != report_data.project_id:
        raise HTTPException(status_code=400, detail="Версия не принадлежит указанному проекту")
    
    # Сохраняем selected_parameters в filters (временное решение, пока не добавим отдельное поле)
    filters = report_data.filters or {}
    if report_data.selected_parameters:
        filters = {**(filters or {}), 'selected_parameters': report_data.selected_parameters}
    
    # Создаем отчет
    report = PivotReport(
        name=report_data.name,
        description=report_data.description,
        project_id=report_data.project_id,
        version_id=report_data.version_id,
        user_id=user_id,
        rows=report_data.rows,
        columns=report_data.columns,
        values=[v.model_dump() for v in report_data.values],  # Конвертируем в dict для JSONB
        filters=filters,
        pivot_data=report_data.pivot_data.model_dump() if report_data.pivot_data else None,  # Конвертируем в dict для JSONB
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    # Конвертируем JSONB values обратно в PivotAggregation
    from app.schemas.pivot import PivotAggregation, PivotResponse
    values = [PivotAggregation(**v) if isinstance(v, dict) else v for v in (report.values or [])]
    
    # Конвертируем JSONB pivot_data обратно в PivotResponse
    pivot_data = None
    if report.pivot_data:
        pivot_data = PivotResponse(**report.pivot_data) if isinstance(report.pivot_data, dict) else report.pivot_data
    
    # Получаем selected_parameters из filters (временное решение) или из отдельного поля
    selected_parameters = None
    if hasattr(report, 'selected_parameters') and report.selected_parameters:
        selected_parameters = report.selected_parameters
    elif report.filters and isinstance(report.filters, dict) and 'selected_parameters' in report.filters:
        selected_parameters = report.filters.get('selected_parameters')
    
    return PivotReportResponse(
        id=report.id,
        name=report.name,
        description=report.description,
        project_id=report.project_id,
        version_id=report.version_id,
        user_id=report.user_id,
        rows=report.rows or [],
        columns=report.columns or [],
        values=values,
        selected_parameters=selected_parameters or [],
        filters=report.filters,
        pivot_data=pivot_data,
        created_at=report.created_at.isoformat() if report.created_at else "",
        updated_at=report.updated_at.isoformat() if report.updated_at else "",
    )


@router.put("/reports/{report_id}", response_model=PivotReportResponse)
async def update_pivot_report(
    report_id: UUID,
    report_data: PivotReportUpdate,
    db: Session = Depends(get_db),
    # TODO: user_id: UUID = Depends(get_current_user_id),
):
    """
    Обновить сохраненный pivot-отчет
    
    Args:
        report_id: ID отчета
        report_data: Обновленные данные
        db: Сессия БД
        
    Returns:
        Обновленный отчет
    """
    report = db.query(PivotReport).filter(PivotReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Отчет не найден")
    
    # TODO: Проверять права доступа (user_id должен совпадать)
    
    # Обновляем поля
    if report_data.name is not None:
        report.name = report_data.name
    if report_data.description is not None:
        report.description = report_data.description
    if report_data.rows is not None:
        report.rows = report_data.rows
    if report_data.columns is not None:
        report.columns = report_data.columns
    if report_data.values is not None:
        report.values = [v.model_dump() for v in report_data.values]
    # Обрабатываем selected_parameters и filters
    if report_data.selected_parameters is not None:
        # Сохраняем selected_parameters в filters (временное решение)
        filters = report.filters or {}
        if isinstance(filters, dict):
            filters = {**filters, 'selected_parameters': report_data.selected_parameters}
        else:
            filters = {'selected_parameters': report_data.selected_parameters}
        report.filters = filters
    if report_data.filters is not None:
        # Если обновляются filters, сохраняем selected_parameters из request или из существующих filters
        filters = report_data.filters
        if report_data.selected_parameters is not None:
            # Если selected_parameters переданы отдельно, добавляем их в filters
            if isinstance(filters, dict):
                filters = {**filters, 'selected_parameters': report_data.selected_parameters}
            else:
                filters = {'selected_parameters': report_data.selected_parameters}
        elif report.filters and isinstance(report.filters, dict):
            # Сохраняем существующие selected_parameters
            existing_selected = report.filters.get('selected_parameters')
            if existing_selected:
                if isinstance(filters, dict):
                    filters = {**filters, 'selected_parameters': existing_selected}
                else:
                    filters = {'selected_parameters': existing_selected}
        report.filters = filters
    if report_data.pivot_data is not None:
        report.pivot_data = report_data.pivot_data.model_dump() if report_data.pivot_data else None
    
    db.commit()
    db.refresh(report)
    
    # Конвертируем JSONB values обратно в PivotAggregation
    from app.schemas.pivot import PivotAggregation, PivotResponse
    values = [PivotAggregation(**v) if isinstance(v, dict) else v for v in (report.values or [])]
    
    # Конвертируем JSONB pivot_data обратно в PivotResponse
    pivot_data = None
    if report.pivot_data:
        pivot_data = PivotResponse(**report.pivot_data) if isinstance(report.pivot_data, dict) else report.pivot_data
    
    # Получаем selected_parameters из filters (временное решение) или из отдельного поля
    selected_parameters = None
    if hasattr(report, 'selected_parameters') and report.selected_parameters:
        selected_parameters = report.selected_parameters
    elif report.filters and isinstance(report.filters, dict) and 'selected_parameters' in report.filters:
        selected_parameters = report.filters.get('selected_parameters')
    
    return PivotReportResponse(
        id=report.id,
        name=report.name,
        description=report.description,
        project_id=report.project_id,
        version_id=report.version_id,
        user_id=report.user_id,
        rows=report.rows or [],
        columns=report.columns or [],
        values=values,
        selected_parameters=selected_parameters or [],
        filters=report.filters,
        pivot_data=pivot_data,
        created_at=report.created_at.isoformat() if report.created_at else "",
        updated_at=report.updated_at.isoformat() if report.updated_at else "",
    )


@router.delete("/reports/{report_id}", status_code=204)
async def delete_pivot_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    # TODO: user_id: UUID = Depends(get_current_user_id),
):
    """
    Удалить сохраненный pivot-отчет
    
    Args:
        report_id: ID отчета
        db: Сессия БД
    """
    report = db.query(PivotReport).filter(PivotReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Отчет не найден")
    
    # TODO: Проверять права доступа (user_id должен совпадать)
    
    db.delete(report)
    db.commit()
    
    return None

