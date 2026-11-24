import init, { init_engine_from_brotli, search_json, search_articles_json, get_total_count, get_all_items_json } from './pkg/search_core.js';

let wasmInitialized = false;

self.onmessage = async (e) => {
  const { type, payload, id } = e.data;

  if (type === 'INIT') {
    try {
      if (!wasmInitialized) {
        await init();
        wasmInitialized = true;
      }
      const t0 = performance.now();
      const count = init_engine_from_brotli(new Uint8Array(payload.bytes));
      const loadTime = (performance.now() - t0).toFixed(1);

      // Экспортируем все элементы для совместимости с аддонами (Accessories, Catalog)
      const rawJson = get_all_items_json();
      const allItems = JSON.parse(rawJson);

      self.postMessage({ type: 'INIT_OK', count, loadTime, allItems, id });
    } catch (err) {
      console.error('[WASM WORKER INIT ERROR]', err);
      self.postMessage({ type: 'INIT_ERROR', error: err.message, id });
    }
  } else if (type === 'SEARCH') {
    if (!wasmInitialized) {
      self.postMessage({ type: 'SEARCH_RES', articles: [], total: 0, id, error: 'WASM не инициализирован' });
      return;
    }
    const { query, smartMode } = payload;
    const t0 = performance.now();
    try {
      const jsonStr = search_articles_json(query, smartMode ?? false);
      const articles = JSON.parse(jsonStr);
      const searchTime = (performance.now() - t0).toFixed(2);
      self.postMessage({
        type: 'SEARCH_RES',
        articles: articles || [],
        total: articles ? articles.length : 0,
        searchTime,
        id
      });
    } catch (err) {
      console.error('[WASM SEARCH ERROR]', err);
      self.postMessage({ type: 'SEARCH_RES', articles: [], total: 0, id, error: err.message });
    }
  } else if (type === 'GET_ALL_ITEMS') {
    try {
      const rawJson = get_all_items_json();
      const items = JSON.parse(rawJson);
      self.postMessage({ type: 'ALL_ITEMS_RES', items, id });
    } catch (err) {
      self.postMessage({ type: 'ALL_ITEMS_RES', items: [], error: err.message, id });
    }
  } else if (type === 'COUNT') {
    self.postMessage({ type: 'COUNT_RES', count: get_total_count(), id });
  }
};
