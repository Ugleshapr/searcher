#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Модуль обработки и сжатия спецификаций продукции КЭАЗ:
1. Загружает активные артикулы из base.csv
2. Фильтрует products_spec.csv и products_spec_values.csv (отсекает архивные и мертвые строки)
3. Генерирует:
   - products_spec.json (словарь характеристик)
   - products_spec.csv (совместимый CSV)
   - products_spec_values.json (структура {art: [[spec_id, value], ...]})
   - products_spec_values.json.gz (ультралегкий gzip ~700 КБ)
   - products_spec_values.json.br (Brotli ~380 КБ, если доступен)
   - products_spec_values.csv (отфильтрованный CSV для обратной совместимости)
"""

import os
import sys
import csv
import json
import gzip
import time
import shutil
import subprocess
from pathlib import Path

def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def process_specs(base_csv_path: Path, spec_csv_path: Path, val_csv_path: Path, output_dir: Path):
    t0 = time.time()
    output_dir.mkdir(parents=True, exist_ok=True)

    if not base_csv_path.exists():
        raise FileNotFoundError(f"base.csv не найден по пути: {base_csv_path}")
    if not spec_csv_path.exists():
        raise FileNotFoundError(f"products_spec.csv не найден: {spec_csv_path}")
    if not val_csv_path.exists():
        raise FileNotFoundError(f"products_spec_values.csv не найден: {val_csv_path}")

    # 1. Сбор активных артикулов из base.csv
    active_articles = set()
    with open(base_csv_path, "r", encoding="utf-8-sig", errors="ignore") as f:
        reader = csv.reader(f, delimiter=';')
        next(reader, None)
        for row in reader:
            if len(row) > 1 and row[1].strip():
                active_articles.add(row[1].strip())
    log(f"Загружено активных артикулов из базы: {len(active_articles)}")

    # 2. Обработка products_spec.csv
    specs_dict = {}
    spec_clean_csv_lines = ["spec_id;title;value_type;group_id;group_name;"]
    with open(spec_csv_path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f, delimiter=';')
        next(reader, None)
        for row in reader:
            if not row or not row[0].strip():
                continue
            sid = row[0].strip()
            title = row[1].strip().strip("'") if len(row) > 1 else ""
            vtype = row[2].strip().strip("'") if len(row) > 2 else ""
            gid = int(row[3].strip()) if len(row) > 3 and row[3].strip().isdigit() else 0
            gname = row[4].strip().strip("'") if len(row) > 4 else ""
            specs_dict[sid] = {
                "title": title,
                "value_type": vtype,
                "group_id": gid,
                "group_name": gname
            }
            spec_clean_csv_lines.append(f"{sid};'{title}';'{vtype}';{gid};'{gname}'")
    log(f"Обработано типов характеристик (specs): {len(specs_dict)}")

    # 3. Обработка products_spec_values.csv (фильтрация по active_articles)
    values_by_art = {}
    val_clean_csv_lines = ["product_id;spec_id;value;"]
    matched_count = 0
    total_count = 0

    with open(val_csv_path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f, delimiter=';')
        next(reader, None)
        for row in reader:
            total_count += 1
            if len(row) < 3:
                continue
            art = row[0].strip()
            if art in active_articles:
                matched_count += 1
                sid = row[1].strip()
                val = row[2].strip().strip("'")
                if art not in values_by_art:
                    values_by_art[art] = []
                # Сохраняем компактный кортеж [spec_id, value]
                values_by_art[art].append([int(sid) if sid.isdigit() else sid, val])
                val_clean_csv_lines.append(f"{art};{sid};'{val}'")

    log(f"Всего строк в выгрузке: {total_count}, отфильтровано для активной базы: {matched_count} ({len(values_by_art)} товаров)")

    # 4. Сохранение результатов
    # 4.1 products_spec.json и products_spec.csv
    spec_json_path = output_dir / "products_spec.json"
    with open(spec_json_path, "w", encoding="utf-8") as f:
        json.dump(specs_dict, f, separators=(',', ':'), ensure_ascii=False)

    spec_csv_out = output_dir / "products_spec.csv"
    with open(spec_csv_out, "w", encoding="utf-8") as f:
        f.write("\n".join(spec_clean_csv_lines) + "\n")

    # 4.2 products_spec_values.json
    val_json_path = output_dir / "products_spec_values.json"
    json_bytes = json.dumps(values_by_art, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    with open(val_json_path, "wb") as f:
        f.write(json_bytes)

    # 4.3 products_spec_values.json.gz (ультрасжатие gzip)
    val_gz_path = output_dir / "products_spec_values.json.gz"
    with gzip.open(val_gz_path, "wb", compresslevel=9) as f:
        f.write(json_bytes)

    # 4.4 products_spec_values.json.br (Brotli, если установлен)
    val_br_path = output_dir / "products_spec_values.json.br"
    try:
        subprocess.run(
            ["brotli", "-q", "11", "-f", str(val_json_path), "-o", str(val_br_path)],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
    except Exception:
        pass

    # 4.5 products_spec_values.csv (отфильтрованный CSV для совместимости)
    val_csv_out = output_dir / "products_spec_values.csv"
    with open(val_csv_out, "w", encoding="utf-8") as f:
        f.write("\n".join(val_clean_csv_lines) + "\n")

    # Вывод итоговых размеров
    log("=== Итоги генерации спецификаций ===")
    log(f"  products_spec.json:          {spec_json_path.stat().st_size / 1024:.1f} KB")
    log(f"  products_spec_values.json:   {val_json_path.stat().st_size / (1024*1024):.2f} MB")
    log(f"  products_spec_values.json.gz:{val_gz_path.stat().st_size / 1024:.1f} KB ({val_gz_path.stat().st_size / (1024*1024):.2f} MB)")
    if val_br_path.exists():
        log(f"  products_spec_values.json.br:{val_br_path.stat().st_size / 1024:.1f} KB ({val_br_path.stat().st_size / (1024*1024):.2f} MB)")
    log(f"  products_spec_values.csv:    {val_csv_out.stat().st_size / (1024*1024):.2f} MB (было ~50 MB)")
    log(f"[✓] Обработка спецификаций завершена за {time.time() - t0:.2f} сек!")

if __name__ == "__main__":
    base = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("base.csv")
    spec = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("web/src/addons/products_spec.csv")
    vals = Path(sys.argv[3]) if len(sys.argv) > 3 else Path("web/src/addons/products_spec_values.csv")
    out = Path(sys.argv[4]) if len(sys.argv) > 4 else Path("web/src/addons")
    process_specs(base, spec, vals, out)
