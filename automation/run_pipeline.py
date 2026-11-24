#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Главный оркестратор обновления базы searcher-wasm:
1. Скачивает и распаковывает https://files.keaz.ru/ftp/csv/keaz_import.zip
2. Запускает enrich_and_filter.py (подготовка enriched.csv и products_files_filtered.csv)
3. Запускает make_base_auto.py (скачивание цен xls + остатков yml -> сборка base.csv)
4. Запускает search-packer (Rust -> сжатие base.csv в base.bin.br)
5. Удаляет тяжелые временные файлы выгрузки КЭАЗ
"""

import os
import sys
import time
import shutil
import zipfile
import urllib.request
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
AUTOMATION_DIR = ROOT_DIR / "automation"
KEAZ_IMPORT_URL = "https://files.keaz.ru/ftp/csv/keaz_import.zip"

def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def download_and_extract_keaz_import():
    log("=== Шаг 1: Скачивание и распаковка keaz_import.zip ===")
    zip_path = AUTOMATION_DIR / "keaz_import.zip"
    
    headers = {"User-Agent": "Mozilla/5.0 (compatible; KeazSearcherBot/1.0)"}
    req = urllib.request.Request(KEAZ_IMPORT_URL, headers=headers)
    
    log(f"Загрузка {KEAZ_IMPORT_URL}...")
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=120) as resp, open(zip_path, "wb") as out_f:
        shutil.copyfileobj(resp, out_f)
    size_mb = zip_path.stat().st_size / (1024 * 1024)
    log(f"Архив скачан за {time.time() - t0:.1f} сек ({size_mb:.2f} МБ)")

    log("Распаковка необходимых CSV файлов...")
    needed_files = [
        "products.csv",
        "products_files.csv",
        "products_spec.csv",
        "products_spec_values.csv"
    ]
    with zipfile.ZipFile(zip_path, "r") as z:
        for name in needed_files:
            if name in z.namelist():
                z.extract(name, AUTOMATION_DIR)
                extracted_path = AUTOMATION_DIR / name
                log(f"  -> {name} ({extracted_path.stat().st_size / (1024 * 1024):.2f} МБ)")
            else:
                log(f"  [!] Файл {name} не найден в архиве!")

    # Удаляем сам zip
    zip_path.unlink(missing_ok=True)

def run_enrich_and_filter():
    log("=== Шаг 2: Обогащение и фильтрация характеристик (enrich_and_filter.py) ===")
    cmd = [sys.executable, str(AUTOMATION_DIR / "enrich_and_filter.py")]
    t0 = time.time()
    res = subprocess.run(cmd, cwd=str(AUTOMATION_DIR))
    if res.returncode != 0:
        raise RuntimeError(f"enrich_and_filter.py завершился с кодом ошибки {res.returncode}")
    log(f"Обогащение завершено за {time.time() - t0:.1f} сек")

def run_make_base():
    log("=== Шаг 3: Сборка base.csv (цены, остатки, документы, характеристики) ===")
    cmd = [sys.executable, str(AUTOMATION_DIR / "make_base_auto.py")]
    t0 = time.time()
    res = subprocess.run(cmd, cwd=str(AUTOMATION_DIR))
    if res.returncode != 0:
        raise RuntimeError(f"make_base_auto.py завершился с кодом ошибки {res.returncode}")
    
    # Перемещаем base.csv в корень репозитория
    auto_base = AUTOMATION_DIR / "base.csv"
    root_base = ROOT_DIR / "base.csv"
    if auto_base.exists():
        shutil.move(str(auto_base), str(root_base))
        log(f"base.csv перемещен в корень ({root_base.stat().st_size / (1024 * 1024):.2f} МБ)")
    else:
        raise FileNotFoundError("automation/base.csv не был создан!")
    log(f"Сборка base.csv завершена за {time.time() - t0:.1f} сек")

def run_search_packer():
    log("=== Шаг 4: Бинарная упаковка Rust (search-packer) ===")
    packer_bin = ROOT_DIR / "target" / "release" / "search-packer"
    root_base = ROOT_DIR / "base.csv"
    root_bin = ROOT_DIR / "base.bin"
    root_br = ROOT_DIR / "base.bin.br"

    t0 = time.time()
    if packer_bin.exists():
        cmd = [str(packer_bin), str(root_base), str(root_bin), str(root_br)]
    else:
        cmd = ["cargo", "run", "--release", "-p", "search-packer", "--",
               str(root_base), str(root_bin), str(root_br)]

    res = subprocess.run(cmd, cwd=str(ROOT_DIR))
    if res.returncode != 0:
        raise RuntimeError(f"search-packer завершился с кодом ошибки {res.returncode}")

    if root_br.exists():
        size_kb = root_br.stat().st_size / 1024
        log(f"Бинарная упаковка успешна! Итоговый base.bin.br: {size_kb:.1f} КБ ({time.time() - t0:.1f} сек)")

        # Копируем base.bin.br в папку web/ и создаем version.json для автообновления клиентов
        web_dir = ROOT_DIR / "web"
        web_dir.mkdir(parents=True, exist_ok=True)
        web_br = web_dir / "base.bin.br"
        shutil.copy2(root_br, web_br)

        now = time.localtime()
        ver_str = time.strftime("%Y-%m-%d-%H%M", now)
        date_str = time.strftime("%d.%m.%Y", now)
        time_str = time.strftime("%H:%M", now)

        version_info = {
            "version": ver_str,
            "date": date_str,
            "time": time_str,
            "timestamp": int(time.time()),
            "size": root_br.stat().st_size
        }
        import json
        with open(web_dir / "version.json", "w", encoding="utf-8") as f:
            json.dump(version_info, f, indent=2, ensure_ascii=False)
        log(f"Создан web/version.json (версия: {ver_str}, дата: {date_str} {time_str})")
    else:
        raise FileNotFoundError("base.bin.br не был создан!")

def cleanup_heavy_intermediates():
    log("=== Шаг 5: Очистка тяжелых временных файлов ===")
    cleanup_files = [
        "products_files.csv",
        "products_spec_values.csv",
        "products_files_filtered.csv",
        "products_spec.csv",
        "products.csv",
        "enriched.csv"
    ]
    for name in cleanup_files:
        p = AUTOMATION_DIR / name
        if p.exists():
            p.unlink(missing_ok=True)
            log(f"  Удален временный файл: {name}")

def main():
    total_t0 = time.time()
    log(">>> СТАРТ ПОЛНОГО ПАЙПЛАЙНА СБОРКИ БАЗЫ ДАННЫХ SEARCHER-WASM <<<")
    try:
        download_and_extract_keaz_import()
        run_enrich_and_filter()
        run_make_base()
        run_search_packer()
    finally:
        cleanup_heavy_intermediates()
    log(f">>> ПАЙПЛАЙН УСПЕШНО ЗАВЕРШЕН ЗА {time.time() - total_t0:.1f} сек! <<<")

if __name__ == "__main__":
    main()
