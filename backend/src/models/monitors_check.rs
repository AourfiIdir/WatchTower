use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// =============================================================================
// DATABASE MODEL
// Maps directly to the 'monitor_checks' table in PostgreSQL
// =============================================================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MonitorCheck {
    pub id: i64, // BIGSERIAL in PostgreSQL
    pub monitor_id: Uuid,
    pub is_up: bool,
    pub status_code: Option<i32>,
    pub response_time_ms: Option<i32>,
    pub error_message: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// =============================================================================
// API RESPONSE DTOs
// =============================================================================

/// Payload for creating a check result (used by the engine & manual testing)
#[derive(Debug, Deserialize)]
pub struct CreateCheckRequest {
    pub monitor_id: Uuid,
    pub is_up: bool,
    pub status_code: Option<i32>,
    pub response_time_ms: Option<i32>,
    pub error_message: Option<String>,
}