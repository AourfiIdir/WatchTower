use serde::{Deserialize, Serialize};
use sqlx::{types::JsonValue, FromRow};

// =============================================================================
// DATABASE MODEL
// Maps directly to the 'app_config' table in PostgreSQL
// =============================================================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AppConfig {
    pub key: String,
    pub value: JsonValue,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// =============================================================================
// API REQUEST DTOs
// =============================================================================

/// Payload for creating or updating a global app setting from React
#[derive(Debug, Deserialize)]
pub struct SetAppConfigRequest {
    pub key: String,
    pub value: JsonValue,
}