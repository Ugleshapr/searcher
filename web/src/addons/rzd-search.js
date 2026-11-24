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
    const app = window.App;
    if (!app) return;
    rzdMode = !rzdMode;
    document.body.classList.toggle('rzd-mode', rzdMode);

    // Закрыть/отключить фильтр, если он был включён
    try {
      if (document.body.classList.contains('is-filter-mode')) {
        const btn = document.getElementById('filterToggle');
        if (btn && typeof btn.click === 'function') {
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
      if (!cachedBaseData) cachedBaseData = Array.isArray(app.data) ? app.data.slice() : null;
      await loadRzdCsv();
    } else {
      // Возврат к обычной базе
      if (cachedBaseData) {
        app.data = cachedBaseData;
        app._updateInfoTooltip?.();
      } else {
        await app.loadDefaultFile?.();
      }
    }

    // В обоих режимах — пересчитать результаты под текущий запрос
    try {
      if (qInput && queryBefore) {
        await app.performSearch?.();
      } else {
        app.filteredData = [];
        app._page = 1;
        app.displayResults?.();
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
      const app = window.App;
      if (!app || !app.dataLoader) throw new Error('App.dataLoader недоступен');

      // грузим как "static" → сначала IndexedDB, иначе fetch + кладём в кеш
      const rows = await app.dataLoader.loadCSV('rzd.csv', { cachePolicy: 'static' });

      if (!Array.isArray(rows) || !rows.length) throw new Error('Файл rzd.csv пустой');

      const first = rows[0] || {};
      const hasName = 'Наименование' in first || '\ufeffНаименование' in first;
      const hasArt = 'Артикул' in first;
      if (!hasName || !hasArt) throw new Error(`В rzd.csv отсутствуют колонки: Наименование, Артикул`);

      app.data = rows;
      app._updateInfoTooltip?.();
      document.body.classList.add('rzd-mode');
    } catch (e) {
      console.error('Ошибка загрузки rzd.csv:', e);
      window.App?.showError?.(`Не удалось загрузить rzd.csv\n${e.message}`);
      rzdMode = false;
      document.body.classList.remove('rzd-mode');
      updateChipLabel();
    }
  }


  // Экспорт в глобальную область — на случай, если понадобится управление извне
  window.RZDMode = { isOn: isRzd, toggle: toggleMode };
})();

