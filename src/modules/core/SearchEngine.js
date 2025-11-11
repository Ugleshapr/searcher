export class SearchEngine {
  constructor(normalizer, rankRules) {
    this.normalizer = normalizer;
    this.rankRules = rankRules;
    this.MAX_TOKENS = 18;
    this.MAX_TOKEN_LEN = 64;
  }

  search(data, query) {
    if (!query) return [];

    const qAliased = this.normalizer.applyUZAliases(query);
    const parts = qAliased
      .split(/[^a-zA-Zа-яА-ЯёЁ0-9/]+/)
      .filter(Boolean)
      .slice(0, this.MAX_TOKENS)
      .map(p => this.normalizer.normalizeForFuzzySearch(p.slice(0, this.MAX_TOKEN_LEN)))
      .filter(Boolean);

    const hasLetters = /[a-zA-Zа-яА-ЯёЁ]/.test(query);
    const digitCount = query.replace(/\D/g, '').length;
    const permitArticle = !hasLetters && digitCount > 0 && digitCount % 6 === 0;

    // Проверка режима "список артикулов"
    const isMultiArticle = parts.length >= 2 && parts.every(p => /^\d{6}$/.test(p));
    
    if (isMultiArticle) {
      return this._searchMultipleArticles(data, parts);
    }

    // Обычный поиск
    let filtered = data.filter(item =>
      parts.every(part =>
        item.__name.includes(part) ||
        (permitArticle && item.__article.includes(part))
      )
    );

    // Ранжирование
    const qn = this.normalizer.normalizeForFuzzySearch(qAliased);
    
    for (const it of filtered) {
      it.__score = 0;
      const nd = it.__name_delim || String(it['Наименование'] || '');
      const ad = it.__article_delim || String(it['Артикул'] || '');

      // Базовый скоринг
      for (const p of parts) {
        const inName = it.__name.includes(p);
        const inArt = permitArticle && it.__article.includes(p);
        
        if (inName || inArt) it.__score += 1000;

        const wre = this._wordRegex(p);
        if (wre && wre.test(nd)) it.__score += 300;
        if (permitArticle && wre && wre.test(ad)) it.__score += 200;

        const nre = this._numTokenRegex(p);
        if (nre && nre.test(nd)) it.__score += 300;
        if (permitArticle && nre && nre.test(ad)) it.__score += 200;

        const hay = permitArticle ? ad : nd;
        const pos = hay.indexOf(p);
        if (pos >= 0) it.__score += Math.max(0, 120 - pos);
      }

      // Фраза
      if (parts.length >= 2) {
        const pre = this._phraseRegexFromParts(parts);
        if (pre.test(nd)) it.__score += 800;
      }

      // Применение правил ранжирования
      this._applyRankRules(it, { nd, raw: String(it['Наименование'] || ''), docs: it.__docs });
    }

    // Сортировка
    filtered.sort((a, b) => {
      if (b.__score !== a.__score) return b.__score - a.__score;
      
      const bestPos = it => {
        const hay = permitArticle ? it.__article_delim : it.__name_delim;
        let best = 1e9;
        for (const p of parts) {
          const i = hay.indexOf(p);
          if (i !== -1 && i < best) best = i;
        }
        return best;
      };

      const ap = bestPos(a), bp = bestPos(b);
      if (ap !== bp) return ap - bp;
      return a.__name.length - b.__name.length;
    });

    return filtered;
  }

  _searchMultipleArticles(data, parts) {
    const uniq = [...new Set(parts)];
    const order = new Map(uniq.map((a, i) => [a, i]));
    
    let filtered = data.filter(it => order.has(it.__article));
    filtered.sort((a, b) => order.get(a.__article) - order.get(b.__article));
    
    return filtered;
  }

  _applyRankRules(it, ctx) {
    const { nd, docs } = ctx;
    const raw = String(ctx.raw || '').toLowerCase();
    const ndLower = String(nd || '').toLowerCase();
    const rr = this.rankRules;

    // Бонусы за слова
    for (const rule of rr.bonuses.wordBonuses || []) {
      if (this._hasAnyWord(raw, rule.words) || this._hasAnyWord(ndLower, rule.words)) {
        it.__score += rule.score;
      }
    }

    // Штрафы за слова
    for (const rule of rr.penalties.wordPenalties || []) {
      if (this._hasAnyWord(raw, rule.words) || this._hasAnyWord(ndLower, rule.words)) {
        it.__score += rule.score;
      }
    }

    // Штрафы за подстроки
    for (const rule of rr.penalties.substrPenalties || []) {
      for (const tok of rule.tokens) {
        const re = new RegExp(this.normalizer.escapeRegExp(tok), 'i');
        if (re.test(raw) || re.test(ndLower)) {
          it.__score += rule.score;
          break;
        }
      }
    }

    if (!docs || docs.length === 0) {
      it.__score += rr.penalties.noDocsPenalty;
    }
  }

  _hasAnyWord(nd, wordList) {
    if (!nd || !wordList?.length) return false;
    for (const w of wordList) {
      const re = this._wordRegex(w);
      if (re && re.test(nd)) return true;
    }
    return false;
  }

  _wordRegex(tok) {
    const t = String(tok).trim();
    if (!t) return null;
    return new RegExp(`(^|[^a-zа-яё0-9])${this.normalizer.escapeRegExp(t)}(?=$|[^a-zа-яё0-9])`, 'i');
  }

  _numTokenRegex(tok) {
    const t = String(tok).trim();
    if (!/^\d+$/.test(t)) return null;
    return new RegExp(`(^|\\D)${this.normalizer.escapeRegExp(t)}(?!\\d)`, 'i');
  }

  _phraseRegexFromParts(parts) {
    const segs = parts.map(p => {
      if (/^\d+$/.test(p)) return this.normalizer.escapeRegExp(p);
      return this.normalizer.escapeRegExp(p);
    });
    return new RegExp(segs.join('[^a-z0-9а-яё]*'), 'i');
  }
}

