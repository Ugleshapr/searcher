(function () {
  'use strict';

  /*** utils ***/
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byNum = (a, b) => (a ?? 0) - (b ?? 0);

  const escapeHTML = s => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function showState(kind, text) {
    const box = qs('#stateBox');
    const host = qs('#state');
    box.className = `alert alert-${kind}`;
    box.textContent = text;
    host.hidden = false;
  }
  function hideState() {
    const host = qs('#state');
    host.hidden = true;
  }

  function getQuery() {
    const p = new URLSearchParams(location.search);
    return {
      art: (p.get('art') || '').trim(),
      name: (p.get('name') || '').trim()
    };
  }

  /*** CSV loaders ***/
  async function fetchText(url) {
    const resp = await fetch(url, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`);
    return resp.text();
  }

  async function parseCSV(url, header = true) {
    const text = await fetchText(url);
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header,
        delimiter: ';',
        skipEmptyLines: true,
        transformHeader: h => h.trim(),
        complete: result => resolve(result.data),
        error: err => reject(err)
      });
    });
  }

  /*** base.xlsx lookup (optional) ***/
  async function lookupNameFromBaseXlsx(art) {
    try {
      const resp = await fetch('base.xlsx', { cache: 'no-cache' });
      if (!resp.ok) return '';
      const buf = await resp.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      const found = rows.find(r => String(r['Артикул'] || '').trim() === art);
      return (found && found['Наименование']) ? String(found['Наименование']) : '';
    } catch {
      return '';
    }
  }

  /*** render ***/
  function renderTitle(name, art) {
    qs('#prodTitle').textContent = name || 'Без названия';
    qs('#prodMeta').textContent = `Артикул: ${art || '—'}`;
  }

  function renderGroups(grouped) {
    const root = qs('#groupsRoot');
    root.innerHTML = '';

    if (!grouped.length) {
      showState('warning', 'Для этого артикула характеристики не найдены.');
      return;
    }

    hideState();

    for (const group of grouped) {
      const card = document.createElement('div');
      card.className = 'group-card';

      const header = document.createElement('div');
      header.className = 'group-card__header';
      header.textContent = group.group_name || 'Без группы';

      const body = document.createElement('div');
      body.className = 'group-card__body';

      const table = document.createElement('table');
      table.className = 'spec-table';
      const tbody = document.createElement('tbody');

      for (const row of group.items) {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.innerHTML = escapeHTML(row.title || '');
        const td = document.createElement('td');
        td.innerHTML = escapeHTML(row.value || '');
        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      body.appendChild(table);

      card.appendChild(header);
      card.appendChild(body);

      root.appendChild(card);
    }
  }

  /*** main ***/
  (async function main() {
    const { art, name } = getQuery();

    if (!art) {
      renderTitle('—', '—');
      showState('danger', 'В адресной строке отсутствует параметр ?art=...');
      return;
    }

    // Заголовок: используем name из URL, иначе пробуем достать из base.xlsx
    let displayName = name;
    if (!displayName) {
      renderTitle('Загрузка…', art);
      displayName = await lookupNameFromBaseXlsx(art);
    }
    renderTitle(displayName || 'Товар', art);

    showState('info', 'Загружаю характеристики…');

    // 1) Загружаем словарь спецификаций
    //    Ожидаемые колонки: spec_id;title;value_type;group_id;group_name
    const specs = await parseCSV('addons/products_spec.csv', /*header*/ true);

    // Сформируем map spec_id → {title, value_type, group_id, group_name}
    const specMap = new Map();
    for (const s of specs) {
      const id = String(s['spec_id'] ?? s['specId'] ?? s['id']).trim();
      if (!id) continue;
      specMap.set(id, {
        title: String(s['title'] ?? '').trim(),
        value_type: String(s['value_type'] ?? '').trim(),
        group_id: s['group_id'] !== undefined && s['group_id'] !== '' ? Number(s['group_id']) : null,
        group_name: String(s['group_name'] ?? '').trim()
      });
    }

    // 2) Значения по продуктам
    //    Ожидаемые колонки: product_id;spec_id;value
    const values = await parseCSV('addons/products_spec_values.csv', /*header*/ true);
    const mine = values.filter(v => String(v['product_id'] ?? '').trim() === art);

    // 3) Объединяем: подставляем title + group_* по spec_id
    const rows = [];
    for (const v of mine) {
      const sid = String(v['spec_id'] ?? '').trim();
      const dict = specMap.get(sid) || {};
      rows.push({
        spec_id: sid,
        title: dict.title || sid,
        value: String(v['value'] ?? '').trim(),
        group_id: dict.group_id,
        group_name: dict.group_name || ''
      });
    }

    // 4) Группировка по group_name, сортировка групп по group_id, внутри — по title
    const byGroup = new Map();
    for (const r of rows) {
      const key = r.group_name || 'Без группы';
      if (!byGroup.has(key)) byGroup.set(key, { group_name: key, group_id: r.group_id ?? 999999, items: [] });
      byGroup.get(key).items.push(r);
    }

    const grouped = Array.from(byGroup.values())
      .sort((a, b) => byNum(a.group_id, b.group_id))
      .map(g => ({ ...g, items: g.items.sort((a, b) => a.title.localeCompare(b.title, 'ru')) }));

    hideState();
    renderGroups(grouped);
  })().catch(err => {
    console.error(err);
    showState('danger', 'Ошибка при загрузке данных. Открой консоль разработчика для деталей.');
  });

})();

