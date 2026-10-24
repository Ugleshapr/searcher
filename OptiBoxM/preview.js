// ==========================================
// Модуль векторной визуализации OptiBox M (SVG)
// ==========================================

function togglePreviewMode() {
    previewMode = (previewMode === 'front') ? 'inner' : 'front';
    const btn = document.getElementById('preview-mode-toggle');
    if (btn) {
        btn.classList.toggle('is-inner', previewMode === 'inner');
        const titleText = (previewMode === 'front') ? 'Вид: Фасад' : 'Вид: Внутренний монтаж';
        btn.title = titleText;
        btn.setAttribute('aria-label', titleText);
    }
    renderCabinetPreview();
}

// Вспомогательная функция отрисовки ячейки выкатного выключателя OptiMat A
function drawAcbCompartmentSvg(x, y, w, h) {
    const vW = (w >= 1000) ? 440 : 390;
    const vH = (h === 450) ? 360 : 440;
    const vX = x + (w - vW) / 2;
    const vY = y + (h - vH) / 2 + 10;

    return `
    <!-- Металлоконструкция отсека зонирования КЭАЗ -->
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e2e8f0" stroke="#334155" stroke-width="2.5"/>
    <text x="${x + 20}" y="${y + 36}" fill="#0f172a" font-size="32" font-family="sans-serif" font-weight="800">Отсек OptiMat A (${h} мм)</text>

    <!-- Направляющие шасси корзины по бокам -->
    <rect x="${vX - 22}" y="${vY - 10}" width="${vW + 44}" height="${vH + 20}" fill="#94a3b8" stroke="#475569" stroke-width="2" rx="4"/>
    <rect x="${vX - 16}" y="${vY - 4}" width="12" height="${vH + 8}" fill="#cbd5e1"/>
    <rect x="${vX + vW + 4}" y="${vY - 4}" width="12" height="${vH + 8}" fill="#cbd5e1"/>

    <!-- Корпус аппарата (RAL 7035) -->
    <rect x="${vX}" y="${vY}" width="${vW}" height="${vH - 42}" fill="#e5e7eb" stroke="#475569" stroke-width="2" rx="4"/>

    <!-- 1. Левая секция: Блок расцепителя MR -->
    <g transform="translate(${vX + 16}, ${vY + 16})">
    <rect x="0" y="0" width="${vW * 0.34}" height="${(vH - 42) * 0.38}" fill="#475569" stroke="#1e293b" stroke-width="1.5" rx="3"/>
    <text x="10" y="20" fill="#f8fafc" font-size="11" font-family="sans-serif" font-weight="800">MR7 / MR10</text>
    <circle cx="${(vW * 0.34) - 18}" cy="18" r="7" fill="#0f172a" stroke="#94a3b8" stroke-width="1"/>

    <rect x="0" y="${(vH - 42) * 0.41}" width="${vW * 0.34}" height="${(vH - 42) * 0.40}" fill="#334155" stroke="#1e293b" stroke-width="1.5" rx="3"/>
    <circle cx="24" cy="${(vH - 42) * 0.52}" r="11" fill="#1e293b" stroke="#cbd5e1" stroke-width="1.5"/>
    <line x1="24" y1="${(vH - 42) * 0.52 - 8}" x2="24" y2="${(vH - 42) * 0.52}" stroke="#ffffff" stroke-width="2"/>
    <circle cx="${(vW * 0.34) - 24}" cy="${(vH - 42) * 0.52}" r="11" fill="#1e293b" stroke="#cbd5e1" stroke-width="1.5"/>
    <line x1="${(vW * 0.34) - 24}" y1="${(vH - 42) * 0.52 - 8}" x2="${(vW * 0.34) - 24}" y2="${(vH - 42) * 0.52}" stroke="#ffffff" stroke-width="2"/>
    <circle cx="${(vW * 0.17)}" cy="${(vH - 42) * 0.70}" r="11" fill="#1e293b" stroke="#cbd5e1" stroke-width="1.5"/>
    <line x1="${(vW * 0.17)}" y1="${(vH - 42) * 0.70 - 8}" x2="${(vW * 0.17)}" y2="${(vH - 42) * 0.70}" stroke="#ffffff" stroke-width="2"/>

    <rect x="0" y="${(vH - 42) * 0.84}" width="${vW * 0.34}" height="24" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5" rx="3"/>
    <text x="${(vW * 0.17)}" y="${(vH - 42) * 0.84 + 17}" fill="#ffffff" font-size="14" font-family="monospace" font-weight="800" letter-spacing="4" text-anchor="middle">00001</text>
    </g>

    <!-- 2. Центральная секция: Кнопки ВКЛ/ОТКЛ и индикаторы -->
    <g transform="translate(${vX + vW * 0.39}, ${vY + 16})">
    <circle cx="34" cy="46" r="24" fill="#dc2626" stroke="#991b1b" stroke-width="3"/>
    <text x="34" y="56" fill="#ffffff" font-size="28" font-family="sans-serif" font-weight="900" text-anchor="middle">0</text>
    <text x="34" y="86" fill="#475569" font-size="14" font-family="sans-serif" font-weight="800" text-anchor="middle">OFF</text>

    <circle cx="94" cy="46" r="24" fill="#16a34a" stroke="#166534" stroke-width="3"/>
    <text x="94" y="56" fill="#ffffff" font-size="26" font-family="sans-serif" font-weight="900" text-anchor="middle">I</text>
    <text x="94" y="86" fill="#475569" font-size="14" font-family="sans-serif" font-weight="800" text-anchor="middle">ON</text>

    <rect x="12" y="104" width="44" height="24" fill="#16a34a" stroke="#15803d" stroke-width="1.5" rx="3"/>
    <text x="34" y="121" fill="#ffffff" font-size="13" font-family="sans-serif" font-weight="900" text-anchor="middle">OFF</text>

    <rect x="68" y="104" width="56" height="24" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" rx="3"/>
    <text x="96" y="120" fill="#0f172a" font-size="10" font-family="sans-serif" font-weight="800" text-anchor="middle">CHARGED</text>
    </g>

    <!-- 3. Правая секция: Рукоятка взвода и шильдик КЭАЗ -->
    <g transform="translate(${vX + vW * 0.74}, ${vY + 16})">
    <rect x="0" y="0" width="34" height="${(vH - 42) * 0.88}" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.5" rx="6"/>
    <rect x="5" y="10" width="24" height="${(vH - 42) * 0.74}" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" rx="6"/>
    <line x1="17" y1="26" x2="17" y2="${(vH - 42) * 0.68}" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>

    <g transform="translate(42, 0)">
    <rect x="0" y="0" width="56" height="105" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" rx="3"/>
    <text x="6" y="16" fill="#e11d48" font-size="12" font-family="sans-serif" font-weight="900">КЭАЗ</text>
    <text x="6" y="32" fill="#0f172a" font-size="10" font-family="sans-serif" font-weight="800">OptiMat A</text>
    <text x="6" y="47" fill="#64748b" font-size="9" font-family="sans-serif">In 1600A</text>
    <text x="6" y="60" fill="#64748b" font-size="9" font-family="sans-serif">Ue 690V</text>
    <text x="6" y="73" fill="#64748b" font-size="9" font-family="sans-serif">Icu 85kA</text>
    <rect x="6" y="81" width="20" height="16" fill="#0f172a" rx="2"/>
    <text x="16" y="93" fill="#ffffff" font-size="9" font-family="sans-serif" font-weight="800" text-anchor="middle">EAC</text>
    </g>
    </g>

    <!-- 4. Нижняя панель выкатного шасси -->
    <g transform="translate(${vX}, ${vY + vH - 40})">
    <rect x="0" y="0" width="${vW}" height="38" fill="#d1d5db" stroke="#475569" stroke-width="2" rx="3"/>
    <circle cx="26" cy="19" r="9" fill="#94a3b8" stroke="#475569" stroke-width="2"/>
    <circle cx="${vW * 0.44}" cy="19" r="8" fill="#1e293b"/>
    <text x="${vW * 0.44}" y="10" fill="#334155" font-size="8" font-family="sans-serif" font-weight="800" text-anchor="middle">TEST</text>
    <circle cx="${vW * 0.68}" cy="19" r="10" fill="#0f172a" stroke="#f8fafc" stroke-width="2"/>
    <rect x="${vW * 0.82}" y="10" width="18" height="18" fill="#475569" rx="3"/>
    </g>
    `;
}

function renderCabinetPreview() {
    const root = document.getElementById('cabinet-preview-root');
    if (!root) return;

    const hEl = document.getElementById('sel-h');
    const wEl = document.getElementById('sel-w');
    const dEl = document.getElementById('sel-d');
    const plinthEl = document.getElementById('sel-plinth');

    if (!hEl || !wEl) {
        root.innerHTML = '';
        return;
    }

    const w = parseInt(wEl.value) || 800;
    const h = parseInt(hEl.value) || 2000;
    const d = dEl ? parseInt(dEl.value) : 600;
    const plinthH = parseInt(plinthEl?.value) || 0;

    const key = `${h}x${w}x${d}`;
    if (!DB || !DB.frames[key]) {
        root.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">Эскиз недоступен для данного типоразмера</span>`;
        return;
    }

    const doorType = (currentMode === 'pro') ? (document.getElementById('sel-door-type')?.value || 'solid') : 'solid';
    const mountType = (currentMode === 'pro') ? (document.getElementById('sel-mounting-type')?.value || 'mp_2mm') : (document.getElementById('chk-mp')?.checked ? 'mp_2mm' : 'none');
    const hasDividerShelf = (currentMode === 'pro') && document.getElementById('chk-divider-shelf')?.checked;

    const totalH = h + plinthH;
    const vbW = w + 200;
    const vbH = totalH + 130;
    const offX = 110;
    const offY = 40;

    // 1. Цоколь
    let plinthSvg = '';
    if (plinthH > 0) {
        const plY = offY + h;
        plinthSvg = `
        <rect x="${offX}" y="${plY}" width="${w}" height="${plinthH}" fill="#334155" stroke="#1e293b" stroke-width="2"/>
        <rect x="${offX}" y="${plY}" width="35" height="${plinthH}" fill="#1e293b"/>
        <rect x="${offX + w - 35}" y="${plY}" width="35" height="${plinthH}" fill="#1e293b"/>
        `;
    }

    // 2. Рым-болты М12
    const eyeboltsSvg = `
    <circle cx="${offX + 45}" cy="${offY - 14}" r="11" fill="none" stroke="#64748b" stroke-width="4"/>
    <rect x="${offX + 41}" y="${offY - 5}" width="8" height="5" fill="#475569"/>
    <circle cx="${offX + w - 45}" cy="${offY - 14}" r="11" fill="none" stroke="#64748b" stroke-width="4"/>
    <rect x="${offX + w - 49}" y="${offY - 5}" width="8" height="5" fill="#475569"/>
    `;

    // 3. Размерные стрелки
    const dimLeftX = offX - 50;
    const dimBotY = offY + totalH + 35;
    const dimSvg = `
    <line x1="${dimLeftX}" y1="${offY}" x2="${dimLeftX}" y2="${offY + totalH}" stroke="#64748b" stroke-width="2"/>
    <line x1="${dimLeftX - 10}" y1="${offY}" x2="${dimLeftX + 10}" y2="${offY}" stroke="#64748b" stroke-width="2"/>
    <line x1="${dimLeftX - 10}" y1="${offY + totalH}" x2="${dimLeftX + 10}" y2="${offY + totalH}" stroke="#64748b" stroke-width="2"/>
    <text x="${dimLeftX - 22}" y="${offY + totalH / 2}" fill="#334155" font-size="44" font-family="sans-serif" font-weight="800" text-anchor="middle" transform="rotate(-90 ${dimLeftX - 22} ${offY + totalH / 2})">${totalH} мм</text>

    <line x1="${offX}" y1="${dimBotY}" x2="${offX + w}" y2="${dimBotY}" stroke="#64748b" stroke-width="2"/>
    <line x1="${offX}" y1="${dimBotY - 10}" x2="${offX}" y2="${dimBotY + 10}" stroke="#64748b" stroke-width="2"/>
    <line x1="${offX + w}" y1="${dimBotY - 10}" x2="${offX + w}" y2="${dimBotY + 10}" stroke="#64748b" stroke-width="2"/>
    <text x="${offX + w / 2}" y="${dimBotY + 50}" fill="#334155" font-size="44" font-family="sans-serif" font-weight="800" text-anchor="middle">${w} мм</text>
    `;

    let innerOrFrontSvg = '';

    if (previewMode === 'front') {
        const frameSvg = `<rect x="${offX}" y="${offY}" width="${w}" height="${h}" fill="#f1f5f9" stroke="#64748b" stroke-width="3" rx="2"/>`;

        let doorSvg = '';
        const dX = offX + 10;
        const dY = offY + 10;
        const dW = w - 20;
        const dH = h - 20;

        if (doorType === 'front_panels') {
            let lines = '';
            for (let y = dY + 150; y < dY + dH; y += 200) {
                lines += `<line x1="${dX}" y1="${y}" x2="${dX + dW}" y2="${y}" stroke="#94a3b8" stroke-width="2"/>`;
            }
            doorSvg = `
            <rect x="${dX}" y="${dY}" width="${dW}" height="${dH}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
            ${lines}
            `;
        } else if (doorType === 'double' || w === 1200) {
            const mid = dX + dW / 2;
            doorSvg = `
            <rect x="${dX}" y="${dY}" width="${dW / 2 - 2}" height="${dH}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
            <rect x="${mid + 2}" y="${dY}" width="${dW / 2 - 2}" height="${dH}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
            <line x1="${mid}" y1="${dY}" x2="${mid}" y2="${dY + dH}" stroke="#64748b" stroke-width="3"/>
            <rect x="${mid - 16}" y="${offY + h / 2 - 25}" width="10" height="50" rx="3" fill="#1e293b"/>
            `;
        } else if (doorType === 'glass') {
            doorSvg = `
            <rect x="${dX}" y="${dY}" width="${dW}" height="${dH}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
            <rect x="${dX + 45}" y="${dY + 50}" width="${dW - 90}" height="${dH - 100}" fill="#1e293b" fill-opacity="0.65" stroke="#475569" stroke-width="3"/>
            <line x1="${dX + 55}" y1="${dY + 70}" x2="${dX + dW - 65}" y2="${dY + dH - 80}" stroke="#ffffff" stroke-width="2" stroke-opacity="0.25"/>
            <rect x="${offX + w - 25}" y="${offY + h / 2 - 25}" width="10" height="50" rx="3" fill="#1e293b"/>
            `;
        } else if (doorType === 'part_glass') {
            const gH = dH * 0.45;
            doorSvg = `
            <rect x="${dX}" y="${dY}" width="${dW}" height="${dH}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
            <rect x="${dX + 45}" y="${dY + 45}" width="${dW - 90}" height="${gH}" fill="#1e293b" fill-opacity="0.65" stroke="#475569" stroke-width="3"/>
            <rect x="${offX + w - 25}" y="${offY + h / 2 - 25}" width="10" height="50" rx="3" fill="#1e293b"/>
            `;
        } else if (doorType === 'none') {
            doorSvg = `
            <rect x="${dX}" y="${dY}" width="${dW}" height="${dH}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="8,6"/>
            <text x="${offX + w / 2}" y="${offY + h / 2}" fill="#94a3b8" font-size="22" font-family="sans-serif" font-weight="700" text-anchor="middle">Без внешней двери (открытый каркас)</text>
            `;
        } else {
            doorSvg = `
            <rect x="${dX}" y="${dY}" width="${dW}" height="${dH}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
            <rect x="${dX + 15}" y="${dY + 15}" width="${dW - 30}" height="${dH - 30}" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>
            <rect x="${offX + w - 25}" y="${offY + h / 2 - 25}" width="10" height="50" rx="3" fill="#1e293b"/>
            `;
        }

        innerOrFrontSvg = frameSvg + doorSvg;
    } else {
        // Внутренний монтаж
        let interiorSvg = `
        <rect x="${offX}" y="${offY}" width="${w}" height="${h}" fill="#f8fafc" stroke="#475569" stroke-width="3"/>
        <rect x="${offX + 10}" y="${offY + 10}" width="${w - 20}" height="${h - 20}" fill="#f1f5f9"/>
        `;

        if (mountType === 'mp_2mm' || mountType === 'mp_3mm') {
            const mpX = offX + 25;
            const mpW = w - 50;
            const acbH = document.getElementById('chk-acb')?.checked ? (parseInt(document.getElementById('sel-acb-height')?.value) || 600) : 0;

            if (acbH > 0) {
                const mpH = h - acbH - 30;
                interiorSvg += `
                <rect x="${mpX}" y="${offY + 20}" width="${mpW}" height="${mpH}" fill="#fed7aa" fill-opacity="0.85" stroke="#ea580c" stroke-width="2"/>
                <text x="${mpX + mpW / 2}" y="${offY + 20 + mpH / 2 + 10}" fill="#9a3412" font-size="32" font-family="sans-serif" font-weight="800" text-anchor="middle">Частичные МП (${mpH} мм)</text>
                `;
                interiorSvg += drawAcbCompartmentSvg(offX + 25, offY + h - acbH - 15, w - 50, acbH);
            } else {
                interiorSvg += `
                <rect x="${mpX}" y="${offY + 20}" width="${mpW}" height="${h - 40}" fill="#fed7aa" fill-opacity="0.85" stroke="#ea580c" stroke-width="2"/>
                <text x="${mpX + mpW / 2}" y="${offY + h / 2}" fill="#9a3412" font-size="34" font-family="sans-serif" font-weight="800" text-anchor="middle">
                Монтажная панель ${mountType === 'mp_3mm' ? '3 мм (усиленная)' : '2 мм'}
                </text>
                `;
            }
        } else if (mountType === 'modular') {
            let curY = offY + 15;
            const tierW = w - 60;
            const tierX = offX + 30;

            // 1. Верхний компенсатор 65 мм
            interiorSvg += `
            <rect x="${tierX}" y="${curY}" width="${tierW}" height="65" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
            <text x="${tierX + tierW / 2}" y="${curY + 42}" fill="#334155" font-size="28" font-family="sans-serif" font-weight="700" text-anchor="middle">Компенсатор 65 мм (верхний)</text>
            `;
            curY += 65;

            // 2. Верхний добор 85 мм
            interiorSvg += `
            <rect x="${tierX}" y="${curY}" width="${tierW}" height="85" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
            <text x="${tierX + tierW / 2}" y="${curY + 54}" fill="#334155" font-size="30" font-family="sans-serif" font-weight="700" text-anchor="middle">Добор 85 мм</text>
            `;
            curY += 85;

            // Расчет свободного места
            const bottomLimitY = offY + h - 15;
            const bottomBorderH = 65;
            const bottomBorderY = bottomLimitY - bottomBorderH;
            const availableTotalH = bottomBorderY - curY;
            const usedTiersH = modularTiers.reduce((sum, t) => sum + t.height, 0);
            const remainingSpaceH = Math.max(0, availableTotalH - usedTiersH);

            const acbIndex = modularTiers.findIndex(t => t.type === 'acb');
            const isAcbAtBottom = (acbIndex !== -1 && acbIndex === modularTiers.length - 1);

            let freeSpaceRendered = false;

            for (let i = 0; i < modularTiers.length; i++) {
                const t = modularTiers[i];

                // Свободная зона перед ACB, если он внизу
                if (isAcbAtBottom && i === acbIndex && remainingSpaceH > 10 && !freeSpaceRendered) {
                    interiorSvg += `
                    <rect x="${tierX}" y="${curY}" width="${tierW}" height="${remainingSpaceH}" fill="#ffffff" fill-opacity="0.6" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="8,6"/>
                    <text x="${tierX + tierW / 2}" y="${curY + remainingSpaceH / 2 + 8}" fill="#94a3b8" font-size="28" font-family="sans-serif" font-weight="700" text-anchor="middle">
                    Свободная зона (${remainingSpaceH} мм)
                    </text>
                    `;
                    curY += remainingSpaceH;
                    freeSpaceRendered = true;
                }

                // Разделительная полка сверху над ACB
                if (hasDividerShelf && t.type === 'acb') {
                    interiorSvg += `
                    <rect x="${tierX - 10}" y="${curY - 8}" width="${tierW + 20}" height="14" fill="#64748b" stroke="#334155" stroke-width="1.5" rx="2"/>
                    <text x="${tierX + tierW / 2}" y="${curY - 12}" fill="#334155" font-size="18" font-family="sans-serif" font-weight="800" text-anchor="middle">Разделительная полка зонирования</text>
                    `;
                }

                const tH = t.height;

                if (t.type === 'acb') {
                    interiorSvg += `
                    <g class="svg-tier-group" data-id="${t.id}">
                    ${drawAcbCompartmentSvg(tierX, curY, tierW, tH)}
                    </g>
                    `;
                } else if (t.type === 'din150' || t.type === 'din200') {
                    const cutH = 45;
                    const cutY = curY + (tH - cutH) / 2;
                    const cutW = tierW - 80;
                    const cutX = tierX + 40;

                    let breakersSvg = '';
                    const mCount = Math.floor(cutW / 18);
                    for (let m = 0; m < mCount; m++) {
                        breakersSvg += `<rect x="${cutX + m * 18}" y="${cutY + 4}" width="16" height="${cutH - 8}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>`;
                        breakersSvg += `<rect x="${cutX + m * 18 + 4}" y="${cutY + 14}" width="8" height="12" fill="#475569" rx="1"/>`;
                    }

                    interiorSvg += `
                    <g class="svg-tier-group" data-id="${t.id}">
                    <rect x="${tierX}" y="${curY}" width="${tierW}" height="${tH}" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
                    <rect x="${cutX}" y="${cutY}" width="${cutW}" height="${cutH}" fill="#334155" stroke="#475569" stroke-width="1"/>
                    <rect x="${cutX - 10}" y="${cutY + cutH / 2 - 4}" width="${cutW + 20}" height="8" fill="#94a3b8"/>
                    ${breakersSvg}
                    <text x="${tierX + 20}" y="${curY + 34}" fill="#1d4ed8" font-size="30" font-family="sans-serif" font-weight="800">DIN ${tH} мм</text>
                    </g>
                    `;
                } else if (t.type === 'partial_mp') {
                    interiorSvg += `
                    <g class="svg-tier-group" data-id="${t.id}">
                    <rect x="${tierX}" y="${curY}" width="${tierW}" height="${tH}" fill="#fed7aa" stroke="#ea580c" stroke-width="1.5"/>
                    <text x="${tierX + tierW / 2}" y="${curY + tH / 2 + 10}" fill="#9a3412" font-size="32" font-family="sans-serif" font-weight="800" text-anchor="middle">Частичная МП ${tH} мм</text>
                    </g>
                    `;
                } else if (t.type === 'sectional_door') {
                    // Секционная дверь с ручкой-замком
                    const lockX = tierX + tierW - 45;
                    const lockY = curY + tH / 2;
                    interiorSvg += `
                    <g class="svg-tier-group" data-id="${t.id}">
                    <rect x="${tierX}" y="${curY}" width="${tierW}" height="${tH}" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/>
                    <rect x="${tierX + 10}" y="${curY + 8}" width="${tierW - 20}" height="${tH - 16}" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>
                    <!-- Ручка-замок секционной двери -->
                    <rect x="${lockX - 8}" y="${lockY - 22}" width="16" height="44" rx="4" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
                    <circle cx="${lockX}" cy="${lockY - 8}" r="5" fill="#94a3b8"/>
                    <rect x="${lockX - 3}" y="${lockY + 2}" width="6" height="14" rx="2" fill="#94a3b8"/>
                    <text x="${tierX + tierW / 2 - 20}" y="${curY + tH / 2 + 10}" fill="#1e293b" font-size="32" font-family="sans-serif" font-weight="800" text-anchor="middle">Секционная дверь ${tH} мм</text>
                    </g>
                    `;
                } else if (t.type === 'perf') {
                    // Перфорированный пластрон (сетка мелких точек)
                    let perfDots = '';
                    const startDotX = tierX + 35;
                    const endDotX = tierX + tierW - 35;
                    const startDotY = curY + 20;
                    const endDotY = curY + tH - 20;
                    for (let py = startDotY; py <= endDotY; py += 22) {
                        for (let px = startDotX; px <= endDotX; px += 26) {
                            perfDots += `<circle cx="${px}" cy="${py}" r="2.5" fill="#64748b"/>`;
                        }
                    }
                    interiorSvg += `
                    <g class="svg-tier-group" data-id="${t.id}">
                    <rect x="${tierX}" y="${curY}" width="${tierW}" height="${tH}" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5"/>
                    ${perfDots}
                    <circle cx="${tierX + 12}" cy="${curY + 12}" r="5" fill="#94a3b8"/>
                    <circle cx="${tierX + tierW - 12}" cy="${curY + 12}" r="5" fill="#94a3b8"/>
                    <circle cx="${tierX + 12}" cy="${curY + tH - 12}" r="5" fill="#94a3b8"/>
                    <circle cx="${tierX + tierW - 12}" cy="${curY + tH - 12}" r="5" fill="#94a3b8"/>
                    <!-- Плашка для читаемости текста поверх перфорации -->
                    <rect x="${tierX + tierW / 2 - 240}" y="${curY + tH / 2 - 18}" width="480" height="38" rx="6" fill="#f1f5f9" fill-opacity="0.9" stroke="#cbd5e1" stroke-width="1"/>
                    <text x="${tierX + tierW / 2}" y="${curY + tH / 2 + 9}" fill="#334155" font-size="30" font-family="sans-serif" font-weight="800" text-anchor="middle">Пластрон перфорированный ${tH} мм</text>
                    </g>
                    `;
                } else {
                    interiorSvg += `
                    <g class="svg-tier-group" data-id="${t.id}">
                    <rect x="${tierX}" y="${curY}" width="${tierW}" height="${tH}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
                    <circle cx="${tierX + 12}" cy="${curY + 12}" r="5" fill="#94a3b8"/>
                    <circle cx="${tierX + tierW - 12}" cy="${curY + 12}" r="5" fill="#94a3b8"/>
                    <circle cx="${tierX + 12}" cy="${curY + tH - 12}" r="5" fill="#94a3b8"/>
                    <circle cx="${tierX + tierW - 12}" cy="${curY + tH - 12}" r="5" fill="#94a3b8"/>
                    <text x="${tierX + tierW / 2}" y="${curY + tH / 2 + 10}" fill="#334155" font-size="32" font-family="sans-serif" font-weight="800" text-anchor="middle">Пластрон глухой ${tH} мм</text>
                    </g>
                    `;
                }

                curY += tH;

                // Разделительная полка снизу под ACB (если под ним ещё есть ярусы)
                if (hasDividerShelf && t.type === 'acb' && i < modularTiers.length - 1) {
                    interiorSvg += `
                    <rect x="${tierX - 10}" y="${curY - 6}" width="${tierW + 20}" height="14" fill="#64748b" stroke="#334155" stroke-width="1.5" rx="2"/>
                    `;
                }
            }

            // Свободная зона в конце, если ACB был не внизу
            if (!freeSpaceRendered && remainingSpaceH > 10) {
                interiorSvg += `
                <rect x="${tierX}" y="${curY}" width="${tierW}" height="${remainingSpaceH}" fill="#ffffff" fill-opacity="0.6" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="8,6"/>
                <text x="${tierX + tierW / 2}" y="${curY + remainingSpaceH / 2 + 8}" fill="#94a3b8" font-size="28" font-family="sans-serif" font-weight="700" text-anchor="middle">
                Свободная зона (${remainingSpaceH} мм)
                </text>
                `;
            }

            // 3. Нижний компенсатор 65 мм
            interiorSvg += `
            <rect x="${tierX}" y="${bottomBorderY}" width="${tierW}" height="65" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>
            <text x="${tierX + tierW / 2}" y="${bottomBorderY + 42}" fill="#334155" font-size="28" font-family="sans-serif" font-weight="700" text-anchor="middle">Компенсатор 65 мм (нижний)</text>
            `;
        }

        // Вертикальные стойки
        const postW = 20;
        let perfCirclesLeft = '';
        let perfCirclesRight = '';
        for (let py = offY + 25; py < offY + h - 25; py += 30) {
            perfCirclesLeft += `<rect x="${offX + 12}" y="${py}" width="4" height="6" fill="#94a3b8"/>`;
            perfCirclesRight += `<rect x="${offX + w - 16}" y="${py}" width="4" height="6" fill="#94a3b8"/>`;
        }

        const postsSvg = `
        <rect x="${offX + 5}" y="${offY + 5}" width="${postW}" height="${h - 10}" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1"/>
        ${perfCirclesLeft}
        <rect x="${offX + w - postW - 5}" y="${offY + 5}" width="${postW}" height="${h - 10}" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1"/>
        ${perfCirclesRight}
        `;

        innerOrFrontSvg = interiorSvg + postsSvg;
    }

    root.innerHTML = `
    <svg class="cabinet-svg" viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg">
    ${eyeboltsSvg}
    ${innerOrFrontSvg}
    ${plinthSvg}
    ${dimSvg}
    </svg>
    `;
}
