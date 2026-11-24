
use search_core::model::Item;
use search_core::engine::SearchEngine;
use std::fs::File;
use std::io::Read;
use std::time::Instant;

fn main() {
    println!("=== Тестирование быстродействия Rust-поисковика ===");
    let start_load = Instant::now();
    let mut file = File::open("base.bin").expect("base.bin not found");
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).unwrap();
    
    let items: Vec<Item> = bincode::deserialize(&buffer).unwrap();
    let engine = SearchEngine::new(items);
    let load_time = start_load.elapsed();
    println!("[✓] Загрузка и десериализация 34 781 позиций в память: {:?}", load_time);

    let test_queries = [
        "ПКТ 10 10 20 31,5",
        "Патрон ПТ 20 10 12,5",
        "310927",
        "OptiMat BB 10 1000 20",
        "ВА57-35 100А",
        "Контактор КТ-6013",
    ];

    println!("\n=== Прогон поисковых запросов ===");
    for q in &test_queries {
        let t0 = Instant::now();
        let results = engine.search(q, 10);
        let elapsed = t0.elapsed();
        println!("Запрос: {:<25} | Время: {:<8?} | Найдено: {}", q, elapsed, results.results.len());
        if let Some(first) = results.results.first() {
            println!("   -> Топ-1: [{}] {} (score: {})", first.article, first.name, first.score);
        }
    }

    // Benchmark 1000 searches
    let iters = 1000;
    let t_bench = Instant::now();
    for _ in 0..iters {
        let _ = engine.search("ПКТ 10 10 20 31,5", 10);
    }
    let total_bench = t_bench.elapsed();
    println!("\n[★] Стресс-тест: 1 000 поисковых запросов за {:?} ({:?} на запрос!)", 
             total_bench, total_bench / iters as u32);
}
