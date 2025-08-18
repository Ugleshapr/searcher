// Приложение для поиска по Excel прайс-листу (STAGING, автозагрузка ./base.xlsx)
class PriceListSearchApp {
  constructor() {
    this.data = [];
    this.filteredData = [];
    this._page = 1;
    this._pageSize = 200;

    // Анти-DoS / безопасность
    this.MAX_TOKENS = 6;
    this.MAX_TOKEN_LEN = 64;
    this.MAX_REGEX_TOTAL = 2000;
    this.MAX_XLSX_BYTES = 15 * 1024 * 1024;
    this.MAX_ROWS = 200000;

    // Транслитерация
    this.translitMap = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
      'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
      'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
      'ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
      'a':'а','b':'б','v':'в','g':'г','d':'д','e':'е','f':'ф','h':'х',
      'i':'и','j':'й','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п',
      'r':'р','s':'с','t':'т','u':'у','w':'в','x':'кс','y':'ы','z':'з'
    };

    // Омографы (лат/кирилл)
    this.homoglyphCanon = new Map([
      ['a','a'],['b','b'],['c','c'],['e','e'],['h','h'],['k','k'],
      ['m','m'],['o','o'],['p','p'],['t','t'],['x','x'],['y','y'],
      ['а','a'],['в','b'],['с','c'],['е','e'],['н','h'],['к','k'],
      ['м','m'],['о','o'],['р','p'],['т','t'],['х','x'],['у','y'],
      ['A','a'],['B','b'],['C','c'],['E','e'],['H','h'],['K','k'],
      ['M','m'],['O','o'],['P','p'],['T','t'],['X','x'],['Y','y'],
      ['А','a'],['В','b'],['С','c'],['Е','e'],['Н','h'],['К','k'],
      ['М','m'],['О','o'],['Р','p'],['Т','t'],['Х','x'],['У','y'],
    ]);
    this.homoglyphClass = new Map([
      ['a','[aа]'],['b','[bв]'],['c','[cс]'],['e','[eе]'],
      ['h','[hн]'],['k','[kк]'],['m','[mм]'],['o','[oо]'],
      ['p','[pр]'],['t','[tт]'],['x','[xх]'],['y','[yу]'],
    ]);

    this.initializeEventListeners();
    // Отключаем подсказки по истории окончательно: делаем уникальное имя поля
const si = document.getElementById('searchInput');
if (si) {
  si.setAttribute('autocomplete', 'off');               // дублируем на всякий
  si.setAttribute('name', `q_${Date.now().toString(36)}`); // уникальное имя каждый раз
}
    this.loadDefaultFile();
  }

  // ---------- Утилиты ----------
  normalizeForFuzzySearch(text) {
    if (!text) return '';
    const lower = String(text).toLowerCase();
    let canon = '';
    for (const ch of lower) {
      canon += this.homoglyphCanon.has(ch) ? this.homoglyphCanon.get(ch) : ch;
    }
    return canon.replace(/[^a-z0-9а-яё]/g, '');
  }

  transliterate(text) {
    return String(text).toLowerCase().split('').map(c => this.translitMap[c] || c).join('');
  }

  escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  escapeHTML(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  debounce(fn, ms=200){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,a),ms); }; }

  buildHomoglyphRegexToken(token) {
    let out = '';
    for (const raw of String(token)) {
      const lower = raw.toLowerCase();
      const canon = this.homoglyphCanon.get(raw) || this.homoglyphCanon.get(lower) || lower;
      if (this.homoglyphClass.has(canon)) out += this.homoglyphClass.get(canon);
      else if (/[a-z0-9а-яё]/i.test(raw)) out += this.escapeRegExp(raw);
      else out += this.escapeRegExp(raw);
    }
    return out;
  }

  highlightHomoglyphs(escapedText, tokenPatterns) {
    if (!escapedText || !tokenPatterns.length) return escapedText;
    let out = String(escapedText);
    for (const pat of tokenPatterns) {
      try { out = out.replace(new RegExp(`(${pat})`,'gi'), '<span class="highlight">$1</span>'); }
      catch {}
    }
    return out;
  }

  showError(message) {
    const modal = new bootstrap.Modal(document.getElementById('errorModal'));
    document.getElementById('errorMessage').textContent = message;
    modal.show();
  }

  showSearchSection() {
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'block';
  }

  initializeEventListeners() {
    const input = document.getElementById('searchInput');
    const debounced = this.debounce(() => this.performSearch(), 200);
    if (input) {
      input.addEventListener('input', debounced);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
    }
  }

  // ---------- Загрузка данных ----------
  async loadDefaultFile() {
    try {
      // Кэш-бастер, чтобы на стейдже всегда подтягивалась свежая база
      const url = `base.xlsx?v=${Date.now()}`;
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);

      const clen = resp.headers.get('content-length');
      if (clen && +clen > this.MAX_XLSX_BYTES) {
        throw new Error(`Файл слишком большой (${Math.round(+clen/1024/1024)} МБ). Предел ~${Math.round(this.MAX_XLSX_BYTES/1024/1024)} МБ.`);
      }

      const buf = await resp.arrayBuffer();
      if (buf.byteLength > this.MAX_XLSX_BYTES) {
        throw new Error(`Файл слишком большой (${Math.round(buf.byteLength/1024/1024)} МБ). Предел ~${Math.round(this.MAX_XLSX_BYTES/1024/1024)} МБ.`);
      }

      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(ws);

      if (!jsonData.length) throw new Error('Файл пустой или не содержит данных');
      if (jsonData.length > this.MAX_ROWS) throw new Error(`Слишком много строк (${jsonData.length}). Предел ${this.MAX_ROWS}.`);

      const required = ['Наименование', 'Артикул', 'Цена'];
      const firstRow = jsonData[0] || {};
      const missing = required.filter(c => !(c in firstRow));
      if (missing.length) throw new Error(`Отсутствуют колонки: ${missing.join(', ')}`);

      // Прединдексация + формат цены (без ₽)
      this.data = jsonData.map(row => ({
        ...row,
        __name: this.normalizeForFuzzySearch(row['Наименование'] || ''),
        __article: this.normalizeForFuzzySearch(row['Артикул'] || ''),
        __price: this._formatPriceCached(row['Цена']),
      }));

      const info = document.getElementById('datasetInfo');
      if (info) {
        info.style.display = 'block';
        info.textContent = `Загружено записей: ${this.data.length}`;
      }

      this.showSearchSection();
// Очистить строку поиска ТОЛЬКО при "reload" (F5/Ctrl+R/кнопка обновить),
// но НЕ при возврате "назад" (bfcache сохраняется).
const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
const isReload = nav ? (nav.type === 'reload')
                     : (performance.navigation && performance.navigation.type === 1); // старый API для старых браузеров

if (isReload) {
  const input = document.getElementById('searchInput');
  if (input) input.value = '';
  this.filteredData = [];
  this._page = 1;
  this.displayResults();
}
    } catch (e) {
      console.error('Загрузка base.xlsx не удалась:', e);
      this.showError(`Не удалось загрузить base.xlsx\n${e.message}`);
    }
  }

  // ---------- Поиск ----------
  createSearchVariants(query) {
    const q = String(query).toLowerCase().trim();
    const t = this.transliterate(q);
    return t !== q ? [q, t] : [q];
  }

  performSearch() {
    const query = (document.getElementById('searchInput')?.value || '').trim();
    if (!query) {
      this.filteredData = [];
      this._page = 1;
      this.displayResults();
      return;
    }

    const parts = query
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, this.MAX_TOKENS)
      .map(p => this.normalizeForFuzzySearch(p.slice(0, this.MAX_TOKEN_LEN)))
      .filter(Boolean);

    this.filteredData = this.data.filter(item =>
      parts.every(part => item.__name.includes(part) || item.__article.includes(part))
    );

    this._page = 1;
    this.displayResults();
  }

  // ---------- Отрисовка ----------
  displayResults() {
    const resultsBody = document.getElementById('resultsBody');
    const resultsCount = document.getElementById('resultsCount');
    const noResults = document.getElementById('noResults');
    const rawQuery = (document.getElementById('searchInput')?.value || '').trim();

    const total = this.filteredData.length;
    if (total === 0) {
      resultsBody.innerHTML = '';
      noResults.style.display = 'block';
      resultsCount.textContent = 'Найдено: 0 результатов';
      this._renderShowMore(false);
      return;
    }

    noResults.style.display = 'none';

    let highlightTokens = rawQuery
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, this.MAX_TOKENS)
      .map(tok => this.buildHomoglyphRegexToken(tok.slice(0, this.MAX_TOKEN_LEN)));

    const totalPatternLen = highlightTokens.join('').length;
    if (totalPatternLen > this.MAX_REGEX_TOTAL) {
      highlightTokens = []; // защита от «регексп-кирпича»
    }

    const end = Math.min(this._page * this._pageSize, total);
    const slice = this.filteredData.slice(0, end);

    const tooMany = total > 5000;
    resultsBody.innerHTML = slice.map(item => {
      const nameSafe = this.escapeHTML(item['Наименование'] || '');
      const artSafe  = this.escapeHTML(item['Артикул'] || '');
      const nameHtml = (tooMany || highlightTokens.length === 0)
        ? nameSafe : this.highlightHomoglyphs(nameSafe, highlightTokens);
      const artHtml  = (tooMany || highlightTokens.length === 0)
        ? artSafe  : this.highlightHomoglyphs(artSafe, highlightTokens);
      return `
        <tr>
          <td>${nameHtml}</td>
          <td>${artHtml}</td>
          <td class="text-price">${item.__price}</td>
        </tr>
      `;
    }).join('');

    resultsCount.textContent = `Показаны: ${slice.length} из ${total}`;
    this._renderShowMore(end < total);
  }

  _renderShowMore(show) {
    const footer = document.getElementById('resultsShowMore');
    if (!footer) return;
    if (!show) { footer.innerHTML = ''; return; }
    footer.innerHTML = `<button class="btn btn--primary" id="showMoreBtn">Показать ещё ${this._pageSize}</button>`;
    document.getElementById('showMoreBtn').onclick = () => {
      this._page += 1;
      setTimeout(() => this.displayResults(), 0);
    };
  }

  // формат цены БЕЗ символа рубля — число с 2 знаками
  _formatPriceCached(price) {
    if (price === null || price === undefined || price === '') return '—';
    const num = parseFloat(price);
    if (Number.isNaN(num)) return String(price);
    return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PriceListSearchApp();
});
