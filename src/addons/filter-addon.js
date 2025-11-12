/* addons/filter-addon.js — системный «клей» фильтров: режим, события, Esc, заморозка поиска */
(function () {
  'use strict';

  // --- Поиск и «заморозка» поля ввода на время фильтра ---
  function freezeSearchInput() {
    const si = document.getElementById('searchInput');
    if (!si) return;
    si.dataset._origType = si.type || '';
    si.dataset._origValue = si.value || '';
    try { si.type = 'text'; } catch {}
    si.readOnly = true;
    si.setAttribute('disabled', 'disabled');
    si.classList.add('is-frozen');
  }

  function unfreezeSearchInput() {
    const si = document.getElementById('searchInput');
    if (!si) return;
    si.removeAttribute('disabled');
    si.readOnly = false;
    if (si.dataset._origType) { try { si.type = si.dataset._origType; } catch {} }
    if (typeof si.dataset._origValue === 'string') si.value = si.dataset._origValue;
    si.classList.remove('is-frozen');
  }

  // --- Управление режимом фильтра ---
  function openFilterMode() {
    if (document.body.classList.contains('is-filter-mode')) return;
    document.body.classList.add('is-filter-mode');
    freezeSearchInput();
    document.dispatchEvent(new CustomEvent('filter:opened'));
  }

  function closeFilterMode() {
    if (!document.body.classList.contains('is-filter-mode')) return;
    document.body.classList.remove('is-filter-mode');
    unfreezeSearchInput();
    document.dispatchEvent(new CustomEvent('filter:closed'));
  }

  // --- Применение фильтров (всегда к снимку _preFilterData) ---
  // pred: (item) => boolean
  function applyFilter(pred) {
    if (typeof pred !== 'function') return;
    const app = window.App;
    if (!app) return;

    const base = (app._preFilterData && Array.isArray(app._preFilterData))
      ? app._preFilterData.slice()
      : (Array.isArray(app.filteredData) ? app.filteredData.slice() : []);

    app.filteredData = base.filter(pred);
    app._page = 1;
    app.displayResults();
  }

  // --- Сброс выбора: корректный выход, восстановит выдачу из снимка в app.js по событию ---
  function resetFilter() {
    closeFilterMode();
  }

  // --- Esc: закрыть фильтр и не дать очистить строку поиска общим Esc-хендлером ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('is-filter-mode')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeFilterMode();
    }
  });

  // Публичный API
  window.FilterAddon = {
    open: openFilterMode,
    close: closeFilterMode,
    apply: applyFilter,
    reset: resetFilter,
  };

  // «Лёгкая» инициализация, которую можно вызвать из UI-скриптов
  window.setupFilterAddon = function () { return true; };
})();

