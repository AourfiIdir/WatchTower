use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// =============================================================================
// DATABASE MODEL
// Maps directly to the 'accounts' table in PostgreSQL via SQLx
// =============================================================================
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Account {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub api_key: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// =============================================================================
// API REQUEST & RESPONSE DTOs
// =============================================================================

/// Payload for creating a new account/project from React
#[derive(Debug, Deserialize)]
pub struct CreateAccountRequest {
    pub name: String,
    pub slug: Option<String>,
}

/// Payload for updating an existing account
#[derive(Debug, Deserialize)]
pub struct UpdateAccountRequest {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub generate_new_api_key: Option<bool>,
}

/// Lightweight account response for frontend selectors/dropdowns
#[derive(Debug, Serialize)]
pub struct AccountSummary {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
}

