// src/server/static_files.rs
use crate::assets::Assets;
use axum::{
    http::{header, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response},
};

pub async fn static_handler(uri: Uri) -> Response {
    // Strip leading slash from URI path (e.g., "/images/logo.png" -> "images/logo.png")
    let path = uri.path().trim_start_matches('/');

    // Fallback to "index.html" if path is empty (root route)
    let path = if path.is_empty() { "index.html" } else { path };

    match Assets::get(path) {
        Some(content) => {
            // Auto-detect MIME type (e.g., "image/png", "image/svg+xml")
            let mime = mime_guess::from_path(path).first_or_octet_stream();

            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, HeaderValue::from_str(mime.as_ref()).unwrap())],
                content.data,
            )
                .into_response()
        }
        None => {
            // SPA fallback: serve index.html for any unknown path so
            // client-side routes (e.g. /monitors) resolve on refresh.
            if let Some(index) = Assets::get("index.html") {
                let mime = mime_guess::from_path("index.html").first_or_octet_stream();
                (
                    StatusCode::OK,
                    [(header::CONTENT_TYPE, HeaderValue::from_str(mime.as_ref()).unwrap())],
                    index.data,
                )
                    .into_response()
            } else {
                (StatusCode::NOT_FOUND, "404 Not Found").into_response()
            }
        }
    }
}