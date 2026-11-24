#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Единый автоматизированный пайплайн подготовки данных (Files + Params):
1. Читает настройки из enrichment_config.json
2. Фильтрует products_files.csv и подменяет ссылки -> products_files_filtered.csv
3. Фильтрует base.csv и обогащает характеристики из спецификаций -> enriched.csv
"""

import sys
import re
import json
from pathlib import Path
import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPT_DIR / "enrichment_config.json"

def load_config() -> dict:
    if not CONFIG_PATH.exists():
        print(f"[!] Конфиг {CONFIG_PATH.name} не найден!")
        sys.exit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def clean_val(s: str) -> str:
    return str(s).strip().strip("'").strip('"') if pd.notna(s) else ""

# ─────────────────── 1. Фильтрация файлов и замена URL ───────────────────
def process_files(config: dict, input_file: Path, output_file: Path):
    if not input_file.exists():
        print(f"[!] Файл документов {input_file.name} не найден. Пропуск.")
        return False

    cfg = config.get("files_filtering", {})
    keywords = cfg.get("keywords", [])
    delete_urls = set(cfg.get("delete_urls", []))
    replacements = cfg.get("url_replacements", {})

    print(f"[*] Фильтрация файлов: {input_file.name} -> {output_file.name}")
    kw_pattern = re.compile("|".join(re.escape(k) for k in keywords), re.IGNORECASE) if keywords else None

    count = 0
    with open(input_file, "r", encoding="utf-8", errors="ignore") as infile, \
         open(output_file, "w", encoding="utf-8") as outfile:
        for line in infile:
            if any(del_url in line for del_url in delete_urls):
                continue
            for old_u, new_u in replacements.items():
                line = line.replace(old_u, new_u)
            if kw_pattern is None or kw_pattern.search(line):
                outfile.write(line)
                count += 1

    print(f"[✓] Документов сохранено: {count}")
    return True

# ─────────────────── 2. Обогащение параметров (enriched.csv) ───────────────
def process_params(config: dict, base_csv: Path, spec_file: Path, val_file: Path, output_enriched: Path):
    if not base_csv.exists():
        print(f"[!] База {base_csv.name} не найдена. Пропуск обогащения параметров.")
        return False
    if not spec_file.exists() or not val_file.exists():
        print(f"[!] Файлы спецификаций ({spec_file.name} / {val_file.name}) не найдены. Пропуск.")
        return False

    cfg = config.get("params_enrichment", {})
    keywords = cfg.get("filter_keywords", [])
    strict_word = cfg.get("strict_word", "Контактор")
    group_rules = cfg.get("group_rules", [])

    print(f"[*] Обогащение характеристик из {spec_file.name}...")
    df_base = pd.read_csv(base_csv, sep=';', dtype=str, encoding='utf-8', engine='python')

    kw_lower = [k.strip().lower() for k in keywords]
    strict_lower = strict_word.strip().lower()
    other_kw = [k for k in kw_lower if k != strict_lower]
    strict_re = re.compile(rf"^\s*{re.escape(strict_word)}(?:\b|[^0-9A-Za-zА-Яа-яЁё])", re.IGNORECASE)

    def row_matches(row: pd.Series) -> bool:
        for val in row:
            if pd.isna(val): continue
            text = str(val).lower()
            if strict_re.search(text): return True
            for kw in other_kw:
                if kw in text: return True
        return False

    matched_base = df_base[df_base.apply(row_matches, axis=1)].copy()
    if matched_base.empty:
        print("[!] Нет совпадений по ключевым словам в базе.")
        return False

    art_col = matched_base.columns[1] if matched_base.shape[1] >= 2 else matched_base.columns[0]
    name_col = matched_base.columns[0]
    filt_arts = matched_base[art_col].dropna().astype(str).str.replace(r"\s+", "", regex=True).map(clean_val)
    filt_names = matched_base[name_col].fillna("").astype(str).str.strip()
    filt_meta = pd.DataFrame({"article_norm": filt_arts, "name": filt_names}).drop_duplicates("article_norm")

    # Чтение products_spec
    specs_map = {}
    with open(spec_file, "r", encoding="utf-8-sig", errors="ignore") as f:
        for line in f:
            parts = line.strip().split(";", 2)
            if len(parts) >= 2:
                specs_map[clean_val(parts[0])] = clean_val(parts[1])

    # Чтение products_spec_values
    val_rows = []
    with open(val_file, "r", encoding="utf-8-sig", errors="ignore") as f:
        for line in f:
            parts = line.strip().split(";", 2)
            if len(parts) >= 3:
                art = clean_val(parts[0])
                code = clean_val(parts[1])
                val = clean_val(parts[2])
                val_rows.append((art, code, val))

    df_vals = pd.DataFrame(val_rows, columns=["article", "param_code", "value"])
    df_vals["article_norm"] = df_vals["article"].str.replace(r"\s+", "", regex=True)
    df_vals = df_vals.merge(filt_meta, on="article_norm", how="inner")
    df_vals["param_name"] = df_vals["param_code"].map(specs_map).fillna("")

    def name_allowed_codes(name: str) -> set:
        name_lc = (name or "").lower()
        allowed = set()
        matched = False
        for rule in group_rules:
            if any(kw.lower() in name_lc for kw in rule.get("keywords", [])):
                matched = True
                allowed |= set(map(str, rule.get("allowed_codes", [])))
        return allowed if matched else set()

    df_vals = df_vals[df_vals.apply(lambda r: str(r["param_code"]) in name_allowed_codes(r["name"]), axis=1)].copy()

    if not df_vals.empty:
        df_vals["__pair"] = df_vals.apply(
            lambda r: f'{r["param_code"]} | {r["param_name"]} = {r["value"]}' if r["param_name"] else f'{r["param_code"]} = {r["value"]}',
            axis=1
        )
        agg = df_vals.groupby(["article", "name"], as_index=False)["__pair"].apply(
            lambda s: "\n".join(s.tolist())
        ).rename(columns={"article": "Артикул", "name": "Наименование", "__pair": "Характеристики"})
    else:
        agg = pd.DataFrame(columns=["Артикул", "Наименование", "Характеристики"])

    agg.to_csv(output_enriched, index=False, sep=";", encoding="utf-8-sig", header=False)
    print(f"[✓] Обогащено позиций: {len(agg)} -> {output_enriched.name}")
    return True

def main():
    config = load_config()
    print("=== Запуск единого пайплайна обогащения и фильтрации ===")

    # Пути
    files_in = SCRIPT_DIR / "products_files.csv"
    files_out = SCRIPT_DIR / "products_files_filtered.csv"
    process_files(config, files_in, files_out)

    base_in = SCRIPT_DIR / "base.csv"
    spec_in = SCRIPT_DIR / "products_spec.csv"
    val_in = SCRIPT_DIR / "products_spec_values.csv"
    enriched_out = SCRIPT_DIR / "enriched.csv"
    process_params(config, base_in, spec_in, val_in, enriched_out)

    print("=== Подготовка данных завершена! ===")

if __name__ == "__main__":
    main()
