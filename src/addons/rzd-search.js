// addons/rzd-search.js
(function () {
  const RZD_COLOR = '#c32b1c';
  const DEFAULT_PRIMARY = getComputedStyle(document.documentElement).getPropertyValue('--color-primary') || '#4f6753';

  let rzdMode = false;
  let cachedBaseData = null; // снимок исходных данных, чтобы вернуться из РЖД

  // Инициализация после загрузки приложения
  document.addEventListener('DOMContentLoaded', () => {
    // Встраиваем кликабельный переключатель, если есть #rzdToggle
    const chip = document.getElementById('rzdToggle');
    if (chip) {
      chip.addEventListener('click', toggleMode);
      // синхронизируем подпись при перезагрузке/кешировании
      updateChipLabel();
    }
  });

  function isRzd() { return rzdMode; }

  async function toggleMode() {
    if (!window.App) return;
    rzdMode = !rzdMode;
    document.body.classList.toggle('rzd-mode', rzdMode);

    // Закрыть/отключить фильтр, если он был включён
    try {
      if (document.body.classList.contains('is-filter-mode')) {
        // кнопка фильтра существует в обычном режиме — закроем
        const btn = document.getElementById('filterToggle');
        if (btn && typeof btn.click === 'function') {
          // если фильтр активен, в app.js на кнопку навешан toggle
          btn.click();
        }
      }
    } catch {}

    // Подпись чипа
    updateChipLabel();

    const qInput = document.getElementById('searchInput');
    const queryBefore = (qInput?.value || '').trim();

    if (rzdMode) {
      // Сохраняем “обычные” данные один раз
      if (!cachedBaseData) cachedBaseData = Array.isArray(App.data) ? App.data.slice() : null;
      await loadRzdCsv();
    } else {
      // Возврат к обычной базе
      if (cachedBaseData) {
        App.data = cachedBaseData;
        // вернём инфо-подсказку (счётчики/версия) исходной базы
        App._updateInfoTooltip?.();
      } else {
        // если по какой-то причине не успели сохранить — подстрахуемся штатной загрузкой
        await App.loadDefaultFile?.();
      }
    }

    // В обоих режимах — пересчитать результаты под текущий запрос
    try {
      if (qInput && queryBefore) {
        await App.performSearch?.();
      } else {
        App.filteredData = [];
        App._page = 1;
        App.displayResults?.();
      }
    } catch (e) {
      console.error('RZD toggle re-render error:', e);
    }
  }

  function updateChipLabel() {
    const chip = document.getElementById('rzdToggle');
    if (!chip) return;
    chip.textContent = isRzd() ? 'прайс-листу РЖД' : 'прайс-листу';
  }

  async function ensurePapa() {
    if (window.Papa) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function loadRzdCsv() {
    try {
      await ensurePapa();
      const resp = await fetch('rzd.csv', { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const text = await resp.text();

      const parsed = Papa.parse(text, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        transformHeader: h => String(h).trim()
      });

      const rows = Array.isArray(parsed.data) ? parsed.data : [];
      if (!rows.length) throw new Error('Файл rzd.csv пустой');

      // Проверим требуемые столбцы
      const first = rows[0] || {};
      const need = ['Наименование', 'Артикул'];
      const miss = need.filter(k => !(k in first));
      if (miss.length) throw new Error(`В rzd.csv отсутствуют колонки: ${miss.join(', ')}`);

      // Приводим к формату, который ожидает app.js (минимум поля и прединдексация)
      App.data = rows.map(r => ({
        ...r,
        // обязательные «внутренние» поля, чтобы поиск/сортировка работали как в обычном режиме
        __name: App.normalizeForFuzzySearch(r['Наименование'] || ''),
        __article: App.normalizeForFuzzySearch(r['Артикул'] || ''),
        __name_delim: App.canonKeepDelims(r['Наименование'] || ''),
        __article_delim: App.canonKeepDelims(r['Артикул'] || ''),

        // поля, которых нет в rzd.csv — ставим значения-заглушки
        'Цена': '',                // нет данных
        __price: '—',              // формат для колонки цены
        'Документы': '',           // нет документов
        __docs: [],                // пустое меню документов
        'Характеристики': '',      // нет характеристик
        __featHtml: null,
        'Количество': '',
        __qty: 0,
        __qtyHint: null
      }));

      // Обновим тултип «i» в шапке (счётчик записей/версия)
      App._updateInfoTooltip?.();

      // В РЖД меняем акценты через класс body (CSS переопределит переменные/рамки)
      document.body.classList.add('rzd-mode');
    } catch (e) {
      console.error('Ошибка загрузки rzd.csv:', e);
      App.showError?.(`Не удалось загрузить rzd.csv\n${e.message}`);
      // если провал — откат к обычной базе
      rzdMode = false;
      document.body.classList.remove('rzd-mode');
      updateChipLabel();
    }
  }

  // Экспорт в глобальную область — на случай, если понадобится управление извне
  window.RZDMode = { isOn: isRzd, toggle: toggleMode };
})();

