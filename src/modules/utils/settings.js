(function () {
  const COLOR_KEY = 'plAccentColor';
  const ART_LABEL_KEY = 'plAddArtLabel';
  const DEFAULT_COLOR = '#21808d';

  const $ = id => document.getElementById(id);

  const normalizeHex = v => {
    v = (v || '').trim().replace(/^#/, '');
    return /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : null;
  };

  const applyColor = hex => {
    const root = document.documentElement;
    root.style.setProperty('--color-teal-500', hex);
    root.style.setProperty('--color-primary', hex);
  };

  const loadStoredColor = () => {
    const saved = localStorage.getItem(COLOR_KEY);
    const hex = normalizeHex(saved) || DEFAULT_COLOR;
    applyColor(hex);
    return hex;
  };

  const loadStoredArtLabel = appSettings => {
    const stored = localStorage.getItem(ART_LABEL_KEY);
    appSettings.addArtLabel = stored === '1';
  };

  const init = () => {
    // глобальный объект настроек
    const appSettings = (window.AppSettings = window.AppSettings || {});

    const currentColor = loadStoredColor();
    loadStoredArtLabel(appSettings);

    const btn = $('settingsBtn');
    const menu = $('settingsMenu');
    if (!btn || !menu) return;

    const input = $('accentColorInput');
    const applyBtn = $('accentColorApply');
    const resetBtn = $('accentColorReset');
    const errorEl = $('accentColorError');
    const artCheckbox = $('addArtLabel');

    if (input) input.value = currentColor;
    if (errorEl) errorEl.textContent = '';

    if (artCheckbox) {
      artCheckbox.checked = !!appSettings.addArtLabel;
      artCheckbox.addEventListener('change', () => {
        const value = artCheckbox.checked;
        appSettings.addArtLabel = value;
        if (value) {
          localStorage.setItem(ART_LABEL_KEY, '1');
        } else {
          localStorage.removeItem(ART_LABEL_KEY);
        }
      });
    }

    const close = () => { menu.hidden = true; };
    const open = () => {
      menu.hidden = false;

      const rect = btn.getBoundingClientRect();
      menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
      menu.style.right = `${window.innerWidth - rect.right - window.scrollX}px`;

      if (input) input.value = localStorage.getItem(COLOR_KEY) || DEFAULT_COLOR;
      if (artCheckbox) artCheckbox.checked = !!appSettings.addArtLabel;
      if (errorEl) errorEl.textContent = '';
    };

    btn.onclick = e => {
      e.stopPropagation();
      menu.hidden ? open() : close();
    };

    document.addEventListener('click', e => {
      if (menu.hidden) return;
      if (e.target.closest('#settingsMenu') || e.target.closest('#settingsBtn')) return;
      close();
    });

    applyBtn.onclick = () => {
      const hex = normalizeHex(input.value);
      if (!hex) {
        if (errorEl) errorEl.textContent = 'HEX #rrggbb';
        return;
      }
      localStorage.setItem(COLOR_KEY, hex);
      applyColor(hex);
      close();
    };

    resetBtn.onclick = () => {
      localStorage.removeItem(COLOR_KEY);
      applyColor(DEFAULT_COLOR);
      if (input) input.value = DEFAULT_COLOR;
      close();
    };
  };

  document.addEventListener('DOMContentLoaded', init);
})();

