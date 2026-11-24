use search_core::model::Item;
use search_core::engine::SearchEngine;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::time::Instant;

#[derive(Serialize, Deserialize)]
struct QueryResultItem {
    article: String,
    name: String,
    score: i32,
}

#[derive(Serialize, Deserialize)]
struct QueryResult {
    query: String,
    time_ms: f64,
    total_found: usize,
    top: Vec<QueryResultItem>,
}

#[derive(Serialize, Deserialize)]
struct RunOutput {
    load_time_ms: f64,
    total_time_ms: f64,
    avg_time_ms: f64,
    queries: Vec<QueryResult>,
}

fn main() {
    println!("Rust: Загрузка base.bin...");
    let t_load0 = Instant::now();
    let mut file = File::open("base.bin").expect("base.bin not found");
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).unwrap();
    let items: Vec<Item> = bincode::deserialize(&buffer).unwrap();
    let items_len = items.len();
    let engine = SearchEngine::new(items);
    let t_load = t_load0.elapsed().as_secs_f64() * 1000.0;
    println!("Rust: Загружено {} позиций за {:.2} мс", items_len, t_load);

    let queries_json = std::fs::read_to_string("tests/queries.json").expect("tests/queries.json not found");
    let queries: Vec<String> = serde_json::from_str(&queries_json).unwrap();

    println!("Rust: Запуск {} тестовых запросов...", queries.len());
    let mut output = Vec::new();
    let mut total_time = 0.0;

    for q in &queries {
        let t0 = Instant::now();
        let res = engine.search(q, 100);
        let elapsed = t0.elapsed().as_secs_f64() * 1000.0;
        total_time += elapsed;

        let top5: Vec<QueryResultItem> = res.iter().take(5).map(|r| QueryResultItem {
            article: r.article.clone(),
            name: r.name.clone(),
            score: r.score,
        }).collect();

        output.push(QueryResult {
            query: q.to_string(),
            time_ms: elapsed,
            total_found: res.len(),
            top: top5,
        });
    }

    println!("Rust: Выполнено за {:.2} мс (в среднем {:.3} мс/запрос)",
             total_time, total_time / queries.len() as f64);

    let final_res = RunOutput {
        load_time_ms: t_load,
        total_time_ms: total_time,
        avg_time_ms: total_time / queries.len() as f64,
        queries: output,
    };

    std::fs::write("tests/results_rust.json", serde_json::to_string_pretty(&final_res).unwrap()).unwrap();
}
