let DB = window.OPTIBOX_DB;

async function init() {
  if (!DB) {
    try {
      const res = await fetch('./data.json');
      DB = await res.json();
    } catch(e) {
      console.error("Ошибка загрузки данных", e);
    }
  }

  const widths = [300, 400, 600, 800, 1000, 1200];
  const wSelect = document.getElementById('sel-w');
  wSelect.innerHTML = widths.map(w => `<option value="${w}" ${w === 800 ? 'selected' : ''}>${w}</option>`).join('');

  updateDimensions();
  render();
}

function onWidthChange() {
  updateDimensions();
  render();
}

function updateDimensions() {
  const w = parseInt(document.getElementById('sel-w').value);

  const heights = (w === 300) ? [1800, 2000] : [1600, 1800, 2000, 2200];
  const hSelect = document.getElementById('sel-h');
  const curH = parseInt(hSelect.value) || 2000;
  hSelect.innerHTML = heights.map(h => `<option value="${h}" ${h === curH || (curH === 1600 && w === 300 && h === 1800) ? 'selected' : ''}>${h}</option>`).join('');

  let depths = [400, 500, 600, 800, 1000];
  if (w === 1000) depths.push(1200);
  const dSelect = document.getElementById('sel-d');
  const curD = parseInt(dSelect.value) || 600;
  dSelect.innerHTML = depths.map(d => `<option value="${d}" ${d === curD ? 'selected' : ''}>${d}</option>`).join('');

  const plinthSelect = document.getElementById('sel-plinth');
  if (w === 300 && plinthSelect.value === '200') plinthSelect.value = '100';

  updateBasicRailsAvailability();
  updateProOptionsAvailability();
}

var currentMode = 'basic';
var previewMode = 'front';
var basicSideRailsQty = 0;
var basicCrossRailsQty = 0;

function setMode(mode) {
  if (currentMode === mode) return;
  currentMode = mode;

  document.getElementById('btn-mode-basic').classList.toggle('active', mode === 'basic');
  document.getElementById('btn-mode-pro').classList.toggle('active', mode === 'pro');

  const wrapBasicMount = document.getElementById('wrap-basic-mounting');
  const subBasicRails = document.getElementById('sub-basic-rails');
  const selBasicMount = document.getElementById('sel-basic-mounting');
  const proAccs = document.getElementById('pro-accordions');

  if (mode === 'pro') {
    if (wrapBasicMount) wrapBasicMount.style.display = 'none';
    proAccs.style.display = 'flex';
  } else {
    if (wrapBasicMount) wrapBasicMount.style.display = 'block';
    if (subBasicRails) {
      subBasicRails.style.display = (selBasicMount && selBasicMount.value === 'rails') ? 'block' : 'none';
    }
    proAccs.style.display = 'none';
  }

  updateProOptionsAvailability();
  render();
}

function onBasicMountingChange() {
  const sel = document.getElementById('sel-basic-mounting');
  const subRails = document.getElementById('sub-basic-rails');
  if (subRails) {
    subRails.style.display = (sel && sel.value === 'rails') ? 'block' : 'none';
  }
  updateBasicRailsAvailability();
  render();
}

function changeBasicRailQty(type, delta) {
  if (type === 'side') {
    basicSideRailsQty = Math.max(0, basicSideRailsQty + delta);
    const el = document.getElementById('basic-side-rails-qty');
    if (el) el.innerText = basicSideRailsQty;
  } else if (type === 'cross') {
    basicCrossRailsQty = Math.max(0, basicCrossRailsQty + delta);
    const el = document.getElementById('basic-cross-rails-qty');
    if (el) el.innerText = basicCrossRailsQty;
  }
  render();
}

function quickAssembleAcbTier() {
  const w = parseInt(document.getElementById('sel-w').value);
  const d = parseInt(document.getElementById('sel-d').value);
  if (w < 600 || d < 600) return;

  basicSideRailsQty = 1;
  basicCrossRailsQty = 1;
  const sideEl = document.getElementById('basic-side-rails-qty');
  if (sideEl) sideEl.innerText = basicSideRailsQty;
  const crossEl = document.getElementById('basic-cross-rails-qty');
  if (crossEl) crossEl.innerText = basicCrossRailsQty;

  const chkAcb = document.getElementById('chk-basic-acb-shelf');
  if (chkAcb) chkAcb.checked = true;

  render();
}

function clearBasicRails() {
  basicSideRailsQty = 0;
  basicCrossRailsQty = 0;
  const sideEl = document.getElementById('basic-side-rails-qty');
  if (sideEl) sideEl.innerText = 0;
  const crossEl = document.getElementById('basic-cross-rails-qty');
  if (crossEl) crossEl.innerText = 0;

  const chkAcb = document.getElementById('chk-basic-acb-shelf');
  if (chkAcb) chkAcb.checked = false;

  render();
}

function updateBasicRailsAvailability() {
  const wEl = document.getElementById('sel-w');
  const dEl = document.getElementById('sel-d');
  if (!wEl || !dEl) return;
  const w = parseInt(wEl.value);
  const d = parseInt(dEl.value);

  const selBasicMount = document.getElementById('sel-basic-mounting');
  if (selBasicMount) {
    const optMp = selBasicMount.querySelector('option[value="mp"]');
    if (optMp) optMp.disabled = (w === 300);
    if (selBasicMount.value === 'mp' && w === 300) {
      selBasicMount.value = 'rails';
      const subRails = document.getElementById('sub-basic-rails');
      if (subRails) subRails.style.display = 'block';
    }
  }

  const isAcbAllowed = (w >= 600 && d >= 600);
  const chkAcb = document.getElementById('chk-basic-acb-shelf');
  const lblAcb = document.getElementById('lbl-basic-acb-shelf');
  const btnQuick = document.getElementById('btn-quick-acb-tier');

  if (chkAcb) {
    chkAcb.disabled = !isAcbAllowed;
    if (!isAcbAllowed && chkAcb.checked) {
      chkAcb.checked = false;
    }
  }
  if (lblAcb) {
    lblAcb.style.opacity = isAcbAllowed ? '1' : '0.5';
    lblAcb.title = isAcbAllowed ? '' : 'Требуются габариты Ш >= 600 и Г >= 600 мм';
  }
  if (btnQuick) {
    btnQuick.disabled = !isAcbAllowed;
    btnQuick.style.opacity = isAcbAllowed ? '1' : '0.5';
    btnQuick.style.pointerEvents = isAcbAllowed ? 'auto' : 'none';
  }
}

function toggleAccordion(headerEl) {
  const item = headerEl.closest('.accordion-item');
  if (item) {
    item.classList.toggle('open');
  }
}

function onSeismicPlinthChange() {
  const chk = document.getElementById('chk-seismic-plinth');
  const selPlinth = document.getElementById('sel-plinth');
  if (chk && chk.checked) {
    if (selPlinth.value === '200' || selPlinth.value === '0') {
      selPlinth.value = '100';
    }
  }
  updateProOptionsAvailability();
  render();
}

function onPlinthChange() {
  const selPlinth = document.getElementById('sel-plinth');
  const chk = document.getElementById('chk-seismic-plinth');
  if (selPlinth.value === '200' || selPlinth.value === '0') {
    if (chk) chk.checked = false;
  }
  updateProOptionsAvailability();
  render();
}

function onDoorTypeChange() {
  const selDoor = document.getElementById('sel-door-type');
  if (selDoor && selDoor.value === 'none') {
    previewMode = 'inner';
    const btn = document.getElementById('preview-mode-toggle');
    if (btn) {
      btn.classList.add('is-inner');
      const titleText = 'Вид: Внутренний монтаж';
      btn.title = titleText;
      btn.setAttribute('aria-label', titleText);
    }
  }
  updateProOptionsAvailability();
  render();
}

function onSidesChange() {
  const chkSides = document.getElementById('chk-sides');
  const subInter = document.getElementById('sub-inter-cabinet');
  if (subInter) {
    subInter.style.display = (chkSides && !chkSides.checked) ? 'block' : 'none';
  }
  render();
}

function onCableEntryChange() {
  const selCable = document.getElementById('sel-cable-entry');
  const subGlands = document.getElementById('sub-cable-glands');
  if (subGlands) {
    subGlands.style.display = (selCable && selCable.value === 'gland') ? 'block' : 'none';
  }
  render();
}

function onDimensionChange() {
  updateBasicRailsAvailability();
  updateProOptionsAvailability();
  render();
}

// OptiMat A как ярус модульной системы
function onAcbToggle() {
  const chk = document.getElementById('chk-acb');
  const optBox = document.getElementById('acb-options');
  if (optBox) {
    optBox.style.display = chk?.checked ? 'block' : 'none';
  }

  const isChecked = chk?.checked;
  const acbH = parseInt(document.getElementById('sel-acb-height')?.value) || 600;

  if (isChecked) {
    const exists = modularTiers.some(t => t.type === 'acb');
    if (!exists) {
      // Всегда ставим в самый низ стека (по умолчанию)
      modularTiers.push({
        id: nextTierId++,
        type: 'acb',
        height: acbH,
        name: `Отсек выключателя OptiMat A (${acbH} мм)`,
                        badgeCls: 'tier-badge-acb'
      });
    }
  } else {
    modularTiers = modularTiers.filter(t => t.type !== 'acb');
  }

  renderTierList();
  updateModularHeightIndicator();
  updateProOptionsAvailability();
  render();
}

function onAcbHeightChange() {
  const acbH = parseInt(document.getElementById('sel-acb-height')?.value) || 600;
  const acbTier = modularTiers.find(t => t.type === 'acb');
  if (acbTier) {
    acbTier.height = acbH;
    acbTier.name = `Отсек выключателя OptiMat A (${acbH} мм)`;
  }
  renderTierList();
  updateModularHeightIndicator();
  render();
}

function updateProOptionsAvailability() {
  const wEl = document.getElementById('sel-w');
  const hEl = document.getElementById('sel-h');
  const dEl = document.getElementById('sel-d');
  if (!wEl || !hEl) return;
  const w = parseInt(wEl.value);
  const h = parseInt(hEl.value);
  const d = dEl ? parseInt(dEl.value) : 600;

  // Сейсмоусилители
  const chkAmp = document.getElementById('chk-seismic-amp');
  const lblAmp = document.getElementById('lbl-seismic-amp');
  if (chkAmp) {
    if (h === 2000) {
      chkAmp.disabled = false;
      if (lblAmp) lblAmp.style.opacity = '1';
    } else {
      chkAmp.checked = false;
      chkAmp.disabled = true;
      if (lblAmp) lblAmp.style.opacity = '0.5';
    }
  }

  // Сейсмоцоколь
  const selPlinth = document.getElementById('sel-plinth');
  const chkSeismicPlinth = document.getElementById('chk-seismic-plinth');
  const lblSeismicPlinth = document.getElementById('lbl-seismic-plinth');
  const optPlinth200 = selPlinth?.querySelector('option[value="200"]');

  if (selPlinth && chkSeismicPlinth) {
    if (chkSeismicPlinth.checked) {
      if (optPlinth200) optPlinth200.disabled = true;
      if (selPlinth.value === '200' || selPlinth.value === '0') {
        selPlinth.value = '100';
      }
    } else {
      if (optPlinth200) optPlinth200.disabled = (w === 300);
    }

    if (selPlinth.value === '200' || selPlinth.value === '0') {
      chkSeismicPlinth.checked = false;
      chkSeismicPlinth.disabled = true;
      if (lblSeismicPlinth) lblSeismicPlinth.style.opacity = '0.5';
    } else {
      chkSeismicPlinth.disabled = false;
      if (lblSeismicPlinth) lblSeismicPlinth.style.opacity = '1';
    }
  }

  // Двери
  const selDoor = document.getElementById('sel-door-type');
  if (selDoor) {
    const optSolid = selDoor.querySelector('option[value="solid"]');
    const optGlass = selDoor.querySelector('option[value="glass"]');
    const optPartGlass = selDoor.querySelector('option[value="part_glass"]');
    const optDouble = selDoor.querySelector('option[value="double"]');

    const hasGlass = (w !== 300 && w !== 1000 && w !== 1200) && (DB?.doors?.glass?.[w]?.[h] !== undefined);
    const hasPartGlass = DB?.doors?.part_glass?.[w]?.[h] !== undefined;
    const hasDouble = DB?.doors?.double?.[w]?.[h] !== undefined;

    if (w === 1200) {
      if (optSolid) optSolid.disabled = true;
      if (optGlass) optGlass.disabled = true;
      if (optPartGlass) optPartGlass.disabled = true;
      if (optDouble) optDouble.disabled = false;
      if (selDoor.value !== 'double' && selDoor.value !== 'none' && selDoor.value !== 'front_panels' && selDoor.value !== 'sectional') {
        selDoor.value = 'double';
      }
    } else {
      if (optSolid) optSolid.disabled = false;
      if (optGlass) optGlass.disabled = !hasGlass;
      if (optPartGlass) optPartGlass.disabled = !hasPartGlass;
      if (optDouble) optDouble.disabled = !hasDouble;

      if (selDoor.value === 'glass' && !hasGlass) selDoor.value = 'solid';
      if (selDoor.value === 'part_glass' && !hasPartGlass) selDoor.value = 'solid';
      if (selDoor.value === 'double' && !hasDouble) selDoor.value = 'solid';
    }

    selDoor.disabled = false;
  }

  // Ввод кабеля
  const selCable = document.getElementById('sel-cable-entry');
  if (selCable) {
    const optGland = selCable.querySelector('option[value="gland"]');
    const hasGland = DB?.cable_and_service?.gland_panel?.[w] !== undefined;
    if (optGland) optGland.disabled = !hasGland;
    if (selCable.value === 'gland' && !hasGland) selCable.value = 'standard';
  }

  // Карман для документов
  const selPocket = document.getElementById('sel-doc-pocket');
  if (selPocket) {
    const optMetal = selPocket.querySelector('option[value="metal"]');
    const hasMetal = DB?.cable_and_service?.pockets?.metal?.[w] !== undefined;
    if (optMetal) optMetal.disabled = !hasMetal;
    if (selPocket.value === 'metal' && !hasMetal) selPocket.value = 'none';
  }

  // Полка разделительная
  const chkShelf = document.getElementById('chk-divider-shelf');
  const lblShelf = document.getElementById('lbl-divider-shelf');
  const hasShelf = (w === 600 || w === 800) && DB?.divider_shelves?.[w]?.[d] !== undefined;
  if (chkShelf && lblShelf) {
    if (hasShelf) {
      lblShelf.style.display = 'flex';
      chkShelf.disabled = false;
    } else {
      chkShelf.checked = false;
      chkShelf.disabled = true;
      lblShelf.style.display = 'none';
    }
  }

  // Рейки шинодержателя
  const chkBusbar = document.getElementById('chk-busbar-rails');
  const lblBusbar = document.getElementById('lbl-busbar-rails');
  const hasBusbar = DB?.busbar_support_rails?.[d] !== undefined || DB?.busbar_support_rails?.rails?.[d] !== undefined;
  if (chkBusbar && lblBusbar) {
    if (hasBusbar) {
      lblBusbar.style.display = 'flex';
      chkBusbar.disabled = false;
    } else {
      chkBusbar.checked = false;
      chkBusbar.disabled = true;
      lblBusbar.style.display = 'none';
    }
  }

  // Отсек OptiMat A (ACB)
  const chkAcb = document.getElementById('chk-acb');
  const lblAcb = document.getElementById('lbl-acb');
  const acbHint = document.getElementById('acb-depth-hint');
  const acbOptBox = document.getElementById('acb-options');
  const selAcbH = document.getElementById('sel-acb-height');

  const isAcbAllowed = (w >= 600 && d >= 600 && h >= 1800);
  if (chkAcb) {
    if (isAcbAllowed) {
      chkAcb.disabled = false;
      if (lblAcb) lblAcb.style.opacity = '1';
      if (acbHint) acbHint.style.display = 'none';
      if (chkAcb.checked && acbOptBox) acbOptBox.style.display = 'block';
    } else {
      if (chkAcb.checked) {
        chkAcb.checked = false;
        modularTiers = modularTiers.filter(t => t.type !== 'acb');
        renderTierList();
      }
      chkAcb.disabled = true;
      if (lblAcb) lblAcb.style.opacity = '0.5';
      if (acbOptBox) acbOptBox.style.display = 'none';
      if (acbHint) acbHint.style.display = (w >= 600 && h >= 1800 && d < 600) ? 'block' : 'none';
    }
  }

  // Доступность высоты 450 мм у OptiMat A
  if (selAcbH) {
    const opt450 = selAcbH.querySelector('option[value="450"]');
    const has450 = (w === 600 || w === 800);
    if (opt450) {
      opt450.disabled = !has450;
      if (!has450 && selAcbH.value === '450') {
        selAcbH.value = '600';
      }
    }
  }

  updateMountingOptionsAvailability();
  updateModularHeightIndicator();
}

var modularTiers = [];
var nextTierId = 1;

function addModularTier(type, height) {
  const hEl = document.getElementById('sel-h');
  const h = parseInt(hEl?.value) || 2000;
  const maxUsefulH = h - 150;

  let tierHeight = 0;
  let name = '';
  let badgeCls = '';

  if (type === 'din150') {
    tierHeight = 150;
    name = 'Комплект DIN 150 мм (окно)';
    badgeCls = 'tier-badge-din';
  } else if (type === 'din200') {
    tierHeight = 200;
    name = 'Комплект DIN 200 мм (окно, высокий)';
    badgeCls = 'tier-badge-din';
  } else if (type === 'plastron' || type === 'blind' || type === 'perf') {
    const selType = document.getElementById('sel-tier-plastron-type')?.value || 'blind';
    const plastronType = (type === 'blind' || type === 'perf') ? type : selType;
    const sel = document.getElementById('sel-tier-blind-h');
    tierHeight = parseInt(height || sel?.value) || 200;
    if (plastronType === 'perf') {
      type = 'perf';
      name = `Пластрон перфорированный ${tierHeight} мм`;
      badgeCls = 'tier-badge-blind';
    } else {
      type = 'blind';
      name = `Пластрон глухой ${tierHeight} мм`;
      badgeCls = 'tier-badge-blind';
    }
  } else if (type === 'sectional_door') {
    const sel = document.getElementById('sel-tier-sect-door-h');
    tierHeight = parseInt(height || sel?.value) || 200;
    name = `Секционная дверь ${tierHeight} мм`;
    badgeCls = 'tier-badge-din';
  } else if (type === 'partial_mp') {
    const sel = document.getElementById('sel-tier-partial-mp-h');
    tierHeight = parseInt(height || sel?.value) || 200;
    name = `Частичная монтажная плата ${tierHeight} мм`;
    badgeCls = 'tier-badge-mp';
  }

  const currentUsed = modularTiers.reduce((sum, t) => sum + t.height, 0);

  if (currentUsed + tierHeight > maxUsefulH) {
    const warnEl = document.getElementById('height-warning');
    if (warnEl) {
      warnEl.style.display = 'flex';
      warnEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Превышена монтажная высота каркаса`;
    }
    const barEl = document.getElementById('height-bar');
    if (barEl) barEl.classList.add('overflow');
    return;
  }

  const newTier = {
    id: nextTierId++,
    type,
    height: tierHeight,
    name,
    badgeCls
  };

  // Если OptiMat A в самом низу стека — добавляем новые пластроны над ним
  const acbIndex = modularTiers.findIndex(t => t.type === 'acb');
  if (acbIndex !== -1 && acbIndex === modularTiers.length - 1) {
    modularTiers.splice(acbIndex, 0, newTier);
  } else {
    modularTiers.push(newTier);
  }

  renderTierList();
  updateModularHeightIndicator();
  render();
}

function removeModularTier(id) {
  const item = modularTiers.find(t => t.id === id);
  if (item && item.type === 'acb') {
    const chk = document.getElementById('chk-acb');
    if (chk) chk.checked = false;
    const optBox = document.getElementById('acb-options');
    if (optBox) optBox.style.display = 'none';
  }
  modularTiers = modularTiers.filter(t => t.id !== id);
  renderTierList();
  updateModularHeightIndicator();
  render();
}

function clearAllTiers() {
  const chk = document.getElementById('chk-acb');
  if (chk) chk.checked = false;
  const optBox = document.getElementById('acb-options');
  if (optBox) optBox.style.display = 'none';

  modularTiers = [];
  renderTierList();
  updateModularHeightIndicator();
  render();
}

function autoFillRemainingPlastrons() {
  const hEl = document.getElementById('sel-h');
  const wEl = document.getElementById('sel-w');
  const h = parseInt(hEl?.value) || 2000;
  const w = parseInt(wEl?.value) || 800;

  const maxUsefulH = h - 150;
  const currentUsed = modularTiers.reduce((sum, t) => sum + t.height, 0);
  const remaining = maxUsefulH - currentUsed;

  if (remaining <= 0) {
    const warnEl = document.getElementById('height-warning');
    if (warnEl) {
      warnEl.style.display = 'flex';
      warnEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Превышена монтажная высота каркаса`;
    }
    return;
  }

  const available = Object.keys(DB?.blind_plastrons?.[w] || {}).map(Number).sort((a, b) => b - a);
  if (!available.length) return;

  function solve(sizes) {
    const queue = [{ rem: remaining, items: [] }];
    const visited = new Set([remaining]);
    while (queue.length > 0) {
      const { rem, items } = queue.shift();
      if (rem === 0) return items;
      for (const sz of sizes) {
        if (sz <= rem && !visited.has(rem - sz)) {
          visited.add(rem - sz);
          queue.push({ rem: rem - sz, items: [...items, sz] });
        }
      }
    }
    return null;
  }

  let solution = solve([400, 300, 200, 150]);
  if (!solution) solution = solve(available);

  if (!solution) {
    alert(`Невозможно точно заполнить остаток ${remaining} мм (минимальный шаг пластрона 150 мм).`);
    return;
  }

  for (const itemH of solution) {
    const blindTier = {
      id: nextTierId++,
      type: 'blind',
      height: itemH,
      name: `Пластрон глухой ${itemH} мм`,
      badgeCls: 'tier-badge-blind'
    };

    const acbIndex = modularTiers.findIndex(t => t.type === 'acb');
    if (acbIndex !== -1 && acbIndex === modularTiers.length - 1) {
      modularTiers.splice(acbIndex, 0, blindTier);
    } else {
      modularTiers.push(blindTier);
    }
  }

  renderTierList();
  updateModularHeightIndicator();
  render();
}

let draggedTierIndex = null;

function renderTierList() {
  const listEl = document.getElementById('tier-stack-list');
  const clearBtn = document.getElementById('btn-clear-tiers');
  if (!listEl) return;

  if (clearBtn) {
    clearBtn.style.display = modularTiers.length > 0 ? 'inline' : 'none';
  }

  if (modularTiers.length === 0) {
    listEl.innerHTML = `<div style="font-size: 0.74rem; color: var(--text-muted); font-style: italic; padding: 0.65rem 0.5rem; text-align: center; border: 1px dashed var(--border); border-radius: 6px; background: #fbfcfe;">Стек ярусов пуст. Добавьте ярусы кнопками выше или нажмите автозаполнение.</div>`;
    return;
  }

  listEl.innerHTML = modularTiers.map((t, index) => `
  <div class="tier-stack-item ${t.type === 'acb' ? 'is-acb-item' : ''}"
  draggable="true"
  data-index="${index}"
  ondragstart="onTierDragStart(event, ${index})"
  ondragover="onTierDragOver(event)"
  ondragleave="onTierDragLeave(event)"
  ondrop="onTierDrop(event, ${index})"
  ondragend="onTierDragEnd(event)">
  <div style="display: flex; align-items: center; gap: 0.45rem; min-width: 0; overflow: hidden;">
  <i class="fa-solid fa-grip-vertical tier-drag-handle" title="Потяните для изменения порядка"></i>
  <span class="tier-badge ${t.badgeCls}">${t.height} мм</span>
  <span class="tier-title" title="${t.name}">${t.type === 'acb' ? '<strong>' + t.name + '</strong>' : t.name}</span>
  </div>
  <button type="button" class="btn-tier-del" onclick="removeModularTier(${t.id})" title="Удалить ярус">
  <i class="fa-solid fa-xmark"></i>
  </button>
  </div>
  `).join('');
}

function onTierDragStart(e, index) {
  draggedTierIndex = index;
  e.currentTarget.classList.add('is-dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', index);
}

function onTierDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  const rect = target.getBoundingClientRect();
  const nextMid = rect.top + rect.height / 2;

  if (e.clientY < nextMid) {
    target.classList.add('drag-over-top');
    target.classList.remove('drag-over-bottom');
  } else {
    target.classList.add('drag-over-bottom');
    target.classList.remove('drag-over-top');
  }
}

function onTierDragLeave(e) {
  e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
}

function onTierDrop(e, targetIndex) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over-top', 'drag-over-bottom');

  if (draggedTierIndex === null || draggedTierIndex === targetIndex) return;

  const rect = target.getBoundingClientRect();
  const isTop = e.clientY < (rect.top + rect.height / 2);

  const movedItem = modularTiers.splice(draggedTierIndex, 1)[0];
  let newIndex = targetIndex;
  if (!isTop && draggedTierIndex < targetIndex) {
    // Вставка вниз
  } else if (!isTop && draggedTierIndex > targetIndex) {
    newIndex++;
  } else if (isTop && draggedTierIndex < targetIndex) {
    newIndex--;
  }

  modularTiers.splice(Math.max(0, newIndex), 0, movedItem);
  renderTierList();
  renderCabinetPreview();
  render();
}

function onTierDragEnd(e) {
  draggedTierIndex = null;
  document.querySelectorAll('.tier-stack-item').forEach(el => {
    el.classList.remove('is-dragging', 'drag-over-top', 'drag-over-bottom');
  });
}

function onMountingTypeChange() {
  const type = document.getElementById('sel-mounting-type')?.value || 'mp_2mm';

  const subMp = document.getElementById('sub-mp');
  const subModular = document.getElementById('sub-modular');

  if (subMp) subMp.style.display = (type === 'mp_2mm' || type === 'mp_3mm') ? 'block' : 'none';
  if (subModular) subModular.style.display = (type === 'modular') ? 'block' : 'none';

  if (type === 'modular') {
    renderTierList();
    updateModularHeightIndicator();
  }

  render();
}

function updateModularHeightIndicator() {
  const hEl = document.getElementById('sel-h');
  const wEl = document.getElementById('sel-w');
  if (!hEl) return;
  const h = parseInt(hEl.value) || 2000;
  const w = parseInt(wEl?.value) || 600;

  const maxUsefulH = Math.max(h - 150, 0);
  const used = modularTiers.reduce((sum, t) => sum + t.height, 0);
  const total = maxUsefulH;

  const textEl = document.getElementById('height-indicator-text');
  const barEl = document.getElementById('height-bar');
  const warnEl = document.getElementById('height-warning');
  const subtextEl = document.getElementById('height-subtext');

  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  if (textEl) {
    textEl.innerHTML = `<span>Занято: <strong>${used}</strong> из <strong>${total}</strong> мм</span><span>${pct}%</span>`;
  }
  if (subtextEl) {
    subtextEl.innerHTML = `(с учетом обязательных компенсаторов и доборов 150 мм)`;
  }
  if (barEl) {
    barEl.style.width = `${Math.min(pct, 100)}%`;
    barEl.classList.toggle('overflow', used > total);
  }
  if (warnEl) {
    warnEl.style.display = used > total ? 'flex' : 'none';
    if (used > total) {
      warnEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Превышена монтажная высота каркаса`;
    }
  }

  let modulesPerRow = 0;
  if (w === 600) modulesPerRow = 24;
  else if (w === 800) modulesPerRow = 35;
  else if (w === 1000) modulesPerRow = 46;

  const dinCount = modularTiers.filter(t => t.type === 'din150' || t.type === 'din200').length;
  const totalModules = dinCount * modulesPerRow;
  const capTextEl = document.getElementById('din-capacity-text');
  if (capTextEl) {
    capTextEl.innerText = `Суммарная емкость: ${totalModules} модулей`;
  }
}

function updateMountingOptionsAvailability() {
  const wEl = document.getElementById('sel-w');
  const hEl = document.getElementById('sel-h');
  const dEl = document.getElementById('sel-d');
  if (!wEl || !hEl) return;
  const w = parseInt(wEl.value);
  const h = parseInt(hEl.value);
  const d = dEl ? parseInt(dEl.value) : 600;
  const sel = document.getElementById('sel-mounting-type');
  if (!sel) return;

  const optMp2 = sel.querySelector('option[value="mp_2mm"]');
  const optMp3 = sel.querySelector('option[value="mp_3mm"]');
  const optMod = sel.querySelector('option[value="modular"]');

  const hasMp2 = w !== 300 && DB?.mounting_plates?.[`${h}x${w}`] !== undefined;
  const hasMp3 = DB?.internal_mounting?.mp_3mm?.[h]?.[w] !== undefined;
  const hasMod = (w === 600 || w === 800 || w === 1000) && h >= 1800;

  // Базовый селект монтажа и доступность рейки / полки ACB
  updateBasicRailsAvailability();

  if (optMp2) optMp2.disabled = !hasMp2;
  if (optMp3) optMp3.disabled = !hasMp3;
  if (optMod) optMod.disabled = !hasMod;

  if (sel.value === 'mp_2mm' && !hasMp2) sel.value = 'none';
  if (sel.value === 'mp_3mm' && !hasMp3) sel.value = hasMp2 ? 'mp_2mm' : 'none';
  if (sel.value === 'modular' && !hasMod) sel.value = hasMp2 ? 'mp_2mm' : 'none';

  const isAcbChecked = document.getElementById('chk-acb')?.checked;
  const mpNotice = document.getElementById('mp-acb-notice');
  if (mpNotice) {
    mpNotice.style.display = (isAcbChecked && (sel.value === 'mp_2mm' || sel.value === 'mp_3mm')) ? 'block' : 'none';
  }

  onMountingTypeChange();
}

function getName(art) {
  return DB?.catalog[art] || `Элемент OptiBox M (арт. ${art})`;
}

function getPartialPlatesForHeight(remainingH, width) {
  const platesMap = DB?.partial_mounting_plates?.[width];
  if (!platesMap || remainingH < 150) return [];

  const available = Object.keys(platesMap).map(Number).sort((a, b) => b - a);
  const result = [];
  let rem = remainingH;

  for (const sz of available) {
    while (rem >= sz) {
      result.push({ art: platesMap[sz], name: getName(platesMap[sz]), qty: 1 });
      rem -= sz;
    }
  }
  return result;
}

var currentSections = {
  base: [],
  mounting: [],
  plinth: [],
  accessories: []
};

function render() {
  if (!DB) return;
  const h = document.getElementById('sel-h').value;
  const w = document.getElementById('sel-w').value;
  const d = document.getElementById('sel-d').value;
  const plinth = document.getElementById('sel-plinth').value;
  const hasSides = document.getElementById('chk-sides').checked;

  const key = `${h}x${w}x${d}`;
  const frame = DB.frames[key];
  const tbody = document.getElementById('spec-table-body');
  const tableWrap = document.getElementById('spec-table-wrap');
  const emptyEl = document.getElementById('spec-empty');

  tbody.innerHTML = '';

  currentSections = {
    base: [],
    mounting: [],
    plinth: [],
    accessories: []
  };

  if (!frame) {
    tableWrap.style.display = 'none';
    emptyEl.style.display = 'block';
    emptyEl.innerText = `Типоразмер ${key} отсутствует в каталоге OptiBox M`;
    document.getElementById('items-count').innerText = 'Позиций: 0';
    renderCabinetPreview();
    return;
  }

  tableWrap.style.display = '';
  emptyEl.style.display = 'none';

  // БЛОК 1: Каркас
  if (frame.posts) currentSections.base.push({ art: frame.posts, name: getName(frame.posts), qty: 1 });
  if (frame.roof_base) currentSections.base.push({ art: frame.roof_base, name: getName(frame.roof_base), qty: 1 });

  let doorArt = frame.door;
  if (currentMode === 'pro') {
    const doorType = document.getElementById('sel-door-type')?.value || 'solid';

    if (doorType === 'none' || doorType === 'front_panels' || doorType === 'sectional') {
      doorArt = null;
      if (doorType === 'front_panels' || doorType === 'sectional') {
        const compType = document.getElementById('sel-comp-type')?.value || 'blind';
        const compArt = (compType === 'perf') ? DB?.external_facades?.comp_front_perf?.[w] : DB?.external_facades?.comp_front_blind?.[w];
        if (compArt) currentSections.base.push({ art: compArt, name: getName(compArt), qty: 1 });
      }
    } else if (w === '1200' || doorType === 'double') {
      doorArt = DB?.doors?.double?.[w]?.[h] || frame.door;
    } else if (doorType === 'glass') {
      doorArt = DB?.doors?.glass?.[w]?.[h] || frame.door;
    } else if (doorType === 'part_glass') {
      doorArt = DB?.doors?.part_glass?.[w]?.[h] || frame.door;
    }
  }
  if (doorArt) currentSections.base.push({ art: doorArt, name: getName(doorArt), qty: 1 });
  if (frame.rear_panel) currentSections.base.push({ art: frame.rear_panel, name: getName(frame.rear_panel), qty: 1 });

  // БЛОК 2: Панели и монтажные платы
  if (hasSides) {
    if (frame.side_panels) {
      currentSections.mounting.push({ art: frame.side_panels, name: getName(frame.side_panels), qty: 1 });
    }
  } else {
    const bayingArt = DB?.accessories?.baying_kit || '419725';
    currentSections.mounting.push({ art: bayingArt, name: getName(bayingArt), qty: 1 });
    if (document.getElementById('chk-inter-mp')?.checked) {
      const interMpArt = DB?.inter_cabinet?.intermediate_mp?.[h];
      if (interMpArt) currentSections.mounting.push({ art: interMpArt, name: getName(interMpArt), qty: 1 });
    }
  }

  if (currentMode === 'basic') {
    const basicMounting = document.getElementById('sel-basic-mounting')?.value || 'mp';
    if (basicMounting === 'mp') {
      if (w !== '300') {
        const mpArt = DB.mounting_plates[`${h}x${w}`];
        if (mpArt) {
          currentSections.mounting.push({ art: mpArt, name: getName(mpArt), qty: 1 });
          currentSections.mounting.push({ art: DB.accessories.plate_brackets, name: getName(DB.accessories.plate_brackets), qty: 1 });
        }
      }
    } else if (basicMounting === 'rails') {
      const sideRailsMap = {
        '400': '419728',
        '500': '419729',
        '600': '419730',
        '800': '419731',
        '1000': '419732',
        '1200': '419727'
      };
      if (basicSideRailsQty > 0) {
        const railArt = sideRailsMap[d];
        if (railArt) {
          currentSections.mounting.push({ art: railArt, name: getName(railArt), qty: basicSideRailsQty });
        }
      }
      if (basicCrossRailsQty > 0) {
        const crossRailArt = DB?.cross_rails?.[w];
        if (crossRailArt) {
          currentSections.mounting.push({ art: crossRailArt, name: getName(crossRailArt), qty: basicCrossRailsQty });
        }
      }
      const chkAcb = document.getElementById('chk-basic-acb-shelf');
      if (chkAcb && chkAcb.checked && parseInt(w) >= 600 && parseInt(d) >= 600) {
        const shelfArt = DB?.internal_mounting?.acb?.shelf?.[w];
        if (shelfArt) {
          currentSections.mounting.push({ art: shelfArt, name: getName(shelfArt), qty: 1 });
        }
      }
    }
  } else {
    // PRO режим
    const isAcb = document.getElementById('chk-acb')?.checked;
    const acbH = isAcb ? (parseInt(document.getElementById('sel-acb-height')?.value) || 600) : 0;

    if (isAcb) {
      const shelfArt = DB?.internal_mounting?.acb?.shelf?.[w];
      if (shelfArt) currentSections.mounting.push({ art: shelfArt, name: getName(shelfArt), qty: 1 });

      let zoneArt = null;
      if (acbH === 450) {
        zoneArt = (w === '600') ? '419989' : (w === '800' ? '419990' : null);
      } else {
        zoneArt = DB?.internal_mounting?.acb?.zoning?.[w];
      }
      if (zoneArt) currentSections.mounting.push({ art: zoneArt, name: getName(zoneArt), qty: 1 });

      const acbPostArt = DB?.internal_mounting?.acb?.posts?.[h];
      if (acbPostArt) currentSections.mounting.push({ art: acbPostArt, name: getName(acbPostArt), qty: 1 });

      // Поперечные рейки 49 мм по глубине каркаса для установки отсека ACB
      const crossRailArt = DB?.cross_rails?.[d];
      if (crossRailArt) {
        currentSections.mounting.push({ art: crossRailArt, name: getName(crossRailArt), qty: 1 });
      }

      const acbSidePanels = {
        450: { 400: '419085', 600: '419086' },
        600: { 400: '419091', 600: '419092' }
      };
      const acbSideArt = acbSidePanels[acbH]?.[d] || (acbH === 450 ? '419086' : '419092');
      if (acbSideArt && DB?.catalog?.[acbSideArt]) {
        currentSections.mounting.push({ art: acbSideArt, name: getName(acbSideArt), qty: 1 });
      }
    }

    const mountType = document.getElementById('sel-mounting-type')?.value || 'mp_2mm';

    if (mountType === 'mp_2mm' || mountType === 'mp_3mm') {
      if (isAcb) {
        const remH = parseInt(h) - acbH;
        const partials = getPartialPlatesForHeight(remH, w);
        for (const p of partials) {
          currentSections.mounting.push(p);
        }
      } else {
        if (mountType === 'mp_2mm' && w !== '300') {
          const mpArt = DB.mounting_plates[`${h}x${w}`];
          if (mpArt) {
            currentSections.mounting.push({ art: mpArt, name: getName(mpArt), qty: 1 });
            currentSections.mounting.push({ art: DB.accessories.plate_brackets, name: getName(DB.accessories.plate_brackets), qty: 1 });
          }
        } else if (mountType === 'mp_3mm') {
          const mp3Art = DB?.internal_mounting?.mp_3mm?.[h]?.[w];
          if (mp3Art) {
            currentSections.mounting.push({ art: mp3Art, name: getName(mp3Art), qty: 1 });
            currentSections.mounting.push({ art: DB.accessories.plate_brackets, name: getName(DB.accessories.plate_brackets), qty: 1 });
          }
        }
      }

      if (document.getElementById('chk-mp-traverses')?.checked) {
        const travArt = DB?.internal_mounting?.traverses?.[d];
        if (travArt) currentSections.mounting.push({ art: travArt, name: getName(travArt), qty: 1 });
        const fixArt = DB?.internal_mounting?.mp_fixator || '419753';
        currentSections.mounting.push({ art: fixArt, name: getName(fixArt), qty: 1 });
      }
    } else if (mountType === 'modular') {
      const postArt = DB?.internal_mounting?.plastron_posts?.[h];
      if (postArt) currentSections.mounting.push({ art: postArt, name: getName(postArt), qty: 1 });

      const compType = document.getElementById('sel-comp-type')?.value || 'blind';
      const compArt = (compType === 'perf') ? DB?.internal_mounting?.comp_perf?.[w] : DB?.internal_mounting?.comp_blind?.[w];
      if (compArt) currentSections.mounting.push({ art: compArt, name: getName(compArt), qty: 1 });

      const doborArt = DB?.internal_mounting?.dobors?.[w];
      if (doborArt) currentSections.mounting.push({ art: doborArt, name: getName(doborArt), qty: 1 });

      const fbSidePanelMap = {
        150: { 400: '419063', 600: '419064' },
        200: { 400: '419065', 600: '419066' },
        250: { 400: '419067', 600: '419068' },
        300: { 400: '419069', 600: '419070' },
        350: { 400: '419071', 600: '419072' },
        400: { 400: '419073', 600: '419074' }
      };

      const tierMap = new Map();
      const fbSideMap = new Map();

      for (const tier of modularTiers) {
        let art = null;
        if (tier.type === 'din150') {
          art = DB?.internal_mounting?.din_kits?.['150']?.[w];
        } else if (tier.type === 'din200') {
          art = DB?.internal_mounting?.din_kits?.['200']?.[w];
        } else if (tier.type === 'blind') {
          art = DB?.blind_plastrons?.[w]?.[tier.height];
        } else if (tier.type === 'perf') {
          art = DB?.perf_plastrons?.[w]?.[tier.height];
        } else if (tier.type === 'sectional_door') {
          art = DB?.external_facades?.sectional_doors?.[w]?.[tier.height];
          const baffleArt = DB?.external_facades?.sectional_baffle?.[w];
          if (baffleArt) {
            if (!tierMap.has(baffleArt)) {
              tierMap.set(baffleArt, { art: baffleArt, name: getName(baffleArt), qty: 1 });
            } else {
              tierMap.get(baffleArt).qty += 1;
            }
          }
        } else if (tier.type === 'partial_mp') {
          art = DB?.partial_mounting_plates?.[w]?.[tier.height];
          const fbSideArt = fbSidePanelMap[tier.height]?.[d] || fbSidePanelMap[tier.height]?.[600] || (d === '400' ? '419065' : '419066');
          if (fbSideArt && DB?.catalog?.[fbSideArt]) {
            if (!fbSideMap.has(fbSideArt)) {
              fbSideMap.set(fbSideArt, { art: fbSideArt, name: getName(fbSideArt), qty: 1 });
            } else {
              fbSideMap.get(fbSideArt).qty += 1;
            }
          }
        }

        if (art) {
          if (!tierMap.has(art)) {
            tierMap.set(art, { art, name: getName(art), qty: 1 });
          } else {
            tierMap.get(art).qty += 1;
          }
        }
      }
      for (const item of tierMap.values()) {
        currentSections.mounting.push(item);
      }
      for (const item of fbSideMap.values()) {
        currentSections.mounting.push(item);
      }
    }

    if (document.getElementById('chk-divider-shelf')?.checked) {
      const shelfArt = DB?.divider_shelves?.[w]?.[d];
      if (shelfArt) currentSections.mounting.push({ art: shelfArt, name: getName(shelfArt), qty: 1 });
    }
  }

  // БЛОК 3: Цоколь
  const isSeismicPlinth = (currentMode === 'pro') && document.getElementById('chk-seismic-plinth')?.checked && plinth === '100';
  if (isSeismicPlinth) {
    const cornerArt = DB?.seismic?.corners || '419802';
    currentSections.plinth.push({ art: cornerArt, name: getName(cornerArt), qty: 1 });
    const frontPlinth = DB?.seismic?.panels?.[w];
    if (frontPlinth) {
      currentSections.plinth.push({ art: frontPlinth, name: getName(frontPlinth) + ' (передняя + задняя)', qty: 1 });
    }
    if (hasSides) {
      const sidePlinth = DB?.seismic?.panels?.[d];
      if (sidePlinth) {
        currentSections.plinth.push({ art: sidePlinth, name: getName(sidePlinth) + ' (боковые)', qty: 1 });
      }
    }
  } else if (plinth !== '0') {
    currentSections.plinth.push({ art: DB.plinth.corners[plinth], name: getName(DB.plinth.corners[plinth]), qty: 1 });
    const frontPlinth = DB.plinth[`panels_${plinth}`][w];
    if (frontPlinth) {
      currentSections.plinth.push({ art: frontPlinth, name: getName(frontPlinth) + ' (передняя + задняя)', qty: 1 });
    }
    if (hasSides) {
      const sidePlinth = DB.plinth[`panels_${plinth}`][d];
      if (sidePlinth) {
        currentSections.plinth.push({ art: sidePlinth, name: getName(sidePlinth) + ' (боковые)', qty: 1 });
      }
    }
  }

  // БЛОК 4: Аксессуары
  currentSections.accessories.push({ art: DB.accessories.eyebolts, name: getName(DB.accessories.eyebolts), qty: 1 });

  if (!hasSides && document.getElementById('chk-inter-transport')?.checked) {
    const transpArt = DB?.inter_cabinet?.transport_brackets || '419773';
    currentSections.accessories.push({ art: transpArt, name: getName(transpArt), qty: 1 });
  }

  if (currentMode === 'pro') {
    if (h === '2000' && document.getElementById('chk-seismic-amp')?.checked) {
      const ampArt = DB?.seismic?.amplifiers?.[d];
      if (ampArt) currentSections.accessories.push({ art: ampArt, name: getName(ampArt), qty: 1 });
    }

    const cableEntry = document.getElementById('sel-cable-entry')?.value || 'standard';
    if (cableEntry === 'brush') {
      const brushArt = DB?.cable_and_service?.brush?.[w];
      if (brushArt) currentSections.accessories.push({ art: brushArt, name: getName(brushArt), qty: 1 });
    } else if (cableEntry === 'gland') {
      const glandArt = DB?.cable_and_service?.gland_panel?.[w];
      if (glandArt) currentSections.accessories.push({ art: glandArt, name: getName(glandArt), qty: 1 });
      const glandCount = document.getElementById('sel-gland-type')?.value || '3';
      const glandSetArt = DB?.glands?.[glandCount];
      if (glandSetArt) currentSections.accessories.push({ art: glandSetArt, name: getName(glandSetArt), qty: 1 });
    }

    if (document.getElementById('chk-cable-tray')?.checked) {
      const trayArt = DB?.cable_and_service?.tray?.[h];
      if (trayArt) currentSections.accessories.push({ art: trayArt, name: getName(trayArt), qty: 1 });
    }

    if (document.getElementById('chk-emc-rail')?.checked) {
      const emcArt = DB?.cable_and_service?.emc_rail?.[w];
      if (emcArt) currentSections.accessories.push({ art: emcArt, name: getName(emcArt), qty: 1 });
      const emcHolderArt = DB?.cable_and_service?.emc_holder || '419895';
      currentSections.accessories.push({ art: emcHolderArt, name: getName(emcHolderArt), qty: 1 });
    }

    if (document.getElementById('chk-busbar-rails')?.checked) {
      const railArt = DB?.busbar_support_rails?.[d] || DB?.busbar_support_rails?.rails?.[d];
      if (railArt) currentSections.accessories.push({ art: railArt, name: getName(railArt), qty: 1 });
      const holderArt = DB?.busbar_support_rails?.holder || '419875';
      currentSections.accessories.push({ art: holderArt, name: getName(holderArt), qty: 1 });
    }

    if (document.getElementById('chk-pe-bus')?.checked) {
      const peArt = '422611';
      currentSections.accessories.push({ art: peArt, name: getName(peArt), qty: 1 });
    }

    if (document.getElementById('chk-ground-point')?.checked) {
      const gndArt = '419874';
      currentSections.accessories.push({ art: gndArt, name: getName(gndArt), qty: 1 });
    }

    const pocketType = document.getElementById('sel-doc-pocket')?.value || 'none';
    if (pocketType === 'plastic') {
      const pArt = DB?.cable_and_service?.pockets?.plastic || '419772';
      currentSections.accessories.push({ art: pArt, name: getName(pArt), qty: 1 });
    } else if (pocketType === 'metal') {
      const pArt = DB?.cable_and_service?.pockets?.metal?.[w];
      if (pArt) currentSections.accessories.push({ art: pArt, name: getName(pArt), qty: 1 });
    }

    if (document.getElementById('chk-handle')?.checked) {
      const hArt = DB?.cable_and_service?.handle || '419796';
      currentSections.accessories.push({ art: hArt, name: getName(hArt), qty: 1 });
    }

    if (document.getElementById('chk-limiter')?.checked) {
      const limArt = DB?.cable_and_service?.limiter || '419767';
      currentSections.accessories.push({ art: limArt, name: getName(limArt), qty: 1 });
    }

    if (document.getElementById('chk-door-rails')?.checked) {
      const railArt = DB?.cable_and_service?.door_rails?.[w];
      if (railArt) currentSections.accessories.push({ art: railArt, name: getName(railArt), qty: 1 });
    }
  }

  resetMultiSelect();

  const groups = [
    { id: 'base', title: 'каркас', cls: 'block-base', items: currentSections.base },
    { id: 'mounting', title: 'панели и плату', cls: 'block-mounting', items: currentSections.mounting },
    { id: 'plinth', title: 'цоколь', cls: 'block-plinth', items: currentSections.plinth },
    { id: 'accessories', title: 'аксессуары', cls: 'block-accessories', items: currentSections.accessories }
  ];

  let totalItems = 0;
  let rowsHtml = '';

  groups.forEach(group => {
    if (!group.items.length) return;
    totalItems += group.items.length;

    group.items.forEach((item, index) => {
      const isFirstInBlock = (index === 0);
      const startClass = isFirstInBlock ? ' block-start' : '';

      rowsHtml += `
      <tr class="${group.cls}${startClass}">
      <td>${item.name}</td>
      <td><span class="art-badge">${item.art}</span></td>
      <td class="qty-col${isFirstInBlock ? ' cell-with-actions' : ''}">
      <span>${item.qty}</span>
      ${isFirstInBlock ? `
        <div class="block-actions">
        <button type="button" class="btn-block-action btn-block-copy"
        id="copy-btn-${group.id}"
        title="Скопировать ${group.title}"
        onclick="onBlockCopyClick('${group.id}')">
        <i class="fa-regular fa-copy"></i>
        </button>
        <button type="button" class="btn-block-action btn-block-check"
        id="check-btn-${group.id}"
        title="Выбрать блок для копирования"
        onclick="toggleBlockCheck('${group.id}')">
        <i class="fa-solid fa-check check-icon"></i>
        </button>
        </div>
        ` : ''}
        </td>
        </tr>
        `;
    });
  });

  tbody.innerHTML = rowsHtml;
  document.getElementById('items-count').innerText = `Позиций: ${totalItems}`;
  renderCabinetPreview();
}

let selectedBlocks = new Set();

function toggleBlockCheck(blockId) {
  if (selectedBlocks.has(blockId)) {
    selectedBlocks.delete(blockId);
  } else {
    selectedBlocks.add(blockId);
  }
  updateMultiSelectUI();
}

function updateMultiSelectUI() {
  const container = document.getElementById('spec-table-wrap');
  if (!container) return;
  const isMulti = selectedBlocks.size > 0;

  if (isMulti) {
    container.classList.add('multi-select-mode');
  } else {
    container.classList.remove('multi-select-mode');
  }

  ['base', 'mounting', 'plinth', 'accessories'].forEach(id => {
    const btn = document.getElementById(`check-btn-${id}`);
    if (!btn) return;
    const isChecked = selectedBlocks.has(id);
    btn.classList.toggle('checked', isChecked);
    const icon = btn.querySelector('.check-icon');
    if (icon) icon.style.display = isChecked ? 'inline-block' : 'none';
  });

    const baseCopyBtn = document.getElementById('copy-btn-base');
    if (baseCopyBtn) {
      if (isMulti) {
        baseCopyBtn.title = `Скопировать выбранные блоки (${selectedBlocks.size})`;
      } else {
        baseCopyBtn.title = 'Скопировать каркас';
      }
    }
}

function onBlockCopyClick(blockId) {
  if (selectedBlocks.size > 0) {
    copySelectedBlocks();
  } else {
    copySection(blockId);
  }
}

function formatQty(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} штук`;
  if (mod10 === 1) return `${n} штука`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} штуки`;
  return `${n} штук`;
}

function formatSpecItems(items) {
  if (!items || !items.length) return '';
  return items.map(i => {
    const qty = parseInt(i.qty) || 1;
    if (qty > 1) {
      return `${i.art}\t${i.name} (${formatQty(qty)})`;
    }
    return `${i.art}\t${i.name}`;
  }).join('\n');
}

function copySelectedBlocks() {
  if (!selectedBlocks.size) return;

  const order = ['base', 'mounting', 'plinth', 'accessories'];
  let allItems = [];
  order.forEach(id => {
    if (selectedBlocks.has(id) && currentSections[id]) {
      allItems.push(...currentSections[id]);
    }
  });

  if (!allItems.length) return;
  const text = formatSpecItems(allItems);
  doClipboardCopy(text);
  resetMultiSelect();
}

function resetMultiSelect() {
  selectedBlocks.clear();
  updateMultiSelectUI();
}

function copySection(sectionKey) {
  const items = currentSections[sectionKey];
  if (!items || !items.length) return;
  const text = formatSpecItems(items);
  doClipboardCopy(text);
}

function copyFullSpec() {
  const allItems = [
    ...currentSections.base,
    ...currentSections.mounting,
    ...currentSections.plinth,
    ...currentSections.accessories
  ];
  if (!allItems.length) return;
  const text = formatSpecItems(allItems);
  doClipboardCopy(text);
}

function doClipboardCopy(text) {
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  });
}

window.onload = init;
