// addons/search.js
// type=module
import { getApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getDatabase, ref, child, get } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

// Мы предполагаем, что у тебя есть утилита для роли. Если имя другое — поправь импорт/вызов.
import { getCurrentUserRole } from "./auth.js?v=V7.3"; // если у тебя функция в другом файле — поправь путь/имя

(function () {
  // === CONFIG / HOOKS ===
  const TITLE_DEFAULT = "Поиск по прайс-листу";
  const TITLE_ANALOGS = "Поиск по аналогам";
  const PAGE_SIZE = 100;

  // Хуки на элементы — подставь свои селекторы, если отличаются
  const titleEl = document.querySelector("[data-search-title]");
  const inputEl = document.querySelector("#search-input"); // текущее поле поиска
  const resultsEl = document.querySelector("#results");    // контейнер результатов
  const tableHostSelector = "#results";                    // куда вставляем таблицу
  const showMoreBtnId = "analogs-show-more";

  if (!titleEl || !inputEl || !resultsEl) {
    console.warn("[analogs] Не найдены элементы интерфейса (title/input/results). Проверь селекторы.");
    return;
  }

  // Состояние
  let enabledForUser = false;      // доступность секретного клика
  let analogMode = false;          // включён ли режим аналогов
  let lastBatch = [];              // накопленные результаты поиска
  let nextOffset = 0;              // смещение для "Показать ещё"
  let lastQueryKey = "";           // последний нормализованный ключ

  // === ИНИЦИАЛИЗАЦИЯ FIREBASE DB ===
  const app = getApp();
  const db = getDatabase(app);

  // === НОРМАЛИЗАЦИЯ ===
  function normalize(str) {
    if (!str) return "";
    let s = String(str).trim().toLowerCase();

    // Омографы/замены (добавь свои по необходимости)
    const homoglyphs = {
      "о": "o", "а": "a", "е": "e", "р": "p", "с": "c", "х": "x",
      "к": "k", "м": "m", "т": "t", "в": "b", "н": "h", "у": "y",
      // лат -> лат (на случай смешанных)
      "ё": "e", "й": "i", "і": "i", "ї": "i", "å": "a"
    };
    s = s.replace(/[а-яёіїå]/g, ch => homoglyphs[ch] || ch);

    // Транслит кир->лат (базовый набор, достаточно для ключей; расширь при желании)
    const tr = [
      [/zh/g, "ж"], [/ch/g, "ч"], [/sh/g, "ш"], [/sch/g, "щ"],
      [/ya/g, "я"], [/yu/g, "ю"], [/yo/g, "ё"], [/e/g, "е"], [/a/g, "а"], [/o/g, "о"], [/k/g, "к"],
      [/x/g, "х"], [/c/g, "с"], [/m/g, "м"], [/t/g, "т"], [/b/g, "в"], [/p/g, "р"], [/h/g, "н"], [/y/g, "у"], [/i/g, "и"]
    ];
    // Приводим смешанные формы к одному каналу (латиница выше), затем чистим
    // Здесь нам важнее получить "склеенный" ключ без пробелов/символов
    s = s.normalize("NFKD");

    // Удаляем всё, кроме букв/цифр
    s = s.replace(/[^a-z0-9]+/g, "");

    return s;
  }

  // === UI ВСПОМОГАТЕЛЬНОЕ ===
  function setAnalogMode(on) {
    analogMode = on;
    document.body.classList.toggle("analog-mode", on);
    titleEl.textContent = on ? TITLE_ANALOGS : TITLE_DEFAULT;

    // Очистка поля ввода и выдачи
    inputEl.value = "";
    clearResults();

    // Скрыть кнопку "Показать ещё" если была
    removeShowMoreBtn();
  }

  function clearResults() {
    lastBatch = [];
    nextOffset = 0;
    lastQueryKey = "";
    resultsEl.innerHTML = ""; // у тебя там таблица — мы нарисуем свою при поиске
  }

  function ensureTable() {
    let table = resultsEl.querySelector("table[data-analogs-table]");
    if (table) return table;
    table = document.createElement("table");
    table.setAttribute("data-analogs-table", "1");
    table.className = "table table-striped table-hover"; // подставь свои классы, если нужны

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>Оборудование</th>
        <th>Наименование</th>
        <th>Артикул</th>
        <th>Комментарий</th>
      </tr>`;
    const tbody = document.createElement("tbody");
    table.appendChild(thead);
    table.appendChild(tbody);
    resultsEl.appendChild(table);
    return table;
  }

  function renderNextPage() {
    const table = ensureTable();
    const tbody = table.querySelector("tbody");
    const slice = lastBatch.slice(nextOffset, nextOffset + PAGE_SIZE);

    for (const item of slice) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(item.equipment || "")}</td>
        <td>${escapeHtml(item.name || "")}</td>
        <td>${escapeHtml(item.article || "")}</td>
        <td>${escapeHtml(item.comment || "")}</td>
      `;
      tbody.appendChild(tr);
    }
    nextOffset += slice.length;

    // Кнопка "Показать ещё"
    removeShowMoreBtn();
    if (nextOffset < lastBatch.length) {
      const btn = document.createElement("button");
      btn.id = showMoreBtnId;
      btn.type = "button";
      btn.className = "btn btn-outline-primary";
      btn.textContent = "Показать ещё";
      btn.addEventListener("click", () => renderNextPage());
      resultsEl.appendChild(btn);
    }
  }

  function removeShowMoreBtn() {
    const btn = document.getElementById(showMoreBtnId);
    if (btn) btn.remove();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // === ПОИСК ===
  async function searchAnalogs(raw) {
    const key = normalize(raw);
    if (!key) {
      clearResults();
      return;
    }

    // Если один и тот же запрос и мы уже отрендерили — ничего не делаем
    if (key === lastQueryKey && lastBatch.length > 0) return;

    clearResults();
    lastQueryKey = key;

    try {
      // 1) Получить список id по индексу
      const idxSnap = await get(child(ref(db), `analogsIndex/${key}`));
      const ids = idxSnap.exists() ? idxSnap.val() : [];

      if (!Array.isArray(ids) || ids.length === 0) {
        ensureTable(); // чтобы была шапка даже при пустом
        return;
      }

      // 2) Батчем чтение карточек (ограничим параллелизмом)
      const chunks = chunk(ids, 50);
      const results = [];
      for (const chunkIds of chunks) {
        const promises = chunkIds.map(id => get(child(ref(db), `analogs/${id}`)));
        const snaps = await Promise.all(promises);
        for (let i = 0; i < snaps.length; i++) {
          const snap = snaps[i];
          if (snap.exists()) {
            const val = snap.val();
            results.push({
              equipment: val.equipment || "",
              name: val.name || "",
              article: val.article || "",
              comment: val.comment || ""
            });
          }
        }
      }

      lastBatch = results;
      renderNextPage();
    } catch (e) {
      console.error("[analogs] search error:", e);
      // Мягко показать пустую шапку
      ensureTable();
    }
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // === ПОВЕДЕНИЕ ===
  // Подписка на роль пользователя и включение «секретного» клика
  (async function initRole() {
    try {
      const role = await getCurrentUserRole(); // должна вернуть строку ('Boar' | 'User' | ...)
      enabledForUser = (role === "Boar");
      if (!enabledForUser) return;

      // Клик по заголовку: переключаем режим
      titleEl.style.cursor = "pointer";
      titleEl.addEventListener("click", () => {
        setAnalogMode(!analogMode);
      });

      // Слушаем поле ввода только в режиме аналогов
      inputEl.addEventListener("input", () => {
        if (!analogMode) return;
        // Поиск по введённой строке
        searchAnalogs(inputEl.value);
      });

      // Если кто-то извне меняет поле — мы реагируем только в analogMode (как просил)
      console.info("[analogs] secret toggle enabled for role Boar");
    } catch (e) {
      console.warn("[analogs] role detection failed:", e);
    }
  })();

})();

