// src/addons/catalog/catalog-addon.js
(function () {
  const CATALOG_COLOR = '#0a0af0';
  const CSV_PATH = 'src/addons/catalog/camerged.csv';

  let mode = 'base'; // base | rzd | catalog

  let graph = null;
  let currentCat = null;
  let path = []; // breadcrumb: [{id,title}]
  let isLoaded = false;

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
    let menu = chip.querySelector('.mode-menu');
    if (menu) return menu;

    menu = document.createElement('div');
    menu.className = 'mode-menu';
    menu.hidden = true;
    menu.setAttribute('role','menu');

    chip.appendChild(menu);

    document.addEventListener('click', (e) => {
      if (!chip.contains(e.target)) menu.hidden = true;
      chip.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
    });

    return menu;
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
      btn.addEventListener('click', async () => {
        menu.hidden = true;
        chip.setAttribute('aria-expanded','false');
        await switchMode(it.key);
      });
      menu.appendChild(btn);
    }
  }

  async function switchMode(next){
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

    // In catalog mode, we don't use free-text search input
    const input = $('searchInput');
    if (input) {
      input.disabled = on;
      if (on) input.value = '';
    }
  }

  async function enterCatalog(){
    showCatalog(true);
    if (!isLoaded) {
      await loadCatalog();
      isLoaded = true;
      currentCat = null;
      path = [];
    }
    renderCurrent();
  }

  async function exitCatalog(){
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

    // build children index
    const children = new Map();
    for (const [id, c] of cats.entries()){
      const p = c.parent_id || '';
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

    return { cats, children, subtree };
  }

  async function loadCatalog(){
    const resp = await fetch(CSV_PATH, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Не удалось загрузить ${CSV_PATH}: ${resp.status}`);
    const text = await resp.text();
    const rows = parseCSV(text);
    graph = buildGraph(rows);
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

    const parentKey = currentCat ?? '';
    const kids = graph.children.get(parentKey) || [];
    if (grid) grid.innerHTML = '';

    if (!kids.length){
      if (empty) empty.style.display = '';
      if (grid) grid.style.display = 'none';
    } else {
      if (empty) empty.style.display = 'none';
      if (grid) grid.style.display = '';
      for (const id of kids){
        const c = graph.cats.get(id);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'catalog-card';
        const title = c?.title || id;
        const total = graph.subtree.get(id) || 0;
        card.innerHTML = `
          <div class="catalog-card__title">${escapeHtml(title)}</div>
          <div class="catalog-card__meta">${total} тов.</div>
        `;
        card.addEventListener('click', ()=>{
          currentCat = id;
          path.push({ id, title });
          renderCurrent();
          renderProductsForCurrent();
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
    const prods = catId ? (graph.cats.get(catId)?.products || []) : [];
    const rows = prods.map(p => toAppRow(p));

    window.App.filteredData = rows;
    window.App._preFilterData = rows.slice();
    window.App._page = 1;
    window.App.displayResults?.();
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
      e.preventDefault();
      e.stopImmediatePropagation();
      const menu = ensureMenu();
      if (!menu) return;
      renderMenu();
      menu.hidden = !menu.hidden;
      chip.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
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
