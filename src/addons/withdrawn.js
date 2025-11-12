// src/addons/withdrawn.js
(function () {
  let loaded = false;
  let withdrawnSet = null;   // Set нормализованных артикулов
  let withdrawnIndex = null; // Map нормализованный→{ art, name }

  async function ensurePapa() {
    if (window.Papa) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureLoaded(normalizer) {
    if (loaded) return;
    await ensurePapa();

    const resp = await fetch('keaz-old-products.csv', { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    const text = await resp.text();

    const parsed = Papa.parse(text, {
      header: true, delimiter: ';', skipEmptyLines: true,
      transformHeader: h => String(h).trim()
    });

    const set = new Set();
    const map = new Map();
    const rows = Array.isArray(parsed.data) ? parsed.data : [];
    for (const r of rows) {
      const artRaw  = (r && (r['Артикул'] ?? r['артикул'])) ?? '';
      const nameRaw = (r && (r['Наименование'] ?? r['наименование'])) ?? '';
      const artNorm = normalizer.normalizeForFuzzySearch(String(artRaw || ''));
      if (!artNorm) continue;
      set.add(artNorm);
      map.set(artNorm, { art: String(artRaw || '').trim(), name: String(nameRaw || '').trim() });
    }

    withdrawnSet = set;
    withdrawnIndex = map;
    loaded = true;
  }

  function splitParts(normalizer, q) {
    return String(q)
      .split(/[^a-zA-Zа-яА-ЯёЁ0-9/]+/)
      .filter(Boolean)
      .map(p => normalizer.normalizeForFuzzySearch(p.slice(0, 64)))
      .filter(Boolean);
  }

  function isPermitArticle(rawQuery) {
    const hasLetters = /[a-zA-Zа-яА-ЯёЁ]/.test(rawQuery);
    const digitCount = String(rawQuery).replace(/\D/g, '').length;
    return !hasLetters && digitCount > 0 && digitCount % 6 === 0;
  }

  function isMultiArticle(parts) {
    return parts.length >= 2 && parts.every(p => /^\d{6}$/.test(p));
  }

  function markWithdrawn(filtered) {
    for (const it of filtered) {
      // если уже помечен — не трогаем; иначе по Set
      it.__withdrawn = it.__withdrawn || (withdrawnSet?.has(it.__article) || false);
    }
  }

  function addVirtualRows(app, parts) {
    const have = new Set(app.filteredData.map(it => it.__article));
    for (const code of parts) {
      if (have.has(code)) continue;
      const meta = withdrawnIndex?.get(code);
      if (!meta) continue;
      app.filteredData.push({
        'Наименование': meta.name || '',
        'Артикул': meta.art || code,
        'Цена': '',
        'Документы': '',
        'Характеристики': '',
        'Количество': '0',

        __name: app.normalizer.normalizeForFuzzySearch(meta.name || ''),
        __article: code,
        __name_delim: app.normalizer.canonKeepDelims(meta.name || ''),
        __article_delim: app.normalizer.canonKeepDelims(meta.art || code),
        __price: '',
        __docs: [],
        __featHtml: '',
        __qty: 0,
        __qtyHint: null,
        __withdrawn: true
      });
    }
  }

  async function augment(app, rawQuery) {
    if (!rawQuery) return;
    const permit = isPermitArticle(rawQuery);
    if (!permit) return; // текстовый сценарий — ничего не делаем

    await ensureLoaded(app.normalizer);

    const parts = splitParts(app.normalizer, app.normalizer.applyUZAliases(rawQuery));
    const numericSeq = parts.filter(p => /^\d+$/.test(p));

    if (isMultiArticle(parts)) {
      addVirtualRows(app, [...new Set(parts)]);
      // восстановим порядок ввода
      const order = new Map(parts.map((a, i) => [a, i]));
      app.filteredData.sort((a, b) => order.get(a.__article) - order.get(b.__article));
      markWithdrawn(app.filteredData);
      return;
    }

    // Обычный режим с разрешённым артикулом — добиваем «чисто выведенные»
    addVirtualRows(app, numericSeq);
    markWithdrawn(app.filteredData);
  }

  window.Withdrawn = { augment };
})();

