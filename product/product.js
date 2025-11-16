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
    
  const unquote = s => {
  let t = String(s ?? '').trim();
  t = t.replace(/^'+|'+$/g, ''); // срезаем обрамляющие одинарные кавычки
  t = t.replace(/''/g, "'");     // схлопываем экранированные пары
  return t;
};


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
  if (!window.Papa) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const text = await fetchText(url);
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header,
      delimiter: ';',
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
      complete: result => resolve(result.data),
      error: err => reject(err),
    });
  });
}

  /*** base.csv lookup (optional) ***/
  async function lookupNameFromBaseCsv(art) {
  try {
    if (!window.Papa) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const resp = await fetch('../base.csv', { cache: 'no-cache' });
    if (!resp.ok) return '';
    const text = await resp.text();

    const parsed = Papa.parse(text, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
    });

    const rows = parsed.data || [];
    const found = rows.find(r => String(r['Артикул'] || '').trim() === art);
    return (found && found['Наименование']) ? unquote(found['Наименование']) : '';
  } catch {
    return '';
  }
}


  /*** render ***/
  function renderTitle(name, art) {
  const cleanName = unquote(name);
  qs('#prodTitle').textContent = cleanName || 'Без названия';
  qs('#prodMeta').textContent = `Артикул: ${art || '—'}`;
  document.title = cleanName || 'Карточка товара';
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
        tr.dataset.title = row.title || '';
  	tr.dataset.value = row.value || '';
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
  
  // Копирование "Название \t Значение" при клике по строке параметра
document.addEventListener('click', async (e) => {
  const root = document.getElementById('groupsRoot');
  if (!root) return;

  const tr = e.target.closest('tr');
  if (!tr || !root.contains(tr)) return;

  // Берём «сырые» значения из data-атрибутов (без HTML-энтити/кавычек)
  const title = (tr.dataset.title || '').trim() || tr.querySelector('th')?.textContent.trim() || '';
  const value = (tr.dataset.value || '').trim() || tr.querySelector('td')?.textContent.trim() || '';
  if (!title && !value) return;

  const tsv = `${title}\t${value}`;
  try {
    await navigator.clipboard.writeText(tsv);
    const prev = tr.getAttribute('title') || '';
    tr.setAttribute('title', 'Скопировано');
    setTimeout(() => tr.setAttribute('title', prev), 800);
  } catch (err) {
    // молча игнорируем, если буфер недоступен
    console.warn('Clipboard error:', err);
  }
});

  

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
      displayName = await lookupNameFromBaseCsv(art);
    }
    renderTitle(displayName || 'Товар', art);

    showState('info', 'Загружаю характеристики…');

    // 1) Загружаем словарь спецификаций
    //    Ожидаемые колонки: spec_id;title;value_type;group_id;group_name
    const specs  = await parseCSV('../src/addons/products_spec.csv', true);

    // Сформируем map spec_id → {title, value_type, group_id, group_name}
    const specMap = new Map();
    for (const s of specs) {
      const id = String(s['spec_id'] ?? s['specId'] ?? s['id']).trim();
      if (!id) continue;
      specMap.set(id, {
  title: unquote(s['title']),
  value_type: String(s['value_type'] ?? '').trim(),
  group_id: s['group_id'] !== undefined && s['group_id'] !== '' ? Number(s['group_id']) : null,
  group_name: unquote(s['group_name'])
});
    }

    // 2) Значения по продуктам
    //    Ожидаемые колонки: product_id;spec_id;value
    const values = await parseCSV('../src/addons/products_spec_values.csv', true);
    const mine = values.filter(v => String(v['product_id'] ?? '').trim() === art);

    // 3) Объединяем: подставляем title + group_* по spec_id
    const rows = [];
    for (const v of mine) {
      const sid = String(v['spec_id'] ?? '').trim();
      const dict = specMap.get(sid) || {};
      rows.push({
  spec_id: sid,
  title: unquote(dict.title || sid),
  value: unquote(v['value']),
  group_id: dict.group_id,
  group_name: unquote(dict.group_name || '')
});

    }

    // 4) Группировка по group_name, сортировка групп по group_id, внутри — по title
    const byGroup = new Map();
    for (const r of rows) {
      const key = r.group_name || 'Без группы';
      if (!byGroup.has(key)) byGroup.set(key, { group_name: key, group_id: r.group_id ?? 999999, items: [] });
      byGroup.get(key).items.push(r);
    }

    let grouped = Array.from(byGroup.values())
  .sort((a, b) => byNum(a.group_id, b.group_id))
  .map(g => ({ ...g, items: g.items.sort((a, b) => a.title.localeCompare(b.title, 'ru')) }));

//  фильтруем: убираем группу "Классификация" целиком
grouped = grouped.filter(g => g.group_name.toLowerCase() !== 'классификация');

hideState();
renderGroups(grouped);

  })().catch(err => {
    console.error(err);
    showState('danger', 'Ошибка при загрузке данных. Открой консоль разработчика для деталей.');
  });

})();

