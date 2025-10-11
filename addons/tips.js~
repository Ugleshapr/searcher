/* ===== addons/tips.js ===== */
;(() => {
  const CSV_URL = 'addons/Akkumuliator viki.csv'; // как договорились
  const DELIM = ';';

  // Глобальный неймспейс
  const Tips = {
    _loaded: false,
    _map: null,        // Map<TAG -> [tip, ...]>
    _memo: new Map(),  // Map<nameHash -> [tip, ...]>

    // Публично: получить подсказки для конкретного "наименования"
    async getForName(name, canonizer /* optional function */) {
      await this._ensureLoaded();
      const key = this._hash(name);
      if (this._memo.has(key)) return this._memo.get(key);

      const nd = (canonizer ? canonizer(name) : name).toUpperCase();
      const res = [];
      // матч по "словам": не допускаем склейку внутри других слов
      const makeRe = (tag) => new RegExp(`(^|[^A-ZА-Я0-9])${this._escape(tag)}(?=$|[^A-ZА-Я0-9])`, 'i');

      for (const [tag, items] of this._map.entries()) {
        if (makeRe(tag).test(nd)) res.push(...items);
      }

      // Сортировка по алфавиту (название заметки)
      res.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru', {sensitivity: 'base'}));
      this._memo.set(key, res);
      return res;
    },

    // Публично: построить HTML содержимое "Документы" (главный экран)
    renderIndex({ links = [], tips = [] }) {
      const linksHTML = links.length
        ? `<ul class="dm-links">${links.map(Tips._renderLinkItem).join('')}</ul>`
        : `<div class="dm-empty">Ссылок нет</div>`;

      const tipsHTML = tips.length
        ? `<ul class="dm-tips-list">
            ${tips.map((t, i) => `
              <li class="dm-tip" data-tip-idx="${i}">
                <div class="dm-tip-title">${Tips._esc(t.title || 'Без названия')}</div>
              </li>`).join('')}
           </ul>`
        : '';

      const tipsSection = tipsHTML
        ? `<section class="dm-section dm-tips">
             <div class="dm-section-title">Подсказки</div>
             ${tipsHTML}
           </section>`
        : '';

      // Заголовок "Документы", кнопка Назад скрыта
      return `
        <div class="docs-modal">
          <div class="dm-header">
            <button class="dm-back" type="button" hidden title="Назад">⟵</button>
            <div class="dm-title">Документы</div>
          </div>
          <div class="dm-body">
            <section class="dm-section">
              <div class="dm-section-title">Ссылки</div>
              ${linksHTML}
            </section>
            ${tipsSection}
          </div>
        </div>`;
    },

    // Публично: включить поведение внутри контейнера меню
    bindIndex(container, tips, { onOpenDetail }) {
      // Клик по подсказке => детальный режим
      container.addEventListener('click', (e) => {
        const el = e.target.closest('.dm-tip');
        if (!el) return;
        const idx = Number(el.dataset.tipIdx);
        const tip = tips[idx];
        onOpenDetail(tip);
      }, { once: false });
    },

    // Публично: отрисовать "детальный" экран подсказки
    renderDetail(tip) {
      const textHTML = tip.note
        ? `<div class="dm-note js-copy-on-click" title="Кликните, чтобы скопировать">
             ${Tips._esc(tip.note).replace(/\n/g, '<br>')}
           </div>`
        : `<div class="dm-note dm-empty">Текст отсутствует</div>`;

      const links = tip.urls || [];
      const linksHTML = links.length
        ? `<div class="dm-detail-links">
             ${links.map((u) => Tips._renderDetailLink(u)).join('')}
           </div>`
        : '';

      return `
        <div class="docs-modal">
          <div class="dm-header">
            <button class="dm-back" type="button" title="Назад">⟵</button>
            <div class="dm-title">${Tips._esc(tip.title || 'Подсказка')}</div>
          </div>
          <div class="dm-body">
            ${textHTML}
            ${linksHTML}
          </div>
        </div>`;
    },

    // Публично: поведение в детальном экране
    bindDetail(container) {
      // Копирование текста заметки
      container.addEventListener('click', async (e) => {
        const el = e.target.closest('.js-copy-on-click');
        if (!el) return;
        const plain = el.innerText.replace(/\s+\n/g, '\n').trim();
        try {
          await navigator.clipboard.writeText(plain);
          Tips._flash(el, 'Скопировано');
        } catch {
          Tips._flash(el, 'Не удалось скопировать');
        }
      }, { once: false });
    },

    /* ---------- внутренности ---------- */

    async _ensureLoaded() {
      if (this._loaded) return;
      await this._ensurePapa();
      const resp = await fetch(CSV_URL, { cache: 'no-cache' });
      const text = await resp.text();
      const parsed = window.Papa.parse(text, { header: true, delimiter: DELIM, skipEmptyLines: true });

      const map = new Map();
      for (const row of parsed.data || []) {
        const rawTags = (row['Укажите тэг продукции'] || '').trim();
        if (!rawTags) continue;

        const tags = rawTags.split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .map(s => s.toUpperCase());

        const urls = Tips._extractUrls(row['Приложите файл если это необходимо вам']);
        const tip = {
          title: (row['Укажите тему заметки'] || '').trim(),
          note:  (row['Напишите саму заметку'] || '').trim(),
          urls
        };
        for (const t of tags) {
          if (!map.has(t)) map.set(t, []);
          map.get(t).push(tip);
        }
      }
      this._map = map;
      this._loaded = true;
    },

    async _ensurePapa() {
      if (window.Papa) return;
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
    },

    _extractUrls(cell) {
      const s = (cell || '').trim();
      if (!s) return [];
      // Надёжно: вытащим все http/https URL
      const rx = /\bhttps?:\/\/[^\s<>")]+/gi;
      return (s.match(rx) || []).map(u => u.trim());
    },

    _renderLinkItem(href) {
      const label = Tips._linkLabel(href);
      const safeHref = Tips._esc(href);
      const safeLabel = Tips._esc(label);
      return `<li><a class="dm-link" href="${safeHref}" target="_blank" rel="noopener">${safeLabel}</a></li>`;
    },

    _renderDetailLink(href) {
      const label = Tips._fileShortLabel(href);
      const safeHref = Tips._esc(href);
      const safeLabel = Tips._esc(label);
      return `<a class="dm-file" href="${safeHref}" target="_blank" rel="noopener">${safeLabel}</a>`;
    },

    _linkLabel(href) {
      // Для списка "Ссылки" оставим человекочитаемый короткий вид:
      // сначала пытаемся извлечь имя файла из параметра path, иначе хвост pathname.
      const p = Tips._fileShortLabel(href);
      return p || href;
    },

    _fileShortLabel(href) {
      try {
        const u = new URL(href);
        const sp = new URLSearchParams(u.search);
        const path = sp.get('path');
        if (path) {
          const decoded = decodeURIComponent(path);
          const name = decoded.split('/').filter(Boolean).pop();
          if (name) return name;
        }
        // fallback — взять последнее из pathname
        const tail = u.pathname.split('/').filter(Boolean).pop();
        return tail || 'File';
      } catch {
        return 'File';
      }
    },

    _esc(s) {
      return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    },
    _escape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); },
    _hash(s) { let h = 9; for (let i=0;i<s.length;i++) h = Math.imul(h ^ s.charCodeAt(i), 9**9); return (h^=h>>>9)>>>0; },

    _flash(el, text) {
      const n = document.createElement('div');
      n.className = 'dm-toast';
      n.textContent = text;
      el.appendChild(n);
      setTimeout(() => n.classList.add('show'), 0);
      setTimeout(() => { n.classList.remove('show'); n.remove(); }, 1200);
    }
  };

  window.Tips = Tips;
})();

