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
    const rowsHtml = slice.map(item => this._renderRow(item, highlightTokens, tooMany)).join('');

    resultsBody.innerHTML = rowsHtml;
    resultsCount.textContent = `Показаны: ${slice.length} из ${total}`;
    
    this._initializeTooltips();
    
    return end < total;
  }

  _renderRow(item, highlightTokens, tooMany) {
    const nameSafe = escapeHTML(item['Наименование'] || '');
    const artSafe = escapeHTML(item['Артикул'] || '');
    
    const nameHtml = tooMany || !highlightTokens.length 
      ? nameSafe 
      : this._highlightText(nameSafe, highlightTokens);
    
    const artHtml = tooMany || !highlightTokens.length
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
      : (inStock ? `В наличии ${q} ${pluralRu(q)}` : 'Нет в наличии');

    const priceText = isWithdrawn ? 'Выведен' : item.__price;
    const priceClass = isWithdrawn ? 'is-withdrawn' : (inStock ? 'is-stock' : 'is-empty');

    return `
      <span class="price-tag ${priceClass}"
            aria-label="${escapeHTML(hint)}"
            ${window.bootstrap ? 'data-bs-toggle="tooltip"' : 'title="'+escapeHTML(hint)+'"'}
            ${window.bootstrap ? 'data-bs-title="'+escapeHTML(hint)+'"' : ''}>
        ${priceText}
      </span>
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
            data-docs="${docsData}">
          <li class="px-3 py-2 text-muted">Загрузка…</li>
        </ul>
      </div>
    `;
  }

  _highlightText(escapedText, tokenPatterns) {
    if (!escapedText || !tokenPatterns.length) return escapedText;
    const uniq = [...new Set(tokenPatterns)].sort((a, b) => b.length - a.length);
    const re = new RegExp(`(${uniq.join('|')})`, 'gi');
    return escapedText.replace(re, '<span class="highlight">$1</span>');
  }

  _showEmptyState(resultsBody, banner) {
    resultsBody.innerHTML = '';
    
    if (document.body.classList.contains('is-filter-mode')) {
      this._renderFilterEmptyRow(resultsBody);
      if (banner) banner.style.display = 'none';
      return;
    }

    const rawQuery = (document.getElementById('searchInput')?.value || '').trim();
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
        if (titleEl) titleEl.textContent = 'По вашему запросу ничего не найдено';
        if (hintEl) hintEl.textContent = 'Попробуйте изменить условия поиска или проверьте правописание';
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

    // Убираем старые Tooltips
    document.querySelectorAll('.feat-info').forEach(el => {
      const tt = window.bootstrap.Tooltip?.getInstance?.(el);
      tt?.dispose();
    });

    // Поповеры для характеристик
    document.querySelectorAll('.feat-info:not(.is-disabled)').forEach(el => {
      const pop = window.bootstrap.Popover.getInstance(el);
      if (pop) pop.dispose();
      new window.bootstrap.Popover(el, {
        html: true,
        sanitize: false,
        placement: 'top',
        trigger: 'click',
        container: 'body'
      });
    });

    // Тултипы для цен
    document.querySelectorAll('.price-tag[data-bs-toggle="tooltip"]').forEach(el => {
      const t = window.bootstrap.Tooltip.getInstance(el);
      if (t) t.dispose();
      new window.bootstrap.Tooltip(el, { html: false, placement: 'top' });
    });
  }
}

