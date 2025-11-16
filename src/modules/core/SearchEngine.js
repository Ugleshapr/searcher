export class SearchEngine {
  constructor(normalizer, rankRules) {
    this.normalizer = normalizer;
    this.rankRules = rankRules;
    this.MAX_TOKENS = 18;
    this.MAX_TOKEN_LEN = 64;
  }

    search(data, query, options = {}) {
    if (!query) return [];

    const relaxed = options.relaxed === true;
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
    const qAmp = this._extractAmpFromString(qAliased);

    // Проверка режима "список артикулов"
    const isMultiArticle = parts.length >= 2 && parts.every(p => /^\d{6}$/.test(p));
    
    if (isMultiArticle) {
      return this._searchMultipleArticles(data, parts);
    }

           let filtered;

    if (!relaxed) {
      // Строгий режим: как было
      filtered = data.filter(item =>
        parts.every(part =>
          item.__name.includes(part) ||
          (permitArticle && item.__article.includes(part))
        )
      );
    } else {
      // Relaxed-режим

      // amp-токен вида "320a"/"320а" не должен быть жёстко обязателен,
      // потому что номинал мы будем сравнивать числами.
      const isAmpToken = tok => {
        if (!tok) return false;
        const m = tok.match(/^(\d{2,3})\s*[aа]$/i);
        return !!m;
      };

      const partsNoAmp = parts.filter(p => !isAmpToken(p));
      const baseParts = partsNoAmp.length ? partsNoAmp : parts;

      const classifyToken = (tok) => {
        if (!tok) return 'weak';
        const hasLettersTok = /[a-zA-Zа-яА-ЯёЁ]/.test(tok);
        if (hasLettersTok) return 'strong';
        if (/^\d+$/.test(tok)) {
          return tok.length >= 4 ? 'strong' : 'weak';
        }
        return 'strong';
      };

      const strongParts = [];
      const weakParts = [];

      for (const p of baseParts) {
        (classifyToken(p) === 'strong' ? strongParts : weakParts).push(p);
      }

      // Если сильных токенов нет (все короткие числа) — считаем все сильными,
      // чтобы не пускать слишком много мусора.
      if (strongParts.length === 0) {
        strongParts.push(...weakParts);
        weakParts.length = 0;
      }

      filtered = data.filter(item => {
        const matchToken = (part) =>
          item.__name.includes(part) ||
          (permitArticle && item.__article.includes(part));

        const strongMatched = strongParts.filter(matchToken).length;
        if (strongMatched < strongParts.length) {
          // Не все сильные токены нашли — выкидываем.
          return false;
        }

        const totalMatched =
          strongMatched + weakParts.filter(matchToken).length;

        const coverage = baseParts.length
          ? totalMatched / baseParts.length
          : 1;

        // Порог покрытия: хотя бы 70% токенов должны где-то встретиться.
        return coverage >= 0.7;
      });
    }



    // Ранжирование
    const qn = this.normalizer.normalizeForFuzzySearch(qAliased);
    
    for (const it of filtered) {
      it.__score = 0;
      const nd = it.__name_delim || String(it['Наименование'] || '');
      const ad = it.__article_delim || String(it['Артикул'] || '');
      const amp = qAmp != null ? this._extractAmpFromItem(it) : null;

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
            // Близость номинала (320A / 315A)
      if (qAmp != null) {
        if (amp != null) {
          const diff = Math.abs(qAmp - amp);

          if (diff === 0) {
            // точное совпадение номинала
            it.__score += 600;
          } else if (diff <= 5) {
            // соседний номинал (например, 315 vs 320)
            it.__score += 250;
          } else if (diff <= 10) {
            it.__score += 80;
          } else if (diff >= 20) {
            // явно другой диапазон — чуть штрафуем
            it.__score -= 120;
          }
        } else {
          // В запросе есть номинал, в строке нет — можно слегка штрафовать
          it.__score -= 50;
        }
      }

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
  
    _extractAmpFromString(str) {
    if (!str) return null;
    const s = String(str);
    // Ищем 2–3 цифры + A/А (латиница или кириллица), без продолжения букв
    const re = /(\d{2,4})\s*[aа](?![a-zа-яё])/i;
    const m = s.match(re);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) ? n : null;
  }

  _extractAmpFromItem(it) {
    // Повторно не считаем
    if (Object.prototype.hasOwnProperty.call(it, '__amp')) {
      return it.__amp;
    }

    const candidates = [
      it.__name_delim,
      it.__article_delim,
      it['Наименование'],
      it['Артикул'],
    ];

    let amp = null;
    for (const val of candidates) {
      amp = this._extractAmpFromString(val);
      if (amp != null) break;
    }

    it.__amp = amp;
    return amp;
  }

}

