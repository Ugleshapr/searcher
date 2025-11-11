import { Normalizer } from './modules/core/Normalizer.js';
import { DataLoader } from './modules/core/DataLoader.js';
import { SearchEngine } from './modules/core/SearchEngine.js';
import { TableRenderer } from './modules/ui/TableRenderer.js';
import { debounce } from './modules/utils/helpers.js';
import { RANK_RULES, PAGE_SIZE, APP_VERSION } from './modules/utils/constants.js';

class PriceListSearchApp {
  constructor() {
    // Инициализация модулей
    this.normalizer = new Normalizer();
    this.dataLoader = new DataLoader(this.normalizer);
    this.searchEngine = new SearchEngine(this.normalizer, RANK_RULES);
    this.tableRenderer = new TableRenderer(this.normalizer);

    // Состояние
    this.data = [];
    this.filteredData = [];
    this._page = 1;
    this._pageSize = PAGE_SIZE;

    this.initializeEventListeners();
    this.loadDefaultFile();
  }

  async loadDefaultFile() {
    try {
      this.data = await this.dataLoader.loadCSV('base.csv');
      this._updateInfoTooltip();
      this.showSearchSection();
      this._fitResultsHeight();

      // Проверка на reload
      const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      const isReload = nav ? nav.type === 'reload' : performance.navigation && performance.navigation.type === 1;

      if (isReload) {
        const input = document.getElementById('searchInput');
        if (input) input.value = '';
        this.filteredData = [];
        this._page = 1;
        this.displayResults();
      } else {
        document.dispatchEvent(new CustomEvent('results:rendered'));
      }
    } catch (e) {
      console.error('Загрузка base.csv не удалась:', e);
      this.showError(`Не удалось загрузить base.csv\n${e.message}`);
    }
  }

  performSearch() {
    const query = (document.getElementById('searchInput')?.value || '').trim();
    
    if (!query) {
      this.filteredData = [];
      this._page = 1;
      this.displayResults();
      return;
    }

    this.filteredData = this.searchEngine.search(this.data, query);
    this._page = 1;
    this.displayResults();
  }

  displayResults() {
    const query = (document.getElementById('searchInput')?.value || '').trim();
    const qAliased = this.normalizer.applyUZAliases(query);
    
    let highlightTokens = qAliased
      .split(/[^a-zA-Zа-яА-ЯёЁ0-9/]+/)
      .filter(Boolean)
      .filter(tok => this.normalizer.normalizeForFuzzySearch(tok).length >= 2)
      .slice(0, 18)
      .map(tok => this.normalizer.buildHomoglyphRegexToken(tok.slice(0, 64)));

    const hasMore = this.tableRenderer.render(
      this.filteredData, 
      this._page, 
      this._pageSize, 
      highlightTokens
    );

    this._renderShowMore(hasMore);
    this._fitResultsHeight();
    
    document.dispatchEvent(new CustomEvent('results:rendered'));
  }

  _renderShowMore(show) {
    const footer = document.getElementById('resultsShowMore');
    if (!footer) return;
    
    if (document.body.classList.contains('is-filter-mode')) show = false;
    
    if (!show) {
      footer.innerHTML = '';
      return;
    }
    
    footer.innerHTML = `<button class="btn btn--primary" id="showMoreBtn">Показать ещё ${this._pageSize}</button>`;
    document.getElementById('showMoreBtn').onclick = () => {
      this._page += 1;
      setTimeout(() => this.displayResults(), 0);
    };
  }

  initializeEventListeners() {
    const input = document.getElementById('searchInput');
    const debounced = debounce(() => this.performSearch(), 200);
    
    if (input) {
      input.addEventListener('input', debounced);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') e.preventDefault();
      });
    }

    // Остальные обработчики (копирование, очистка, resize и т.д.)
    this._setupTableEvents();
    this._setupClearButton();
    this._setupResizeHandlers();
  }

  _setupTableEvents() {
    const tbody = document.getElementById('resultsBody');
    if (!tbody) return;

    // Клик по ячейке для копирования
    tbody.addEventListener('click', async e => {
      const cell = e.target.closest('td.copyable');
      if (!cell) return;

      if (window.CopyMode && window.CopyMode.isOn && window.CopyMode.isOn()) {
        e.preventDefault();
        window.CopyMode.toggleFromCell(cell);
        return;
      }

      const rawName = (cell.getAttribute('data-name') || '').trim();
      const article = (cell.getAttribute('data-sku') || '').trim();

      if (!rawName || !article) return;

      const tsv = `${rawName}\t${article}`;
      try {
        await navigator.clipboard.writeText(tsv);
        const prev = cell.getAttribute('title') || '';
        cell.setAttribute('title', 'Скопировано');
        setTimeout(() => cell.setAttribute('title', prev), 800);
      } catch (err) {
        console.warn('Clipboard error:', err);
      }
    });

    // Двойной клик по info кнопке
    tbody.addEventListener('dblclick', e => {
      const btn = e.target.closest('.info-circle');
      if (!btn) return;

      const row = btn.closest('tr');
      let art = (btn.dataset.article || '').trim();
      if (!art && row) {
        const artCell = row.children[1];
        if (artCell) art = artCell.textContent.trim();
      }

      let rawName = '';
      if (row) {
        const nameCell = row.children[0];
        if (nameCell) {
          rawName = (nameCell.getAttribute('data-name') || nameCell.textContent || '').trim();
        }
      }

      if (!art) return;

      const url = `product/product.html?art=${encodeURIComponent(art)}&name=${encodeURIComponent(rawName)}`;
      window.open(url, '_blank', 'noopener');
    });
  }

  _setupClearButton() {
    const inputEl = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');

    const toggleClear = () => {
      inputEl.parentElement.classList.toggle('has-value', !!inputEl.value.trim());
    };

    inputEl.addEventListener('input', toggleClear);
    toggleClear();

    const doClear = () => {
      if (!inputEl) return;
      if (document.body.classList.contains('is-filter-mode')) return;
      if (!inputEl.value) return;
      inputEl.value = '';
      toggleClear();
      this._page = 1;
      this.performSearch();
      inputEl.focus();
    };

    clearBtn?.addEventListener('click', doClear);

    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Escape' && inputEl.value) {
        e.preventDefault();
        doClear();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.modal.show')) return;
      if (document.querySelector('.dropdown.show') || document.querySelector('.dropdown-menu[data-portal="1"]')) return;

      const ae = document.activeElement;
      const isOtherTextField = ae && ae !== inputEl && 
        ((ae.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color', 'hidden'].includes(ae.type)) ||
         ae.tagName === 'TEXTAREA' || ae.isContentEditable);
      
      if (isOtherTextField) return;
      if (document.body.classList.contains('is-filter-mode')) return;
      
      e.preventDefault();
      doClear();
    });
  }

  _setupResizeHandlers() {
    const fit = debounce(this._fitResultsHeight.bind(this), 50);
    window.addEventListener('resize', fit, { passive: true });
    window.addEventListener('orientationchange', fit);
    this._fitResultsHeight();
  }

  _fitResultsHeight() {
    const box = document.querySelector('#resultsSection .table-responsive');
    if (!box) return;

    const gap = 24;
    const top = box.getBoundingClientRect().top;
    let h = window.innerHeight - top - gap;
    h = Math.max(320, Math.min(h, Math.floor(window.innerHeight * 0.92)));

    box.style.maxHeight = h + 'px';
    box.style.overflowY = 'auto';
  }

  _updateInfoTooltip() {
    const host = document.getElementById('datasetInfo');
    if (!host) return;

    host.style.display = 'inline-flex';

    if (!host.querySelector('#helpLink')) {
      host.insertAdjacentHTML('beforeend', `<button type="button" id="helpLink" class="info-circle" title="Открыть справку">?</button>`);
      const help = host.querySelector('#helpLink');
      help?.addEventListener('click', () => {
        window.open('https://forms.yandex.ru/u/68dfc48bd046883763799290', '_blank', 'noopener');
      });
    }

    if (!host.querySelector('#dataInfo')) {
      host.insertAdjacentHTML('beforeend', `<button type="button" id="dataInfo" class="info-circle" data-bs-toggle="tooltip" data-bs-html="true" data-bs-placement="top" title="">i</button>`);
    }

    const el = host.querySelector('#dataInfo');
    const total = Array.isArray(this.data) ? this.data.length : 0;
    const html = `Загружено записей: <b>${total.toLocaleString('ru-RU')}</b><br>Номер версии: <b>${APP_VERSION}</b>`;
    el?.setAttribute('data-bs-title', html);
    el?.setAttribute('title', '');

    if (el && window.bootstrap?.Tooltip) {
      const t = window.bootstrap.Tooltip.getInstance(el);
      if (t) t.dispose();
      new window.bootstrap.Tooltip(el, { html: true, sanitize: false, placement: 'top' });
    }
  }

  showSearchSection() {
    document.getElementById('searchSection').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'block';
  }

  showError(message) {
    const modal = new bootstrap.Modal(document.getElementById('errorModal'));
    document.getElementById('errorMessage').textContent = message;
    modal.show();
  }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  window.App = new PriceListSearchApp();
  
  // Вызов функций setup из других аддонов (если есть)
  if (typeof setupFilterAddon === 'function') setupFilterAddon();
});

