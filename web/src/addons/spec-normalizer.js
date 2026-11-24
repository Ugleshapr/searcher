/**
 * ============================================================================
 * SpecNormalizer - Интеллектуальный конвейер нормализации характеристик и фильтров
 * ============================================================================
 * Предотвращает дублирование параметров и значений в фильтрах каталога,
 * не изменяя исходные обновляемые файлы данных.
 */
(function () {
  'use strict';

  // --- Маппинг синонимов параметров (spec_id aliases) ---
  const SPEC_ALIASES = {
    '788': '148', // Номинальные габариты: высота (мм) -> Габариты изделия: Высота (мм)
    '789': '146', // Номинальные габариты: ширина (мм) -> Габариты изделия: Ширина (мм)
    '790': '149', // Номинальные габариты: глубина (мм) -> Габариты изделия: Глубина (мм)
    '528': '28',  // Общее количество полюсов -> Количество полюсов
    '755': '28',  // Количество силовых полюсов -> Количество полюсов
    '1284': '51'  // Степень защиты корпуса (IP) -> Степень защиты (IP)
  };

  // --- Словарь стандартизации единиц измерения ---
  const UNIT_MAP = {
    'а': 'А',
    'a': 'А',
    'в': 'В',
    'v': 'В',
    'ка': 'кА',
    'ka': 'кА',
    'кв': 'кВ',
    'kv': 'кВ',
    'гц': 'Гц',
    'hz': 'Гц',
    'мм': 'мм',
    'mm': 'мм',
    'м': 'м',
    'с': 'с',
    's': 'с',
    'вт': 'Вт',
    'w': 'Вт',
    'ом': 'Ом',
    'om': 'Ом',
    '°с': '°C',
    '°c': '°C'
  };

  /**
   * Снятие обрамляющих кавычек и краевых спецсимволов
   */
  function unquote(s) {
    let t = String(s ?? '').trim();
    t = t.replace(/^['"«]+|['"»]+$/g, '').trim();
    t = t.replace(/''/g, "'");
    return t;
  }

  /**
   * Определение целевого spec_id с учётом алиасов
   */
  function resolveSpecId(sid) {
    const s = String(sid ?? '').trim();
    return SPEC_ALIASES[s] || s;
  }

  /**
   * Нормализация числового значения и единиц измерения
   */
  function formatNumberDisplay(num) {
    if (typeof num !== 'number' || Number.isNaN(num)) return '';
    // Округляем артефакты IEEE-754 с точностью до 4 знаков
    const rounded = Math.round(num * 10000) / 10000;
    return String(rounded).replace('.', ',');
  }

  /**
   * Каноникализация значения характеристики
   * @param {string|number} raw - Сырое значение из базы
   * @param {Object} dict - Описание параметра из products_spec.json
   * @param {string} specId - ID параметра
   * @returns {{ key: string, display: string, sortNum: number|null }}
   */
  function normalizeValue(raw, dict, specId) {
    let orig = unquote(raw).replace(/\u00A0/g, ' ');
    orig = orig.replace(/\s+/g, ' ').trim();
    // Срезаем висящие запятые и точки с запятой в конце
    orig = orig.replace(/[,;]+$/, '').trim();

    if (!orig) {
      return { key: '', display: '', sortNum: null };
    }

    const lower = orig.toLowerCase();

    // 1. Булевы и бинарные значения (Да / Нет)
    if (['нет', 'нет.', '-', '0', 'no', 'отсутствует'].includes(lower)) {
      return { key: 'нет', display: 'Нет', sortNum: 999999 };
    }
    if (['да', 'есть', 'yes', 'имеется', 'присутствует', 'в комплекте'].includes(lower)) {
      return { key: 'да', display: 'Да', sortNum: 0 };
    }

    // 2. Специфичные коды типоразмеров (00, 000, 0, 1, 2 для предохранителей/габаритов)
    if (/^0{2,}$/.test(orig)) {
      return { key: orig, display: orig, sortNum: null };
    }

    // 3. Диапазоны вида "от -60 °С до +40 °С" или "от 5 до 10"
    const otDoMatch = orig.match(/^от\s*([+-]?\d+(?:[.,]\d+)?)\s*(?:°?[СCсc])?\s*до\s*([+-]?\d+(?:[.,]\d+)?)\s*(.*)$/i);
    if (otDoMatch) {
      const fromNum = otDoMatch[1].replace('.', ',');
      const toNum = otDoMatch[2].replace('.', ',');
      let tail = (otDoMatch[3] || '').trim();
      if (/^[°˚]?[сc]$/i.test(tail)) tail = '°C';
      const display = tail ? `от ${fromNum} до ${toNum} ${tail}` : `от ${fromNum} до ${toNum}`;
      const key = `от_${fromNum}_до_${toNum}_${tail}`.toLowerCase().replace(/\s+/g, '');
      return { key, display, sortNum: null };
    }

    // 4. Диапазоны вида "5-10 In", "0,8–1In", "0.7~16", "5...10"
    // ВАЖНО: разделителями считаются только дефис, тире, тильда или 2-3 точки подряд!
    // Одиночная точка исключена, чтобы десятичные дроби (1.5) не ломались!
    const rangeMatch = orig.match(/^([+-]?\d+(?:[.,]\d+)?)\s*(?:[-–—~]|(?:\.{2,3}))\s*([+-]?\d+(?:[.,]\d+)?)(.*)$/i);
    if (rangeMatch) {
      const fromRaw = rangeMatch[1].replace('.', ',');
      const toRaw = rangeMatch[2].replace('.', ',');
      let tail = (rangeMatch[3] || '').trim();

      if (/in/i.test(tail)) {
        tail = tail.replace(/in/gi, 'In').trim();
      }

      const display = tail ? `${fromRaw}–${toRaw} ${tail}` : `${fromRaw}–${toRaw}`;
      const key = `${fromRaw}-${toRaw}_${tail}`.toLowerCase().replace(/\s+/g, '');
      return { key, display, sortNum: null };
    }

    // 5. Число + единица измерения (или просто число)
    // Примеры: "400", "400А", "400 А", "3,5 мм", "2 модуля", "16,000 А"
    const numMatch = orig.match(/^([+-]?\d+(?:[.,]\d+)?)(?:\s*([a-zA-Zа-яА-Яµμω%°²³\/\\]+.*))?$/);
    if (numMatch) {
      const num = parseFloat(numMatch[1].replace(',', '.'));
      if (!Number.isNaN(num)) {
        let unit = (numMatch[2] || '').trim();

        // Если единицы нет, но в названии параметра указано "(А)" или "(В)"
        if (!unit && dict && dict.title) {
          const t = String(dict.title).toLowerCase();
          if (/\(a\)|\(а\)|амп/i.test(t)) {
            unit = 'А';
          } else if (/\(v\)|\(в\)|вольт/i.test(t)) {
            unit = 'В';
          }
        }

        // Стандартизация единиц
        const unitLower = unit.replace(/\s+/g, '').toLowerCase();
        let normalizedUnit = UNIT_MAP[unitLower] || unit;

        if (/модул/i.test(unitLower)) {
          normalizedUnit = 'модуля';
        }

        const formattedNum = formatNumberDisplay(num);
        const display = normalizedUnit ? `${formattedNum} ${normalizedUnit}` : formattedNum;
        const key = normalizedUnit ? `${num}_${normalizedUnit.toLowerCase()}` : String(num);

        return { key, display, sortNum: num };
      }
    }

    // 6. Текстовые значения (санитизация дефисов, пробелов и регистра)
    // Схлопываем лишние пробелы вокруг дефисов ("Пружинно - моторный" -> "Пружинно-моторный")
    let cleanText = orig.replace(/([a-zA-Zа-яА-Я0-9])\s*[-–—]\s*([a-zA-Zа-яА-Я0-9])/gu, '$1-$2');
    cleanText = cleanText.replace(/\s*,\s*/g, ', ');

    // Канонический ключ: lowercase для схлопывания дублей регистра
    const key = cleanText.toLowerCase();

    // Красивое отображение: первая буква заглавная, если это обычное слово
    let display = cleanText;
    if (display.length > 0 && !display.startsWith('http')) {
      display = display.charAt(0).toUpperCase() + display.slice(1);
    }

    return { key, display, sortNum: null };
  }

  // Экспорт в глобальную область
  window.SpecNormalizer = {
    SPEC_ALIASES,
    resolveSpecId,
    normalizeValue,
    unquote
  };
})();
