import { escapeHTML, pluralRu } from '../utils/helpers.js';

export class TableRenderer {
  constructor(normalizer) {
    this.normalizer = normalizer;
  }

  render(results, page, pageSize, highlightTokens = []) {
    const resultsBody = document.getElementById('resultsBody');
    const resultsCount = document.getElementById('resultsCount');
    const banner = document.getElementById('stateBanner');

    const total = results.length;

    if (total === 0) {
      this._showEmptyState(resultsBody, banner);
      return;
    }

    if (banner) banner.style.display = 'none';

    const end = Math.min(page * pageSize, total);
    const slice = results.slice(0, end);

    const tooMany = total > 5000;
    const rowsHtml = slice
      .map(item => this._renderRow(item, highlightTokens, tooMany))
      .join('');

    resultsBody.innerHTML = rowsHtml;
    resultsCount.textContent = `Показаны: ${slice.length} из ${total}`;

    this._initializeTooltips();

    return end < total;
  }

  _renderRow(item, highlightTokens, tooMany) {
    const nameSafe = escapeHTML(item['Наименование'] || '');
    const artSafe = escapeHTML(item['Артикул'] || '');

    const nameHtml =
      tooMany || !highlightTokens.length
        ? nameSafe
        : this._highlightText(nameSafe, highlightTokens);

    const artHtml =
      tooMany || !highlightTokens.length
        ? artSafe
        : this._highlightText(artSafe, highlightTokens);

    const docs = item.__docs || [];
    const docsHtml = this._renderDocs(docs, item);

    const priceHtml = this._renderPrice(item);
    const infoBtn = this._renderInfoBtn(item);

    return `
      <tr data-sku="${escapeHTML(item['Артикул'] || '')}">
        <td class="copyable"
            data-name="${escapeHTML(item['Наименование'] || '')}"
            data-sku="${escapeHTML(item['Артикул'] || '')}"
            title="ЛКМ — ${window.CopyMode?.isOn && window.CopyMode.isOn() ? 'добавить/убрать из списка' : 'скопировать'}">
          ${nameHtml}<span class="copy-badge" style="display:none">в списке</span>
        </td>
        <td>${artHtml}</td>
        <td class="text-price">
          <div class="price-cell">
            ${priceHtml}
            ${infoBtn}
          </div>
        </td>
        <td class="col-docs">${docsHtml}</td>
      </tr>
    `;
  }

  _renderPrice(item) {
    const q = item.__qty || 0;
    const inStock = q > 0;
    const isWithdrawn = item.__withdrawn === true;

    const hint = isWithdrawn
      ? 'Выведен из ассортимента'
      : inStock
        ? `В наличии ${q} ${pluralRu(q)}`
        : 'Нет в наличии';

    const priceText = isWithdrawn ? 'Выведен' : item.__price;
    const priceClass = isWithdrawn
      ? 'is-withdrawn'
      : inStock
        ? 'is-stock'
        : 'is-empty';

    const dropdownId = `dd-${Math.random().toString(36).substring(2, 9)}`;

    return `
      <div class="dropdown"
           ${window.bootstrap ? 'data-bs-toggle="tooltip"' : ''}
           ${window.bootstrap ? 'data-bs-title="' + escapeHTML(hint) + '"' : 'title="' + escapeHTML(hint) + '"'}>
        <span class="price-tag ${priceClass}"
              role="button"
              data-bs-toggle="dropdown"
              data-bs-target="#${dropdownId}"
              data-bs-auto-close="true"
              aria-expanded="false"
              aria-label="${escapeHTML(hint)}">
          ${priceText}
        </span>
        <div class="dropdown-menu price-menu" id="${dropdownId}">
          <div class="price-menu-content">
            <input type="number" class="price-menu-input" value="1" min="1" max="9999">
            <span class="price-menu-arrow">→</span>
            <div class="price-menu-placeholder"></div>
            <button type="button" class="price-menu-btn" title="Поиск">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderInfoBtn(item) {
    const artRaw = item['Артикул'] || '';
    const hasFeat = !!item.__featHtml;

    if (hasFeat) {
      return `
        <button type="button"
                class="info-circle feat-info"
                data-article="${escapeHTML(artRaw)}"
                data-bs-toggle="popover"
                data-bs-html="true"
                data-bs-placement="top"
                data-bs-content="${item.__featHtml}"
                title="Характеристики">i</button>
      `;
    } else {
      return `
        <button type="button"
                class="info-circle feat-info is-disabled"
                data-article="${escapeHTML(artRaw)}"
                title="Открыть страницу товара (двойной клик)">i</button>
      `;
    }
  }

  _renderDocs(docs, item) {
    if (!docs.length) return '—';

    const docsData = encodeURIComponent(JSON.stringify(docs));
    const nameForTips = (item['Наименование'] || '').trim();
    const artRaw = (item['Артикул'] || '').trim();

    return `
      <div class="dropdown">
        <button type="button"
                class="btn btn--outline btn--sm docs-btn"
                data-bs-toggle="dropdown"
                data-bs-auto-close="outside"
                aria-expanded="false"
                title="Документы">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
               viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 4l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h5z" fill="currentColor"/>
          </svg>
        </button>
        <ul class="dropdown-menu dropdown-menu-end docs-menu"
            data-name="${escapeHTML(nameForTips)}"
            data-art="${escapeHTML(artRaw)}"
            data-docs="${docsData}">
          <li class="px-3 py-2 text-muted">Загрузка…</li>
        </ul>
      </div>
    `;
  }

  _highlightText(escapedText, tokenPatterns) {
    if (!escapedText || !tokenPatterns.length) return escapedText;
    const uniq = [...new Set(tokenPatterns)].sort(
      (a, b) => b.length - a.length
    );
    const re = new RegExp(`(${uniq.join('|')})`, 'gi');
    return escapedText.replace(re, '<span class="highlight">$1</span>');
  }

  _showEmptyState(resultsBody, banner) {
    resultsBody.innerHTML = '';

    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) resultsCount.textContent = 'Найдено: 0 результатов';

    if (document.body.classList.contains('is-filter-mode')) {
      this._renderFilterEmptyRow(resultsBody);
      if (banner) banner.style.display = 'none';
      return;
    }

    const rawQuery = (
      document.getElementById('searchInput')?.value || ''
    ).trim();
    const isEmptyQuery = rawQuery.length === 0;

    if (banner) {
      const titleEl = document.getElementById('stateBannerTitle');
      const hintEl = document.getElementById('stateBannerHint');

      if (isEmptyQuery) {
        banner.className = 'no-results no-results--empty text-center py-4';
        if (titleEl) titleEl.textContent = 'Введите текст для поиска';
        if (hintEl) hintEl.textContent = '';
      } else {
        banner.className = 'no-results text-center py-4';
        if (titleEl)
          titleEl.textContent = 'По вашему запросу ничего не найдено';
        if (hintEl)
          hintEl.textContent =
            'Попробуйте изменить условия поиска или проверьте правописание';
      }
      banner.style.display = 'block';
    }
  }

  _renderFilterEmptyRow(resultsBody) {
    const cols = document.body.classList.contains('is-filter-mode') ? 3 : 4;
    resultsBody.innerHTML = `
      <tr class="table-empty-row">
        <td colspan="${cols}">По выбранным фильтрам ничего не найдено</td>
      </tr>
    `;
  }

  _initializeTooltips() {
    if (!window.bootstrap?.Tooltip) return;

    // Убираем старые Tooltips на .feat-info (если где-то остались)
    document.querySelectorAll('.feat-info').forEach(el => {
      const tt = window.bootstrap.Tooltip?.getInstance?.(el);
      tt?.dispose();
    });

    // Поповеры для характеристик (ТОЛЬКО кнопки .feat-info без .is-disabled)
    document.querySelectorAll('.feat-info:not(.is-disabled)').forEach(el => {
      const pop = window.bootstrap.Popover.getInstance(el);
      if (pop) pop.dispose();
      new window.bootstrap.Popover(el, {
        html: true,
        sanitize: false,
        placement: 'top',
        trigger: 'click',
        container: 'body',
      });
    });

    // Тултипы для цен (теперь на .dropdown обертке)
    document
      .querySelectorAll('.dropdown[data-bs-toggle="tooltip"]')
      .forEach(el => {
        const t = window.bootstrap.Tooltip.getInstance(el);
        if (t) t.dispose();

        const tt = new window.bootstrap.Tooltip(el, {
          html: false,
          placement: 'top',
          trigger: 'hover',
        });

        // Отключаем тултип при открытии dropdown внутри
        const btn = el.querySelector('[data-bs-toggle="dropdown"]');
        if (btn) {
          btn.addEventListener('show.bs.dropdown', () => {
            tt.disable();
            tt.hide();
          });
          btn.addEventListener('hidden.bs.dropdown', () => {
            tt.enable();
          });
        }
      });

    // Глобальные хендлеры ТОЛЬКО для поповеров .feat-info
    if (!window.__featPopoverGlobalHandlersAttached) {
      window.__featPopoverGlobalHandlersAttached = true;

      const hideAllFeatPopovers = () => {
        if (!window.bootstrap?.Popover) return;
        document.querySelectorAll('.feat-info').forEach(el => {
          const inst = window.bootstrap.Popover.getInstance(el);
          if (inst) inst.hide();
        });
      };

      // Клик по документу:
      //  - НЕ закрываем, если клик по самой .feat-info
      //  - НЕ закрываем, если клик внутри .popover
      //  - иначе закрываем все поповеры характеристик
      document.addEventListener('click', e => {
        const target = e.target;

        // клик по "i" — отрабатывает сам Bootstrap (toggle), не мешаем
        if (target.closest('.feat-info')) return;

        // клик внутри любого popover — не закрываем характеристики,
        // чтобы можно было выделять/копировать текст
        if (target.closest('.popover')) return;

        hideAllFeatPopovers();
      });

      // Любой скролл (внутри таблицы, страницы и т.д.) закрывает только поповеры характеристик
      document.addEventListener(
        'scroll',
        () => {
          hideAllFeatPopovers();
        },
        { passive: true, capture: true }
      );
    }
  }
}
