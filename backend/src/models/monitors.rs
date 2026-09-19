// src/models/monitor.rs
use serde::{Deserialize, Serialize};
use sqlx::{types::JsonValue, FromRow};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "monitor_type", rename_all = "UPPERCASE")]
#[serde(rename_all = "UPPERCASE")]
pub enum MonitorType {
    Http,
    Tcp,
    Dns,
    Icmp,
}

// Database representation (SQLx)
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Monitor {
    pub id: Uuid,
    pub account_id: Uuid,
    pub name: String,
    pub r#type: MonitorType,
    pub target: String,
    pub port: Option<i32>,
    pub http_method: Option<String>,
    pub expected_status_code: Option<i32>,
    pub headers: Option<JsonValue>,
    pub body: Option<String>,
    pub dns_query_type: Option<String>,
    pub dns_expected_result: Option<String>,
    pub interval_seconds: i32,
    pub timeout_seconds: i32,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// API DTO for creating a new monitor from React
#[derive(Debug, Deserialize)]
pub struct CreateMonitorRequest {
    pub account_id: Uuid,
    pub name: String,
    pub r#type: MonitorType,
    pub target: String,

    // TCP & DNS Port
    pub port: Option<i32>,

    // HTTP Options
    pub http_method: Option<String>,
    pub expected_status_code: Option<i32>,
    pub headers: Option<JsonValue>,
    pub body: Option<String>,

    // DNS Options
    pub dns_query_type: Option<String>,      // e.g. "A", "MX", "TXT"
    pub dns_expected_result: Option<String>, // Expected resolved IP/record

    // Timing Options (defaults set in Axum handler if omitted)
    pub interval_seconds: Option<i32>,
    pub timeout_seconds: Option<i32>,
}

// API DTO for updating an existing monitor (all fields optional)
#[derive(Debug, Deserialize)]
pub struct UpdateMonitorRequest {
    pub account_id: Option<Uuid>,
    pub name: Option<String>,
    pub r#type: Option<MonitorType>,
    pub target: Option<String>,
    pub port: Option<i32>,
    pub http_method: Option<String>,
    pub expected_status_code: Option<i32>,
    pub headers: Option<JsonValue>,
    pub body: Option<String>,
    pub dns_query_type: Option<String>,
    pub dns_expected_result: Option<String>,
    pub interval_seconds: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub is_active: Option<bool>,
}