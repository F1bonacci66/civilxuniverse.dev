"""
Сервис конвертации RVT в IFC

Примечание: Конвертер DataDrivenConstruction в бесплатной версии пытается открыть
браузер с промо-страницей. Для блокировки открытия браузера используются:
1. Переменные окружения (BROWSER, NO_BROWSER, DISABLE_BROWSER и др.)
2. Флаги Windows для запуска процесса без окна (CREATE_NO_WINDOW)
3. Скрытие окна процесса через STARTUPINFO

Если браузер все еще открывается, возможно, конвертер использует прямые вызовы
Windows API (ShellExecute). В таком случае рекомендуется:
- Использовать платную версию конвертера (Ad-Free version)
- Или использовать альтернативный конвертер RVT->IFC
"""
import subprocess
import os
import sys
from pathlib import Path
from typing import Optional
from app.core.config import settings


class RVT2IFCService:
    """Сервис для конвертации RVT файлов в IFC"""
    
    def __init__(self):
        self.converter_path = settings.RVT2IFC_CONVERTER_PATH
    
    def _get_process_env(self) -> dict:
        """
        Получить переменные окружения для процесса конвертации.
        Блокирует открытие браузера конвертером.
        """
        env = os.environ.copy()
        
        # Блокируем открытие браузера через переменные окружения
        # Устанавливаем фиктивный браузер, который ничего не делает
        env['BROWSER'] = 'NONE'
        env['NO_BROWSER'] = '1'
        env['DISABLE_BROWSER'] = '1'
        env['BROWSER_NONE'] = '1'
        
        # Переменные для блокировки различных способов открытия браузера
        env['NO_OPEN'] = '1'
        env['SUPPRESS_BROWSER'] = '1'
        
        # Для Windows - блокируем вызовы браузера
        if sys.platform == 'win32':
            # Переопределяем переменные для браузеров
            # Chrome, Edge, Firefox - все блокируем
            env['CHROME_BIN'] = ''
            env['MSEDGE_BIN'] = ''
            env['FIREFOX_BIN'] = ''
            
            # Блокируем обнаружение браузеров через стандартные пути
            # Устанавливаем пустые значения для переменных браузеров
            env['CHROME_PATH'] = ''
            env['EDGE_PATH'] = ''
            env['FIREFOX_PATH'] = ''
            env['IE_PATH'] = ''
        
        return env
    
    def _get_process_flags(self) -> dict:
        """
        Получить флаги для subprocess в зависимости от ОС.
        Блокирует открытие новых окон и браузера.
        """
        flags = {}
        
        if sys.platform == 'win32':
            # CREATE_NO_WINDOW - не создавать окно консоли
            # CREATE_NEW_PROCESS_GROUP - создать новую группу процессов
            # Это помогает предотвратить открытие браузера и новых окон
            # Примечание: DETACHED_PROCESS не используется, т.к. он может
            # помешать получению stdout/stderr от процесса
            flags['creationflags'] = (
                subprocess.CREATE_NO_WINDOW | 
                subprocess.CREATE_NEW_PROCESS_GROUP
            )
            
            # Настройка startupinfo для скрытия окна
            flags['startupinfo'] = subprocess.STARTUPINFO()
            flags['startupinfo'].dwFlags |= subprocess.STARTF_USESHOWWINDOW
            flags['startupinfo'].wShowWindow = subprocess.SW_HIDE
            # Дополнительно: скрываем окно процесса
            flags['startupinfo'].dwFlags |= subprocess.STARTF_USESTDHANDLES
        
        return flags
    
    def convert(
        self,
        rvt_file_path: str,
        output_ifc_path: str,
        export_settings: Optional[dict] = None,
    ) -> dict:
        """
        Конвертировать RVT файл в IFC
        
        Args:
            rvt_file_path: Путь к RVT файлу
            output_ifc_path: Путь для сохранения IFC файла
            export_settings: Настройки экспорта
            
        Returns:
            Результат конвертации
        """
        if not os.path.exists(self.converter_path):
            raise FileNotFoundError(f"Конвертер не найден: {self.converter_path}")
        
        if not os.path.exists(rvt_file_path):
            raise FileNotFoundError(f"RVT файл не найден: {rvt_file_path}")
        
        # Формируем аргументы командной строки
        args = self._build_command_line_args(rvt_file_path, output_ifc_path, export_settings)
        
        # Получаем переменные окружения и флаги для блокировки браузера
        process_env = self._get_process_env()
        process_flags = self._get_process_flags()
        
        try:
            # Запускаем конвертер с блокировкой браузера
            process = subprocess.Popen(
                [self.converter_path] + args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=process_env,
                **process_flags,
            )
            
            stdout, stderr = process.communicate()
            
            if process.returncode == 0 and os.path.exists(output_ifc_path):
                return {
                    "success": True,
                    "output_path": output_ifc_path,
                    "stdout": stdout,
                    "stderr": stderr,
                }
            else:
                return {
                    "success": False,
                    "error": stderr or "Конвертация завершилась с ошибкой",
                    "stdout": stdout,
                    "stderr": stderr,
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }
    
    def _build_command_line_args(
        self,
        rvt_file_path: str,
        output_ifc_path: str,
        export_settings: Optional[dict],
    ) -> list:
        """
        Построить аргументы командной строки для RVT2IFCconverter.exe
        Используются стандартные настройки из документации export-to-ifc.mdc
        """
        # Пути без кавычек - subprocess сам обработает пробелы
        args = [
            rvt_file_path,
            output_ifc_path,
            "mode=custom",
        ]
        
        # Применяем настройки по умолчанию, если не указаны
        settings_dict = export_settings or {}
        
        # === File / Format ===
        # FileVersion: IFC4 ReferenceView (ifc4rv)
        file_version = settings_dict.get("file_version", "ifc4rv")
        args.append(f'FileVersion="{file_version}"')
        
        # === File Header ===
        # FhFileDesc: Описание файла
        fh_file_desc = settings_dict.get("fh_file_desc", "Standard IFC export")
        args.append(f'FhFileDesc="{fh_file_desc}"')
        
        # === Visibility / View ===
        # VisibleOnly: только видимые элементы
        visible_only = settings_dict.get("visible_only", True)
        args.append(f"VisibleOnly={'y' if visible_only else 'n'}")
        
        # RoomsIn3D: не экспортировать комнаты в 3D
        rooms_in_3d = settings_dict.get("rooms_in_3d", False)
        args.append(f"RoomsIn3D={'y' if rooms_in_3d else 'n'}")
        
        # 2DPlanViewEl: не экспортировать 2D элементы планов
        plan_view_elements = settings_dict.get("2d_plan_view_el", False)
        args.append(f"2DPlanViewEl={'y' if plan_view_elements else 'n'}")
        
        # LinkedAsSeparate: не экспортировать связанные файлы отдельно
        linked_as_separate = settings_dict.get("linked_as_separate", False)
        args.append(f"LinkedAsSeparate={'y' if linked_as_separate else 'n'}")
        
        # === LOD / Tessellation ===
        # LevelOfDetail: уровень детализации
        level_of_detail = settings_dict.get("level_of_detail", "low")
        args.append(f'LevelOfDetail="{level_of_detail}"')
        
        # CLOD_FastMode: быстрый режим
        clod_fast_mode = settings_dict.get("clod_fast_mode", True)
        args.append(f"CLOD_FastMode={'y' if clod_fast_mode else 'n'}")
        
        # CLOD_RecalculateSurfaceTolerance: пересчитывать допуск поверхности
        clod_recalculate_tolerance = settings_dict.get("clod_recalculate_surface_tolerance", True)
        args.append(f"CLOD_RecalculateSurfaceTolerance={'y' if clod_recalculate_tolerance else 'n'}")
        
        # === Property Sets ===
        # Используем настройки по умолчанию из документации, если не указаны
        property_sets = settings_dict.get("property_sets", {})
        
        # BimRvPropSets: экспорт параметров Revit как IFC property sets
        bim_rv_prop_sets = property_sets.get("bim_rv_prop_sets") if property_sets else True
        if bim_rv_prop_sets is not None:
            args.append(f"BimRvPropSets={'y' if bim_rv_prop_sets else 'n'}")
        else:
            args.append("BimRvPropSets=y")
        
        # BaseQuantities: экспорт базовых количеств (QTO)
        base_quantities = property_sets.get("base_quantities") if property_sets else True
        if base_quantities is not None:
            args.append(f"BaseQuantities={'y' if base_quantities else 'n'}")
        else:
            args.append("BaseQuantities=y")
        
        # MaterialPropSets: экспорт property sets материалов
        material_prop_sets = property_sets.get("material_prop_sets") if property_sets else True
        if material_prop_sets is not None:
            args.append(f"MaterialPropSets={'y' if material_prop_sets else 'n'}")
        else:
            args.append("MaterialPropSets=y")
        
        # IgnoreIfcPg: игнорирование группы свойств IFC
        ignore_ifc_pg = property_sets.get("ignore_ifc_pg") if property_sets else True
        if ignore_ifc_pg is not None:
            args.append(f"IgnoreIfcPg={'y' if ignore_ifc_pg else 'n'}")
        else:
            args.append("IgnoreIfcPg=y")
        
        # IfcCommonPropSets: не экспортировать общие property sets IFC
        ifc_common_prop_sets = property_sets.get("ifc_common_prop_sets") if property_sets else False
        if ifc_common_prop_sets is not None:
            args.append(f"IfcCommonPropSets={'y' if ifc_common_prop_sets else 'n'}")
        else:
            args.append("IfcCommonPropSets=n")
        
        # Schedules: не экспортировать спецификации
        schedules = property_sets.get("schedules") if property_sets else False
        if schedules is not None:
            args.append(f"Schedules={'y' if schedules else 'n'}")
        else:
            args.append("Schedules=n")
        
        # SchedFilter: не фильтровать спецификации
        sched_filter = property_sets.get("sched_filter") if property_sets else False
        if sched_filter is not None:
            args.append(f"SchedFilter={'y' if sched_filter else 'n'}")
        else:
            args.append("SchedFilter=n")
        
        # UserDefPSets: не использовать пользовательские property sets
        user_def_psets = property_sets.get("user_def_psets") if property_sets else False
        if user_def_psets is not None:
            args.append(f"UserDefPSets={'y' if user_def_psets else 'n'}")
        else:
            args.append("UserDefPSets=n")
        
        # ParamMapTable: не использовать таблицу маппинга параметров
        param_map_table = property_sets.get("param_map_table") if property_sets else False
        if param_map_table is not None:
            args.append(f"ParamMapTable={'y' if param_map_table else 'n'}")
        else:
            args.append("ParamMapTable=n")
        
        # === Advanced Options ===
        # Используем настройки по умолчанию из документации, если не указаны
        advanced_options = settings_dict.get("advanced_options", {})
        
        # CoplanarFacesToExtrusion: преобразовывать копланарные грани в экструзии
        coplanar_faces = advanced_options.get("coplanar_faces_to_extrusion") if advanced_options else True
        if coplanar_faces is not None:
            args.append(f"CoplanarFacesToExtrusion={'y' if coplanar_faces else 'n'}")
        else:
            args.append("CoplanarFacesToExtrusion=y")
        
        # SystemMaterialIsMain: системный материал как основной
        system_material = advanced_options.get("system_material_is_main") if advanced_options else True
        if system_material is not None:
            args.append(f"SystemMaterialIsMain={'y' if system_material else 'n'}")
        else:
            args.append("SystemMaterialIsMain=y")
        
        # ExportBoundBox: не экспортировать ограничивающий бокс
        export_bound_box = advanced_options.get("export_bound_box") if advanced_options else False
        if export_bound_box is not None:
            args.append(f"ExportBoundBox={'y' if export_bound_box else 'n'}")
        else:
            args.append("ExportBoundBox=n")
        
        # KeepTesGeomAsTriangl: не сохранять тесселированную геометрию как треугольники
        keep_tess_geom = advanced_options.get("keep_tess_geom_as_triangl") if advanced_options else False
        if keep_tess_geom is not None:
            args.append(f"KeepTesGeomAsTriangl={'y' if keep_tess_geom else 'n'}")
        else:
            args.append("KeepTesGeomAsTriangl=n")
        
        return args

