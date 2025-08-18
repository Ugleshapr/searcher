// app.js — версия под base.search.json
// Приложение для поиска по предобработанной JSON-базе
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
    this.MAX_ROWS = 200000;

    // Транслитерация (как было)
    this.translitMap = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
      'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
      'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
      'ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
      'a':'а','b':'б','v':'в','g':'г','d':'д','e':'е','f':'ф','h':'х',
      'i':'и','j':'й','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п',
      'r':'р','s':'с','t':'т','u':'у','w':'в','x':'кс','y':'ы','z':'з'
    };

    // Омографы (лат/кирилл) — как было
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

    // Отключаем автоподсказки истории
    const si = document.getElementById('searchInput');
    if (si) {
      si.setAttribute('autocomplete', 'off');
      si.setAttribute('name', `q_${Date.now().toString(36)}`);
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

    // Копирование "Наименование\tАртикул" по ЛКМ на первой колонке
    const tbody = document.getElementById('resultsBody');
    if (tbody) {
      tbody.addEventListener('click', async (e) => {
        const cell = e.target.closest('td.copyable');
        if (!cell) return;
        const name = cell.textContent.trim();
        const row = cell.parentElement;
        const articleCell = row ? row.children[1] : null;
        const article = articleCell ? articleCell.textContent.trim() : '';
        const tsv = `${name}\t${article}`;
        try {
          await navigator.clipboard.writeText(tsv);
          const prev = cell.getAttribute('title') || '';
          cell.setAttribute('title', 'Скопировано');
          setTimeout(() => cell.setAttribute('title', prev), 800);
        } catch (err) {
          console.warn('Clipboard error:', err);
        }
      });
    }
  }

  // ---------- Загрузка данных (JSON) ----------
  async loadDefaultFile() {
    try {
      const resp = await fetch('base.search.json', { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const json = await resp.json();
      if (!Array.isArray(json) || json.length === 0) throw new Error('Файл пустой или неправильного формата');
      if (json.length > this.MAX_ROWS) throw new Error(`Слишком много строк (${json.length}). Предел ${this.MAX_ROWS}.`);

      const first = json[0] || {};
      const nameKey    = ('name'    in first) ? 'name'    : (('Наименование' in first) ? 'Наименование' : null);
      const articleKey = ('article' in first) ? 'article' : (('Артикул'       in first) ? 'Артикул'       : null);
      const priceKey   = ('price'   in first) ? 'price'   : (('Цена'          in first) ? 'Цена'          : 'price');

      if (!nameKey || !articleKey) {
        throw new Error('Отсутствуют обязательные колонки: name/Наименование и/или article/Артикул');
      }

      // Подготовка записей: берём предвычисленные __name/__article если даны, иначе считаем
      this.data = json.map(row => {
        const name = row[nameKey] ?? '';
        const article = row[articleKey] ?? '';
        let priceNum = row[priceKey];

        // цена с НДС: если нет — 0
        if (priceNum === null || priceNum === undefined || priceNum === '' || Number.isNaN(Number(priceNum))) {
          priceNum = 0;
        } else {
          priceNum = Number(priceNum);
        }

        const __name    = row.__name    ? String(row.__name)    : this.normalizeForFuzzySearch(name);
        const __article = row.__article ? String(row.__article) : this.normalizeForFuzzySearch(article);

        return {
          // сохраняем исходные поля на всякий
          ...row,
          name,
          article,
          price: priceNum,
          __name,
          __article,
          __price: this._formatPriceCached(priceNum),
        };
      });

      const info = document.getElementById('datasetInfo');
      if (info) {
        info.style.display = 'block';
        info.textContent = `Загружено записей: ${this.data.length}`;
      }

      this.showSearchSection();

      // При полном перезагрузе чистим интерфейс
      const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      const isReload = nav ? (nav.type === 'reload')
                           : (performance.navigation && performance.navigation.type === 1);
      if (isReload) {
        const input = document.getElementById('searchInput');
        if (input) input.value = '';
        this.filteredData = [];
        this._page = 1;
        this.displayResults();
      }
    } catch (e) {
      console.error('Загрузка base.search.json не удалась:', e);
      this.showError(`Не удалось загрузить base.search.json\n${e.message}`);
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

    // Токены из оригинала + из транслитерации
    const variants = this.createSearchVariants(query);
    const partsSet = new Set();
    for (const v of variants) {
      const toks = v.split(/\s+/).filter(Boolean).slice(0, this.MAX_TOKENS)
        .map(p => this.normalizeForFuzzySearch(p.slice(0, this.MAX_TOKEN_LEN)))
        .filter(Boolean);
      toks.forEach(t => partsSet.add(t));
    }
    const parts = Array.from(partsSet);

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
    const banner  = document.getElementById('stateBanner');
    const titleEl = document.getElementById('stateBannerTitle');
    const hintEl  = document.getElementById('stateBannerHint');

    const rawQuery = (document.getElementById('searchInput')?.value || '').trim();

    const total = this.filteredData.length;

    if (total === 0) {
      resultsBody.innerHTML = '';

      const isEmptyQuery = rawQuery.length === 0;
      if (banner && titleEl && hintEl) {
        if (isEmptyQuery) {
          banner.className = 'no-results no-results--empty text-center py-4';
          titleEl.textContent = 'Введите текст для поиска';
          hintEl.textContent = '';
        } else {
          banner.className = 'no-results text-center py-4';
          titleEl.textContent = 'По вашему запросу ничего не найдено';
          hintEl.textContent = 'Попробуйте изменить условия поиска или проверьте правописание';
        }
        banner.style.display = 'block';
      }

      resultsCount.textContent = 'Найдено: 0 результатов';
      this._renderShowMore(false);
      return;
    } else {
      if (banner) banner.style.display = 'none';
    }

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
      const nameSafe = this.escapeHTML(item.name ?? item['Наименование'] ?? '');
      const artSafe  = this.escapeHTML(item.article ?? item['Артикул'] ?? '');
      const nameHtml = (tooMany || highlightTokens.length === 0)
        ? nameSafe : this.highlightHomoglyphs(nameSafe, highlightTokens);
      const artHtml  = (tooMany || highlightTokens.length === 0)
        ? artSafe  : this.highlightHomoglyphs(artSafe, highlightTokens);
      return `
        <tr>
          <td class="copyable">${nameHtml}</td>
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

  // формат цены БЕЗ символа рубля — число с 2 знаками; если нет — 0,00
  _formatPriceCached(price) {
    if (price === null || price === undefined || price === '' || Number.isNaN(Number(price))) {
      return (0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    const num = Number(price);
    return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PriceListSearchApp();
});

