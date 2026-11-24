use anyhow::{Context, Result};
use search_core::engine::extract_amp_from_str;
use search_core::model::Item;
use search_core::normalizer::{canon_keep_delims, normalize_for_fuzzy_search};
use std::fs::File;
use std::io::{BufReader, BufWriter, Write};
use std::path::PathBuf;

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let input_csv = if args.len() > 1 {
        PathBuf::from(&args[1])
    } else {
        PathBuf::from("base.csv")
    };

    let output_bin = if args.len() > 2 {
        PathBuf::from(&args[2])
    } else {
        PathBuf::from("base.bin")
    };

    let output_br = if args.len() > 3 {
        PathBuf::from(&args[3])
    } else {
        PathBuf::from("base.bin.br")
    };

    println!("=== Упаковщик базы КЭАЗ в компактный бинарный формат ===");
    println!("Входной CSV: {}", input_csv.display());

    let file = File::open(&input_csv)
        .with_context(|| format!("Не удалось открыть файл {}", input_csv.display()))?;
    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(b';')
        .has_headers(true)
        .flexible(true)
        .from_reader(BufReader::new(file));

    let mut items = Vec::new();
    let mut count = 0;

    for result in rdr.records() {
        let record = result?;
        if record.is_empty() {
            continue;
        }

        let name = record.get(0).unwrap_or("").trim().to_string();
        let article = record.get(1).unwrap_or("").trim().to_string();
        let price = record.get(2).unwrap_or("0.0").trim().to_string();
        let docs = record.get(3).unwrap_or("").trim().to_string();
        let features = record.get(4).unwrap_or("").trim().to_string();
        let qty_str = record.get(5).unwrap_or("0").trim();
        let quantity = qty_str.parse::<u32>().unwrap_or(0);

        let name_norm = normalize_for_fuzzy_search(&name);
        let article_norm = normalize_for_fuzzy_search(&article);
        let name_delim = canon_keep_delims(&name);
        let article_delim = canon_keep_delims(&article);
        let amp = extract_amp_from_str(&name_delim);

        items.push(Item {
            name,
            article,
            price,
            name_norm,
            article_norm,
            name_delim,
            article_delim,
            docs,
            features,
            quantity,
            amp,
        });

        count += 1;
    }

    println!("[✓] Прочитано строк: {}", count);

    // 1. Сериализация в Bincode
    println!("[*] Сериализация в Bincode -> {}", output_bin.display());
    let encoded = bincode::serialize(&items)?;
    let raw_size = encoded.len();
    {
        let mut out = BufWriter::new(File::create(&output_bin)?);
        out.write_all(&encoded)?;
    }
    println!("[✓] Размер несжатого бинарника: {:.2} МБ", raw_size as f64 / (1024.0 * 1024.0));

    // 2. Сжатие в Brotli
    println!("[*] Сжатие в Brotli -> {}", output_br.display());
    let mut br_compressed = Vec::new();
    let mut params = brotli::enc::BrotliEncoderParams::default();
    params.quality = 9; // Высокое сжатие
    brotli::BrotliCompress(&mut &encoded[..], &mut br_compressed, &params)?;

    let br_size = br_compressed.len();
    {
        let mut out = BufWriter::new(File::create(&output_br)?);
        out.write_all(&br_compressed)?;
    }
    println!("[✓] Размер Brotli-архива: {:.2} МБ (сжатие в {:.1} раз!)",
             br_size as f64 / (1024.0 * 1024.0),
             raw_size as f64 / br_size as f64);

    println!("=== Упаковка успешно завершена! ===");
    Ok(())
}
