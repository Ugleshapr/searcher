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
  root.style.setProperty('--color-primary', hex);

  const rgb = hexToRgbObj(hex);
  if (rgb) {
    const hsl = rgbToHsl(rgb);
    const hoverHsl = { ...hsl, l: Math.min(hsl.l + 0.12, 1) }; // чуть светлее
    const hoverHex = hslToHex(hoverHsl);

    root.style.setProperty('--color-primary-hover', hoverHex);
  }
};

  
  const hexToRgbObj = hex => {
  const v = normalizeHex(hex);
  if (!v) return null;
  return {
    r: parseInt(v.slice(1, 3), 16),
    g: parseInt(v.slice(3, 5), 16),
    b: parseInt(v.slice(5, 7), 16),
  };
};

const rgbToHsl = ({ r, g, b }) => {
  (r /= 255), (g /= 255), (b /= 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
};

const hslToHex = ({ h, s, l }) => {
  const toHex = x => {
    const v = Math.round(x * 255).toString(16);
    return v.length === 1 ? '0' + v : v;
  };
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h * 6) % 6;
    return l - a * Math.max(Math.min(k - 3, 1, 5 - k), -1);
  };
  return `#${toHex(f(0))}${toHex(f(2))}${toHex(f(4))}`;
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

