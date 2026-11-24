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

/// Двунаправленная конвертация клавиатурной раскладки QWERTY <-> ЙЦУКЕН
pub fn swap_keyboard_layout(text: &str) -> String {
    let mut out = String::with_capacity(text.len() * 2);
    for ch in text.chars() {
        let mapped = match ch {
            // EN -> RU lowercase
            'q' => 'й', 'w' => 'ц', 'e' => 'у', 'r' => 'к', 't' => 'е', 'y' => 'н',
            'u' => 'г', 'i' => 'ш', 'o' => 'щ', 'p' => 'з', '[' => 'х', ']' => 'ъ',
            'a' => 'ф', 's' => 'ы', 'd' => 'в', 'f' => 'а', 'g' => 'п', 'h' => 'р',
            'j' => 'о', 'k' => 'л', 'l' => 'д', ';' => 'ж', '\'' => 'э',
            'z' => 'я', 'x' => 'ч', 'c' => 'с', 'v' => 'м', 'b' => 'и', 'n' => 'т',
            'm' => 'ь', ',' => 'б', '.' => 'ю', '`' => 'ё',

            // EN -> RU uppercase
            'Q' => 'Й', 'W' => 'Ц', 'E' => 'У', 'R' => 'К', 'T' => 'Е', 'Y' => 'Н',
            'U' => 'Г', 'I' => 'Ш', 'O' => 'Щ', 'P' => 'З', '{' => 'Х', '}' => 'Ъ',
            'A' => 'Ф', 'S' => 'Ы', 'D' => 'В', 'F' => 'А', 'G' => 'П', 'H' => 'Р',
            'J' => 'О', 'K' => 'Л', 'L' => 'Д', ':' => 'Ж', '"' => 'Э',
            'Z' => 'Я', 'X' => 'Ч', 'C' => 'С', 'V' => 'М', 'B' => 'И', 'N' => 'Т',
            'M' => 'Ь', '<' => 'Б', '>' => 'Ю', '~' => 'Ё',

            // RU -> EN lowercase
            'й' => 'q', 'ц' => 'w', 'у' => 'e', 'к' => 'r', 'е' => 't', 'н' => 'y',
            'г' => 'u', 'ш' => 'i', 'щ' => 'o', 'з' => 'p', 'х' => '[', 'ъ' => ']',
            'ф' => 'a', 'ы' => 's', 'в' => 'd', 'а' => 'f', 'п' => 'g', 'р' => 'h',
            'о' => 'j', 'л' => 'k', 'д' => 'l', 'ж' => ';', 'э' => '\'',
            'я' => 'z', 'ч' => 'x', 'с' => 'c', 'м' => 'v', 'и' => 'b', 'т' => 'n',
            'ь' => 'm', 'б' => ',', 'ю' => '.', 'ё' => '`',

            // RU -> EN uppercase
            'Й' => 'Q', 'Ц' => 'W', 'У' => 'E', 'К' => 'R', 'Е' => 'T', 'Н' => 'Y',
            'Г' => 'U', 'Ш' => 'I', 'Щ' => 'O', 'З' => 'P', 'Х' => '{', 'Ъ' => '}',
            'Ф' => 'A', 'Ы' => 'S', 'В' => 'D', 'А' => 'F', 'П' => 'G', 'Р' => 'H',
            'О' => 'J', 'Л' => 'K', 'Д' => 'L', 'Ж' => ':', 'Э' => '"',
            'Я' => 'Z', 'Ч' => 'X', 'С' => 'C', 'М' => 'V', 'И' => 'B', 'Т' => 'N',
            'Ь' => 'M', 'Б' => '<', 'Ю' => '>', 'Ё' => '~',

            // Прочие символы без изменений
            other => other,
        };
        out.push(mapped);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_swap_keyboard_layout() {
        assert_eq!(swap_keyboard_layout("dsrk.xfntkm"), "выключатель");
        assert_eq!(swap_keyboard_layout("jgnblby"), "оптидин");
        assert_eq!(swap_keyboard_layout("ghbdtn"), "привет");
        assert_eq!(swap_keyboard_layout("щзешвшт"), "optidin");
        assert_eq!(swap_keyboard_layout("260791"), "260791");
        assert_eq!(swap_keyboard_layout("ВА57-35"), "DF57-35");
    }
}
