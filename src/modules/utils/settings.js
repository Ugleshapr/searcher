
(function () {
  const STORAGE_KEY = 'plAccentColor';
  const DEFAULT = '#21808d';

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
    const saved = localStorage.getItem(STORAGE_KEY);
    const hex = normalizeHex(saved) || DEFAULT;
    applyColor(hex);
  };

  const init = () => {
    loadStoredColor();

    const btn = $('settingsBtn');
    const menu = $('settingsMenu');
    if (!btn || !menu) return;

    const input = $('accentColorInput');
    const applyBtn = $('accentColorApply');
    const resetBtn = $('accentColorReset');
    const errorEl = $('accentColorError');

    const close = () => { menu.hidden = true; };
const open = () => {
  menu.hidden = false;

  const rect = btn.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  menu.style.right = `${window.innerWidth - rect.right - window.scrollX}px`;

  input.value = localStorage.getItem(STORAGE_KEY) || DEFAULT;
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
      if (!hex) return (errorEl.textContent = 'HEX #rrggbb');
      localStorage.setItem(STORAGE_KEY, hex);
      applyColor(hex);
      close();
    };
    resetBtn.onclick = () => {
      localStorage.removeItem(STORAGE_KEY);
      applyColor(DEFAULT);
      close();
    };
  };

  document.addEventListener('DOMContentLoaded', init);
})();

