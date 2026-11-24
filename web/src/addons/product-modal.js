(function () {
  'use strict';

  let _modalEl = null;
  let _currentData = null;
  let _allGroups = [];
  let _specMap = null;
  let _valuesCache = null;

  const escapeHTML = s => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const unquote = s => String(s ?? '').replace(/^'+|'+$/g, '').trim();

  // --- IndexedDB Cache Helpers (совместимы с filter-panel.js) ---
  const SPECS_DB_NAME = 'keaz_specs_cache';
  const SPECS_STORE = 'specs';
  const KEY_SPEC_MAP = 'spec_map';
  const KEY_SPEC_VALUES = 'spec_values';

  function openIDB() {
    return new Promise(resolve => {
      if (typeof window === 'undefined' || !window.indexedDB) return resolve(null);
      const req = indexedDB.open(SPECS_DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(SPECS_STORE)) {
          req.result.createObjectStore(SPECS_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function idbGet(key) {
    try {
      const db = await openIDB();
      if (!db) return null;
      return new Promise(resolve => {
        const tx = db.transaction(SPECS_STORE, 'readonly');
        const req = tx.objectStore(SPECS_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (_) {
      return null;
    }
  }

  async function idbSet(key, val) {
    try {
      const db = await openIDB();
      if (!db) return;
      const tx = db.transaction(SPECS_STORE, 'readwrite');
      tx.objectStore(SPECS_STORE).put(val, key);
    } catch (_) {}
  }

  async function ensureSpecsData() {
    // 1. Словарь названий параметров (_specMap)
    if (!_specMap) {
      const cachedMap = await idbGet(KEY_SPEC_MAP);
      if (cachedMap) {
        _specMap = new Map(Object.entries(cachedMap));
      } else {
        try {
          const resp = await fetch('src/addons/products_spec.json');
          if (resp.ok) {
            const json = await resp.json();
            _specMap = new Map(Object.entries(json));
            idbSet(KEY_SPEC_MAP, json);
          }
        } catch (e) {
          console.warn('[ProductModal] fetch products_spec.json fallback:', e);
        }
      }
    }

    // 2. База характеристик (_valuesCache)
    if (!_valuesCache) {
      const cachedVals = await idbGet(KEY_SPEC_VALUES);
      if (cachedVals && typeof cachedVals === 'object') {
        _valuesCache = cachedVals;
      } else if (typeof window.DecompressionStream === 'function') {
        try {
          const resp = await fetch('src/addons/products_spec_values.json.gz');
          if (resp.ok) {
            const ds = new DecompressionStream('gzip');
            const decompressed = resp.body.pipeThrough(ds);
            _valuesCache = await new Response(decompressed).json();
            idbSet(KEY_SPEC_VALUES, _valuesCache);
          }
        } catch (e) {
          console.warn('[ProductModal] DecompressionStream load fallback:', e);
        }
      }
    }
  }

  function showToast(text = 'Скопировано в буфер') {
    let toast = document.getElementById('pmToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pmToast';
      toast.className = 'pm-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('is-show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('is-show'), 1200);
  }

  function createModalDOM() {
    if (_modalEl) return;

    _modalEl = document.createElement('div');
    _modalEl.className = 'pm-overlay';
    _modalEl.innerHTML = `
      <div class="pm-backdrop"></div>
      <div class="pm-window" role="dialog" aria-modal="true">
        <div class="pm-header">
          <div class="pm-header-top">
            <div class="pm-title-block">
              <h2 class="pm-title" id="pmTitle">Загрузка…</h2>
              <div class="pm-meta-bar">
                <span class="pm-art-badge" id="pmArtBadge" title="Нажмите, чтобы скопировать артикул">
                  Артикул: <span id="pmArt">…</span> 📋
                </span>
                <span class="pm-status-badge" id="pmCountBadge">0 параметров</span>
              </div>
            </div>
            <div class="pm-actions">
              <button type="button" class="pm-btn" id="pmCopyAllBtn" title="Скопировать все характеристики товара">
                📋 Копировать все
              </button>
              <button type="button" class="pm-btn-close" id="pmCloseBtn" title="Закрыть (Esc)">✕</button>
            </div>
          </div>
          <div class="pm-toolbar">
            <input type="search" class="pm-search-input" id="pmSearchInput" placeholder="Поиск по параметрам товара…" />
            <button type="button" class="pm-search-clear" id="pmSearchClear">×</button>
          </div>
        </div>
        <div class="pm-body" id="pmBody">
          <!-- Группы характеристик -->
        </div>
      </div>
    `;

    document.body.appendChild(_modalEl);

    // Закрытие только по крестику
    _modalEl.querySelector('#pmCloseBtn').addEventListener('click', close);

    // Копирование артикула
    _modalEl.querySelector('#pmArtBadge').addEventListener('click', () => {
      const art = _currentData?.art || '';
      if (art) {
        navigator.clipboard.writeText(art).then(() => showToast(`Артикул ${art} скопирован`));
      }
    });

    // Копирование всех параметров
    _modalEl.querySelector('#pmCopyAllBtn').addEventListener('click', copyAllSpecs);

    // Поиск по параметрам
    const searchInput = _modalEl.querySelector('#pmSearchInput');
    const searchClear = _modalEl.querySelector('#pmSearchClear');

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      searchClear.classList.toggle('is-visible', !!q);
      filterGroups(q);
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.classList.remove('is-visible');
      filterGroups('');
      searchInput.focus();
    });

    // Копирование пары "Параметр 	 Значение" по клику на любую строку
    _modalEl.querySelector('#pmBody').addEventListener('click', e => {
      const row = e.target.closest('.pm-row');
      if (!row) return;
      const k = row.dataset.key || '';
      const v = row.dataset.val || '';
      if (k || v) {
        navigator.clipboard.writeText(`${k}	${v}`).then(() => showToast(`Скопировано: ${k}`));
      }
    });

    // Закрытие по Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _modalEl && _modalEl.classList.contains('is-open')) {
        close();
      }
    });
  }

  function filterGroups(query) {
    if (!_modalEl) return;
    const body = _modalEl.querySelector('#pmBody');

    if (!query) {
      renderGroups(_allGroups, body);
      return;
    }

    const filtered = [];
    for (const g of _allGroups) {
      const matchedItems = g.items.filter(it =>
        it.title.toLowerCase().includes(query) || it.value.toLowerCase().includes(query)
      );
      if (matchedItems.length > 0) {
        filtered.push({ ...g, items: matchedItems });
      }
    }

    renderGroups(filtered, body);
  }

  function renderGroups(groups, container) {
    container.innerHTML = '';

    if (!groups.length) {
      container.innerHTML = '<div class="pm-empty-state">Характеристики не найдены</div>';
      return;
    }

    for (const g of groups) {
      const gEl = document.createElement('div');
      gEl.className = 'pm-group';
      gEl.innerHTML = `<div class="pm-group-title">${escapeHTML(g.group_name)} (${g.items.length})</div>`;

      const table = document.createElement('table');
      table.className = 'pm-table';
      const tbody = document.createElement('tbody');

      for (const it of g.items) {
        const tr = document.createElement('tr');
        tr.className = 'pm-row';
        tr.dataset.key = it.title;
        tr.dataset.val = it.value;
        tr.title = 'Нажмите, чтобы скопировать';
        tr.innerHTML = `
          <td class="pm-cell-key">${escapeHTML(it.title)}</td>
          <td class="pm-cell-val">${escapeHTML(it.value)}</td>
        `;
        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      gEl.appendChild(table);
      container.appendChild(gEl);
    }
  }

  function copyAllSpecs() {
    if (!_currentData || !_allGroups.length) return;
    const lines = [
      `Наименование:	${_currentData.name || ''}`,
      `Артикул:	${_currentData.art || ''}`,
      ''
    ];

    for (const g of _allGroups) {
      lines.push(`[${g.group_name}]`);
      for (const it of g.items) {
        lines.push(`${it.title}	${it.value}`);
      }
      lines.push('');
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      showToast('Все характеристики скопированы в буфер (Excel/TSV)');
    });
  }

  async function open({ art, name = '' }) {
    if (!art) return;
    createModalDOM();

    _currentData = { art: String(art).trim(), name: String(name).trim() };

    // Заголовок и артикул
    _modalEl.querySelector('#pmTitle').textContent = _currentData.name || `Товар ${_currentData.art}`;
    _modalEl.querySelector('#pmArt').textContent = _currentData.art;
    _modalEl.querySelector('#pmCountBadge').textContent = 'Загрузка…';
    _modalEl.querySelector('#pmSearchInput').value = '';
    _modalEl.querySelector('#pmSearchClear').classList.remove('is-visible');

    const body = _modalEl.querySelector('#pmBody');
    body.innerHTML = '<div class="pm-empty-state">Загружаю параметры…</div>';

    // Открываем модалку
    _modalEl.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    await ensureSpecsData();

    // Достаем спеки товара
    const specsForArt = (_valuesCache && _valuesCache[_currentData.art]) || [];
    const rows = [];

    for (let i = 0; i < specsForArt.length; i++) {
      const sid = String(specsForArt[i][0]);
      const val = unquote(specsForArt[i][1]);
      const dict = (_specMap && _specMap.get(sid)) || {};
      rows.push({
        spec_id: sid,
        title: unquote(dict.title || sid),
        value: val,
        group_id: dict.group_id ?? 999999,
        group_name: unquote(dict.group_name || 'Основные параметры')
      });
    }

    // Группировка
    const byGroup = new Map();
    for (const r of rows) {
      const gname = r.group_name || 'Без группы';
      if (!byGroup.has(gname)) {
        byGroup.set(gname, { group_name: gname, group_id: r.group_id, items: [] });
      }
      byGroup.get(gname).items.push(r);
    }

    // Сортировка групп и исключение группы "Классификация"
    _allGroups = Array.from(byGroup.values())
      .filter(g => g.group_name.toLowerCase() !== 'классификация')
      .sort((a, b) => (a.group_id ?? 999999) - (b.group_id ?? 999999))
      .map(g => ({
        ...g,
        items: g.items.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
      }));

    const totalSpecs = _allGroups.reduce((acc, g) => acc + g.items.length, 0);
    _modalEl.querySelector('#pmCountBadge').textContent = `${totalSpecs} параметров`;

    renderGroups(_allGroups, body);
    body.scrollTop = 0;
  }

  function close() {
    if (_modalEl) {
      _modalEl.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  window.ProductModal = { open, close };
})();
