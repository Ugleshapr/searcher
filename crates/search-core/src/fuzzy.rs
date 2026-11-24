/// Алгоритм расстояния Дамерау-Левенштейна и умного сопоставления токенов

pub fn damerau_levenshtein(s1: &str, s2: &str) -> usize {
    let s1_chars: Vec<char> = s1.chars().collect();
    let s2_chars: Vec<char> = s2.chars().collect();
    let len1 = s1_chars.len();
    let len2 = s2_chars.len();

    if len1 == 0 {
        return len2;
    }
    if len2 == 0 {
        return len1;
    }
    if len1.abs_diff(len2) > 2 {
        return 999;
    }

    let mut d = vec![vec![0; len2 + 1]; len1 + 1];
    for i in 0..=len1 {
        d[i][0] = i;
    }
    for j in 0..=len2 {
        d[0][j] = j;
    }

    for i in 1..=len1 {
        for j in 1..=len2 {
            let cost = if s1_chars[i - 1] == s2_chars[j - 1] { 0 } else { 1 };
            d[i][j] = (d[i - 1][j] + 1)
                .min(d[i][j - 1] + 1)
                .min(d[i - 1][j - 1] + cost);

            if i > 1
                && j > 1
                && s1_chars[i - 1] == s2_chars[j - 2]
                && s1_chars[i - 2] == s2_chars[j - 1]
            {
                d[i][j] = d[i][j].min(d[i - 2][j - 2] + 1);
            }
        }
    }
    d[len1][len2]
}

/// Проверка совпадения токена с учетом опечаток
/// Возвращает Some(distance) или None
pub fn matches_fuzzy_token(query_token: &str, target_word: &str) -> Option<usize> {
    // 1. Точное совпадение
    if query_token == target_word {
        return Some(0);
    }

    // 2. Префиксное совпадение
    if target_word.starts_with(query_token) {
        return Some(0);
    }

    // 3. Строгая защита: токены короче 4 символов или чисто цифровые номиналы/артикулы
    // допускают ТОЛЬКО 100% точное совпадение!
    let q_len = query_token.chars().count();
    if q_len < 4 || query_token.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }

    let t_len = target_word.chars().count();
    let max_dist = if q_len <= 6 { 1 } else { 2 };

    // 4. Сравнение целых слов
    let dist = damerau_levenshtein(query_token, target_word);
    if dist <= max_dist {
        return Some(dist);
    }

    // 5. Сравнение с префиксом слова (если слово длиннее запроса)
    if t_len > q_len && t_len - q_len <= 4 {
        let prefix: String = target_word.chars().take(q_len).collect();
        let p_dist = damerau_levenshtein(query_token, &prefix);
        if p_dist <= 1 {
            return Some(p_dist);
        }
    }

    None
}

/// Проверка совпадения токена с любым словом в нормализованной строке name_delim
pub fn matches_in_item_delim(query_token: &str, name_delim: &str) -> Option<usize> {
    let mut best_dist = None;
    for word in name_delim.split(|c: char| !c.is_alphanumeric() && c != '/') {
        if word.is_empty() {
            continue;
        }
        if let Some(dist) = matches_fuzzy_token(query_token, word) {
            if dist == 0 {
                return Some(0);
            }
            match best_dist {
                None => best_dist = Some(dist),
                Some(prev) if dist < prev => best_dist = Some(dist),
                _ => {}
            }
        }
    }
    best_dist
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_levenshtein() {
        assert_eq!(damerau_levenshtein("выключатель", "выключатель"), 0);
        assert_eq!(damerau_levenshtein("автомотический", "автоматический"), 1); // замена о/а
        assert_eq!(damerau_levenshtein("выкючатель", "выключатель"), 1); // пропуск л
        assert_eq!(damerau_levenshtein("optidyn", "optidin"), 1); // замена y/i
    }

    #[test]
    fn test_fuzzy_matching() {
        assert_eq!(matches_fuzzy_token("автомотический", "автоматический"), Some(1));
        assert_eq!(matches_fuzzy_token("выкючатель", "выключатель"), Some(1));
        assert_eq!(matches_fuzzy_token("optid", "optidin"), Some(0)); // префикс

        // Защита цифр и коротких серий
        assert_eq!(matches_fuzzy_token("260791", "260792"), None); // артикул: опечатка запрещена
        assert_eq!(matches_fuzzy_token("16", "25"), None); // ток: опечатка запрещена
        assert_eq!(matches_fuzzy_token("bm", "ba"), None); // короткая серия < 4 букв: запрещена
    }
}
