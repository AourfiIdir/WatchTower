// src/assets.rs
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "public/"] // Path relative to Cargo.toml containing index.html, CSS, JS, etc.
pub struct Assets;