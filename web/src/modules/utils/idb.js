export const IDB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('pricelist-cache', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => { this._db = r.result; res(this._db); };
      r.onerror = () => rej(r.error);
    });
  },
  async get(key, version) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('files', 'readonly');
      const rq = tx.objectStore('files').get(key);
      rq.onsuccess = () => {
        const v = rq.result;
        res(v && v.version === version ? v.data : null);
      };
      rq.onerror = () => rej(rq.error);
    });
  },
  async put(key, version, data) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put({ version, data }, key);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  }
};

