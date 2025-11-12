(function () {
  'use strict';

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const unquote = s => String(s ?? '').replace(/^'(.*)'$/, '$1').trim();
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  async function fetchText(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  }
  async function ensurePapa() {
    if (window.Papa) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }
  async function parseCSV(url, header = true) {
    await ensurePapa();
    const text = await fetchText(url);
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header, delimiter: ';', skipEmptyLines: true,
        transformHeader: h => h.trim(),
        complete: r => resolve(r.data),
        error: reject
      });
    });
  }

  let _specMap = null;
  let _index = null;
  let _articlesSet = null;
  let _selected = new Map();
  let _container = null;
  let _searchInput = null;
  let _prebuiltGroups = null;
  let _lastCountSig = null;
  let _lastArtsNow = null;

  const STOCK_SID = '__stock__';
  const STOCK_VAL_IN = 'В наличии';
  const STOCK_VAL_OUT = 'Под заказ';

  function resetState() {
    _index = null;
    _articlesSet = null;
    _selected.clear();
    _prebuiltGroups = null;
    _lastCountSig = null;
    _lastArtsNow = null;
  }

  async function ensureSpecsLoaded() {
    if (_specMap) return;
    const specs = await parseCSV('addons/products_spec.csv', true);
    _specMap = new Map();
    for (const s of specs) {
      const id = String(s['spec_id'] ?? s['specId'] ?? s['id']).trim();
      if (!id) continue;
      _specMap.set(id, {
        title: unquote(s['title']),
        value_type: String(s['value_type'] ?? '').trim(),
        group_id: Number(s['group_id'] ?? 0) || 0,
        group_name: unquote(s['group_name'] || '')
      });
    }
  }

  async function buildIndex(articles) {
    await ensureSpecsLoaded();
    const values = await parseCSV('addons/products_spec_values.csv', true);
    const want = new Set(articles);

    const appData = (window.App && window.App._preFilterData) ? window.App._preFilterData : [];
    const art2qty = new Map();
    for (const row of appData) {
      const art = String(row['Артикул'] || '').trim();
      if (!want.has(art)) continue;
      const qtyRaw = row['Количество'];
      const qty = (typeof qtyRaw === 'number')
        ? qtyRaw
        : parseInt(String(qtyRaw || '0').replace(/\s+/g,'').replace(',', '.'), 10) || 0;
      art2qty.set(art, qty);
    }

    const perArt = new Map();
    for (const row of values) {
      const art = String(row['product_id'] ?? '').trim();
      if (!want.has(art)) continue;
      const sid = String(row['spec_id'] ?? '').trim();
      if (!sid) continue;
      const dict = _specMap.get(sid) || {};
      const value = unquote(row['value']);
      (perArt.get(art) || perArt.set(art, []).get(art)).push({ spec_id: sid, value, dict });
    }

    const index = new Map();
    const groups = new Map();

    (function addStockFacet(){
      const vmap = new Map();
      vmap.set(STOCK_VAL_IN,  new Set());
      vmap.set(STOCK_VAL_OUT, new Set());
      for (const art of want) {
        const qty = art2qty.get(art) || 0;
        (qty > 0 ? vmap.get(STOCK_VAL_IN) : vmap.get(STOCK_VAL_OUT)).add(art);
      }
      index.set(STOCK_SID, vmap);

      const g = { group_id: -1, group_name: 'Наличие', params: new Map() };
      g.params.set(STOCK_SID, {
        spec_id: STOCK_SID,
        title: 'Наличие',
        values: new Map([
          [STOCK_VAL_IN,  vmap.get(STOCK_VAL_IN).size],
          [STOCK_VAL_OUT, vmap.get(STOCK_VAL_OUT).size],
        ])
      });
      groups.set(g.group_id, g);
    })();

    for (const art of want) {
      const rows = perArt.get(art) || [];
      for (const { spec_id, value, dict } of rows) {
        let vmap = index.get(spec_id);
        if (!vmap) index.set(spec_id, (vmap = new Map()));
        let aset = vmap.get(value);
        if (!aset) vmap.set(value, (aset = new Set()));
        aset.add(art);

        const gid = dict.group_id ?? 0;
        const gname = dict.group_name || '';
        let g = groups.get(gid);
        if (!g) groups.set(gid, (g = { group_id: gid, group_name: gname, params: new Map() }));
        let p = g.params.get(spec_id);
        if (!p) g.params.set(spec_id, (p = { spec_id, title: dict.title || spec_id, values: new Map() }));
        let cnt = p.values.get(value) || 0;
        p.values.set(value, cnt + 1);
      }
    }

    let grouped = Array.from(groups.values())
      .sort((a, b) => (a.group_id || 0) - (b.group_id || 0))
      .map(g => {
        const params = Array.from(g.params.values()).map(p => {
          const variants = Array.from(p.values.entries())
            .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
            .map(([val, count]) => ({ value: val, count }));
          return { spec_id: p.spec_id, title: p.title, variants };
        })
        .filter(p => p.variants.length > 1)
        .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
        return { group_id: g.group_id, group_name: g.group_name, items: params };
      })
      .filter(g => g.items.length > 0)
      .filter(g => String(g.group_name).toLowerCase() !== 'классификация');

    _index = index;
    _prebuiltGroups = grouped;
    _articlesSet = want;
  }

  function selectionSignature() {
    const parts = [];
    _selected.forEach((vals, sid) => {
      parts.push(`${sid}=${[...vals].sort().join('|')}`);
    });
    return parts.sort().join('&');
  }

  function updatePillsCounts() {
    const app = window.App;
    if (!app) return;

    const sig = selectionSignature();
    if (sig !== _lastCountSig || !_lastArtsNow) {
      _lastArtsNow = new Set(app.filteredData.map(it => String(it['Артикул'] || '').trim()));
      _lastCountSig = sig;
    }
    const artsNow = _lastArtsNow;

    qsa('.fp-pill', _container).forEach(btn => {
      const sid = btn.dataset.sid;
      const val = btn.dataset.val;
      const vmap = _index.get(sid);
      const aset = vmap ? vmap.get(val) : null;

      let n = 0;
      if (aset) for (const a of aset) if (artsNow.has(a)) n++;

      const base = val || '—';
      btn.textContent = base;
      btn.title = `Совпадений: ${n}`;
      btn.disabled = n === 0 && !btn.classList.contains('is-active');
      btn.classList.toggle('is-disabled', btn.disabled);
      btn.dataset.count = String(n);
    });

    qsa('.fp-param', _container).forEach(paramEl => {
      const pills = qsa('.fp-pill', paramEl);
      const hasActive = pills.some(p => p.classList.contains('is-active'));
      const hasAnyPositive = pills.some(p => (parseInt(p.dataset.count || '0', 10) > 0));
      const hide = !hasActive && !hasAnyPositive;
      paramEl.classList.toggle('is-hidden', hide);
    });
    qsa('.fp-group', _container).forEach(groupEl => {
      const visibleParams = qsa(':scope > .fp-param', groupEl).filter(el => !el.classList.contains('is-hidden'));
      groupEl.classList.toggle('is-hidden', visibleParams.length === 0);
    });
  }

  function applySelection() {
    const app = window.App;
    if (!app || !app._preFilterData) return;

    if (_selected.size === 0) {
      app.filteredData = app._preFilterData.slice();
      app._page = 1;
      app.displayResults();
      updatePillsCounts();
      return;
    }

    let acc = null;
    for (const [sid, values] of _selected) {
      const vmap = _index.get(sid);
      if (!vmap) continue;
      const union = new Set();
      for (const val of values) {
        const aset = vmap.get(val);
        if (aset) for (const a of aset) union.add(a);
      }
      if (acc == null) acc = union;
      else {
        const next = new Set();
        for (const a of acc) if (union.has(a)) next.add(a);
        acc = next;
      }
    }
    acc = acc || new Set();

    app.filteredData = app._preFilterData.filter(it =>
      acc.has(String(it['Артикул'] || '').trim())
    );
    app._page = 1;
    app.displayResults();
    updatePillsCounts();
  }

  function renderPanel() {
    if (!_container) return;
    _container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'fp-header';
    header.innerHTML = `
      <div class="fp-search">
        <input type="search" class="form-control" placeholder="Поиск параметра..." aria-label="Поиск параметра"/>
        <button type="button" class="fp-clear-btn" title="Очистить">×</button>
      </div>
      <button type="button" class="btn btn--secondary btn--sm" id="fpClear">Сбросить</button>
    `;
    _container.appendChild(header);

    _searchInput = header.querySelector('input[type="search"]');
    const fpSearchBox = header.querySelector('.fp-search');
    const fpClearBtn  = header.querySelector('.fp-clear-btn');

    const toggleFpClear = () => {
      if (!fpSearchBox || !_searchInput) return;
      fpSearchBox.classList.toggle('has-value', !!_searchInput.value.trim());
    };
    toggleFpClear();
    _searchInput.addEventListener('input', toggleFpClear);

    const list = document.createElement('div');
    list.id = 'fpList';
    _container.appendChild(list);

    const grouped = _prebuiltGroups || [];
    fillList(grouped);

    _searchInput.addEventListener('input', () => {
      const q = _searchInput.value.trim().toLowerCase();
      if (!q) { fillList(grouped); return; }
      const re = new RegExp(escRe(q), 'i');
      const boosted = grouped.map(g => {
        const top = [], rest = [];
        for (const p of g.items) (re.test(p.title) ? top : rest).push(p);
        return { ...g, items: [...top, ...rest] };
      }).filter(g => g.items.length);
      fillList(boosted);
      if (_container) _container.scrollTo({ top: 0, behavior: 'smooth' });
    });

    header.querySelector('#fpClear')?.addEventListener('click', () => {
      _selected.clear();
      qsa('.fp-pill.is-active', _container).forEach(el => el.classList.remove('is-active'));
      applySelection();
    });

    fpClearBtn?.addEventListener('click', () => {
      if (!_searchInput) return;
      _searchInput.value = '';
      toggleFpClear();
      fillList(grouped);
      if (_container) _container.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function fillList(grouped) {
    const list = qs('#fpList', _container);
    list.innerHTML = '';

    for (const g of grouped) {
      const gEl = document.createElement('div');
      gEl.className = 'fp-group';
      gEl.innerHTML = `<div class="fp-group__title">${g.group_name || 'Без группы'}</div>`;
      list.appendChild(gEl);

      for (const p of g.items) {
        const pEl = document.createElement('div');
        pEl.className = 'fp-param';
        pEl.innerHTML = `<div class="fp-param__name">${p.title}</div><div class="fp-values"></div>`;
        gEl.appendChild(pEl);

        const wrap = qs('.fp-values', pEl);
        for (const v of p.variants) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'fp-pill';
          btn.textContent = v.value || '—';
          btn.title = `Совпадений: ${v.count}`;
          btn.dataset.sid = p.spec_id;
          btn.dataset.val = v.value;

          if (_selected.get(p.spec_id)?.has(v.value)) btn.classList.add('is-active');

          btn.addEventListener('click', () => {
            const sid = btn.dataset.sid;
            const val = btn.dataset.val;
            let set = _selected.get(sid);
            if (!set) _selected.set(sid, (set = new Set()));
            if (set.has(val)) {
              set.delete(val);
              btn.classList.remove('is-active');
              if (set.size === 0) _selected.delete(sid);
            } else {
              set.add(val);
              btn.classList.add('is-active');
            }
            applySelection();
          });

          wrap.appendChild(btn);
        }
      }
    }
  }

  async function open(ctx) {
    const host = document.getElementById('filterPanel');
    if (!host) return;
    _container = host;
    resetState();
    await buildIndex(ctx.articles || []);
    renderPanel();
    updatePillsCounts();
    if (_container) _container.scrollTop = 0;
  }

  function close() {
    if (_container) _container.innerHTML = '';
    resetState();
  }

  window.FilterPanel = { open, close };
})();

(function () {
  'use strict';

  function initToggle() {
    const btn = document.getElementById('filterToggle');
    const panel = document.getElementById('filterPanel');
    if (!btn || !panel) return;

    const updateBtn = () => {
      btn.textContent = document.body.classList.contains('is-filter-mode') ? 'Закрыть' : 'Фильтр';
    };

    btn.addEventListener('click', async () => {
      if (btn.disabled) return;

      const app = window.App;
      if (!app || !app.filteredData) return;

      const artsBase = (app._preFilterData && Array.isArray(app._preFilterData))
        ? app._preFilterData
        : app.filteredData;

      const arts = artsBase.map(r => String(r['Артикул'] || '').trim()).filter(Boolean);

      if (!document.body.classList.contains('is-filter-mode')) {
        window.FilterAddon?.open?.();
        panel.style.display = 'block';
        updateBtn();
        if (window.FilterPanel && typeof window.FilterPanel.open === 'function') {
          await window.FilterPanel.open({ articles: arts });
        }
      } else {
        window.FilterPanel?.close?.();
        panel.style.display = 'none';
        window.FilterAddon?.close?.();
        updateBtn();
      }
    });

    document.addEventListener('filter:closed', () => {
      const panelNow = document.getElementById('filterPanel');
      if (panelNow) panelNow.style.display = 'none';
      window.FilterPanel?.close?.();
      updateBtn();
    });

    document.addEventListener('filter:opened', async () => {
      const panelNow = document.getElementById('filterPanel');
      if (!panelNow) return;
      const app = window.App;
      if (!app) return;
      const arts = (app._preFilterData || app.filteredData || [])
        .map(r => String(r['Артикул'] || '').trim()).filter(Boolean);
      panelNow.style.display = 'block';
      if (window.FilterPanel && typeof window.FilterPanel.open === 'function') {
        await window.FilterPanel.open({ articles: arts });
      }
    });

    updateBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.setupFilterAddon && window.setupFilterAddon();
      initToggle();
    });
  } else {
    window.setupFilterAddon && window.setupFilterAddon();
    initToggle();
  }
})();

