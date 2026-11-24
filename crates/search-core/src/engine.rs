use crate::model::{Item, SearchResult};
use crate::normalizer::{apply_uz_aliases, normalize_for_fuzzy_search};
use once_cell::sync::Lazy;
use fancy_regex::Regex;

static RE_AMP_STR: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(\d{2,4})\s*[aа](?![a-zа-яё])").unwrap()
});

static RE_AMP_ICU: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(\d{1,4})\s*[aа]\s*[-–—]\s*(\d{2,5})\b").unwrap()
});

static RE_FUSE_U3: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(?:^|[^a-z0-9а-яё])(y3|у3)(?:$|[^a-z0-9а-яё])").unwrap()
});

pub fn extract_amp_from_str(s: &str) -> Option<u32> {
    if let Ok(Some(caps)) = RE_AMP_STR.captures(s) {
        if let Some(m) = caps.get(1) {
            return m.as_str().parse::<u32>().ok();
        }
    }
    None
}

pub fn has_amp_icu_pair(s: &str) -> bool {
    for cap_res in RE_AMP_ICU.captures_iter(s) {
        if let Ok(caps) = cap_res {
            if let (Some(m1), Some(m2)) = (caps.get(1), caps.get(2)) {
                if let (Ok(a), Ok(b)) = (m1.as_str().parse::<u32>(), m2.as_str().parse::<u32>()) {
                    if b == a * 10 {
                        return true;
                    }
                }
            }
        }
    }
    false
}

pub struct SearchEngine {
    pub items: Vec<Item>,
}

impl SearchEngine {
    pub fn new(items: Vec<Item>) -> Self {
        Self { items }
    }

    pub fn search(&self, query: &str, limit: usize) -> Vec<SearchResult> {
        let q_trimmed = query.trim();
        if q_trimmed.is_empty() {
            return Vec::new();
        }

        let q_aliased = apply_uz_aliases(q_trimmed);

        // Токенизация: split(/[^a-zA-Zа-яА-ЯёЁ0-9/]+/)
        let raw_tokens: Vec<&str> = q_aliased
            .split(|c: char| !c.is_alphanumeric() && c != '/')
            .filter(|s| !s.is_empty())
            .take(18)
            .collect();

        let parts: Vec<String> = raw_tokens
            .iter()
            .map(|t| {
                let slice = if t.len() > 64 { &t[..64] } else { t };
                normalize_for_fuzzy_search(slice)
            })
            .filter(|p| !p.is_empty())
            .collect();

        if parts.is_empty() {
            return Vec::new();
        }

        let has_letters = q_trimmed.chars().any(|c| c.is_alphabetic());
        let digit_count = q_trimmed.chars().filter(|c| c.is_ascii_digit()).count();
        let permit_article = !has_letters && digit_count > 0 && digit_count % 6 == 0;
        let q_amp = extract_amp_from_str(&q_aliased);

        // Проверка режима "список артикулов"
        let is_multi_art = parts.len() >= 2 && parts.iter().all(|p| p.len() == 6 && p.chars().all(|c| c.is_ascii_digit()));
        if is_multi_art {
            return self.search_multiple_articles(&parts);
        }

        let is_fuse_query = parts.iter().any(|p| {
            p == "пkt" || p == "pkt" || p == "пt" || p == "pt" || p == "пkh" || p == "pkn"
        });
        let user_explicit_u1 = parts.iter().any(|p| p == "y1" || p == "у1");

        // 1. Фильтрация
        let mut candidates: Vec<(&Item, i32)> = Vec::new();

        for it in &self.items {
            let matched_all = parts.iter().all(|p| {
                it.name_norm.contains(p) || (permit_article && it.article_norm.contains(p))
            });

            if matched_all {
                candidates.push((it, 0));
            }
        }

        // 2. Ранжирование
        for (it, score) in &mut candidates {
            let nd = &it.name_delim;
            let ad = &it.article_delim;
            let hay = if permit_article { ad } else { nd };

            // Базовый скоринг токенов
            for p in &parts {
                let in_name = it.name_norm.contains(p);
                let in_art = permit_article && it.article_norm.contains(p);

                if in_name || in_art {
                    *score += 1000;
                }

                // Word boundary match
                if self.word_regex_match(nd, p) {
                    *score += 300;
                }
                if permit_article && self.word_regex_match(ad, p) {
                    *score += 200;
                }

                // Num token match
                if p.chars().all(|c| c.is_ascii_digit()) {
                    if self.num_token_match(nd, p) {
                        *score += 300;
                    }
                    if permit_article && self.num_token_match(ad, p) {
                        *score += 200;
                    }
                }

                // Position bonus
                if let Some(byte_pos) = hay.find(p) {
                    let char_pos = hay[..byte_pos].chars().count() as i32;
                    if char_pos < 120 {
                        *score += 120 - char_pos;
                    }
                }
            }

            // Фразовый бонус
            if parts.len() >= 2 {
                if self.phrase_matches(nd, &parts) {
                    *score += 800;
                }
            }

            // Бонус за сохранение порядка токенов в запросе (+150 за пару)
            if parts.len() >= 2 {
                for i in 0..parts.len() - 1 {
                    let p1 = &parts[i];
                    let p2 = &parts[i + 1];
                    if let Some(pos1) = hay.find(p1) {
                        let search_start = pos1 + p1.len();
                        if search_start <= hay.len() {
                            if hay[search_start..].contains(p2) {
                                *score += 150;
                            }
                        }
                    }
                }
            }

            // Приоритет исполнения У3 для высоковольтных предохранителей (+100)
            if is_fuse_query && !user_explicit_u1 {
                let is_fuse_item = it.name_norm.contains("пkt")
                    || it.name_norm.contains("pkt")
                    || it.name_norm.contains("пt")
                    || it.name_norm.contains("pt")
                    || it.name_norm.contains("пkh");

                if is_fuse_item && RE_FUSE_U3.is_match(nd).unwrap_or(false) {
                    *score += 100;
                }
            }

            // Правила ранжирования (категории, слова, штрафы)
            self.apply_rank_rules(it, score);

            // Близость номинала (320A vs 315A)
            if let Some(qa) = q_amp {
                if let Some(ia) = it.amp.or_else(|| extract_amp_from_str(nd)) {
                    let diff = (qa as i32 - ia as i32).abs();
                    if diff == 0 {
                        *score += 600;
                    } else if diff <= 5 {
                        *score += 250;
                    } else if diff <= 10 {
                        *score += 80;
                    } else if diff >= 20 {
                        *score -= 120;
                    }
                } else {
                    *score -= 50;
                }
            }
        }

        // 3. Сортировка
        candidates.sort_by(|(a, score_a), (b, score_b)| {
            if score_b != score_a {
                return score_b.cmp(score_a);
            }

            let best_pos = |it: &Item| -> usize {
                let hay = if permit_article { &it.article_delim } else { &it.name_delim };
                let mut best = usize::MAX;
                for p in &parts {
                    if let Some(byte_idx) = hay.find(p) {
                        let char_idx = hay[..byte_idx].chars().count();
                        if char_idx < best {
                            best = char_idx;
                        }
                    }
                }
                best
            };

            let ap = best_pos(a);
            let bp = best_pos(b);
            if ap != bp {
                return ap.cmp(&bp);
            }

            a.name_norm.chars().count().cmp(&b.name_norm.chars().count())
        });

        // 4. Формирование результатов
        let end_idx = if limit == 0 { candidates.len() } else { limit.min(candidates.len()) };
        candidates[..end_idx]
            .iter()
            .map(|(it, sc)| SearchResult {
                name: it.name.clone(),
                article: it.article.clone(),
                price: it.price.clone(),
                docs: it.docs.clone(),
                features: it.features.clone(),
                quantity: it.quantity,
                score: *sc,
            })
            .collect()
    }

    fn search_multiple_articles(&self, parts: &[String]) -> Vec<SearchResult> {
        let mut res = Vec::new();
        for p in parts {
            for it in &self.items {
                if &it.article_norm == p {
                    res.push(SearchResult {
                        name: it.name.clone(),
                        article: it.article.clone(),
                        price: it.price.clone(),
                        docs: it.docs.clone(),
                        features: it.features.clone(),
                        quantity: it.quantity,
                        score: 10000,
                    });
                }
            }
        }
        res
    }

    pub fn word_regex_match(&self, nd: &str, tok: &str) -> bool {
        let mut start = 0;
        while let Some(pos) = nd[start..].find(tok) {
            let actual_pos = start + pos;
            let before = if actual_pos == 0 {
                ' '
            } else {
                nd[..actual_pos].chars().last().unwrap_or(' ')
            };
            let end_idx = actual_pos + tok.len();
            let after = if end_idx >= nd.len() {
                ' '
            } else {
                nd[end_idx..].chars().next().unwrap_or(' ')
            };
            let b_ok = !before.is_alphanumeric() && before != '_';
            let a_ok = !after.is_alphanumeric() && after != '_';
            if b_ok && a_ok {
                return true;
            }
            if let Some(ch) = nd[actual_pos..].chars().next() {
                start = actual_pos + ch.len_utf8();
            } else {
                break;
            }
        }
        false
    }

    pub fn num_token_match(&self, nd: &str, tok: &str) -> bool {
        let mut start = 0;
        while let Some(pos) = nd[start..].find(tok) {
            let actual_pos = start + pos;
            let before = if actual_pos == 0 {
                ' '
            } else {
                nd[..actual_pos].chars().last().unwrap_or(' ')
            };
            let end_idx = actual_pos + tok.len();
            let after = if end_idx >= nd.len() {
                ' '
            } else {
                nd[end_idx..].chars().next().unwrap_or(' ')
            };
            let b_ok = !before.is_ascii_digit();
            let a_ok = !after.is_ascii_digit();
            if b_ok && a_ok {
                return true;
            }
            if let Some(ch) = nd[actual_pos..].chars().next() {
                start = actual_pos + ch.len_utf8();
            } else {
                break;
            }
        }
        false
    }

    fn phrase_matches(&self, nd: &str, parts: &[String]) -> bool {
        let mut cur = 0;
        for (i, p) in parts.iter().enumerate() {
            if let Some(pos) = nd[cur..].find(p) {
                let actual_pos = cur + pos;
                if i > 0 {
                    let between = &nd[cur..actual_pos];
                    if between.chars().any(|c| c.is_alphanumeric()) {
                        return false;
                    }
                }
                cur = actual_pos + p.len();
            } else {
                return false;
            }
        }
        true
    }

    fn apply_rank_rules(&self, it: &Item, score: &mut i32) {
        let raw_lower = it.name.to_lowercase();
        let nd_lower = &it.name_delim;

        // "новый" -> +1200 (только как отдельное слово!)
        if self.word_regex_match(&raw_lower, "новый") || self.word_regex_match(nd_lower, "новый") {
            *score += 1200;
        }

        // Категории -> +250
        for w in &["контактор", "выключатель", "переключатель", "предохранитель", "разъединитель"] {
            if self.word_regex_match(&raw_lower, w) || self.word_regex_match(nd_lower, w) {
                *score += 250;
            }
        }

        // Подстроки -> +100
        if raw_lower.contains("340010") || nd_lower.contains("340010") {
            *score += 100;
        }

        // amp/icu пара (например 20А-200) -> +250
        if has_amp_icu_pair(&it.name) || has_amp_icu_pair(nd_lower) {
            *score += 250;
        }

        // Штрафы
        for p in &["om4", "ом4", "reg", "рег", "t3", "т3"] {
            if self.word_regex_match(&raw_lower, p) || self.word_regex_match(nd_lower, p) {
                *score -= 700;
            }
        }

        if raw_lower.contains("бзав") || raw_lower.contains("ferraz") {
            *score -= 300;
        }

        if it.docs.trim().is_empty() {
            *score -= 400;
        }
    }
}
