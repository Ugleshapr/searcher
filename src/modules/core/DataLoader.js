export class DataLoader {
  constructor(normalizer) {
    this.normalizer = normalizer;
    this.MAX_ROWS = 200000;
    this.MAX_XLSX_BYTES = 15 * 1024 * 1024;
  }

  async loadCSV(url) {
    try {
      const resp = await fetch(url, { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const text = await resp.text();

      // Загрузка PapaParse если нужно
      if (!window.Papa) {
        await this._loadPapaParse();
      }

      const parsed = Papa.parse(text, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        transformHeader: h => h.trim(),
      });

      const jsonData = parsed.data;

      if (!jsonData.length) {
        throw new Error('Файл пустой или не содержит данных');
      }
      if (jsonData.length > this.MAX_ROWS) {
        throw new Error(`Слишком много строк (${jsonData.length}). Предел ${this.MAX_ROWS}.`);
      }

      const required = ['Наименование', 'Артикул', 'Цена'];
      const firstRow = jsonData[0] || {};
      const missing = required.filter(c => !(c in firstRow));
      if (missing.length) {
        throw new Error(`Отсутствуют колонки: ${missing.join(', ')}`);
      }

      return this._preprocessData(jsonData);
    } catch (e) {
      console.error('Загрузка CSV не удалась:', e);
      throw e;
    }
  }

  _preprocessData(jsonData) {
    return jsonData.map(row => ({
      ...row,
      __name: this.normalizer.normalizeForFuzzySearch(row['Наименование'] || ''),
      __article: this.normalizer.normalizeForFuzzySearch(row['Артикул'] || ''),
      __name_delim: this.normalizer.canonKeepDelims(row['Наименование'] || ''),
      __article_delim: this.normalizer.canonKeepDelims(row['Артикул'] || ''),
      __price: this._formatPrice(row['Цена']),
      __docs: this._parseDocs(row['Документы']),
      __featHtml: this._featuresToHtml(row['Характеристики']),
      __qty: this._parseQty(row['Количество']),
      __qtyHint: null
    }));
  }

  _parseDocs(raw) {
    if (!raw) return [];
    const text = String(raw).replace(/\s+/g, ' ').trim();
    const urls = [...text.matchAll(/https?:\/\/\S+/g)];
    if (!urls.length) return [];

    const docs = [];
    let last = 0, n = 1;
    for (const m of urls) {
      const url = m[0];
      let title = text.slice(last, m.index).trim();
      title = title.replace(/[—–-]+$/, '').replace(/[:;,.\u00A0\s]+$/, '').trim();
      docs.push({ title: title || `Документ ${n}`, url });
      last = m.index + url.length;
      n++;
    }
    return docs;
  }

  _featuresToHtml(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    let h = this._escapeHTML(s);
    h = h.replace(/\r?\n/g, '<br>');
    h = h.replace(/;\s*/g, '<br>');
    h = h.replace(/^(<br>)+|(<br>)+$/g, '');
    return h;
  }

  _formatPrice(price) {
    if (price === null || price === undefined || price === '') return '—';
    const num = parseFloat(price);
    if (Number.isNaN(num)) return String(price);
    return num.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  _parseQty(v) {
    const n = Number(String(v ?? '').replace(',', '.').trim());
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  _escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async _loadPapaParse() {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
}

