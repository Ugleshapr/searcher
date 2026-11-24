use once_cell::sync::Lazy;
use std::collections::HashMap;
use fancy_regex::Regex;

static HOMOGLYPH_CANON: Lazy<HashMap<char, char>> = Lazy::new(|| {
    let mut m = HashMap::new();
    // Латиница
    for ch in "abcdefhkmoprtxy".chars() {
        m.insert(ch, ch);
    }
    // Латиница верхний регистр
    m.insert('A', 'a'); m.insert('B', 'b'); m.insert('C', 'c'); m.insert('D', 'd');
    m.insert('E', 'e'); m.insert('F', 'f'); m.insert('H', 'h'); m.insert('K', 'k');
    m.insert('M', 'm'); m.insert('O', 'o'); m.insert('P', 'p'); m.insert('R', 'p');
    m.insert('T', 't'); m.insert('X', 'x'); m.insert('Y', 'y');

    // Кириллица -> канон
    m.insert('а', 'a'); m.insert('А', 'a');
    m.insert('в', 'b'); m.insert('В', 'b');
    m.insert('д', 'd'); m.insert('Д', 'd');
    m.insert('е', 'e'); m.insert('Е', 'e');
    m.insert('н', 'h'); m.insert('Н', 'h');
    m.insert('л', 'l'); m.insert('Л', 'l');
    m.insert('к', 'k'); m.insert('К', 'k');
    m.insert('м', 'm'); m.insert('М', 'm');
    m.insert('о', 'o'); m.insert('О', 'o');
    m.insert('р', 'p'); m.insert('Р', 'p');
    m.insert('т', 't'); m.insert('Т', 't');
    m.insert('х', 'x'); m.insert('Х', 'x');
    m.insert('у', 'y'); m.insert('У', 'y');
    m.insert('ф', 'f'); m.insert('Ф', 'f');
    m.insert('с', 'c'); m.insert('С', 'c');
    m.insert('б', 'b'); m.insert('Б', 'b');
    m
});

static RE_UXLZ: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(^|[^A-Za-zА-Яа-яЁё0-9])ухл[зЗ](?=$|[^A-Za-zА-Яа-яЁё0-9])").unwrap()
});

static RE_UZ: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(^|[^A-Za-zА-Яа-яЁё0-9])у[зЗ](?=$|[^A-Za-zА-Яа-яЁё0-9])").unwrap()
});

pub fn apply_uz_aliases(s: &str) -> String {
    let s1 = RE_UXLZ.replace_all(s, "${1}ухл3");
    let s2 = RE_UZ.replace_all(&s1, "${1}у3");
    s2.to_string()
}

pub fn canon_keep_delims(text: &str) -> String {
    let lower = text.to_lowercase();
    let mut out = String::with_capacity(lower.len());
    for ch in lower.chars() {
        if let Some(&canon) = HOMOGLYPH_CANON.get(&ch) {
            out.push(canon);
        } else {
            out.push(ch);
        }
    }
    out
}

pub fn normalize_for_fuzzy_search(text: &str) -> String {
    let lower = text.to_lowercase();
    let mut out = String::with_capacity(lower.len());
    for ch in lower.chars() {
        let mapped = HOMOGLYPH_CANON.get(&ch).copied().unwrap_or(ch);
        if mapped.is_ascii_alphanumeric() || ('а'..='я').contains(&mapped) || mapped == 'ё' || mapped == '/' {
            out.push(mapped);
        }
    }
    out
}
