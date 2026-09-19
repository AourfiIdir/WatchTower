use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// =============================================================================
// DATABASE MODEL
// Maps directly to the 'incidents' table in PostgreSQL via SQLx
// =============================================================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Incident {
    pub id: Uuid,
    pub monitor_id: Uuid,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub resolved_at: Option<chrono::DateTime<chrono::Utc>>,
    pub cause: String,
    pub is_resolved: bool,
}

// =============================================================================
// API DATA TRANSFER OBJECTS (DTOs)
// =============================================================================

/// Payload for manually creating an incident
#[derive(Debug, Deserialize)]
pub struct CreateIncidentRequest {
    pub monitor_id: Uuid,
    pub cause: String,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
}