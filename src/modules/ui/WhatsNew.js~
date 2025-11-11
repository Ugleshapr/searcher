export class WhatsNew {
  constructor(appVersion) {
    this.appVersion = appVersion;
    this.storageKey = `v_whatsnew_${appVersion}`;
    this.infoBtnSelector = '#dataInfo';
    this.triedAutoShow = false;
  }

  isCopyActive() {
    try {
      if (window.CopyMode && typeof window.CopyMode.isOn === 'function') {
        return !!window.CopyMode.isOn();
      }
    } catch {
      return false;
    }
    return document.body.classList.contains('copy-mode');
  }

  isFilterActive() {
    try {
      if (window.FilterPanel && typeof window.FilterPanel.isActive === 'function') {
        return !!window.FilterPanel.isActive();
      }
    } catch {
      return false;
    }
    return document.body.classList.contains('is-filter-mode');
  }

  mdToHtml(md) {
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    
    md = md.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (m, t, u) => 
      `<a href="${u}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>`
    );
    md = md.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    md = md.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    md = md.replace(/^###\s*(.+)$/gm, '<h3 class="mt-1 mb-3">$1</h3>');
    md = md.replace(/^####\s*(.+)$/gm, '<h5 class="mt-3 mb-2">$1</h5>');

    const lines = md.split(/\r?\n/);
    let out = [], inList = false;
    
    for (const line of lines) {
      const m = line.match(/^-\s*(.+)/);
      if (m) {
        if (!inList) { out.push('<ul class="mb-0">'); inList = true; }
        out.push(`<li>${m[1]}</li>`);
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        if (line.trim()) out.push(`<p class="mb-2">${line}</p>`);
        else out.push('<br>');
      }
    }
    if (inList) out.push('</ul>');
    return out.join('');
  }

  async loadMarkdown(version) {
    const url = `addons/whatsnew/Release_${version}.md?v=${encodeURIComponent(this.appVersion)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Release notes not found: ${url}`);
    return res.text();
  }

  parseTitle(md) {
    const m = md.match(/^#\s*(.+)$/m);
    return m ? m[1].trim() : '';
  }

  setModalContent(version, title, html) {
    const v = document.getElementById('whatsnewVersionBadge');
    const t = document.getElementById('whatsnewTitle');
    const b = document.getElementById('whatsnewBody');
    if (v) v.textContent = version;
    if (t) t.textContent = title;
    if (b) b.innerHTML = html;
  }

  async open(auto = false) {
    if (!this.appVersion) return;
    if (this.isFilterActive() || this.isCopyActive()) return;

    let title, html;
    try {
      const md = await this.loadMarkdown(this.appVersion);
      title = this.parseTitle(md);
      const cleaned = md.replace(/^#\s*(.+)$/m, '');
      html = this.mdToHtml(cleaned);
    } catch {
      title = 'Примечания к выпуску';
      html = '<p>Не удалось загрузить заметки о выпуске.</p>';
    }

    this.setModalContent(this.appVersion, title, html);

    const modalEl = document.getElementById('whatsnewModal');
    if (!modalEl) return;

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl, {
      backdrop: true,
      keyboard: true,
      focus: true
    });

    modal.show();

    modalEl.addEventListener('hidden.bs.modal', () => {
      try {
        modal.dispose?.();
      } catch {}
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    }, { once: true });

    const done = () => modal.hide();

    const ok = document.getElementById('whatsnewOkBtn');
    const x = document.getElementById('whatsnewCloseX');
    if (ok) ok.onclick = done;
    if (x) x.onclick = done;

    if (auto) {
      try {
        localStorage.setItem(`${this.storageKey}${this.appVersion}`, '1');
      } catch {}
    }
  }

  maybeAutoShow() {
    if (this.triedAutoShow) return;
    this.triedAutoShow = true;

    if (!this.appVersion) return;

    try {
      if (localStorage.getItem(`${this.storageKey}${this.appVersion}`)) return;
    } catch {}

    if (this.isFilterActive() || this.isCopyActive()) return;

    this.open(true);
  }

  setupListeners() {
    // Автопоказ при первом рендере результатов
    document.addEventListener('results:rendered', () => {
      if (this.triedAutoShow) return;
      this.triedAutoShow = true;
      this.maybeAutoShow();
    }, { once: true });

    // Клик по кнопке "i"
    document.addEventListener('click', e => {
      const infoBtn = e.target.closest(this.infoBtnSelector);
      if (!infoBtn) return;
      if (this.isFilterActive() || this.isCopyActive()) return;
      this.open(false);
    });
  }

  checkVersionChange() {
    const cur = this.appVersion;
    const KEY = 'app:lastVersion';
    const FLAG = `reloaded-for:${cur}`;

    try {
      const prev = localStorage.getItem(KEY);
      const already = sessionStorage.getItem(FLAG) === '1';

      if (cur && prev && prev !== cur && !already) {
        sessionStorage.setItem(FLAG, '1');
        location.reload();
        return;
      }

      if (cur && (!prev || prev !== cur)) {
        localStorage.setItem(KEY, cur);
      }
    } catch {}
  }
}

