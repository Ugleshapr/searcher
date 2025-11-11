export const APP_VERSION = document.documentElement.getAttribute('data-app-version') || '—';

export const RANK_RULES = {
  bonuses: {
    wordBonuses: [{ words: ['новый'], score: +1200 }],
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

