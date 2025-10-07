/* addons/copy-mode.js — режим COPY без localStorage + выпадающий список выбранных */
(function () {
  /** @type {Map<string,{sku:string,name:string}>} */
  const selected = new Map(); // key = `${sku}|||${name}`

  const els = {
    switch: null,
    panel: null,
    count: null,
    copyBtn: null,
    clearBtn: null,
    list: null,
    panelLeft: null,
  };

  function keyOf(sku, name) {
    return `${sku}|||${name}`;
  }

  function isOn() {
    return !!(els.switch && els.switch.checked);
  }
  function setOn(on) {
    if (!els.switch) return;
    els.switch.checked = !!on;
    updatePanel();
    applyHighlights();
  }

  function updatePanel() {
    const n = selected.size;
    if (els.count) els.count.textContent = `Выбрано: ${n}`;
    if (els.copyBtn) els.copyBtn.textContent = n > 0 ? `Копировать ${n} строк` : 'Копировать';

    if (!els.panel) return;
    if (isOn()) {
      els.panel.classList.remove('hidden');
      els.panel.setAttribute('aria-hidden', 'false');
    } else {
      els.panel.classList.add('hidden');
      els.panel.setAttribute('aria-hidden', 'true');
      hideList();
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
    markCell(cell);
    updatePanel();
    if (!isListHidden()) renderList(); // если список открыт — обновим
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
  // если режим выключен и выбор пуст, вообще ничего не делаем
  if (!isOn() && selected.size === 0) return;

  document.querySelectorAll('td.copyable[data-sku][data-name]').forEach(markCell);
  updatePanel();
}

  async function copyAll() {
    if (!selected.size) return;

    const lines = [];
    selected.forEach(({ sku, name }) => {
      const safeName = String(name).replace(/[\t\r\n]+/g, ' ').trim();
      const safeSku = String(sku).replace(/[\t\r\n]+/g, '').trim();
      lines.push(`${safeName}\t${safeSku}`);
    });
    const text = lines.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      pulseCopied();
      clearAll();
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
      pulseCopied();
      clearAll();
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
    applyHighlights();
    renderList(); // если список открыт — очистится
  }

  // ---------- выпадающий список ----------
  function isListHidden() {
    return !els.list || els.list.classList.contains('hidden');
  }
  function showList() {
    if (!els.list) return;
    renderList();
    els.list.classList.remove('hidden');
    els.list.setAttribute('aria-hidden', 'false');
    // клик вне — закрыть
    setTimeout(() => {
      document.addEventListener('click', onDocClick, { capture: true, once: true });
    }, 0);
  }
  function hideList() {
    if (!els.list) return;
    els.list.classList.add('hidden');
    els.list.setAttribute('aria-hidden', 'true');
  }
  function onDocClick(e) {
    if (!els.list || isListHidden()) return;
    const within = els.list.contains(e.target) || els.count.contains(e.target);
    if (!within) hideList();
  }
  function toggleList() {
    if (isListHidden()) showList(); else hideList();
  }
  function renderList() {
    if (!els.list) return;
    if (selected.size === 0) {
      els.list.innerHTML = `<div class="copy-list-item"><span class="copy-list-title">Список пуст</span></div>`;
      return;
    }
    const rows = [];
    selected.forEach(({sku, name}) => {
      const title = escapeHtml(name);
      const art = escapeHtml(sku);
      const key = escapeAttr(keyOf(sku, name));
      rows.push(`
        <div class="copy-list-item" data-key="${key}">
          <div>
            <span class="copy-list-title">${title}</span>
            <span class="copy-list-article">${art}</span>
          </div>
          <button type="button" class="copy-remove" data-key="${key}" title="Убрать из выбора">🗑</button>
        </div>
      `);
    });
    els.list.innerHTML = rows.join('');
  }

  function removeByKey(key) {
    if (!key) return;
    if (!selected.has(key)) return;
    const { sku, name } = selected.get(key);
    selected.delete(key);

    // снять подсветку в таблице, если элемент виден
    const cell = document.querySelector(`td.copyable[data-sku="${cssEscape(sku)}"][data-name="${cssEscape(name)}"]`);
    if (cell) markCell(cell);

    updatePanel();
    renderList();
  }

  // ---------- utils ----------
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) {
    return String(s).replace(/"/g, '&quot;');
  }
  function cssEscape(s) {
    // минимальный эскейп для селектора атрибута
    return String(s).replace(/(["\\])/g, '\\$1');
  }

  // ---------- init/UI ----------
  function bindUI() {
    els.switch    = document.getElementById('copyModeSwitch');
    els.panel     = document.getElementById('copyPanel');
    els.count     = document.getElementById('copyCount');
    els.copyBtn   = document.getElementById('copyDo');
    els.clearBtn  = document.getElementById('copyClear');
    els.list      = document.getElementById('copyList');
    els.panelLeft = document.querySelector('.copy-panel-left');

    if (els.switch) {
      // по умолчанию режим выключен на каждой загрузке
      els.switch.checked = false;
      els.switch.addEventListener('change', () => setOn(els.switch.checked));
    }

    els.copyBtn  && els.copyBtn.addEventListener('click', copyAll);
    els.clearBtn && els.clearBtn.addEventListener('click', clearAll);

    // клик по "Выбрано: N" — открыть/закрыть список
    els.count && els.count.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isOn()) return; // список доступен только в режиме COPY
      toggleList();
    });

    // делегат удаления
    els.list && els.list.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-remove');
      if (!btn) return;
      const key = btn.getAttribute('data-key');
      removeByKey(key);
    });

    // горячая клавиша: Ctrl/Cmd + Enter — копировать
    document.addEventListener('keydown', (e) => {
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (ctrlOrCmd && e.key === 'Enter' && isOn()) {
        e.preventDefault();
        copyAll();
      }
    });

    // перерисовка результатов — обновить подсветку
    document.addEventListener('results:rendered', () => {
  if (!isOn() && selected.size === 0) return;
  applyHighlights();
});

    updatePanel();
    applyHighlights();
  }

  function init() {
    // Никакого localStorage: каждую загрузку начинаем с пустого выбора и COPY=OFF
    selected.clear();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindUI);
    } else {
      bindUI();
    }
  }

  window.CopyMode = { isOn, toggleFromCell, applyHighlights };

  init();
})();

