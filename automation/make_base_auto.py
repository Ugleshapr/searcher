#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys, re, ssl, shutil, os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

import pandas as pd

# ──────────────────────────────────────────────────────────────────────────────
# URL обязателен: либо ENV SOURCE_URL, либо 1-й аргумент CLI.
SOURCE_URL = os.environ.get("SOURCE_URL") or (sys.argv[1] if len(sys.argv) > 1 else None)
if not SOURCE_URL:
    sys.stderr.write(
        "ERROR: SOURCE_URL is not set.\n"
        "Set env:    SOURCE_URL=https://... python make_base_auto.py\n"
        "or run as:  python make_base_auto.py https://...\n"
    )
    sys.exit(2)
SHEET      = 0                             # номер/имя листа (0 — первый)
TMP_NAME   = "_source_download"            # базовое имя временного файла
# Если products-файл называется иначе — можно переопределить; иначе ищется автоматически
PRODUCTS_FILE = ""                         # например: "products.xlsx"
# ──────────────────────────────────────────────────────────────────────────────

NAME_SYNS = ["наименование","номенклатура","название","товар","позиция","product","item","name","наим","описание","model"]
ART_SYNS  = ["артикул","sku","код","article","part","номер","id"]
PRICE_VAT_PATTERNS = [
    r"цена\s*\(\s*с\s*ндс\s*\)",   # Цена (с НДС)
    r"цена\s*с\s*ндс",             # Цена с НДС
    r"price.*vat"                  # ENG fallback
]

def _engine_for_path(path: Path):
    """Выбрать движок чтения excel по расширению."""
    return "xlrd" if path.suffix.lower() == ".xls" else None  # None → openpyxl/auto

def find_header_row(src_path: Path, max_rows=120, sheet=0) -> int:
    engine = _engine_for_path(src_path)
    try:
        raw = pd.read_excel(src_path, sheet_name=sheet, header=None, nrows=max_rows, dtype=str, engine=engine)
    except ImportError as e:
        if "xlrd" in str(e).lower():
            print("[ОШИБКА] Для чтения .xls установи: pip install xlrd")
        raise
    def has_syn(val, syns):
        if val is None or (isinstance(val, float) and pd.isna(val)): return False
        low = str(val).strip().lower()
        return any(s in low for s in syns)
    best_idx, best_score = 0, -1
    for i in range(len(raw)):
        row = raw.iloc[i].tolist()
        name_hit  = any(has_syn(v, NAME_SYNS) for v in row)
        art_hit   = any(has_syn(v, ART_SYNS)  for v in row)
        price_hit = any(has_syn(v, ["цена","руб","стоимость","price","amount"]) for v in row)
        score = int(name_hit) + int(art_hit) + int(price_hit)
        if score > best_score:
            best_idx, best_score = i, score
    return best_idx if best_score >= 0 else 0

def pick_col(columns, exact_list, syns):
    # точное совпадение (без регистра)
    for ex in exact_list:
        for c in columns:
            if str(c).strip().lower() == ex:
                return c
    # по вхождению синонимов
    for c in columns:
        low = str(c).strip().lower()
        if any(s in low for s in syns):
            return c
    return None

def clean_name(v):
    if pd.isna(v): return ""
    s = str(v).strip()
    s = re.sub(r"\s{2,}", " ", s)
    return s

def clean_article(v):
    if v is None or (isinstance(v, float) and pd.isna(v)): return ""
    return re.sub(r"\D+", "", str(v).strip())

def parse_price(v):
    if v is None or (isinstance(v, float) and pd.isna(v)): return None
    s = str(v).strip().replace(" ", "").replace(",", ".")
    try:
        return round(float(s), 2)
    except Exception:
        return None

def strip_outer_single_quotes(s: str) -> str:
    """Снять только внешние одинарные кавычки и схлопнуть пробелы."""
    if s is None:
        return ""
    s = str(s).strip()
    if len(s) >= 2 and s[0] == "'" and s[-1] == "'":
        s = s[1:-1]
    return re.sub(r"\s{2,}", " ", s).strip()

def download_to_script_dir(url: str) -> Path:
    if not url or url == "PUT_XLS_OR_XLSX_URL_HERE":
        print("[ОШИБКА] Укажи корректный SOURCE_URL в начале скрипта.")
        sys.exit(2)

    script_dir = Path(__file__).resolve().parent

    # Определим расширение по URL (по умолчанию .xls)
    ext = ".xls"
    low = url.lower()
    if low.endswith(".xlsx"):
        ext = ".xlsx"
    elif low.endswith(".xls"):
        ext = ".xls"

    tmp_path = script_dir / f"{TMP_NAME}{ext}"
    print(f"[i] Скачиваю:\n    {url}\n    → {tmp_path}")
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        ctx = ssl.create_default_context()
        with urlopen(req, context=ctx) as resp, open(tmp_path, "wb") as out:
            if hasattr(resp, "status") and resp.status != 200:
                print(f"[ОШИБКА] HTTP {resp.status} при скачивании {url}")
                sys.exit(3)
            shutil.copyfileobj(resp, out)
    except HTTPError as e:
        print(f"[ОШИБКА] HTTP {e.code}: {e.reason} — {url}")
        sys.exit(4)
    except URLError as e:
        print(f"[ОШИБКА] URL error: {e.reason} — {url}")
        sys.exit(5)
    except Exception as e:
        print(f"[ОШИБКА] Не удалось скачать файл: {e}")
        sys.exit(6)

    if not tmp_path.exists() or tmp_path.stat().st_size == 0:
        print("[ОШИБКА] Файл не найден/пустой после скачивания.")
        sys.exit(7)
    return tmp_path

def _find_products_file(search_dir: Path) -> Path | None:
    """Найти products-файл рядом со скриптом (или взять явный PRODUCTS_FILE)."""
    if PRODUCTS_FILE:
        p = (search_dir / PRODUCTS_FILE).resolve()
        if p.exists():
            return p
    for name in ("products.xlsx", "product.xlsx", "products.xls", "product.xls"):
        p = (search_dir / name).resolve()
        if p.exists():
            return p
    return None

# ───────────────────────── ДОБАВЛЕНО: поиск CSV с файлами ─────────────────────
def _find_products_files_csv(search_dir: Path) -> Path | None:
    for name in ("products_files.csv", "products.csv", "product.csv"):
        p = (search_dir / name).resolve()
        if p.exists():
            return p
    return None

def _is_en_text(s: str) -> bool:
    if not s:
        return False
    # считаем английским, если есть "(En)" или отдельное слово en/eng/english
    return bool(re.search(r"\(\s*en\s*\)", s, flags=re.IGNORECASE) or
                re.search(r"\b(en|eng|english)\b", s, flags=re.IGNORECASE))

def _is_wanted_doc(category: str, title: str) -> bool:
    """
    Нужны только:
      - Каталог/Каталоги
      - Руководство по эксплуатации
      - РЭ (как отдельное слово)
      - ДОБАВЛЕНО: Паспорт
    """
    s = f"{category or ''} {title or ''}"
    if _is_en_text(s):
        return False
    has_catalog = re.search(r"каталог", s, flags=re.IGNORECASE) is not None
    has_re_full = re.search(r"руководств[оа]\s*по\s*эксплуатац", s, flags=re.IGNORECASE) is not None
    has_re_abbr = re.search(r"(?<![А-Яа-яA-Za-z])РЭ(?![А-Яа-яA-Za-z])", s) is not None
    has_passport = re.search(r"паспорт", s, flags=re.IGNORECASE) is not None
    return bool(has_catalog or has_re_full or has_re_abbr or has_passport)

def build_docs_map_from_csv(csv_path: Path) -> dict:
    """
    Возвращает словарь: art(str) -> list[str] вида 'Название URL'.
    CSV ожидается БЕЗ заголовков, разделитель ';', кодировка utf-8.
    Колонки: 0=Артикул, 1=Категория, 2=Название, 3=URL
    """
    try:
        df = pd.read_csv(csv_path, sep=';', header=None, dtype=str, encoding='utf-8', engine='python')
    except Exception as e:
        print(f"[!] Не удалось прочитать {csv_path.name}: {e}")
        return {}

    if df.shape[1] < 4:
        print(f"[!] В {csv_path.name} меньше 4 столбцов — колонка «Документы» пропущена.")
        return {}

    df = df.iloc[:, :4]
    df.columns = ["Артикул","Категория","Название","URL"]
    # очистка
    df["Артикул"] = df["Артикул"].map(lambda v: re.sub(r"\D+","", str(v)) if pd.notna(v) else "")
    df["Категория"] = df["Категория"].map(strip_outer_single_quotes)
    df["Название"]  = df["Название"].map(strip_outer_single_quotes)
    df["URL"]       = df["URL"].astype(str).str.strip()

    # фильтр по типам документов + не EN
    mask = df.apply(lambda r: _is_wanted_doc(r["Категория"], r["Название"]), axis=1)
    df = df[mask & df["Артикул"].ne("") & df["URL"].ne("")]

    # группировка по артикулу с устранением дублей по URL (сохранить порядок)
    docs_map = {}
    for art, grp in df.groupby("Артикул", sort=False):
        seen = set()
        items = []
        for _, row in grp.iterrows():
            url = row["URL"]
            if url in seen:
                continue
            seen.add(url)
            title = row["Название"] or ""
            items.append(f"{title} {url}".strip())
        if items:
            docs_map[art] = items
    print(f"[i] Документы из {csv_path.name}: артикулами покрыто {len(docs_map)}")
    return docs_map

# ───────────────────────── ДОБАВЛЕНО: «Сайт ссылка» из products ───────────────
def build_site_link_map_from_products(search_dir: Path) -> dict:
    """
    Читает products.xlsx/.xls (без заголовков) и возвращает art -> URL из 14-го столбца (1-based).
    Ожидается: столбец 1 = Артикул, столбец 14 = URL сайта.
    """
    prod_path = _find_products_file(search_dir)
    if not prod_path:
        print("[i] products-файл не найден — «Сайт ссылка» пропущена.")
        return {}

    engine = _engine_for_path(prod_path)
    try:
        pr = pd.read_excel(prod_path, header=None, dtype=str, engine=engine)
    except ImportError as e:
        if "xlrd" in str(e).lower():
            raise SystemExit("[ОШИБКА] Для чтения .xls установи: pip install xlrd")
        raise
    except Exception as e:
        print(f"[!] Не удалось прочитать {prod_path.name}: {e}")
        return {}

    if pr.shape[1] < 14:
        print(f"[i] В {prod_path.name} меньше 14 столбцов — «Сайт ссылка» пропущена.")
        return {}

    # 0-й столбец — артикул, 13-й — URL
    tmp = pr.iloc[:, [0, 13]].copy()
    tmp.columns = ["Артикул", "URL"]
    tmp["Артикул"] = tmp["Артикул"].map(clean_article)
    tmp["URL"] = tmp["URL"].astype(str).str.strip()

    # Оставляем валидные http(s) ссылки
    tmp = tmp[(tmp["Артикул"] != "") & tmp["URL"].str.match(r"^https?://", na=False)]
    m = dict(zip(tmp["Артикул"], tmp["URL"]))
    print(f"[i] «Сайт ссылка» из products: артикулами покрыто {len(m)}")
    return m

def _extract_last_url(text: str) -> str:
    """Вытащить URL из конца строки '… https://…'. Нужен для дедупликации по URL."""
    if not text:
        return ""
    m = re.search(r"(https?://\S+)\s*$", text)
    return m.group(1) if m else ""

def attach_documents_column(base_df: pd.DataFrame, search_dir: Path, site_link_map: dict | None = None) -> pd.DataFrame:
    """
    Добавляет четвёртую колонку «Документы» (строки в ячейке разделены переносом строки).
    1) Берёт «Сайт ссылка» из products (если есть) и ставит ПЕРВОЙ строкой.
    2) Добавляет документы из products_files.csv / product.csv / products.csv.
    Дубликаты по URL отбрасываются, порядок сохраняется.
    """
    if site_link_map is None:
        site_link_map = {}

    csv_path = _find_products_files_csv(search_dir)
    docs_map = build_docs_map_from_csv(csv_path) if csv_path else {}

    out = base_df.copy()
    arts = out["Артикул"].map(clean_article)

    docs_col = []
    for a in arts:
        lines = []
        seen_urls = set()

        # 1) Сайт ссылка — первой строкой
        site_url = site_link_map.get(a, "")
        if site_url:
            lines.append(f"Сайт {site_url}")
            seen_urls.add(site_url)

        # 2) Остальные документы из CSV
        for item in docs_map.get(a, []):
            url = _extract_last_url(item)
            # если url не распознан — добавляем как есть (на всякий)
            if url and url in seen_urls:
                continue
            if url:
                seen_urls.add(url)
            lines.append(item)

        docs_col.append("\n".join(lines))

    out.insert(3, "Документы", pd.Series(docs_col, index=out.index).fillna(""))  # 4-я колонка
    return out
# ───────────────────────── КОНЕЦ ДОБАВЛЕННОГО ────────────────────────────────

def enrich_names_with_products(base_df: pd.DataFrame, search_dir: Path) -> pd.DataFrame:
    """
    base_df: колонки 'Наименование','Артикул','Цена'
    products: БЕЗ заголовков; столбец 1 = Артикул, столбец 3 = Наименование (в одинарных кавычках)
    """
    prod_path = _find_products_file(search_dir)
    if not prod_path:
        print("[i] products-файл не найден — обогащение пропущено.")
        return base_df

    engine = _engine_for_path(prod_path)
    try:
        pr = pd.read_excel(prod_path, header=None, dtype=str, engine=engine)
    except ImportError as e:
        if "xlrd" in str(e).lower():
            raise SystemExit("[ОШИБКА] Для чтения .xls установи: pip install xlrd")
        raise
    except Exception as e:
        print(f"[!] Не удалось прочитать {prod_path.name}: {e}")
        return base_df

    if pr.shape[1] < 3:
        print(f"[!] В {prod_path.name} меньше 3 столбцов — обогащение пропущено.")
        return base_df

    # Берём только нужные колонки
    prod = pr.iloc[:, [0, 2]].copy()
    prod.columns = ["Артикул", "НовоеИмя"]
    prod["Артикул"] = prod["Артикул"].map(clean_article)
    prod["НовоеИмя"] = prod["НовоеИмя"].map(strip_outer_single_quotes)

    # Выкинуть пустые, оставить по одному имени на артикул
    prod = prod[(prod["Артикул"] != "") & prod["НовоеИмя"].astype(str).str.strip().ne("")]\
             .drop_duplicates(subset=["Артикул"], keep="first")

    out = base_df.copy()
    out["__art"] = out["Артикул"].map(clean_article)

    m = dict(zip(prod["Артикул"], prod["НовоеИмя"]))
    new_names = out["__art"].map(m)
    mask = new_names.notna() & new_names.astype(str).str.strip().ne("")
    replaced = int(mask.sum())
    if replaced:
        out.loc[mask, "Наименование"] = new_names[mask]
        print(f"[i] Заменено наименований по products: {replaced}")
    else:
        print("[i] Совпадений артикулов не найдено — замен нет.")

    return out.drop(columns=["__art"], errors="ignore")

def main():
    script_dir = Path(__file__).resolve().parent

    # 1) Скачивание исходника (xls/xlsx) в папку скрипта
    src_path = download_to_script_dir(SOURCE_URL)

    # 2) Чтение и авто-определение заголовков
    engine = _engine_for_path(src_path)
    try:
        hdr = find_header_row(src_path, sheet=SHEET)
        print(f"[i] Строка заголовков (0-based): {hdr}")
        df = pd.read_excel(src_path, sheet_name=SHEET, header=hdr, dtype=str, engine=engine)
    except ImportError as e:
        if "xlrd" in str(e).lower():
            print("[ОШИБКА] Для чтения .xls установи: pip install xlrd")
        try: src_path.unlink()
        except FileNotFoundError: pass
        sys.exit(8)
    except Exception as e:
        try: src_path.unlink()
        except FileNotFoundError: pass
        print(f"[ОШИБКА] Не удалось прочитать Excel: {e}")
        sys.exit(9)

    # Удаляем пустые/Unnamed колонки
    df = df.loc[:, ~df.columns.to_series().astype(str).str.match(r"^Unnamed:")]
    df.columns = [str(c).strip() for c in df.columns]

    # 3) Поиск нужных колонок
    c_name = pick_col(list(df.columns), ["номенклатура","наименование"], NAME_SYNS)
    c_art  = pick_col(list(df.columns), ["артикул"], ART_SYNS)

    # Цена строго «с НДС»: ищем по шаблонам; если нет — 0.00
    c_price = None
    for c in df.columns:
        low = str(c).strip().lower()
        if any(re.search(p, low) for p in PRICE_VAT_PATTERNS):
            c_price = c
            break

    print(f"[i] Колонки: name='{c_name}' | article='{c_art}' | price(VAT)='{c_price}'")

    if c_name is None or c_art is None:
        try: src_path.unlink()
        except FileNotFoundError: pass
        print("[ОШИБКА] Не нашли обязательные колонки: 'Номенклатура/Наименование' и/или 'Артикул'.")
        sys.exit(10)

    # 4) Очистка/сборка
    name  = df[c_name].map(clean_name)
    art   = df[c_art].map(clean_article)
    price = (df[c_price].map(parse_price) if c_price else pd.Series([0.0]*len(df)))

    base = pd.DataFrame({"Наименование": name, "Артикул": art, "Цена": price})
    base = base[(base["Наименование"] != "") | (base["Артикул"] != "")].copy()

    # 5) Обогащение наименований из products*.xlsx (если есть)
    base = enrich_names_with_products(base, script_dir)

    # 5.0) Построить карту «Сайт ссылка» из products (если есть)
    site_link_map = build_site_link_map_from_products(script_dir)

    # 5.1) Колонка «Документы»: сначала «Сайт ссылка», затем документы из CSV (если есть)
    base = attach_documents_column(base, script_dir, site_link_map=site_link_map)

    # 6) Сохранение base.xlsx в ПАПКЕ СКРИПТА
    xlsx_path = script_dir / "base.xlsx"
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as wt:
        base[["Наименование","Артикул","Цена","Документы"]].to_excel(wt, index=False, sheet_name="TDSheet")
    print(f"[✓] Готово: {len(base)} строк")
    print(f"[→] {xlsx_path}")

    # 7) Удаляем исходный временный файл
    try:
        src_path.unlink()
        print(f"[i] Временный файл удалён: {src_path.name}")
    except FileNotFoundError:
        pass

if __name__ == "__main__":
    main()
