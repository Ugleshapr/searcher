import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

global.document = { documentElement: { getAttribute: () => '1.0' } };

const mainSrcDir = '/home/uglesha/Документы/Prod/Git/main/src';
const { Normalizer } = await import(path.join(mainSrcDir, 'modules/core/Normalizer.js'));
const { SearchEngine } = await import(path.join(mainSrcDir, 'modules/core/SearchEngine.js'));
const { RANK_RULES } = await import(path.join(mainSrcDir, 'modules/utils/constants.js'));

const norm = new Normalizer();
const se = new SearchEngine(norm, RANK_RULES);

// Quote-aware CSV parser
function parseCSV(text) {
  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i+1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ';' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i+1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        records.push(row);
      }
      row = [];
    } else {
      field += ch;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}

// Загрузка base.csv
const csvPath = '/home/uglesha/Документы/Prod/Git/main/base.csv';
console.log('JS: Загрузка base.csv...');
const tLoad0 = performance.now();
const text = fs.readFileSync(csvPath, 'utf-8');
const rows = parseCSV(text);

const data = [];
for (let i = 1; i < rows.length; i++) {
  const cols = rows[i];
  if (cols.length >= 3) {
    const name = (cols[0] || '').trim();
    const art = (cols[1] || '').trim();
    const price = (cols[2] || '').trim();
    const docs = (cols[3] || '').trim();
    const features = (cols[4] || '').trim();
    const qty = parseInt((cols[5] || '0').trim(), 10) || 0;

    data.push({
      'Наименование': name,
      'Артикул': art,
      'Цена': price,
      'Документы': docs,
      'Характеристики': features,
      'Количество': qty,
      __name: norm.normalizeForFuzzySearch(name),
      __article: norm.normalizeForFuzzySearch(art),
      __name_delim: norm.canonKeepDelims(name),
      __article_delim: norm.canonKeepDelims(art),
      __docs: docs ? [{ url: 'test' }] : []
    });
  }
}
const tLoad = performance.now() - tLoad0;
console.log(`JS: Загружено ${data.length} строк за ${tLoad.toFixed(2)} мс`);

// Загрузка запросов
const queriesPath = path.join(__dirname, 'queries.json');
const queries = JSON.parse(fs.readFileSync(queriesPath, 'utf-8'));

console.log(`JS: Запуск ${queries.length} тестовых запросов...`);
const output = [];

let totalTime = 0;
for (const q of queries) {
  const t0 = performance.now();
  const res = se.search(data, q);
  const elapsed = performance.now() - t0;
  totalTime += elapsed;

  const top5 = res.slice(0, 5).map(r => ({
    article: r['Артикул'],
    name: r['Наименование'],
    score: r.__score
  }));

  output.push({
    query: q,
    time_ms: elapsed,
    total_found: res.length,
    top: top5
  });
}

console.log(`JS: Выполнено за ${totalTime.toFixed(2)} мс (в среднем ${(totalTime / queries.length).toFixed(2)} мс/запрос)`);

fs.writeFileSync(path.join(__dirname, 'results_js.json'), JSON.stringify({
  load_time_ms: tLoad,
  total_time_ms: totalTime,
  avg_time_ms: totalTime / queries.length,
  queries: output
}, null, 2));
