/* addons/copy-mode.js
 * Режим массового копирования «COPY».
 * - Левый клик по наименованию в режиме COPY — добавляет/убирает позицию в список.
 * - Сохранение выбора между поисками и перезагрузками (localStorage).
 * - «Копировать N строк» кладёт в буфер TSV (Название<TAB>Артикул) построчно.
 * - Горячая клавиша: Ctrl/Cmd + Enter — копировать.
 */

(function () {
  const LS_ON_KEY = 'copyMode:on';
  const LS_ITEMS_KEY = 'copyMode:items'; // [{sku, name}] в JSON

  /** @type {Map<string,{sku:string,name:string}>} */
  const selected = new Map(); // key = `${sku}|||${name}`

  const els = {
    switch: null,
    panel: null,
    count: null,
    copyBtn: null,
    clearBtn: null,
  };

  function keyOf(sku, name) {
    return `${sku}|||${name}`;
  }

  function readLS() {
    try {
      const raw = localStorage.getItem(LS_ITEMS_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      selected.clear();
      arr.forEach(({ sku, name }) => {
        if (sku && name) selected.set(keyOf(sku, name), { sku, name });
      });
    } catch {}
  }

  function writeLS() {
    const arr = Array.from(selected.values());
    try {
      localStorage.setItem(LS_ITEMS_KEY, JSON.stringify(arr));
    } catch {}
  }

  function isOn() {
    return !!(els.switch && els.switch.checked);
  }

  function setOn(on) {
    if (!els.switch) return;
    els.switch.checked = !!on;
    localStorage.setItem(LS_ON_KEY, on ? '1' : '0');
    updatePanel();
    applyHighlights();
  }

  function updatePanel() {
    const n = selected.size;
    if (els.count) els.count.textContent = `Выбрано: ${n}`;
    if (!els.panel) return;
    // панель показываем только когда режим включён
    if (isOn()) {
      els.panel.classList.remove('hidden');
      els.panel.setAttribute('aria-hidden', 'false');
      if (els.copyBtn) els.copyBtn.textContent = n > 0 ? `Копировать ${n} строк` : 'Копировать';
    } else {
      els.panel.classList.add('hidden');
      els.panel.setAttribute('aria-hidden', 'true');
    }
  }

  function toggleFromCell(cell) {
    const sku = (cell.getAttribute('data-sku') || '').trim();
    const name = (cell.getAttribute('data-name') || '').trim();
    if (!sku || !name) return;

    const k = keyOf(sku, name);
    if (selected.has(k)) {
      selected.delete(k);
    } else {
      selected.set(k, { sku, name });
    }
    writeLS();
    markCell(cell);
    updatePanel();
  }

  function markCell(cell) {
    const tr = cell.closest('tr');
    if (!tr) return;
    const sku = (cell.getAttribute('data-sku') || '').trim();
    const name = (cell.getAttribute('data-name') || '').trim();
    const inList = selected.has(keyOf(sku, name));

    tr.classList.toggle('copy-selected', inList);
    const badge = cell.querySelector('.copy-badge');
    if (badge) badge.style.display = inList ? 'inline-block' : 'none';
    cell.title = inList ? 'В списке на копирование (ЛКМ — убрать)' : 'ЛКМ — добавить в список';
  }

  function applyHighlights() {
    // пройти по текущим видимым результатам и подсветить те, что в selected
    const cells = document.querySelectorAll('td.copyable[data-sku][data-name]');
    cells.forEach((cell) => markCell(cell));
    updatePanel();
  }

  async function copyAll() {
    if (!selected.size) return;

    // TSV: Название \t Артикул \n ...
    const lines = [];
    selected.forEach(({ sku, name }) => {
      // подчищаем табы/переносы, чтобы вставка в Excel не съезжала
      const safeName = String(name).replace(/[\t\r\n]+/g, ' ').trim();
      const safeSku = String(sku).replace(/[\t\r\n]+/g, '').trim();
      lines.push(`${safeName}\t${safeSku}`);
    });
    const text = lines.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      pulseCopied();
    } catch {
      // фоллбек через textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
      pulseCopied();
    }
  }

  function pulseCopied() {
    if (!els.copyBtn) return;
    const old = els.copyBtn.textContent;
    els.copyBtn.textContent = 'Скопировано!';
    setTimeout(() => { els.copyBtn.textContent = old; }, 900);
  }

  function clearAll() {
    selected.clear();
    writeLS();
    applyHighlights();
  }

  function bindUI() {
    els.switch = document.getElementById('copyModeSwitch');
    els.panel  = document.getElementById('copyPanel');
    els.count  = document.getElementById('copyCount');
    els.copyBtn= document.getElementById('copyDo');
    els.clearBtn=document.getElementById('copyClear');

    if (els.switch) {
      const saved = localStorage.getItem(LS_ON_KEY) === '1';
      els.switch.checked = saved;
      els.switch.addEventListener('change', () => setOn(els.switch.checked));
    }

    if (els.copyBtn) els.copyBtn.addEventListener('click', copyAll);
    if (els.clearBtn) els.clearBtn.addEventListener('click', clearAll);

    // горячая клавиша: Ctrl/Cmd + Enter
    document.addEventListener('keydown', (e) => {
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (ctrlOrCmd && e.key === 'Enter' && isOn()) {
        e.preventDefault();
        copyAll();
      }
    });

    // когда результаты обновились — подсветить выбранные
    document.addEventListener('results:rendered', applyHighlights);

    // начальная отрисовка
    updatePanel();
    applyHighlights();
  }

  function init() {
    readLS();
    // возможно, DOM ещё не готов
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindUI);
    } else {
      bindUI();
    }
  }

  // публичный API для app.js
  window.CopyMode = {
    isOn,
    toggleFromCell,
    applyHighlights,
  };

  init();
})();

