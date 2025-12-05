"""
Трансформирует CSV exporter'а (широкий формат) в длинный формат,
который использует существующая система (ModelName, ElementId, ...).
"""
import csv
from pathlib import Path
from typing import Dict, List, Optional


class CSVWideToLongTransformer:
    """Pivot из wide CSV (ID | Category | param1 | ...) в long формат."""

    OUTPUT_HEADERS = [
        "ModelName",
        "ElementId",
        "Category",
        "ParameterName",
        "ParameterValue",
    ]

    def transform(
        self,
        source_path: str,
        destination_path: str,
        model_name: str,
    ) -> Dict[str, int]:
        """
        Выполнить трансформацию.

        Returns:
            dict с количеством записей и параметров.
        """
        source = Path(source_path)
        if not source.exists():
            raise FileNotFoundError(f"CSV файл не найден: {source_path}")

        delimiter = self._detect_delimiter(source)
        encoding = self._detect_encoding(source)

        with source.open("r", encoding=encoding, newline="") as src_file, Path(
            destination_path
        ).open("w", encoding="utf-8-sig", newline="") as dst_file:
            reader = csv.reader(src_file, delimiter=delimiter)
            writer = csv.DictWriter(dst_file, fieldnames=self.OUTPUT_HEADERS)
            writer.writeheader()

            headers = next(reader, None)
            if not headers:
                raise ValueError("CSV файл не содержит заголовков")

            normalized_headers = [self._normalize_header(h) for h in headers]

            id_idx = self._find_column(normalized_headers, ["id", "elementid", "element_id"])
            if id_idx is None:
                id_idx = 0

            category_idx = self._find_column(normalized_headers, ["category", "категория"])

            excluded_columns = {id_idx}
            if category_idx is not None:
                excluded_columns.add(category_idx)

            pivot_indexes = [idx for idx in range(len(headers)) if idx not in excluded_columns]

            if not pivot_indexes:
                raise ValueError("Не найдены столбцы для pivot-преобразования")

            rows_written = 0
            for row in reader:
                row = self._pad_row(row, len(headers))
                element_id = row[id_idx].strip() if id_idx < len(row) else ""
                category = (
                    row[category_idx].strip()
                    if category_idx is not None and category_idx < len(row)
                    else ""
                )

                for pivot_idx in pivot_indexes:
                    parameter_name = self._human_readable_header(headers[pivot_idx])
                    parameter_value = row[pivot_idx].strip()
                    if parameter_value == "":
                        continue

                    writer.writerow(
                        {
                            "ModelName": model_name,
                            "ElementId": element_id,
                            "Category": category,
                            "ParameterName": parameter_name,
                            "ParameterValue": parameter_value,
                        }
                    )
                    rows_written += 1

            return {
                "rows": rows_written,
                "parameters": len(pivot_indexes),
            }

    @staticmethod
    def _normalize_header(value: Optional[str]) -> str:
        return (value or "").strip().lower()

    @staticmethod
    def _human_readable_header(value: Optional[str]) -> str:
        cleaned = (value or "").strip()
        return cleaned or "Unnamed parameter"

    @staticmethod
    def _pad_row(row: List[str], target_len: int) -> List[str]:
        if len(row) >= target_len:
            return row
        return row + [""] * (target_len - len(row))

    def _detect_delimiter(self, path: Path) -> str:
        with path.open("r", encoding="utf-8", errors="ignore") as file:
            sample = file.readline()

        semicolons = sample.count(";")
        commas = sample.count(",")

        if semicolons == 0 and commas == 0:
            return ";"
        return ";" if semicolons >= commas else ","

    def _detect_encoding(self, path: Path) -> str:
        encodings = ["utf-8-sig", "utf-8", "cp1251", "latin-1"]
        for enc in encodings:
            try:
                with path.open("r", encoding=enc) as file:
                    file.read(1024)
                return enc
            except UnicodeDecodeError:
                continue
        return "utf-8"

    @staticmethod
    def _find_column(headers: List[str], candidates: List[str]) -> Optional[int]:
        for idx, header in enumerate(headers):
            if header in candidates:
                return idx
        return None

