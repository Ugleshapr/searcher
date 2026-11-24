// Менеджер локального кэша базы данных (IndexedDB) и фонового автообновления
const DB_NAME = 'keaz_wasm_db';
const STORE_NAME = 'cache';
const KEY_DATA = 'base_bin_br';
const KEY_VER = 'version_info';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[IDB GET ERROR]', e);
    return null;
  }
}

async function idbSet(key, val) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(val, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[IDB SET ERROR]', e);
  }
}

export class DbLoader {
  constructor(worker, onStatusChange) {
    this.worker = worker;
    this.onStatusChange = onStatusChange || (() => {});
    this.localVersion = null;
    this.checking = false;
  }

  async start() {
    // 1. Сверхбыстрый старт: проверяем локальную базу в IndexedDB
    const cachedVer = await idbGet(KEY_VER);
    const cachedBytes = await idbGet(KEY_DATA);

    if (cachedBytes && cachedVer) {
      console.log(`[DB] Мгновенный старт из IndexedDB (версия базы: ${cachedVer.version})`);
      this.localVersion = cachedVer;
      this._initWorker(cachedBytes);
      this.onStatusChange({
        status: 'ready',
        version: cachedVer,
        fromCache: true
      });
    }

    // 2. Фоновая проверка свежести на сервере
    await this.checkForUpdates(!cachedBytes);

    // 3. Подписка на возврат юзера на вкладку (после сна или переключения)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkForUpdates(false);
      }
    });

    // 4. Утренний таймер (каждые 30 минут)
    setInterval(() => {
      this.checkForUpdates(false);
    }, 30 * 60 * 1000);
  }

  async checkForUpdates(forceDownload = false) {
    if (this.checking) return;
    this.checking = true;

    try {
      const resp = await fetch(`version.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (!resp.ok) {
        this.checking = false;
        return;
      }
      const remoteVer = await resp.json();

      const needUpdate = forceDownload || !this.localVersion || (this.localVersion.version !== remoteVer.version);

      if (needUpdate) {
        console.log(`[DB] Найдено обновление базы: ${remoteVer.version} (текущая: ${this.localVersion?.version || 'нет'})`);
        this.onStatusChange({
          status: 'updating',
          version: remoteVer,
          local: this.localVersion
        });

        // Скачиваем легкий бинарник base.bin.br (< 1 МБ)
        const binResp = await fetch(`base.bin.br?_t=${Date.now()}`, { cache: 'no-store' });
        if (!binResp.ok) throw new Error(`HTTP ${binResp.status} при загрузке base.bin.br`);

        const arrayBuffer = await binResp.arrayBuffer();

        // Сохраняем в кэш IndexedDB
        await idbSet(KEY_DATA, arrayBuffer);
        await idbSet(KEY_VER, remoteVer);

        this.localVersion = remoteVer;
        this._initWorker(arrayBuffer);

        this.onStatusChange({
          status: 'ready',
          version: remoteVer,
          updated: true
        });
        console.log(`[✓] База данных успешно обновлена до версии ${remoteVer.version}`);
      } else {
        // База уже актуальна
        this.onStatusChange({
          status: 'ready',
          version: remoteVer,
          isLatest: true
        });
      }
    } catch (e) {
      console.warn('[DB AUTO-UPDATE ERROR]', e);
    } finally {
      this.checking = false;
    }
  }

  _initWorker(bytes) {
    this.worker.postMessage({
      type: 'INIT',
      payload: { bytes }
    });
  }
}
