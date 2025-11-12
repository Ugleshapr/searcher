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

  async function loadRzdCsv() {
  try {
    if (!window.App || !App.dataLoader) throw new Error('App.dataLoader недоступен');

    // грузим как "static" → сначала IndexedDB, иначе fetch + кладём в кеш
    const rows = await App.dataLoader.loadCSV('rzd.csv', { cachePolicy: 'static' });

    if (!Array.isArray(rows) || !rows.length) throw new Error('Файл rzd.csv пустой');

    const first = rows[0] || {};
    const need = ['Наименование', 'Артикул'];
    const miss = need.filter(k => !(k in first));
    if (miss.length) throw new Error(`В rzd.csv отсутствуют колонки: ${miss.join(', ')}`);

    // Приводим к формату, который ожидает app.js (часть полей уже подготовлена DataLoader'ом)
    App.data = rows.map(r => ({
      ...r,
      __name: r.__name ?? App.normalizeForFuzzySearch(r['Наименование'] || ''),
      __article: r.__article ?? App.normalizeForFuzzySearch(r['Артикул'] || ''),
      __name_delim: r.__name_delim ?? App.canonKeepDelims(r['Наименование'] || ''),
      __article_delim: r.__article_delim ?? App.canonKeepDelims(r['Артикул'] || ''),

      'Цена': r['Цена'] ?? '',
      __price: r.__price ?? '—',
      'Документы': r['Документы'] ?? '',
      __docs: r.__docs ?? [],
      'Характеристики': r['Характеристики'] ?? '',
      __featHtml: r.__featHtml ?? null,
      'Количество': r['Количество'] ?? '',
      __qty: r.__qty ?? 0,
      __qtyHint: r.__qtyHint ?? null
    }));

    App._updateInfoTooltip?.();
    document.body.classList.add('rzd-mode');
  } catch (e) {
    console.error('Ошибка загрузки rzd.csv:', e);
    App.showError?.(`Не удалось загрузить rzd.csv\n${e.message}`);
    rzdMode = false;
    document.body.classList.remove('rzd-mode');
    updateChipLabel();
  }
}


  // Экспорт в глобальную область — на случай, если понадобится управление извне
  window.RZDMode = { isOn: isRzd, toggle: toggleMode };
})();

