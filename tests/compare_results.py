#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import os
import sys

def main():
    js_path = "tests/results_js.json"
    rust_path = "tests/results_rust.json"

    if not os.path.exists(js_path) or not os.path.exists(rust_path):
        print("[!] Не найдены файлы результатов tests/results_js.json или tests/results_rust.json")
        sys.exit(1)

    with open(js_path, "r", encoding="utf-8") as f:
        js_data = json.load(f)

    with open(rust_path, "r", encoding="utf-8") as f:
        rust_data = json.load(f)

    js_queries = {q["query"]: q for q in js_data["queries"]}
    rust_queries = {q["query"]: q for q in rust_data["queries"]}

    total_queries = len(js_queries)
    top1_matches = 0
    top5_exact_matches = 0
    top5_set_matches = 0
    discrepancies = []

    print(f"=== Сравнение 1-в-1: JS Engine vs Rust Engine ({total_queries} запросов) ===\n")

    for query, q_js in js_queries.items():
        q_rust = rust_queries.get(query)
        if not q_rust:
            continue

        js_top = q_js["top"]
        rust_top = q_rust["top"]

        js_top1_art = js_top[0]["article"] if js_top else None
        rust_top1_art = rust_top[0]["article"] if rust_top else None

        js_top5_arts = [x["article"] for x in js_top]
        rust_top5_arts = [x["article"] for x in rust_top]

        # Top 1 match
        is_top1_match = (js_top1_art == rust_top1_art)
        if is_top1_match:
            top1_matches += 1

        # Top 5 exact order match
        is_top5_exact = (js_top5_arts == rust_top5_arts)
        if is_top5_exact:
            top5_exact_matches += 1

        # Top 5 set match (same items, possibly tied score ordering)
        is_top5_set = (set(js_top5_arts) == set(rust_top5_arts))
        if is_top5_set:
            top5_set_matches += 1

        if not is_top1_match or not is_top5_exact:
            discrepancies.append({
                "query": query,
                "top1_match": is_top1_match,
                "js_top": js_top,
                "rust_top": rust_top
            })

    print(f"================== ИТОГИ СРАВНЕНИЯ ТОЧНОСТИ ==================")
    print(f"Всего тестовых запросов:         {total_queries}")
    print(f"Совпадение Топ-1 (100% 1-в-1):   {top1_matches}/{total_queries} ({top1_matches / total_queries * 100:.1f}%)")
    print(f"Полное совпадение Топ-5 (порядок): {top5_exact_matches}/{total_queries} ({top5_exact_matches / total_queries * 100:.1f}%)")
    print(f"Совпадение набора Топ-5:         {top5_set_matches}/{total_queries} ({top5_set_matches / total_queries * 100:.1f}%)")
    print("==============================================================\n")

    print(f"================== СРАВНЕНИЕ БЫСТРОДЕЙСТВИЯ ==================")
    print(f"Загрузка базы в память:")
    print(f"  * JS (PapaParse + Heap):       {js_data['load_time_ms']:.2f} мс")
    print(f"  * Rust (Zero-copy Bincode):    {rust_data['load_time_ms']:.2f} мс")
    print(f"  -> Rust быстрее в:             {js_data['load_time_ms'] / max(0.1, rust_data['load_time_ms']):.1f} раз!")
    print(f"\nВремя прогона 100 запросов:")
    print(f"  * JS суммарно:                 {js_data['total_time_ms']:.2f} мс ({js_data['avg_time_ms']:.2f} мс/запрос)")
    print(f"  * Rust суммарно:               {rust_data['total_time_ms']:.2f} мс ({rust_data['avg_time_ms']:.3f} мс/запрос)")
    print(f"  -> Rust быстрее в:             {js_data['total_time_ms'] / max(0.1, rust_data['total_time_ms']):.1f} раз!")
    print("==============================================================\n")

    if discrepancies:
        print(f"Детали расхождений ({len(discrepancies)} запросов):")
        for d in discrepancies[:10]:
            print(f"\n[?] Запрос: '{d['query']}' (Топ-1 совпал: {d['top1_match']})")
            print("  JS Top:")
            for idx, item in enumerate(d["js_top"][:3]):
                print(f"    #{idx+1} [{item['article']}] {item['name'][:50]} (score: {item['score']})")
            print("  Rust Top:")
            for idx, item in enumerate(d["rust_top"][:3]):
                print(f"    #{idx+1} [{item['article']}] {item['name'][:50]} (score: {item['score']})")
    else:
        print("🎉 ВСЕ 100 ЗАПРОСОВ СОВПАЛИ ИДЕАЛЬНО 1-В-1!")

if __name__ == "__main__":
    main()
