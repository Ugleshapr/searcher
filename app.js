// Приложение для поиска по Excel прайс-листу (автозагрузка ./base.xlsx)
class PriceListSearchApp {
  constructor() {
    this.data = [];
    this.filteredData = [];
    this._page = 1;
    this._pageSize = 200;

    // Анти-DoS / безопасность
    this.MAX_TOKENS = 18;
    this.MAX_TOKEN_LEN = 64;
    this.MAX_REGEX_TOTAL = 3000;
    this.MAX_XLSX_BYTES = 15 * 1024 * 1024;
    this.MAX_ROWS = 200000;
    this.APP_VERSION =
      document.documentElement.getAttribute('data-app-version') || '—';

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
      ['а','a'],['в','b'],['с','c'],['д','d'],['е','e'],['н','h'],['л','l'],['к','k'],
      ['м','m'],['о','o'],['р','p'],['т','t'],['х','x'],['у','y'],
      ['A','a'],['B','b'],['C','c'],['E','e'],['H','h'],['K','k'],
      ['M','m'],['O','o'],['P','p'],['T','t'],['X','x'],['Y','y'],
      ['А','a'],['В','b'],['С','c'],['Д','d'],['Е','e'],['Н','h'],['Л','L'],['К','k'],
      ['М','m'],['О','o'],['Р','p'],['Т','t'],['Х','x'],['У','y'],
    ]);
    this.homoglyphClass = new Map([
      ['a','[aа]'],['b','[bв]'],['c','[cс]'],['d','[dд]'],['e','[eе]'],
      ['h','[hн]'],['k','[kк]'],['m','[mм]'],['o','[oо]'],
      ['p','[pр]'],['t','[tт]'],['x','[xх]'],['y','[yу]'],
    ]);

    // Правила ранжирования: меняем только эти массивы/списки
    this.rankRules = {
        bonuses: {
    // + за отдельные слова
        wordBonuses: [{ words: ['новый'], score: +1200 }],
  },
        penalties: {
    // - за отдельные слова (границы слова)
        wordPenalties: [
      { words: ['om4','ом4'], score: -700 },
      { words: ['reg','рег'], score: -700 },
    ],
    // - за подстроки (совпадения внутри слова)
        substrPenalties: [
  
  { tokens: ['БЗАВ'], score: -300 },
  { tokens: ['FERRAZ'], score: -300 },
],
    // - за отсутствие документов
        noDocsPenalty: -400,
  }
};




    this.initializeEventListeners();
    // Отключаем подсказки по истории окончательно: делаем уникальное имя поля
    const si = document.getElementById('searchInput');
    if (si) {
      si.setAttribute('autocomplete', 'off'); // дублируем на всякий
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
    return canon.replace(/[^a-z0-9а-яё/]/g, '');
  }

  // Заменяет только слитные "УЗ" → "У3" и "УХЛЗ" → "УХЛ3" (без разделителей)
  _applyUZAliases(str = '') {
    let s = String(str);

    // УХЛЗ как отдельный токен → УХЛ3
    s = s.replace(
      /(^|[^A-Za-zА-Яа-яЁё0-9])ухл[зЗ](?=$|[^A-Za-zА-Яа-яЁё0-9])/gi,
      (_m, pre) => pre + 'ухл3'
    );

    // УЗ как отдельный токен → У3
    s = s.replace(
      /(^|[^A-Za-zА-Яа-яЁё0-9])у[зЗ](?=$|[^A-Za-zА-Яа-яЁё0-9])/gi,
      (_m, pre) => pre + 'у3'
    );

    return s;
  }
  
  // Возвращает целое количество или 0
_parseQty(v) {
  const n = Number(String(v ?? '').replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// Согласование по-русски: 1 штука, 2–4 штуки, 5+ штук
_pluralRu(n, forms = ['штука','штуки','штук']) {
  n = Math.abs(n) % 100; const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

  _updateInfoTooltip() {
  const host = document.getElementById('datasetInfo');
  if (!host) return;

  // 1) гарантированно показать контейнер
  host.style.display = 'inline-flex';

  // 2) если нет "?" — добавим слева
  if (!host.querySelector('#helpLink')) {
    host.insertAdjacentHTML(
  'beforeend',
  `<button type="button" id="helpLink" class="info-circle" title="Открыть справку">?</button>`
);

    // навешиваем клик без inline-скрипта (CSP-friendly)
    const help = host.querySelector('#helpLink');
    help?.addEventListener('click', () => {
      // подставь свою ссылку сюда:
      window.open('https://forms.yandex.ru/u/68dfc48bd046883763799290', '_blank', 'noopener');
    });
  }

  // 3) если нет "i" — добавим справа
  if (!host.querySelector('#dataInfo')) {
    host.insertAdjacentHTML(
      'beforeend',
      `<button type="button"
               id="dataInfo"
               class="info-circle"
               data-bs-toggle="tooltip"
               data-bs-html="true"
               data-bs-placement="top"
               title="">
         i
       </button>`
    );
  }

  // 4) контент тултипа и инициализация Bootstrap
  const el = host.querySelector('#dataInfo');
  const total = Array.isArray(this.data) ? this.data.length : 0;
  const html = `Загружено записей: <b>${total.toLocaleString('ru-RU')}</b><br>Номер версии: <b>${this.APP_VERSION}</b>`;
  el?.setAttribute('data-bs-title', html);
  el?.setAttribute('title', '');

  if (el && window.bootstrap?.Tooltip) {
    const t = window.bootstrap.Tooltip.getInstance(el);
    if (t) t.dispose();
    new window.bootstrap.Tooltip(el, { html: true, sanitize: false, placement: 'top' });
  }
}

  // Подгоняет высоту контейнера таблицы под текущую высоту окна
  _fitResultsHeight() {
    const box = document.querySelector('#resultsSection .table-responsive');
    if (!box) return;

    const gap = 24; // "воздух" снизу под тени/футер
    const top = box.getBoundingClientRect().top;
    let h = window.innerHeight - top - gap;

    // разумные пределы
    h = Math.max(320, Math.min(h, Math.floor(window.innerHeight * 0.92)));

    box.style.maxHeight = h + 'px';
    box.style.overflowY = 'auto';
  }

  transliterate(text) {
    return String(text)
      .toLowerCase()
      .split('')
      .map(c => this.translitMap[c] || c)
      .join('');
  }
  // Подсчёт пересечения символов (с учётом кратности), регистр/кирилл-лат уже нормализованы
  _countCharOverlap(target, query) {
    if (!target || !query) return 0;
    const qmap = new Map();
    for (const ch of query) qmap.set(ch, (qmap.get(ch) || 0) + 1);

    let cnt = 0;
    for (const ch of target) {
      const n = qmap.get(ch);
      if (n > 0) {
        qmap.set(ch, n - 1);
        cnt++;
      }
    }
    return cnt;
  }
  // Канонизация с сохранением разделителей (нижний регистр + омографы, но НЕ выкидываем знаки)
  canonKeepDelims(text) {
    if (!text) return '';
    const lower = String(text).toLowerCase();
    let out = '';
    for (const ch of lower) {
      out += this.homoglyphCanon.has(ch) ? this.homoglyphCanon.get(ch) : ch;
    }
    return out; // пунктуация и пробелы остаются
  }
  escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  _wordRegex(tok) {
  // границы слова: всё, что не буква/цифра — разделитель
  const t = String(tok).trim();
  if (!t) return null;
  return new RegExp(`(^|[^a-zа-яё0-9])${this.escapeRegExp(t)}(?=$|[^a-zа-яё0-9])`, 'i');
}
  _numTokenRegex(tok) {
  // границы: не-цифра слева/справа (или край строки)
  const t = String(tok).trim();
  if (!/^\d+$/.test(t)) return null;
  return new RegExp(`(^|\\D)${this.escapeRegExp(t)}(?!\\d)`, 'i');
}
  _phraseRegexFromParts(parts) {
  // k f 09 30 → k [^a-z0-9]* f [^a-z0-9]* 09 [^a-z0-9]* 30
  const segs = parts.map(p => {
    if (/^\d+$/.test(p)) return this.escapeRegExp(p);
    return this.escapeRegExp(p);
  });
  return new RegExp(segs.join('[^a-z0-9а-яё]*'), 'i');
}

_hasAnyWord(nd, wordList) {
  if (!nd || !wordList?.length) return false;
  for (const w of wordList) {
    const re = this._wordRegex(w);
    if (re && re.test(nd)) return true;
  }
  return false;
}
_applyRankRulesToItem(it, ctx) {
  const { nd, docs } = ctx;               // ← сначала деструктурируем
  const raw = String(ctx.raw || '').toLowerCase();
  const ndLower = String(nd || '').toLowerCase();  // ← теперь тут всё ок
  const rr = this.rankRules;

  // Бонусы за слова
  for (const rule of rr.bonuses.wordBonuses || []) {
    if (this._hasAnyWord(raw, rule.words) || this._hasAnyWord(ndLower, rule.words)) {
      it.__score += rule.score;
    }
  }

  // Штрафы за слова
  for (const rule of rr.penalties.wordPenalties || []) {
    if (this._hasAnyWord(raw, rule.words) || this._hasAnyWord(ndLower, rule.words)) {
      it.__score += rule.score;
    }
  }

  // Штрафы за подстроки
  for (const rule of rr.penalties.substrPenalties || []) {
    for (const tok of rule.tokens) {
      const re = new RegExp(this.escapeRegExp(tok), 'i');
      if (re.test(raw) || re.test(ndLower)) {
        it.__score += rule.score;
        break;
      }
    }
  }

  // (опц.) если brandPenalties больше не используешь — можно удалить блок ниже
  const bp = rr.penalties.brandPenalties;
  if (bp?.list?.length && this._hasAnyWord(ndLower, bp.list)) {
    it.__score += bp.score;
  }

  if (!docs || docs.length === 0) it.__score += rr.penalties.noDocsPenalty;
}


  escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  _featuresToHtml(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  // экранируем HTML, потом заменяем переводы строк/точки с запятой на <br>
  let h = this.escapeHTML(s);
  h = h.replace(/\r?\n/g, '<br>');
  h = h.replace(/;\s*/g, '<br>');
  // лишние <br> по краям — убрать
  h = h.replace(/^(<br>)+|(<br>)+$/g, '');
  return h;
}

  
  // Парсит строку вида: "Каталог ... https://... Руководство ... https://..."
  parseDocs(raw) {
    if (!raw) return [];
    const text = String(raw).replace(/\s+/g, ' ').trim();
    const urls = [...text.matchAll(/https?:\/\/\S+/g)];
    if (!urls.length) return [];

    const docs = [];
    let last = 0,
      n = 1;
    for (const m of urls) {
      const url = m[0];
      // заголовок — текст между предыдущим концом и началом URL
      let title = text.slice(last, m.index).trim();
      // чуть подчистим хвостовую пунктуацию
      title = title
        .replace(/[—–-]+$/, '')
        .replace(/[:;,.\u00A0\s]+$/, '')
        .trim();
      docs.push({ title: title || `Документ ${n}`, url });
      last = m.index + url.length;
      n++;
    }
    return docs;
  }
  debounce(fn, ms = 200) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), ms);
    };
  }

  buildHomoglyphRegexToken(token) {
    let out = '';
    for (const raw of String(token)) {
      const lower = raw.toLowerCase();
      const canon =
        this.homoglyphCanon.get(raw) || this.homoglyphCanon.get(lower) || lower;
      if (this.homoglyphClass.has(canon)) out += this.homoglyphClass.get(canon);
      else if (/[a-z0-9а-яё]/i.test(raw)) out += this.escapeRegExp(raw);
      else out += this.escapeRegExp(raw);
    }
    return out;
  }

  highlightHomoglyphs(escapedText, tokenPatterns) {
    if (!escapedText || !tokenPatterns.length) return escapedText;

    // 1) убираем дубликаты и сортируем по длине, чтобы длинные ловились первыми
    const uniq = [...new Set(tokenPatterns)].sort(
      (a, b) => b.length - a.length
    );

    // 2) один объединённый регэксп вместо N проходов
    const re = new RegExp(`(${uniq.join('|')})`, 'gi');

    // 3) единичная замена — не заденем вставленный <span>
    return escapedText.replace(re, '<span class="highlight">$1</span>');
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
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') e.preventDefault();
      });
    }

    // 1) Копирование "Наименование\tАртикул" по клику на 1-й колонке
    const tbody = document.getElementById('resultsBody');
    if (tbody) {
      tbody.addEventListener('click', async e => {
        const cell = e.target.closest('td.copyable');
        if (!cell) return;
            // COPY mode: вместо мгновенного копирования — переключаем выбранность
    if (window.CopyMode && window.CopyMode.isOn && window.CopyMode.isOn()) {
      e.preventDefault();
      window.CopyMode.toggleFromCell(cell);
      return;
    }


        // Берём из data-* чтобы не тащить скрытый бейдж "в списке"
const rawName = (cell.getAttribute('data-name') || '').trim();
const article = (cell.getAttribute('data-sku')
  || cell.closest('tr')?.getAttribute('data-sku')
  || cell.parentElement?.children?.[1]?.textContent
  || ''
).trim();

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
    }
    // 1) Двойной клик по кнопке "i" — открываем страницу товара с артикулом и названием
if (tbody) {
  tbody.addEventListener('dblclick', e => {
    const btn = e.target.closest('.info-circle');
    if (!btn) return;

    const row = btn.closest('tr');

    // артикул
    let art = (btn.dataset.article || '').trim();
    if (!art && row) {
      const artCell = row.children[1];
      if (artCell) art = artCell.textContent.trim();
    }

    // наименование (берём из data-name, без бейджа "в списке")
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


    // 2) Кнопка очистки поля поиска (вынесено из клика по таблице)
    const inputEl = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');

    const toggleClear = () => {
      inputEl.parentElement.classList.toggle(
        'has-value',
        !!inputEl.value.trim()
      );
    };

    inputEl.addEventListener('input', toggleClear);

    toggleClear(); // первичное состояние
    // Единая функция очистки поиска
    const doClear = () => {
      if (!inputEl) return;
      if (document.body.classList.contains('is-filter-mode')) return;
      if (!inputEl.value) return; // уже пусто — выходим
      inputEl.value = '';
      toggleClear();
      this._page = 1;
      this.performSearch();
      inputEl.focus();
    };

    // Заменяем клик по кнопке × на вызов doClear
    clearBtn?.addEventListener('click', doClear);

    // Локальный Esc в самом инпуте — тоже вызывает doClear
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Escape' && inputEl.value) {
        e.preventDefault();
        doClear();
      }
    });

    // Глобальный Esc: работает где угодно на странице
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;

      // Если открыт наш dropdown "Документы" — даём Esc его закрыть и не чистим поиск
      if (
        document.querySelector('.dropdown.show') ||
        document.querySelector('.dropdown-menu[data-portal="1"]')
      ) {
        return;
      }

      // Если фокус в другом текстовом поле/редакторе — не мешаем
      const ae = document.activeElement;
      const isOtherTextField =
        ae &&
        ae !== inputEl &&
        ((ae.tagName === 'INPUT' &&
          ![
            'checkbox',
            'radio',
            'button',
            'submit',
            'reset',
            'file',
            'image',
            'range',
            'color',
            'hidden',
          ].includes(ae.type)) ||
          ae.tagName === 'TEXTAREA' ||
          ae.isContentEditable);
      if (isOtherTextField) return;
      if (document.body.classList.contains('is-filter-mode')) return;
      e.preventDefault();
      doClear();
    });
    // 3) Автоподгон высоты с дебаунсом
    const fit = this.debounce(this._fitResultsHeight.bind(this), 50);
    window.addEventListener('resize', fit, { passive: true });
    window.addEventListener('orientationchange', fit);

    // 4) "Портал" для выпадашки "Документы"
    document.addEventListener('shown.bs.dropdown', e => {
  const dd = e.target.closest('.dropdown');
  dd.setAttribute('data-bs-auto-close', 'outside');
  if (!dd || !dd.closest('#resultsSection')) return;
  const menu = dd.querySelector('.dropdown-menu');
  const btn = dd.querySelector('[data-bs-toggle="dropdown"]');
  if (!menu || !btn) return;

  // --- существующий "портал" + позиционирование (оставляем, как есть) ---
  menu.dataset.portal = '1';
  document.body.appendChild(menu);
  menu.style.position = 'fixed';               
// фиксируем Popper-побочки, чтобы не мешали ручному позиционированию
  menu.style.transform = 'none';
menu.removeAttribute('data-popper-placement');
menu.removeAttribute('data-bs-popper');


if (menu.classList.contains('docs-menu')) {
  // клики внутри — не считаем «вне меню»
  menu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

const place = () => {
  const bcr = btn.getBoundingClientRect();
  const mw = menu.offsetWidth || 0;
  const mh = menu.offsetHeight || 0;

  // базовая позиция — под кнопкой, по правому краю вьюпорта
  let left = Math.round(bcr.right - mw);
  let top  = Math.round(bcr.bottom + 6);

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  if (left + mw > vw - 8) left = Math.max(8, vw - mw - 8);
  if (left < 8) left = 8;

  // если снизу не влезает — открываем вверх
  if (top + mh > vh - 8) {
    const altTop = Math.round(bcr.top - mh - 6);
    if (altTop >= 8) top = altTop;
  }

  menu.style.left = left + 'px';
  menu.style.top  = top  + 'px';
  menu.style.zIndex = 3000;
  menu.style.maxWidth = 'initial'
  };

place();
menu._reposition = place;

// слушаем ВСЕ скроллы: окна и внутреннего скроллера таблицы
window.addEventListener('scroll', place, true);
window.addEventListener('resize', place);
const scroller = document.querySelector('#resultsSection .table-responsive');
if (scroller) {
  const closeOnScroll = () => {
    // закрываем текущий dropdown «по правилам» Bootstrap
    const btnEl = dd.querySelector('[data-bs-toggle="dropdown"]');
    try {
      const ddInst = window.bootstrap?.Dropdown?.getOrCreateInstance(btnEl);
      ddInst?.hide();
    } catch {
      // запасной путь, если bootstrap namespace недоступен
      menu.dispatchEvent(new Event('hide.bs.dropdown'));
      menu.classList.remove('show');
      dd.appendChild(menu);
    }
  };
  scroller.addEventListener('scroll', closeOnScroll, { passive: true });
  menu._closeOnScroll = closeOnScroll; // чтобы снять в hide
}



  // ===  лениво отрисовываем окно "Документы" ===
  if (menu.classList.contains('docs-menu')) {
    // Если уже наполняли — не повторяем
    if (menu._enhanced) return;
    menu._enhanced = true;

    // Достаём "наименование" для матчей подсказок и список документов
    const rawName = (menu.dataset.name || '').trim();
    let docs = [];
    try {
      docs = JSON.parse(decodeURIComponent(menu.dataset.docs || '[]'));
    } catch { docs = []; }

    // Получаем подсказки по тегам (лениво + кэш внутри Tips)
    (async () => {
      try {
        const tips = await window.Tips.getForName(rawName);

        // Рисуем основной экран через Tips (с двумя разделами)
        // Передадим пустые "links", а потом подменим секцию ссылок на нашу с тайтлами.
        menu.innerHTML = window.Tips.renderIndex({ links: [], tips });

// СБРОС Popper-позиций при смене контента
menu.style.transform = 'none';
menu.style.inset = 'auto';
menu.removeAttribute('data-popper-placement');

place();
setTimeout(place, 0);

        // Собираем HTML списка ссылок «как раньше» — с названиями
const linksSection = (() => {
  if (!docs.length) return `<div class="dm-empty">Ссылок нет</div>`;
  const listHtml = `
    <ul class="dm-links">
      ${docs.map(d => `
        <li>
          <a class="dm-link" href="${this.escapeHTML(d.url)}"
             target="_blank" rel="noopener">
            ${this.escapeHTML(d.title || 'Документ')}
          </a>
        </li>`).join('')}
    </ul>`;
  return listHtml;
})();

// Находим ПЕРВУЮ секцию (это «Ссылки») и полностью подменяем её содержимое:
const firstSection = menu.querySelector('.dm-section');
if (firstSection) {
  firstSection.innerHTML = `
    <div class="dm-section-title">Ссылки</div>
    ${linksSection}
  `;
}
menu.style.transform = 'none';
menu.style.inset = 'auto';
menu.removeAttribute('data-popper-placement');
place();
setTimeout(place, 0);



        // --- детальный режим для подсказки ---
const openDetail = (tip) => {
  // 1) детальный экран
  menu.innerHTML = window.Tips.renderDetail(tip);
  menu.style.transform = 'none';
menu.style.inset = 'auto';
menu.removeAttribute('data-popper-placement');
  place();
setTimeout(place, 0);
  window.Tips.bindDetail(menu);

  // 2) кнопка Назад → восстановить главный экран
  const back = menu.querySelector('.dm-back');
  if (back) {
    back.addEventListener('click', () => {
      menu.innerHTML = window.Tips.renderIndex({ links: [], tips });
      menu.style.transform = 'none';
menu.style.inset = 'auto';
menu.removeAttribute('data-popper-placement');
      place();                       
setTimeout(place, 0);          

      // восстановить раздел «Ссылки» с заголовками
      const linksSection = (() => {
        if (!docs.length) return `<div class="dm-empty">Ссылок нет</div>`;
        const listHtml = `
          <ul class="dm-links">
            ${docs.map(d => `
              <li>
                <a class="dm-link" href="${this.escapeHTML(d.url)}"
                   target="_blank" rel="noopener">
                  ${this.escapeHTML(d.title || 'Документ')}
                </a>
              </li>`).join('')}
          </ul>`;
        return listHtml;
      })();
      const firstSection = menu.querySelector('.dm-section');
      if (firstSection) {
        firstSection.innerHTML = `
          <div class="dm-section-title">Ссылки</div>
          ${linksSection}
        `;
      }
      menu.style.transform = 'none';
menu.style.inset = 'auto';
menu.removeAttribute('data-popper-placement');
place();
setTimeout(place, 0);

      // скрыть «Назад» на главном и заново подключить клики по подсказкам
      const back2 = menu.querySelector('.dm-back');
      if (back2) back2.hidden = true;
      window.Tips.bindIndex(menu, tips, { onOpenDetail: openDetail });

      if (typeof menu._reposition === 'function') setTimeout(menu._reposition, 0);
    }, { once: true });
  }

  const backBtn = menu.querySelector('.dm-back');
  if (backBtn) backBtn.hidden = false;
  if (typeof menu._reposition === 'function') setTimeout(menu._reposition, 0);
};

// подключаем клики по подсказкам (первично)
window.Tips.bindIndex(menu, tips, { onOpenDetail: openDetail });

        // На главном экране "Назад" скрываем
        const backInit = menu.querySelector('.dm-back');
        if (backInit) backInit.hidden = true;

      } catch (err) {
        console.warn('Docs/tips render error:', err);
        menu.innerHTML = `<div class="px-3 py-2 text-danger">Не удалось загрузить материалы</div>`;
      }

      // Подправим позицию после смены контента
      if (typeof menu._reposition === 'function') {
        setTimeout(menu._reposition, 0);
      }
    })();
  }
});


   document.addEventListener('hide.bs.dropdown', e => {
  const dd = e.target.closest('.dropdown');
  const menu = document.querySelector('.dropdown-menu[data-portal="1"]');
  if (!menu) return;

  // снять слушатели окна
  window.removeEventListener('scroll', menu._reposition, true);
  window.removeEventListener('resize', menu._reposition);

  // снять слушатель скролла у контейнера таблицы (именно тот, что закрывает меню)
  const scroller = document.querySelector('#resultsSection .table-responsive');
  if (scroller && menu._closeOnScroll) {
    scroller.removeEventListener('scroll', menu._closeOnScroll);
    menu._closeOnScroll = null;
  }

  // вернуть меню внутрь dropdown и почистить стили/метки
  menu.removeAttribute('style');
  menu.removeAttribute('data-portal');
  if (dd) dd.appendChild(menu);

  // (если где-то добавлял ResizeObserver — тут его бы отключить)
  // if (menu._resizeObserver) { menu._resizeObserver.disconnect(); menu._resizeObserver = null; }
});



    // первичная подгонка
    this._fitResultsHeight();
  }

  // ---------- Загрузка данных ----------
  async loadDefaultFile() {
  try {
    const resp = await fetch('base.csv', { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    const text = await resp.text();

    // Используем PapaParse для CSV
    if (!window.Papa) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const parsed = Papa.parse(text, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
    });

    const jsonData = parsed.data;

    if (!jsonData.length)
      throw new Error('Файл пустой или не содержит данных');
    if (jsonData.length > this.MAX_ROWS)
      throw new Error(`Слишком много строк (${jsonData.length}). Предел ${this.MAX_ROWS}.`);

    const required = ['Наименование', 'Артикул', 'Цена'];
    const firstRow = jsonData[0] || {};
    const missing = required.filter(c => !(c in firstRow));
    if (missing.length)
      throw new Error(`Отсутствуют колонки: ${missing.join(', ')}`);
     

      // Прединдексация + формат цены (без ₽)
      this.data = jsonData.map(row => ({
        ...row,
        __name: this.normalizeForFuzzySearch(row['Наименование'] || ''),
        __article: this.normalizeForFuzzySearch(row['Артикул'] || ''),
        __name_delim: this.canonKeepDelims(row['Наименование'] || ''),
        __article_delim: this.canonKeepDelims(row['Артикул'] || ''),
        __price: this._formatPriceCached(row['Цена']),
        __docs: this.parseDocs(row['Документы']),
        __featHtml: this._featuresToHtml(row['Характеристики']), 
         __qty: this._parseQty(row['Количество']),             
         __qtyHint: null                           
      }));

      this._updateInfoTooltip();

      this.showSearchSection();
      this._fitResultsHeight(); // сразу выставить высоту контейнера

      // Очистить строку поиска ТОЛЬКО при "reload" (F5/Ctrl+R/кнопка обновить),
      // но НЕ при возврате "назад" (bfcache сохраняется).
      const nav =
        performance.getEntriesByType &&
        performance.getEntriesByType('navigation')[0];
      const isReload = nav
        ? nav.type === 'reload'
        : performance.navigation && performance.navigation.type === 1; // старый API для старых браузеров

      if (isReload) {
        const input = document.getElementById('searchInput');
        if (input) input.value = '';
        this.filteredData = [];
        this._page = 1;
        this.displayResults();
      }
    } catch (e) {
      console.error('Загрузка base.csv не удалась:', e);
      this.showError(`Не удалось загрузить base.csv\n${e.message}`);
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

    const qAliased = this._applyUZAliases(query);

    const parts = qAliased
      .split(/[^a-zA-Zа-яА-ЯёЁ0-9/]+/)
      .filter(Boolean)
      .slice(0, this.MAX_TOKENS)
      .map(p => this.normalizeForFuzzySearch(p.slice(0, this.MAX_TOKEN_LEN)))
      .filter(Boolean);

    const hasLetters = /[a-zA-Zа-яА-ЯёЁ]/.test(query); // считаем по исходному
    
    // Можно ли подключать поиск по артикулу?
    // Разрешаем только если в запросе НЕТ букв и общее число цифр кратно 6
    const digitCount = query.replace(/\D/g, '').length;
    const permitArticle = !hasLetters && digitCount > 0 && digitCount % 6 === 0;
    // Последовательность чисто цифровых токенов (в порядке ввода)
	const numericSeq = parts.filter(p => /^\d+$/.test(p));

    // РЕЖИМ СПИСКА АРТИКУЛОВ: если 2+ токена и каждый строго 6 цифр —
    // ищем только по артикулу и выводим в порядке ввода.
    const isMultiArticle =
      parts.length >= 2 && parts.every(p => /^\d{6}$/.test(p));

    if (isMultiArticle) {
      // уникальные коды в порядке ввода
      const uniq = [...new Set(parts)];
      const order = new Map(uniq.map((a, i) => [a, i]));

      // фильтруем строго по __article (он у тебя уже нормализован)
      this.filteredData = this.data.filter(it => order.has(it.__article));

      // сортируем как ввели
      this.filteredData.sort(
        (a, b) => order.get(a.__article) - order.get(b.__article)
      );

      this._page = 1;
      this.displayResults();
      return; // важно: не запускаем обычную логику every()/скоринга ниже
    }
    // Фильтрация: если есть буквы — ищем только по названию
    this.filteredData = this.data.filter(item =>
  parts.every(
    part =>
      item.__name.includes(part) ||
      (permitArticle && item.__article.includes(part))
  	)
	);

    const rawQuery = (
      document.getElementById('searchInput')?.value || ''
    ).trim();
    const qn = this.normalizeForFuzzySearch(this._applyUZAliases(rawQuery));

    for (const it of this.filteredData) {
  it.__score = 0;

  const nd = it.__name_delim || String(it['Наименование'] || '');
  const ad = it.__article_delim || String(it['Артикул'] || '');

  // Базовый скор по каждому токену
  for (const p of parts) {
    const inName = it.__name.includes(p);
    const inArt  = permitArticle && it.__article.includes(p);

    // простое вхождение → базовые очки
    if (inName || inArt) it.__score += 1000;

    // совпадение «словом»
    const wre = this._wordRegex(p);
    if (wre && wre.test(nd)) it.__score += 300;
    if (permitArticle && wre && wre.test(ad)) it.__score += 200;

    // ЧИСЛО: требуем полное числовое совпадение (не «30» в «300»)
    const nre = this._numTokenRegex(p);
    if (nre && nre.test(nd)) it.__score += 300;
    if (permitArticle && nre && nre.test(ad)) it.__score += 200;

    // Позиционный бонус — чем левее первый матч, тем лучше
    const hay = permitArticle ? ad : nd;
    const pos = hay.indexOf(p);
    if (pos >= 0) it.__score += Math.max(0, 120 - pos);
  }

  // Бонус за «фразу» (все токены в правильном порядке с любыми разделителями)
  if (parts.length >= 2) {
    const pre = this._phraseRegexFromParts(parts);
    if (pre.test(nd)) it.__score += 800;
  }

  // Общие бонусы/штрафы из конфига (FERRAZ/БЗАВ и т.п.)
  this._applyRankRulesToItem(it, { nd, raw: String(it['Наименование'] || ''), docs: it.__docs });
}
    

    // Сортировка: тай-брейкер смотрит в артикул только если нет букв
    this.filteredData.sort((a, b) => {
      if (b.__score !== a.__score) return b.__score - a.__score;

      const bestPos = it => {
  	const hay = permitArticle ? it.__article_delim : it.__name_delim;
  	let best = 1e9;
  	for (const p of parts) {
    	const i = hay.indexOf(p);
    	if (i !== -1 && i < best) best = i;
 	 }
 	 return best;
	};

      const ap = bestPos(a),
        bp = bestPos(b);
      if (ap !== bp) return ap - bp;

      return a.__name.length - b.__name.length;
    });

    this._page = 1;
    this.displayResults();
  }
  // ---------- Отрисовка ----------
  displayResults() {
    const resultsBody = document.getElementById('resultsBody');
    const resultsCount = document.getElementById('resultsCount');
    const banner = document.getElementById('stateBanner');
    const titleEl = document.getElementById('stateBannerTitle');
    const hintEl = document.getElementById('stateBannerHint');

    const rawQuery = (
      document.getElementById('searchInput')?.value || ''
    ).trim();

    const total = this.filteredData.length;
    
    // блокируем/разблокируем кнопку "Фильтр"
    const filterBtn = document.getElementById('filterToggle');
    if (filterBtn) {
    filterBtn.disabled = total === 0;
    filterBtn.title = total === 0 ? 'Нет результатов для фильтрации' : '';
    }


    if (total === 0) {
  // очищаем таблицу
  resultsBody.innerHTML = '';

  // В РЕЖИМЕ ФИЛЬТРА — показываем строку внутри таблицы, без общего баннера
  if (document.body.classList.contains('is-filter-mode')) {
    renderFilterEmptyRow();
    if (banner) banner.style.display = 'none';
    resultsCount.textContent = 'Найдено: 0 результатов';
    this._renderShowMore(false);
    this._fitResultsHeight();
    relocateStateBannerForFilterMode?.();
    return;
  }

  // Обычный режим — показываем штатный (розовый) баннер
  const isEmptyQuery = rawQuery.length === 0;
  if (banner && titleEl && hintEl) {
    if (isEmptyQuery) {
      banner.className = 'no-results no-results--empty text-center py-4';
      titleEl.textContent = 'Введите текст для поиска';
      hintEl.textContent = '';
    } else {
      banner.className = 'no-results text-center py-4';
      titleEl.textContent = 'По вашему запросу ничего не найдено';
      hintEl.textContent =
        'Попробуйте изменить условия поиска или проверьте правописание';
    }
    banner.style.display = 'block';
  }

  resultsCount.textContent = 'Найдено: 0 результатов';
  this._renderShowMore(false);
  this._fitResultsHeight();
  relocateStateBannerForFilterMode();
  return;
}

    else {
      // есть результаты — скрываем баннер
      if (banner) banner.style.display = 'none';
    }

    let highlightTokens = this._applyUZAliases(rawQuery)
      .split(/[^a-zA-Zа-яА-ЯёЁ0-9/]+/)
      .filter(Boolean)
      .filter(tok => this.normalizeForFuzzySearch(tok).length >= 2)
      .slice(0, this.MAX_TOKENS)
      .map(tok =>
        this.buildHomoglyphRegexToken(tok.slice(0, this.MAX_TOKEN_LEN))
      );

    const totalPatternLen = highlightTokens.join('').length;
    if (totalPatternLen > this.MAX_REGEX_TOTAL) {
      highlightTokens = []; // защита от «регексп-кирпича»
    }

    const end = Math.min(this._page * this._pageSize, total);
    const slice = this.filteredData.slice(0, end);

    const tooMany = total > 5000;
    const rowsHtml = slice
      .map(item => {
        const nameSafe = this.escapeHTML(item['Наименование'] || '');
        const artSafe = this.escapeHTML(item['Артикул'] || '');
        const nameHtml =
          tooMany || highlightTokens.length === 0
            ? nameSafe
            : this.highlightHomoglyphs(nameSafe, highlightTokens);
        const artHtml =
          tooMany || highlightTokens.length === 0
            ? artSafe
            : this.highlightHomoglyphs(artSafe, highlightTokens);
        const docs = item.__docs || [];
let docsHtml = '—';
if (docs.length) {
  // Упакуем документы в data-атрибут (безопасно кодируем)
  const docsData = encodeURIComponent(JSON.stringify(docs));
  // Имя для матчей подсказок (берём чистое наименование без бейджа)
  const nameForTips = (item['Наименование'] || '').trim();

  docsHtml = `
    <div class="dropdown">
      <button type="button"
              class="btn btn--outline btn--sm docs-btn"
              data-bs-toggle="dropdown"
              data-bs-auto-close="outside"
              aria-expanded="false"
              title="Документы">
        <!-- inline SVG folder -->
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
             viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 4l2 2h7a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h5z" fill="currentColor"/>
        </svg>
      </button>
      <ul class="dropdown-menu dropdown-menu-end docs-menu"
          data-name="${this.escapeHTML(nameForTips)}"
          data-docs="${docsData}">
        <!-- наполним содержимым лениво при открытии -->
        <li class="px-3 py-2 text-muted">Загрузка…</li>
      </ul>
    </div>`;
}

     const artRaw = item['Артикул'] || '';
const hasFeat = !!item.__featHtml;

const infoBtn = hasFeat
  ? `<button type="button"
             class="info-circle feat-info"
             data-article="${this.escapeHTML(artRaw)}"
             data-bs-toggle="popover"
             data-bs-html="true"
             data-bs-placement="top"
             data-bs-content="${item.__featHtml}"
             title="Характеристики">i</button>`
  : `<button type="button"
             class="info-circle feat-info is-disabled"
             data-article="${this.escapeHTML(artRaw)}"
             title="Открыть страницу товара (двойной клик)">i</button>`;

       return `
  <tr data-sku="${this.escapeHTML(item['Артикул'] || '')}">
    <td class="copyable"
        data-name="${this.escapeHTML(item['Наименование'] || '')}"
        data-sku="${this.escapeHTML(item['Артикул'] || '')}"
        title="ЛКМ — ${window.CopyMode?.isOn && window.CopyMode.isOn() ? 'добавить/убрать из списка' : 'скопировать'}">
      ${nameHtml}<span class="copy-badge" style="display:none">в списке</span>
    </td>
    <td>${artHtml}</td>
${(() => {
  const q = this._parseQty(item.__qty);
  const inStock = q > 0;
  const hint = inStock
    ? `В наличии ${q} ${this._pluralRu(q, ['штука','штуки','штук'])}`
    : 'Нет в наличии';

  const price = `
  <span class="price-tag ${inStock ? 'is-stock' : 'is-empty'}"
        aria-label="${this.escapeHTML(hint)}"
        ${window.bootstrap ? 'data-bs-toggle="tooltip"' : 'title="'+this.escapeHTML(hint)+'"'}
        ${window.bootstrap ? 'data-bs-title="'+this.escapeHTML(hint)+'"' : ''}>
    ${item.__price}
  </span>`;


  return `
    <td class="text-price">
      <div class="price-cell">
        ${price}
        ${infoBtn}
      </div>
    </td>`;
})()}
<td class="col-docs">${docsHtml}</td>
  </tr>
`;
      })
      .join('');

    resultsBody.innerHTML = rowsHtml;
    // COPY: сообщаем модулю, что таблица перерисована (подсветка выбранных)
document.dispatchEvent(new CustomEvent('results:rendered'));

    // тултипы для характеристик
// поповеры для характеристик (копируемый текст)
if (window.bootstrap && window.bootstrap.Popover) {
  // На всякий случай «погасим» возможные инстансы Tooltip, если они были
  document.querySelectorAll('.feat-info').forEach(el => {
    const tt = window.bootstrap.Tooltip?.getInstance?.(el);
    tt?.dispose();
  });

  // Инициализация Popover
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

  }

// Тултипы для цен (наличие)
if (window.bootstrap?.Tooltip) {
  document.querySelectorAll('.price-tag[data-bs-toggle="tooltip"]').forEach(el => {
    const t = window.bootstrap.Tooltip.getInstance(el);
    if (t) t.dispose();
    new window.bootstrap.Tooltip(el, { html: false, placement: 'top' });
  });

  // Клик вне поповера — закрываем открытые
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.feat-info').forEach(el => {
      const pop = window.bootstrap.Popover.getInstance(el);
      if (!pop) return;
      const tip = pop.tip;
      const clickedInside = el.contains(e.target) || (tip && tip.contains(e.target));
      if (!clickedInside) pop.hide();
    });
  }, { capture: true });
}
    resultsCount.textContent = `Показаны: ${slice.length} из ${total}`;
    this._renderShowMore(end < total);
    this._fitResultsHeight();
  }

  _renderShowMore(show) {
    const footer = document.getElementById('resultsShowMore');
    if (!footer) return;
     if (document.body.classList.contains('is-filter-mode')) {
    show = false;
  }
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

  // формат цены БЕЗ символа рубля — число с 2 знаками
  _formatPriceCached(price) {
    if (price === null || price === undefined || price === '') return '—';
    const num = parseFloat(price);
    if (Number.isNaN(num)) return String(price);
    return num.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.App = new PriceListSearchApp(); // даём глобальный доступ панели
  setupFilterAddon();                    // навесим кнопку, Esc и пр.
});


function relocateStateBannerForFilterMode() {
  const banner = document.getElementById('stateBanner');
  if (!banner) return;

  const resultsFlex = document.getElementById('resultsFlex');
  const tableWrap   = resultsFlex?.querySelector('.table-responsive');
  const panel       = document.getElementById('filterPanel');
  const cardBody    = document.querySelector('#resultsSection .card__body');

  if (document.body.classList.contains('is-filter-mode')) {
    // поместить баннер внутрь левой колонки, строго ПЕРЕД панелью фильтров
    if (resultsFlex && panel && banner.parentElement !== resultsFlex) {
      resultsFlex.insertBefore(banner, panel);
    }
  } else {
    // вернуть баннер обратно в базовый контейнер страницы
    if (cardBody && banner.parentElement !== cardBody) {
      cardBody.appendChild(banner);
    }
  }
}

function renderFilterEmptyRow() {
  const tbody = document.querySelector('#resultsTable tbody');
  if (!tbody) return;
  const cols = document.body.classList.contains('is-filter-mode') ? 3 : 4;
  tbody.innerHTML = `<tr class="table-empty-row"><td colspan="${cols}">По выбранным фильтрам ничего не найдено</td></tr>`;
}

// === Фильтр (аддон) — кнопка, Esc, интеграция с COPY и панелью ===
function setupFilterAddon() {
  const filterBtn   = document.getElementById('filterToggle');
  const searchInput = document.getElementById('searchInput');
  searchInput?.addEventListener('input', () => {
  if (document.body.classList.contains('is-filter-mode')) {
    searchInput.value = window.App?._preFilterQuery ?? searchInput.value;
  }
});
  const copySwitch  = document.getElementById('copyModeSwitch');

  if (!filterBtn) return;

    // клик по кнопке
filterBtn.addEventListener('click', () => {
  if (filterBtn.disabled) return;              // защита от клика по disabled
  if (isFilterMode()) closeFilterMode(); 
  else openFilterMode();
});

  

  function isFilterMode() {
    return document.body.classList.contains('is-filter-mode');
  }

  function openFilterMode() {
    // запрещаем включение при пустой строке поиска
    const q = (searchInput?.value || '').trim();
    if (!q) {
      alert('Введите поисковый запрос');
      return;
    }

    // снимок текущей выдачи (до фильтра)
    if (!window.App._preFilterData) {
      window.App._preFilterData = window.App.filteredData.slice();
    }

    // COPY: если включён — выключим, затем блокируем тумблер до выхода из фильтра
    if (window.CopyMode?.isOn && window.CopyMode.isOn()) {
      if (copySwitch) {
        copySwitch.checked = false;
        copySwitch.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (copySwitch) copySwitch.setAttribute('disabled', 'disabled');

    // включаем режим
    document.body.classList.add('is-filter-mode');
    relocateStateBannerForFilterMode();
    const banner = document.getElementById('stateBanner');
    if (banner) banner.style.display = 'none';
    filterBtn.classList.add('is-active');
    // Замораживаем строку запроса так, чтобы крестик «х» не работал и текст не менялся
if (searchInput) {
  // запомним текущий текст и тип
  window.App._preFilterQuery = searchInput.value;
  window.App._searchOriginalType = searchInput.type;

  // меняем тип на text, чтобы пропал нативный крестик, и делаем только для чтения
  try { searchInput.type = 'text'; } catch(e) {} // на всякий случай
  searchInput.readOnly = true;                   // курсор можно ставить, но менять нельзя
  searchInput.classList.add('is-frozen');        // (если захочешь подсветить стилем)
}

    if (searchInput) { searchInput.setAttribute('disabled', 'disabled'); searchInput.blur(); }

    // отдаём панели первые 400 артикулов текущей выдачи
    const slice = window.App._preFilterData.slice(0, Math.min(1000, window.App._preFilterData.length));
    const arts  = slice.map(it => String(it['Артикул'] || '').trim()).filter(Boolean);

    window.FilterPanel?.open({ articles: arts });
  }

  function closeFilterMode() {
    document.body.classList.remove('is-filter-mode');
    filterBtn.classList.remove('is-active');
   if (searchInput) {
   searchInput.removeAttribute('disabled');
   // разморозим и вернём исходный тип/значение
   searchInput.readOnly = false;
   if (window.App?._searchOriginalType) {
     try { searchInput.type = window.App._searchOriginalType; } catch(e) {}
   }
   if (typeof window.App?._preFilterQuery === 'string') {
     searchInput.value = window.App._preFilterQuery;
   }
   searchInput.classList.remove('is-frozen');
 }
    if (copySwitch)  copySwitch.removeAttribute('disabled');

    // вернуть исходную выдачу (как была до включения фильтра)
    if (window.App._preFilterData) {
      window.App.filteredData = window.App._preFilterData;
      window.App._preFilterData = null;
      window.App._page = 1;
      window.App.displayResults();
    }
    const banner = document.getElementById('stateBanner');
    if (banner) banner.style.display = '';
    relocateStateBannerForFilterMode();
    window.FilterPanel?.close();
  }

  


  // Esc закрывает фильтр (строку поиска НЕ чистим)
  document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isFilterMode()) {
    e.preventDefault();
    e.stopImmediatePropagation(); // ← критично
    closeFilterMode();
  }
});
}

// === WHAT'S NEW (changelog) ===============================================
(function () {
  const APP_VERSION = document.documentElement.getAttribute('data-app-version') || '';
  const STORAGE_KEY = v => `whatsnew:${v}`;
  const INFO_BTN_SELECTOR = '#dataInfo';

  // --- Проверки активных режимов (используем то, что есть; плюс класс-маркеры как фолбэк)
  function isCopyActive() {
  try {
    if (window.CopyMode && typeof window.CopyMode.isOn === 'function') {
      return !!window.CopyMode.isOn();
    }
  } catch {}
  return document.body.classList.contains('copy-mode');
}

  function isFilterActive() {
    try {
      if (window.FilterPanel && typeof window.FilterPanel.isActive === 'function') return !!window.FilterPanel.isActive();
    } catch {}
    return document.body.classList.contains('is-filter-mode');
  }

  // --- Простой безопасный Markdown → HTML
  function mdToHtml(md) {
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // ссылки [text](https://…)
    md = md.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, (_m, t, u) =>
      `<a href="${u}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`);

    // жирный/курсив
    md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    md = md.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // заголовки
    md = md.replace(/^#\s+(.+)$/gm, '<h3 class="mt-1 mb-3">$1</h3>');
    md = md.replace(/^##\s+(.+)$/gm, '<h5 class="mt-3 mb-2">$1</h5>');

    // списки/параграфы
    const lines = md.split(/\r?\n/);
    let out = [], inList = false;
    for (const line of lines) {
      const m = line.match(/^\s*[-*]\s+(.*)$/);
      if (m) {
        if (!inList) { out.push('<ul class="mb-0">'); inList = true; }
        out.push(`<li>${m[1]}</li>`);
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        if (line.trim() === '') out.push('');
        else out.push(`<p class="mb-2">${line}</p>`);
      }
    }
    if (inList) out.push('</ul>');
    return out.join('\n');
  }

  async function loadMarkdown(version) {
  const url = `addons/whatsnew/Release.md?v=${encodeURIComponent(APP_VERSION)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Release notes not found: ${url}`);
  return res.text();
}


  function parseTitle(md) {
    const m = md.match(/^#\s+(.+)$/m);
    return m ? m[1].trim() : 'Что нового';
  }

  function setModalContent({ version, title, html }) {
    const v = document.getElementById('whatsnewVersionBadge');
    const t = document.getElementById('whatsnewTitle');
    const b = document.getElementById('whatsnewBody');
    if (v) v.textContent = version || '';
    if (t) t.textContent = title || 'Что нового';
    if (b) b.innerHTML = html || '';
  }

  let triedAutoShow = false;
  async function openWhatsNew(auto = false) {
    if (!APP_VERSION) return;
    if (isFilterActive() || isCopyActive()) return; // запрещено в этих режимах

    let title, html;
    try {
      const md = await loadMarkdown(APP_VERSION);
      title = parseTitle(md);
      html  = mdToHtml(md);
    } catch {
      title = 'Что нового';
      html  = '<p>Описание обновления будет добавлено позже.</p>';
    }
    setModalContent({ version: APP_VERSION, title, html });

    const modalEl = document.getElementById('whatsnewModal');
    if (!modalEl) return;
    const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    modal.show();

    const done = () => {
      modal.hide();
      if (auto) {
        try { localStorage.setItem(STORAGE_KEY(APP_VERSION), '1'); } catch {}
      }
    };
    const ok  = document.getElementById('whatsnewOkBtn');
    const x   = document.getElementById('whatsnewCloseX');
    if (ok) ok.onclick = done;
    if (x)  x.onclick  = done;

    // ставим флаг сразу при автопоказе — чтобы при F5 не мигало второй раз
    if (auto) {
      try { localStorage.setItem(STORAGE_KEY(APP_VERSION), '1'); } catch {}
    }
  }

  function maybeAutoShow() {
    if (triedAutoShow) return;
    triedAutoShow = true;
    if (!APP_VERSION) return;
    try {
      if (localStorage.getItem(STORAGE_KEY(APP_VERSION))) return; // уже показывали
    } catch {}
    if (isFilterActive() || isCopyActive()) return;
    openWhatsNew(true);
  }

  // Показываем "Что нового" один раз после первой реальной отрисовки результатов
document.addEventListener('results:rendered', () => {
  if (triedAutoShow) return;
  triedAutoShow = true;
  maybeAutoShow();
}, { once: true });

  // --- Клик по уже существующей кнопке "i" (datasetInfo)
  document.addEventListener('click', (e) => {
    const infoBtn = e.target.closest(INFO_BTN_SELECTOR);
    if (!infoBtn) return;
    if (isFilterActive() || isCopyActive()) return; // запрещаем в этих режимах
    openWhatsNew(false);
  });

  
})();


// === Soft refresh on version change (once) ================================
(function () {
  const cur  = document.documentElement.getAttribute('data-app-version') || '';
  const KEY  = 'app:lastVersion';
  const FLAG = `reloaded-for:${cur}`;

  try {
    const prev    = localStorage.getItem(KEY) || '';
    const already = sessionStorage.getItem(FLAG) === '1';

    // 1) Версия сменилась и ещё не перезагружали вкладку для неё → делаем один reload
    if (cur && prev && prev !== cur && !already) {
      sessionStorage.setItem(FLAG, '1'); // помечаем, что уже перезагрузили для этой версии
      location.reload();                 // обычный reload; ассеты обновятся благодаря ?v=
      return;
    }

    // 2) После reload (или на первом визите) фиксируем текущую версию
    if (cur && (!prev || prev !== cur)) {
      localStorage.setItem(KEY, cur);
    }
  } catch {}
})();





