# AGENTS.md — searcher-wasm

KEAZ product search: Rust/WASM search engine + static web app + Python data pipeline.

## Repo layout

```
crates/search-core/   # Rust search library; builds to WASM cdylib
crates/search-packer/ # CLI that packs base.csv → base.bin(.br)
web/                  # Static web app (index.html, src/app.js, worker.js, pkg/)
automation/           # Python pipeline that rebuilds base.csv/base.bin.br/tests/
tests/                # queries.json + comparison harnesses
```

`search-packer` depends on `search-core` via path.

## Branches & deployment

- `main` — production web UI root (`/`).
- `dev` — dev preview (`/dev/`).
- `rust-wasm` — WASM build + generated data (`/wasm/`).

`.github/workflows/deploy-pages.yml` merges all three branches into one Pages artifact:
`main` at root, `dev` at `/dev`, `rust-wasm/web` at `/wasm`.  `.github/workflows/build-wasm-base.yml` runs on `rust-wasm`, rebuilds the database, commits `base.bin.br`, `base.csv`, `web/base.bin.br`, `web/version.json`, `web/src/addons/products_spec*`, then triggers Pages deploy.

If you change the Rust `#[wasm_bindgen]` API, the updated glue must land on `rust-wasm` and the Pages deploy must run before users see it.

## Build commands

```bash
# Compile the packer CLI (use --bin; the other bin targets are stale)
cargo build --release -p search-packer --bin search-packer
# → target/release/search-packer

# Compile the WASM cdylib
cargo build --release --target wasm32-unknown-unknown -p search-core
# → target/wasm32-unknown-unknown/release/search_core.wasm

# Rust unit tests for the engine/normalizer/fuzzy modules
cargo test -p search-core
```

**Caveat:** `cargo test --workspace` and `cargo build --release -p search-packer` currently fail because `crates/search-packer/src/bin/bench.rs` and `src/bin/run_rust.rs` call `engine.search(query, limit)` with the old 2-argument signature; the API is now `engine.search(query, limit, smart_mode)`.

## Data pipeline (rebuilds `base.csv` and `base.bin.br`)

Prerequisites: Python 3.11+, `automation/requirements.txt` (`pandas`, `openpyxl`, `xlrd`), plus `brotli` and `requests`. Network access to `files.keaz.ru` is required.

```bash
# 1. Build packer once
cargo build --release -p search-packer --bin search-packer

# 2. Run full pipeline
python automation/run_pipeline.py
```

Pipeline order: download `keaz_import.zip` → `enrich_and_filter.py` → `make_base_auto.py` → `search-packer` → `process_specs.py` → cleanup.

Outputs:

- `base.csv` (gitignored, ~20 MB)
- `base.bin.br` and `web/base.bin.br` (tracked, ~1 MB)
- `web/version.json`
- `web/src/addons/products_spec*`

`search-packer` expects `base.csv` with semicolon-separated columns:
`Наименование;Артикул;Цена;Документы;Характеристики;Количество`.

## WASM glue files

`web/pkg/search_core.js`, `search_core_bg.wasm`, and `.d.ts` are wasm-bindgen-generated glue. They are the files actually loaded by `web/worker.js`.

`crates/search-core/web/pkg/` contains an older generated set that does **not** export `get_all_items_json` / `search_articles_json`. Do not treat it as the source of truth for the web app.

The repo does not record the exact wasm-pack/wasm-bindgen invocation. After changing exports in `crates/search-core/src/lib.rs`, regenerate the glue and copy the resulting files into `web/pkg/`.

## Local web development

```bash
cd web
python -m http.server 8000
# open http://localhost:8000
```

Do **not** open `index.html` directly from `file://` — ES modules and the WASM worker need an HTTP origin.

The app caches `base.bin.br` in IndexedDB; `version.json` drives background updates. The CSP in `index.html` only allows `'self'`, `blob:`, `data:`, and `https://keaz.ru` for `connect-src`.

`web/src/modules/utils/config.js` contains `__API_KEY_PLACEHOLDER__`; CI replaces it with `secrets.KEAZ_API_HASH`. Local tests of the availability API will fail unless you provide a real hash.

## Testing quirks

- **Rust tests:** `cargo test -p search-core` (6 tests, passes). `cargo test --workspace` fails due to stale benchmark binaries.
- **JS comparison harness:** `tests/run_js.mjs` hard-codes absolute paths to `/home/uglesha/Документы/Prod/Git/main/src` and `/home/uglesha/Документы/Prod/Git/main/base.csv`. It is not self-contained and will not run in a fresh checkout.
- `tests/results_*.json` are gitignored and produced by the harnesses.

## Generated artifacts & `.gitignore`

Tracked generated files: `base.bin.br`, `web/base.bin.br`, `web/version.json`, `web/pkg/*`, `web/src/addons/products_spec*`.

Ignored: `target/`, `*.bin`, `*.bin.gz`, `base.csv`, `tests/results_*.json`, `__pycache__/`, `*.pyc`, `*.log`.

`base.bin` (uncompressed) is ignored; only the Brotli-compressed `base.bin.br` is kept.
