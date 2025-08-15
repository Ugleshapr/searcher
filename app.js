// Приложение для поиска по Excel прайс-листу (без выбора файла, автозагрузка base.xlsx)
class PriceListSearchApp {
  constructor() {
    this.data = [];
    this.filteredData = [];
    this._page = 1;
    this._pageSize = 200;

    this.translitMap = {
      // Рус -> Лат
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
      'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
      'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
      'ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
      // Лат -> Рус (грубая замена для поиска)
      'a':'а','b':'б','v':'в','g':'г','d':'д','e':'е','f':'ф','h':'х',
      'i':'и','j':'й','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п',
      'r':'р','s':'с','t':'т','u':'у','w':'в','x':'кс','y':'ы','z':'з'
    };

    this.initializeEventListeners();
    this.loadDefaultFile(); // автозагрузка base.xlsx
  }

  // ---- Utils ----
  normalizeForFuzzySearch(text) {
    if (!text) return '';
    return String(text).toLowerCase().replace(/[^а-яёa-z0-9]/g, '');
  }

  transliterate(text) {
    return String(text).toLowerCase().split('').map(c => this.translitMap[c] || c).join('');
  }

  escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  debounce(fn, ms = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ---- Bootstrap modal error ----
  showError(message) {
    const modal = new bootstrap.Modal(document.getElementById('errorModal'));
    document.getElementById('errorMessage').textContent = message;
    modal.show();
  }

  // ---- DOM helpers ----
  showSearchSection() {
    const el = document.getElementById('searchSection');
    if (el) {
      el.style.display = 'block';
      el.classList.add('fade-in');
    }
    const res = document.getElementById('resultsSection');
    if (res) res.style.display = 'block';
  }

  // ---- Init listeners ----
  initializeEventListeners() {
    const input = document.getElementById('searchInput');
    const debounced = this.debounce(() => this.performSearch(), 200);
    if (input) {
      input.addEventListener('input', debounced);
      // Enter = отменяем отправку форм где-либо
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.preventDefault();
      });
    }
  }

  // ---- Data load ----
  async loadDefaultFile() {
    try {
      const resp = await fetch('base.xlsx', { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const buf = await resp.arrayBuffer();

      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(ws);

      if (!jsonData.length) throw new Error('Файл пустой или не содержит данных');

      // Проверим необходимые колонки
      const required = ['Наименование', 'Артикул', 'Цена'];
      const firstRow = jsonData[0] || {};
      const missing = required.filter(c => !(c in firstRow));
      if (missing.length) {
        throw new Error(`Отсутствуют колонки: ${missing.join(', ')}`);
      }

      // Прединдексация для быстрого поиска + предформат цены
      this.data = jsonData.map(row => {
        const __name = this.normalizeForFuzzySearch(row['Наименование'] || '');
        const __article = this.normalizeForFuzzySearch(row['Артикул'] || '');
        const __price = this._formatPriceCached(row['Цена']);
        return { ...row, __name, __article, __price };
      });

      // Показать краткую информацию о наборе
      const info = document.getElementById('datasetInfo');
      if (info) {
        info.style.display = 'block';
        info.textContent = `Загружено записей: ${this.data.length}`;
      }

      // Показать поисковый интерфейс
      this.showSearchSection();

    } catch (e) {
      console.error('Загрузка base.xlsx не удалась:', e);
      // Сообщение пользователю
      let hint = 'Не удалось автоматически загрузить base.xlsx. ';
      if (location.hostname.endsWith('github.io')) {
        hint += 'Проверь, что файл лежит рядом с index.html в корне ветки main и Pages указаны на /root.';
      } else if (location.protocol === 'file:') {
        hint += 'Страница открыта как file:// — fetch может быть заблокирован. Открой через http(s).';
      }
      this.showError(`${hint}\nТехническая причина: ${e.message}`);
    }
  }

  // ---- Search ----
  createSearchVariants(query) {
    const q = String(query).toLowerCase().trim();
    const t = this.transliterate(q);
    return t !== q ? [q, t] : [q];
  }

  performSearch() {
    const input = document.getElementById('searchInput');
    const query = (input?.value || '').trim();

    if (!query) {
      this.filteredData = [];
      this._page = 1;
      this.displayResults();
      return;
    }

    const parts = query.split(/\s+/).map(p => this.normalizeForFuzzySearch(p)).filter(Boolean);

    // Быстрый фильтр по прединдексированным полям
    this.filteredData = this.data.filter(item =>
      parts.every(part => item.__name.includes(part) || item.__article.includes(part))
    );

    this._page = 1; // новый поиск — с первой страницы
    this.displayResults();
  }

  // ---- Rendering ----
  displayResults() {
    const resultsSection = document.getElementById('resultsSection');
    const resultsBody = document.getElementById('resultsBody');
    const resultsCount = document.getElementById('resultsCount');
    const noResults = document.getElementById('noResults');
    const query = (document.getElementById('searchInput')?.value || '').trim();

    if (resultsSection) {
      resultsSection.style.display = 'block';
      resultsSection.classList.add('fade-in');
    }

    const total = this.filteredData.length;
    if (total === 0) {
      if (resultsBody) resultsBody.innerHTML = '';
      if (noResults) noResults.style.display = 'block';
      if (resultsCount) resultsCount.textContent = 'Найдено: 0 результатов';
      this._renderShowMore(false);
      return;
    }

    if (noResults) noResults.style.display = 'none';
    const searchVariants = query ? this.createSearchVariants(query) : [];

    const end = Math.min(this._page * this._pageSize, total);
    const slice = this.filteredData.slice(0, end);

    if (resultsBody) {
      // если результатов очень много — отключим подсветку для ускорения
      const tooMany = total > 5000;
      resultsBody.innerHTML = slice.map(item => `
        <tr>
          <td>${tooMany ? (item['Наименование'] || '') : this.highlightMatches(item['Наименование'] || '', searchVariants)}</td>
          <td>${tooMany ? (item['Артикул'] || '') : this.highlightMatches(item['Артикул'] || '', searchVariants)}</td>
          <td class="text-price">${item.__price}</td>
        </tr>
      `).join('');
    }

    if (resultsCount) {
      resultsCount.textContent = `Показаны: ${slice.length} из ${total}`;
    }

    this._renderShowMore(end < total);
  }

  _renderShowMore(show) {
    const footer = document.getElementById('resultsShowMore');
    if (!footer) return;

    if (!show) {
      footer.innerHTML = '';
      return;
    }

    footer.innerHTML = `<button class="btn btn--primary" id="showMoreBtn">Показать ещё ${this._pageSize}</button>`;
    const btn = document.getElementById('showMoreBtn');
    if (btn) {
      btn.onclick = () => {
        this._page += 1;
        // Дадим браузеру такт между рендерами
        setTimeout(() => this.displayResults(), 0);
      };
    }
  }

  // ---- Formatting ----
  _formatPriceCached(price) {
    if (price === null || price === undefined || price === '') return '—';
    const num = parseFloat(price);
    if (Number.isNaN(num)) return String(price);
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(num);
  }

  highlightMatches(text, searchVariants) {
    if (!text || !searchVariants.length) return text;
    let result = String(text);
    const norm = String(text).toLowerCase();
    searchVariants.forEach(variant => {
      const re = new RegExp(`(${this.escapeRegExp(variant)})`, 'gi');
      if (norm.includes(variant.toLowerCase())) {
        result = result.replace(re, '<span class="highlight">$1</span>');
      }
    });
    return result;
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  new PriceListSearchApp();
});



