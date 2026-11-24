pub mod model;
pub mod normalizer;
pub mod engine;

use engine::SearchEngine;
use model::Item;
use std::sync::Mutex;
use once_cell::sync::Lazy;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

static GLOBAL_ENGINE: Lazy<Mutex<Option<SearchEngine>>> = Lazy::new(|| Mutex::new(None));

pub fn set_engine(engine: SearchEngine) {
    let mut g = GLOBAL_ENGINE.lock().unwrap();
    *g = Some(engine);
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub fn init_engine_from_bincode(bytes: &[u8]) -> Result<usize, String> {
    let items: Vec<Item> = bincode::deserialize(bytes)
        .map_err(|e| format!("Bincode deserialize error: {e}"))?;
    let count = items.len();
    set_engine(SearchEngine::new(items));
    Ok(count)
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub fn init_engine_from_brotli(compressed_bytes: &[u8]) -> Result<usize, String> {
    let mut decompressed = Vec::new();
    brotli_decompressor::BrotliDecompress(&mut &compressed_bytes[..], &mut decompressed)
        .map_err(|e| format!("Brotli decompress error: {e}"))?;
    init_engine_from_bincode(&decompressed)
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub fn search_json(query: &str, limit: usize) -> String {
    let g = GLOBAL_ENGINE.lock().unwrap();
    if let Some(ref engine) = *g {
        let results = engine.search(query, limit);
        serde_json::to_string(&results).unwrap_or_else(|_| "[]".to_string())
    } else {
        "[]".to_string()
    }
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub fn get_total_count() -> usize {
    let g = GLOBAL_ENGINE.lock().unwrap();
    if let Some(ref engine) = *g {
        engine.items.len()
    } else {
        0
    }
}
