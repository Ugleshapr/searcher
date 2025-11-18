export const APP_VERSION = document.documentElement.getAttribute('data-app-version') || '—';

export const RANK_RULES = {
  bonuses: {
    wordBonuses: [
      { words: ['новый'], score: +1200 },
      { words: ['Контактор','Выключатель','Перключатель'], score: +250 },
    ],

    // бонус за пару NА-N*10 (10А-100, 20А-200, 200А-2000, 630А-6300 и т.д.)
    ampIcuPairScore: 250,
    
    substrBonuses: [
      { tokens: ['340010'], score: +100 },
    ],
  },
  penalties: {
    wordPenalties: [
      { words: ['om4','ом4'], score: -700 },
      { words: ['reg','рег'], score: -700 },
    ],
    substrPenalties: [
      { tokens: ['БЗАВ'], score: -300 },
      { tokens: ['FERRAZ'], score: -300 },
    ],
    noDocsPenalty: -400,
  }
};


export const PAGE_SIZE = 200;
export const MAX_ROWS = 200000;

