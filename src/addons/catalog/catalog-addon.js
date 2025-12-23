// src/addons/catalog/catalog-addon.js
(function () {
  const CATALOG_COLOR = '#0a0af0';
  const CSV_PATH = 'src/addons/catalog/camerged.csv';

  let mode = 'base'; // base | rzd | catalog

  let graph = null;
  let currentCat = null;
  let path = []; // breadcrumb: [{id,title}]
  let isLoaded = false;
    let baseIndex = null; // Map(Артикул -> строка из window.App.data)

  function buildBaseIndexFromApp() {
    const data = window.App && Array.isArray(window.App.data) ? window.App.data : null;
    if (!data || !data.length) return null;

    const idx = new Map();
    for (const row of data) {
      const art = (row && row['Артикул'] != null) ? String(row['Артикул']).trim() : '';
      if (art) idx.set(art, row);
    }
    return idx;
  }

  function ensureBaseIndex() {
    if (baseIndex) return true;
    const idx = buildBaseIndexFromApp();
    if (!idx) return false;
    baseIndex = idx;
    return true;
  }


  function $(id){ return document.getElementById(id); }

  function setTitleAndChip(prefix, chipText){
    const title = $('searchTitle');
    const chip = $('rzdToggle');
    if (title) title.childNodes[0].textContent = prefix;
    if (chip) chip.childNodes[0].textContent = chipText;
  }

  function ensureMenu(){
    const chip = $('rzdToggle');
    if (!chip) return null;

    let menu = document.querySelector('.mode-menu[data-owner="rzdToggle"]');
    if (menu) return menu;

    menu = document.createElement('div');
    menu.className = 'mode-menu';
    menu.hidden = true;
    menu.setAttribute('role','menu');
    menu.setAttribute('data-owner','rzdToggle');

    // ВАЖНО: меню в body, чтобы не резалось контейнерами
    document.body.appendChild(menu);

    document.addEventListener('click', (e) => {
      if (!chip.contains(e.target) && !menu.contains(e.target)) {
        menu.hidden = true;
        chip.setAttribute('aria-expanded', 'false');
      }
    });

    window.addEventListener('resize', () => {
      if (!menu.hidden) positionMenu(menu, chip);
    });
    window.addEventListener('scroll', () => {
      if (!menu.hidden) positionMenu(menu, chip);
    }, true);

    return menu;
  }

  function positionMenu(menu, chip){
    const r = chip.getBoundingClientRect();
    const gap = 8;

    // базовая позиция "под чипом"
    let left = r.left;
    let top = r.bottom + gap;

    // если вылезает вправо — сдвинем влево
    const mw = menu.offsetWidth || 210;
    const maxLeft = window.innerWidth - mw - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);

    // если вылезает вниз — попробуем вверх
    const mh = menu.offsetHeight || 120;
    const maxTop = window.innerHeight - mh - 8;
    if (top > maxTop) top = Math.max(8, r.top - mh - gap);

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }


  function renderMenu(){
    const chip = $('rzdToggle');
    const menu = ensureMenu();
    if (!chip || !menu) return;

    const items = [];
    if (mode !== 'rzd') items.push({ key:'rzd', label:'Прайс-листу РЖД' });
    if (mode !== 'base') items.push({ key:'base', label:'Прайс-листу' });
    if (mode !== 'catalog') items.push({ key:'catalog', label:'Каталог' });

    menu.innerHTML = '';
    for (const it of items){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mode-menu__item';
      btn.textContent = it.label;
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.hidden = true;
        chip.setAttribute('aria-expanded','false');
        await switchMode(it.key);
      });
      menu.appendChild(btn);
    }

    requestAnimationFrame(() => positionMenu(menu, chip));
  }


  async function switchMode(next){
  // при любом переключении режима фильтры должны выключаться и забываться
    hardCloseFilters();
    // hard rule: catalog and rzd cannot be on together
    if (next === 'rzd') {
      if (mode === 'catalog') await exitCatalog();
      if (window.RZDMode && !window.RZDMode.isOn()) window.RZDMode.toggle();
      mode = 'rzd';
      document.body.classList.remove('catalog-mode');
      setTitleAndChip('Поиск по ', 'прайс-листу РЖД');
      showCatalog(false);
      ensureCopyOff(); // RZD already manages filter/copy behavior, but keep consistent
      renderMenu();
      return;
    }

    if (next === 'base') {
      if (mode === 'catalog') await exitCatalog();
      if (window.RZDMode && window.RZDMode.isOn()) window.RZDMode.toggle();
      mode = 'base';
      document.body.classList.remove('catalog-mode');
      setTitleAndChip('Поиск по ', 'прайс-листу');
      showCatalog(false);
      renderMenu();
      return;
    }

    if (next === 'catalog') {
      if (window.RZDMode && window.RZDMode.isOn()) window.RZDMode.toggle();
      mode = 'catalog';
      document.body.classList.add('catalog-mode');
      setTitleAndChip('Поиск по ', 'каталогу');
      ensureCopyOff();
      await enterCatalog();
      renderMenu();
      return;
    }
  }

  function ensureCopyOff(){
    const sw = $('copyModeSwitch');
    if (sw && sw.checked) {
      try { sw.click(); } catch { sw.checked = false; }
    }
    const panel = $('copyPanel');
    if (panel) { panel.classList.add('hidden'); panel.setAttribute('aria-hidden','true'); }
  }

  function showCatalog(on){
    const sec = $('catalogSection');
    if (sec) sec.style.display = on ? '' : 'none';

    // В каталоге строка поиска скрыта CSS-ом, тут просто чистим значение
const input = $('searchInput');
if (input && on) input.value = '';

  }
  
    function hardCloseFilters() {
    // 1) закрыть режим фильтра через официальный API (он бросит filter:closed)
    try { window.FilterAddon?.close?.(); } catch {}

    // 2) на случай, если события/аддоны не сработали — добиваем вручную
    try { document.body.classList.remove('is-filter-mode'); } catch {}

    const panel = document.getElementById('filterPanel');
    if (panel) panel.style.display = 'none';

    // 3) очистка состояния панели (resetState вызывается внутри close)
    try { window.FilterPanel?.close?.(); } catch {}

    // 4) вернуть текст кнопки
    const btn = document.getElementById('filterToggle');
    if (btn) btn.textContent = 'Фильтр';
  }


    async function enterCatalog(){
    hardCloseFilters();
    showCatalog(true);
    if (!isLoaded) {
      await loadCatalog();

      // base.csv уже загружен приложением (window.App.data), просто строим индекс
      ensureBaseIndex();

      isLoaded = true;
      currentCat = null;
      path = [];
    }
    renderCurrent();
  }


  async function exitCatalog(){
    hardCloseFilters();
    showCatalog(false);
    // clear results
    if (window.App) {
      window.App.filteredData = [];
      window.App._preFilterData = [];
      window.App._page = 1;
      window.App.displayResults?.();
      
    }
  }

  // --- CSV parsing (semicolon + quotes) ---
  function splitLine(line){
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i=0;i<line.length;i++){
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ';' && !inQ) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function parseCSV(text){
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim().length);
    if (!lines.length) return [];
    const header = splitLine(lines[0]).map(h=>h.trim());
    const rows = [];
    for (let i=1;i<lines.length;i++){
      const cols = splitLine(lines[i]);
      const obj = {};
      for (let j=0;j<header.length;j++){
        obj[header[j]] = (cols[j] ?? '').trim();
      }
      rows.push(obj);
    }
    return rows;
  }

  function buildGraph(rows){
    const cats = new Map();
    // expecting: parent_id, product_category_id, category_title, product_id, product_title (from camerged)
    for (const r of rows){
      const cid = r.product_category_id || r['product_category_id'];
      if (!cid) continue;
      if (!cats.has(cid)){
        cats.set(cid, {
          id: cid,
          parent_id: r.parent_id || r['parent_id'] || '',

          title: r.category_title || r['category_title'] || r.title || r['title'] || '',
          products: []
        });
      }
      const pid = r.product_id || r['product_id'];
      const ptitle = r.product_title || r['product_title'] || r['product_title '] || '';
      if (pid) cats.get(cid).products.push({ id: pid, title: ptitle || '' });
    }

        // auto-detect rootKey: самый частый parent_id, который НЕ является category_id
    const rootCounter = new Map();
    for (const c of cats.values()){
      const p = (c.parent_id || '').toString().trim();
      if (p && !cats.has(p)) rootCounter.set(p, (rootCounter.get(p) || 0) + 1);
    }
    let rootKey = '__ROOT__';
    let best = 0;
    for (const [k, v] of rootCounter.entries()){
      if (v > best) { best = v; rootKey = k; }
    }

    // build children index: всё, у кого parent_id не найден среди категорий — в rootKey
    const children = new Map();
    for (const [id, c] of cats.entries()){
      const pRaw = (c.parent_id || '').toString().trim();
      const p = (pRaw && cats.has(pRaw)) ? pRaw : rootKey;
      if (!children.has(p)) children.set(p, []);
      children.get(p).push(id);
    }

    for (const arr of children.values()){
      arr.sort((a,b)=>{
        const ta = (cats.get(a)?.title || '').toLowerCase();
        const tb = (cats.get(b)?.title || '').toLowerCase();
        return ta.localeCompare(tb, 'ru');
      });
    }

    function subtreeCount(catId){
      let sum = (cats.get(catId)?.products.length || 0);
      const kids = children.get(catId) || [];
      for (const k of kids) sum += subtreeCount(k);
      return sum;
    }

    const subtree = new Map();
    for (const id of cats.keys()){
      subtree.set(id, subtreeCount(id));
    }

    return { cats, children, subtree, rootKey };

  }

  async function loadCatalog(){
    const resp = await fetch(CSV_PATH, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Не удалось загрузить ${CSV_PATH}: ${resp.status}`);
    const text = await resp.text();
    const rows = parseCSV(text);
    graph = buildGraph(rows);
        window.__catalogGraph = graph;

  }

  function renderCurrent(){
    if (!graph) return;
    const grid = $('catalogCategoriesGrid');
    const empty = $('catalogCategoriesEmpty');
    const bc = $('catalogBreadcrumb');

    // breadcrumb
    const crumbs = [{ id: null, title: 'Каталог' }, ...path];
    if (bc){
      bc.innerHTML = crumbs.map((c, idx) => {
        if (idx === crumbs.length - 1) return `<span class="catalog-crumb is-current">${escapeHtml(c.title)}</span>`;
        return `<button type="button" class="catalog-crumb" data-idx="${idx}">${escapeHtml(c.title)}</button>`;
      }).join('<span class="catalog-sep">/</span>');
      bc.querySelectorAll('button[data-idx]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          const idx = Number(btn.getAttribute('data-idx'));
          if (idx === 0){
            currentCat = null; path = [];
          } else {
            currentCat = crumbs[idx].id;
            path = path.slice(0, idx);
          }
          renderCurrent();
        });
      });
    }

       const parentKey = currentCat ?? graph.rootKey;
    const kids = graph.children.get(parentKey) || [];
    if (grid) grid.innerHTML = '';

    if (!kids.length){
  if (empty) empty.style.display = 'none';
  if (grid) grid.style.display = 'none';
    } else {
      if (empty) empty.style.display = 'none';
      if (grid) grid.style.display = '';
      for (const id of kids){
        const c = graph.cats.get(id);
        const card = document.createElement('div');
card.className = 'cat-tile fade-in';
card.tabIndex = 0;
card.role = 'button';

const title = c?.title || id;
const total = graph.subtree.get(id) || 0;

card.innerHTML = `
  <div class="cat-tile__title">${escapeHtml(title)}</div>
  <div class="cat-tile__meta">
    <div></div>
    <div>${total} тов.</div>
  </div>
`;
        const open = () => {
  currentCat = id;
  path.push({ id, title });
  renderCurrent();
  renderProductsForCurrent();
};

card.addEventListener('click', open);
card.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    open();
  }
});
        grid.appendChild(card);
      }
    }

    // controls
    const btnRoot = $('catalogGoRoot');
    const btnUp = $('catalogGoUp');
    if (btnRoot) btnRoot.disabled = (currentCat === null);
    if (btnUp) btnUp.disabled = (currentCat === null);

    renderProductsForCurrent();
  }

  function renderProductsForCurrent(){
    if (!window.App || !graph) return;
    const catId = currentCat;

// В корне каталога: таблицу не заполняем, показываем подсказку
if (mode === 'catalog' && !catId) {
  window.App.filteredData = [];
  window.App._preFilterData = [];
  window.App._page = 1;
  window.App.displayResults?.();
  
  if (mode === 'catalog') {
  const t = document.getElementById('stateBannerTitle');
  const h = document.getElementById('stateBannerHint');

  if (t) t.textContent = 'Выберите нужную категорию';
  if (h) h.textContent = '';
}


  const b = $('stateBanner');
  const t = $('stateBannerTitle');
  const h = $('stateBannerHint');
  if (t) t.textContent = 'Выберите нужную категорию';
  if (h) h.textContent = '';
  if (b) b.style.display = '';
  return;
}

const prods = (graph.cats.get(catId)?.products || []);

// гарантируем индекс по base.csv (из window.App.data)
ensureBaseIndex();

const rows = prods.map(p => {
  const art = (p && p.id != null) ? String(p.id).trim() : '';
  const baseRow = (baseIndex && art) ? baseIndex.get(art) : null;

  // если нашли артикул в base.csv — возвращаем “родную” строку (все столбцы + __поля)
  if (baseRow) return baseRow;

  // fallback: минимальная строка, если артикула нет в base
  return toAppRow(p);
});


window.App.filteredData = rows;
window.App._preFilterData = rows.slice();
window.App._page = 1;
window.App.displayResults?.();
if (mode === 'catalog') {
  const t = document.getElementById('stateBannerTitle');
  const h = document.getElementById('stateBannerHint');

  if (t) t.textContent = 'Выберите нужную категорию';
  if (h) h.textContent = '';
}

  }

  function toAppRow(p){
    const name = p.title || '';
    const art = p.id || '';
    const App = window.App;

    const normName = App?.normalizeForFuzzySearch ? App.normalizeForFuzzySearch(name) : name.toLowerCase();
    const normArt = App?.normalizeForFuzzySearch ? App.normalizeForFuzzySearch(art) : art.toLowerCase();
    const keepName = App?.canonKeepDelims ? App.canonKeepDelims(name) : name;
    const keepArt = App?.canonKeepDelims ? App.canonKeepDelims(art) : art;

    return {
      'Наименование': name,
      'Артикул': art,
      'Цена': '',
      'Документы': '',
      'Характеристики': '',
      'Количество': '',
      __name: normName,
      __article: normArt,
      __name_delim: keepName,
      __article_delim: keepArt,
      __price: '—',
      __docs: [],
      __featHtml: null,
      __qty: 0,
      __isCatalog: true
    };
  }

  function escapeHtml(s){
    return (s ?? '').toString()
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function init(){
    const chip = $('rzdToggle');
    if (!chip) return;

    // Intercept click to open menu (prevent rzd-search.js toggling)
    chip.addEventListener('click', (e) => {
      const menu = ensureMenu();
      if (!menu) return;

      // Если клик по самому меню — не перехватываем (иначе пункты не нажимаются)
      if (menu.contains(e.target)) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      renderMenu();

      menu.hidden = !menu.hidden;
      chip.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');

      if (!menu.hidden) {
        requestAnimationFrame(() => positionMenu(menu, chip));
      }
    }, true);

    // root/up buttons
    $('catalogGoRoot')?.addEventListener('click', () => {
      currentCat = null;
      path = [];
      renderCurrent();
    });
    $('catalogGoUp')?.addEventListener('click', () => {
      if (!currentCat) return;
      path.pop();
      currentCat = path.length ? path[path.length-1].id : null;
      renderCurrent();
    });

    // initial menu
    renderMenu();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
