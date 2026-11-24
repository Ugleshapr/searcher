use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub name: String,
    pub article: String,
    pub price: String,
    pub name_norm: String,
    pub article_norm: String,
    pub name_delim: String,
    pub article_delim: String,
    pub docs: String,
    pub features: String,
    pub quantity: u32,
    #[serde(default)]
    pub amp: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub name: String,
    pub article: String,
    pub price: String,
    pub docs: String,
    pub features: String,
    pub quantity: u32,
    pub score: i32,
}
