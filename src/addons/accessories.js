(function () {
  // Простая проверка, что App уже есть
  function getBaseData() {
    return (window.App && Array.isArray(window.App.data)) ? window.App.data : [];
  }

  const Accessories = {
    _acsMap: null,
    _baseIndex: null,
    _loadingPromise: null,

    async _ensureLoaded() {
      if (this._loadingPromise) return this._loadingPromise;
      this._loadingPromise = this._loadAll();
      return this._loadingPromise;
    },

    async _loadAll() {
      // Индекс по base.csv: артикул -> запись
      const base = getBaseData();
      const baseIndex = new Map();
      for (const row of base) {
        const sku = (row['Артикул'] || '').trim();
        if (!sku) continue;
        baseIndex.set(sku, row);
      }
      this._baseIndex = baseIndex;

      // Загрузка acs.csv
      // Формат строки: baseSku;acc1|acc2|acc3...
      const resp = await fetch('src/addons/csv/acs.csv', { cache: 'no-store' });
      if (!resp.ok) {
        console.warn('acs.csv load error:', resp.status, resp.statusText);
        this._acsMap = new Map();
        return;
      }
      const text = await resp.text();
      const lines = text.split(/\r?\n/);

      const map = new Map();

      for (const lineRaw of lines) {
        const line = lineRaw.trim();
        if (!line) continue;
        const parts = line.split(';');
        if (parts.length < 2) continue;
        const baseSku = parts[0].trim();
        if (!baseSku) continue;

        const accStr = parts[1].trim();
        if (!accStr) continue;
        const accList = accStr.split('|')
          .map(s => s.trim())
          .filter(Boolean);

        if (!accList.length) continue;
        map.set(baseSku, accList);
      }

      this._acsMap = map;
    },

    /**
     * Основной метод, вызываемый из app.js
     * menu  – элемент UL.docs-menu
     * opts  – { art, docs, tips }
     */
    async enhanceDocsMenu(menu, opts) {
      if (!menu || !menu.classList || !menu.classList.contains('docs-menu')) return;

      const art = (opts && opts.art ? String(opts.art).trim() : '');
      if (!art) return;

      await this._ensureLoaded();

      if (!this._acsMap || !this._acsMap.size) return;

      const accSkus = this._acsMap.get(art);
      if (!accSkus || !accSkus.length) {
        // Для позиций без аксессуаров вкладок не делаем – меню останется как есть
        return;
      }

      // Создаём структуру вкладок только один раз на меню
      if (menu._acsEnhanced) return;
      menu._acsEnhanced = true;

      const modal = menu.querySelector('.docs-modal') || menu.firstElementChild;
      if (!modal) return;

      const header = modal.querySelector('.dm-header');
      const body = modal.querySelector('.dm-body');
      if (!header || !body) return;

      // Оборачиваем текущий контент body в pane "Документы"
      const docsPane = document.createElement('div');
      docsPane.className = 'dm-pane dm-pane--docs';
      while (body.firstChild) {
        docsPane.appendChild(body.firstChild);
      }
      body.appendChild(docsPane);

      // Строим pane "Аксессуары"
      const accPane = document.createElement('div');
      accPane.className = 'dm-pane dm-pane--accs';
      accPane.hidden = true;
      accPane.innerHTML = this._renderAccessoriesList(accSkus);
      body.appendChild(accPane);

      // Добавляем переключатели вкладок в заголовок
      const tabs = document.createElement('div');
      tabs.className = 'dm-tabs';
      tabs.innerHTML = `
        <button type="button" class="dm-tab dm-tab--active" data-tab="docs">Документы</button>
        <button type="button" class="dm-tab" data-tab="accs">Аксессуары</button>
      `;
      header.appendChild(tabs);

      // Обработчики переключения вкладок
      tabs.addEventListener('click', e => {
        const btn = e.target.closest('.dm-tab');
        if (!btn) return;
        const tab = btn.dataset.tab;

        tabs.querySelectorAll('.dm-tab').forEach(b => {
          b.classList.toggle('dm-tab--active', b === btn);
        });

        docsPane.hidden = tab !== 'docs';
        accPane.hidden = tab !== 'accs';
      });

      // Копирование по ЛКМ по наименованию аксессуара
      accPane.addEventListener('click', async e => {
        const el = e.target.closest('.js-acc-copy');
        if (!el) return;
        const name = (el.dataset.name || '').trim();
        const sku = (el.dataset.sku || '').trim();
        if (!name || !sku) return;

        const tsv = `${name}\t${sku}`;

        try {
          await navigator.clipboard.writeText(tsv);
          const prev = el.getAttribute('title') || '';
          el.setAttribute('title', 'Скопировано');
          setTimeout(() => el.setAttribute('title', prev), 800);
        } catch (err) {
          console.warn('Clipboard error (accessories):', err);
        }
      });

      // Инициализация тултипов по наличию
      if (window.bootstrap && window.bootstrap.Tooltip) {
        accPane.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
          const t = window.bootstrap.Tooltip.getInstance(el);
          if (t) t.dispose();
          new window.bootstrap.Tooltip(el, { placement: 'top' });
        });
      }
    },

    _renderAccessoriesList(accSkus) {
      const baseIndex = this._baseIndex || new Map();

      const items = [];
      for (const sku of accSkus) {
        const accSku = (sku || '').trim();
        if (!accSku) continue;

        const baseItem = baseIndex.get(accSku) || null;
        const name = baseItem ? (baseItem['Наименование'] || '').trim() : '';
        if (!name) continue; // если нет в базе, пропускаем

        const qty = baseItem && typeof baseItem.__qty === 'number' ? baseItem.__qty : 0;
        const inStock = qty > 0;
        const isWithdrawn = baseItem && baseItem.__withdrawn === true;

        let hint;
        if (isWithdrawn) {
          hint = 'Выведен из ассортимента';
        } else if (inStock) {
          hint = `В наличии ${qty} шт`;
        } else {
          hint = 'Нет в наличии';
        }

        items.push({
          sku: accSku,
          name,
          inStock,
          isWithdrawn,
          hint
        });
      }

      if (!items.length) {
        return `<div class="dm-empty">Аксессуаров не найдено</div>`;
      }

      const rows = items.map(it => {
        const nameEsc = this._escape(it.name);
        const skuEsc = this._escape(it.sku);
        const hintEsc = this._escape(it.hint);

        const stockClass = it.isWithdrawn
          ? 'dm-acc-art--withdrawn'
          : (it.inStock ? 'dm-acc-art--stock' : 'dm-acc-art--empty');

        const tooltipAttrs = window.bootstrap
          ? `data-bs-toggle="tooltip" data-bs-title="${hintEsc}"`
          : `title="${hintEsc}"`;

        return `
          <li class="dm-acc">
            <span class="dm-acc-name js-acc-copy"
                  data-name="${nameEsc}"
                  data-sku="${skuEsc}"
                  title="ЛКМ — скопировать наименование и артикул">
              ${nameEsc}
            </span>
            <span class="dm-acc-art ${stockClass}"
                  ${tooltipAttrs}>
              ${skuEsc}
            </span>
          </li>
        `;
      }).join('');

      return `
        <div class="dm-section">
          <div class="dm-section-title">Аксессуары</div>
          <ul class="dm-acc-list">
            ${rows}
          </ul>
        </div>
      `;
    },

    _escape(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  };

  window.Accessories = Accessories;
})();

