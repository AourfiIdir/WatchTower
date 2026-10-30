use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::*;

// =============================================================================
// ACCOUNTS
// =============================================================================

pub async fn get_account_by_id(
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<Account>, StatusCode> {
    let account = sqlx::query_as!(
        Account,
        "SELECT id, name, slug, api_key, created_at, updated_at
         FROM accounts WHERE id = $1",
        id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match account {
        Some(account) => Ok(Json(account)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn get_account_by_name(
    Path(name): Path<String>,
    State(pool): State<PgPool>,
) -> Result<Json<Account>, StatusCode> {
    let account = sqlx::query_as!(
        Account,
        "SELECT id, name, slug, api_key, created_at, updated_at
         FROM accounts WHERE name = $1",
        name
    )
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match account {
        Some(account) => Ok(Json(account)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn get_accounts(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Account>>, StatusCode> {
    let accounts: Vec<Account> = sqlx::query_as::<sqlx::Postgres, Account>(
        "SELECT id, name, slug, api_key, created_at, updated_at FROM accounts
         ORDER BY created_at ASC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(accounts))
}

pub async fn create_account(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateAccountRequest>,
) -> Result<(StatusCode, Json<AccountSummary>), (StatusCode, String)> {
    let slug = match payload.slug {
        Some(s) => s,
        None => payload.name.trim().to_lowercase().replace(' ', "-"),
    };

    let record = sqlx::query!(
        r#"
        INSERT INTO accounts(name,slug) VALUES ($1,$2) 
        RETURNING id, name, slug
        "#,
        payload.name,
        slug
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::CONFLICT,
            format!("create_account failed: {e}"),
        )
    })?;

    let response = AccountSummary {
        id: record.id,
        name: record.name,
        slug: record.slug,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn update_account(
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<UpdateAccountRequest>,
) -> Result<Json<Account>, (StatusCode, String)> {
    let existing = sqlx::query_as::<sqlx::Postgres, Account>(
        "SELECT id, name, slug, api_key, created_at, updated_at
         FROM accounts WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some(existing) = existing else {
        return Err((StatusCode::NOT_FOUND, "account not found".to_string()));
    };

    let name = payload.name.unwrap_or(existing.name);
    let slug = payload.slug.unwrap_or(existing.slug);
    let api_key = if payload.generate_new_api_key.unwrap_or(false) {
        Some(generate_api_key())
    } else {
        existing.api_key
    };

    let account = sqlx::query_as!(
        Account,
        "UPDATE accounts
         SET name = $2, slug = $3, api_key = $4, updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, slug, api_key, created_at, updated_at",
        id,
        name,
        slug,
        api_key
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(account))
}

pub async fn delete_account(
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query!("DELETE FROM accounts WHERE id = $1", id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "account not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// =============================================================================
// MONITORS
// =============================================================================

const MONITOR_COLUMNS: &str = "id, account_id, name, type, target, port, http_method,
    expected_status_code, headers, body, dns_query_type, dns_expected_result,
    interval_seconds, timeout_seconds, is_active, created_at, updated_at";

const MONITOR_RETURNING: &str = "RETURNING id, account_id, name, type, target, port,
    http_method, expected_status_code, headers, body, dns_query_type,
    dns_expected_result, interval_seconds, timeout_seconds, is_active,
    created_at, updated_at";

pub async fn get_monitors(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Monitor>>, StatusCode> {
    let monitors = sqlx::query_as::<sqlx::Postgres, Monitor>(
        &format!("SELECT {MONITOR_COLUMNS} FROM monitors ORDER BY created_at DESC"),
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(monitors))
}

pub async fn get_monitor_by_id(
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<Monitor>, StatusCode> {
    let monitor = sqlx::query_as::<sqlx::Postgres, Monitor>(
        &format!("SELECT {MONITOR_COLUMNS} FROM monitors WHERE id = $1"),
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    monitor
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn get_monitors_by_account(
    Path(account_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Monitor>>, StatusCode> {
    let monitors = sqlx::query_as::<sqlx::Postgres, Monitor>(
        &format!(
            "SELECT {MONITOR_COLUMNS} FROM monitors
             WHERE account_id = $1 ORDER BY created_at DESC"
        ),
    )
    .bind(account_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(monitors))
}

pub async fn create_monitor(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateMonitorRequest>,
) -> Result<(StatusCode, Json<Monitor>), (StatusCode, String)> {
    let monitor = sqlx::query_as::<sqlx::Postgres, Monitor>(
        &format!(
            "INSERT INTO monitors (
                account_id, name, type, target, port, http_method, expected_status_code,
                headers, body, dns_query_type, dns_expected_result,
                interval_seconds, timeout_seconds, is_active
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             {MONITOR_RETURNING}"
        ),
    )
    .bind(payload.account_id)
    .bind(payload.name)
    .bind(payload.r#type)
    .bind(payload.target)
    .bind(payload.port)
    .bind(payload.http_method.unwrap_or(HttpMethod::Get))
    .bind(payload.expected_status_code.unwrap_or(200))
    .bind(payload.headers.unwrap_or(serde_json::json!({})))
    .bind(payload.body)
    .bind(payload.dns_query_type.unwrap_or(DnsRecordType::A))
    .bind(payload.dns_expected_result)
    .bind(payload.interval_seconds.unwrap_or(60))
    .bind(payload.timeout_seconds.unwrap_or(10))
    .bind(true)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, Json(monitor)))
}

pub async fn update_monitor(
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
    Json(payload): Json<UpdateMonitorRequest>,
) -> Result<Json<Monitor>, (StatusCode, String)> {
    let existing = sqlx::query_as::<sqlx::Postgres, Monitor>(
        &format!("SELECT {MONITOR_COLUMNS} FROM monitors WHERE id = $1"),
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some(existing) = existing else {
        return Err((StatusCode::NOT_FOUND, "monitor not found".to_string()));
    };

    let monitor = sqlx::query_as::<sqlx::Postgres, Monitor>(
        &format!(
            "UPDATE monitors SET
                account_id = $1, name = $2, type = $3, target = $4, port = $5,
                http_method = $6, expected_status_code = $7, headers = $8,
                body = $9, dns_query_type = $10, dns_expected_result = $11,
                interval_seconds = $12, timeout_seconds = $13, is_active = $14,
                updated_at = NOW()
             WHERE id = $15 {MONITOR_RETURNING}"
        ),
    )
    .bind(payload.account_id.unwrap_or(existing.account_id))
    .bind(payload.name.unwrap_or(existing.name))
    .bind(payload.r#type.unwrap_or(existing.r#type))
    .bind(payload.target.unwrap_or(existing.target))
    .bind(payload.port.or(existing.port))
    .bind(payload.http_method.or(existing.http_method))
    .bind(payload.expected_status_code.or(existing.expected_status_code))
    .bind(
        payload
            .headers
            .or(existing.headers.or(Some(serde_json::json!({})))),
    )
    .bind(payload.body.or(existing.body))
    .bind(payload.dns_query_type.or(existing.dns_query_type))
    .bind(payload.dns_expected_result.or(existing.dns_expected_result))
    .bind(payload.interval_seconds.unwrap_or(existing.interval_seconds))
    .bind(payload.timeout_seconds.unwrap_or(existing.timeout_seconds))
    .bind(payload.is_active.unwrap_or(existing.is_active))
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(monitor))
}

pub async fn delete_monitor(
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query!("DELETE FROM monitors WHERE id = $1", id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "monitor not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// =============================================================================
// MONITOR CHECKS
// =============================================================================

pub async fn get_checks(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<MonitorCheck>>, StatusCode> {
    let checks = sqlx::query_as::<sqlx::Postgres, MonitorCheck>(
        "SELECT id, monitor_id, is_up, status_code, response_time_ms, error_message,
                created_at
         FROM monitor_checks ORDER BY id DESC LIMIT 200",
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(checks))
}

pub async fn get_checks_by_monitor(
    Path(monitor_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<MonitorCheck>>, StatusCode> {
    let checks = sqlx::query_as::<sqlx::Postgres, MonitorCheck>(
        "SELECT id, monitor_id, is_up, status_code, response_time_ms, error_message,
                created_at
         FROM monitor_checks WHERE monitor_id = $1 ORDER BY id DESC LIMIT 200",
    )
    .bind(monitor_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(checks))
}

pub async fn create_check(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateCheckRequest>,
) -> Result<(StatusCode, Json<MonitorCheck>), (StatusCode, String)> {
    let check = sqlx::query_as::<sqlx::Postgres, MonitorCheck>(
        "INSERT INTO monitor_checks (monitor_id, is_up, status_code, response_time_ms,
                     error_message)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, monitor_id, is_up, status_code, response_time_ms,
                   error_message, created_at",
    )
    .bind(payload.monitor_id)
    .bind(payload.is_up)
    .bind(payload.status_code)
    .bind(payload.response_time_ms)
    .bind(payload.error_message)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, Json(check)))
}

pub async fn delete_check(
    Path(id): Path<i64>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query!("DELETE FROM monitor_checks WHERE id = $1", id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "check not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// =============================================================================
// INCIDENTS
// =============================================================================

pub async fn get_incidents(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Incident>>, StatusCode> {
    let incidents = sqlx::query_as::<sqlx::Postgres, Incident>(
        "SELECT id, monitor_id, started_at, resolved_at, cause, is_resolved
         FROM incidents ORDER BY started_at DESC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(incidents))
}

pub async fn get_incidents_by_monitor(
    Path(monitor_id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<Vec<Incident>>, StatusCode> {
    let incidents = sqlx::query_as::<sqlx::Postgres, Incident>(
        "SELECT id, monitor_id, started_at, resolved_at, cause, is_resolved
         FROM incidents WHERE monitor_id = $1 ORDER BY started_at DESC",
    )
    .bind(monitor_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(incidents))
}

pub async fn create_incident(
    State(pool): State<PgPool>,
    Json(payload): Json<CreateIncidentRequest>,
) -> Result<(StatusCode, Json<Incident>), (StatusCode, String)> {
    let incident = sqlx::query_as::<sqlx::Postgres, Incident>(
        "INSERT INTO incidents (monitor_id, cause, started_at, is_resolved)
         VALUES ($1, $2, $3, FALSE)
         RETURNING id, monitor_id, started_at, resolved_at, cause, is_resolved",
    )
    .bind(payload.monitor_id)
    .bind(payload.cause)
    .bind(payload.started_at.unwrap_or_else(chrono::Utc::now))
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, Json(incident)))
}

pub async fn resolve_incident(
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<Json<Incident>, (StatusCode, String)> {
    let incident = sqlx::query_as::<sqlx::Postgres, Incident>(
        "UPDATE incidents
         SET resolved_at = NOW(), is_resolved = TRUE
         WHERE id = $1
         RETURNING id, monitor_id, started_at, resolved_at, cause, is_resolved",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(incident))
}

pub async fn delete_incident(
    Path(id): Path<Uuid>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query!("DELETE FROM incidents WHERE id = $1", id)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "incident not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// =============================================================================
// APP CONFIG
// =============================================================================

pub async fn get_config(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<AppConfig>>, StatusCode> {
    let configs = sqlx::query_as::<sqlx::Postgres, AppConfig>(
        "SELECT key, value, updated_at FROM app_config ORDER BY key ASC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(configs))
}

pub async fn get_config_by_key(
    Path(key): Path<String>,
    State(pool): State<PgPool>,
) -> Result<Json<AppConfig>, StatusCode> {
    let config = sqlx::query_as::<sqlx::Postgres, AppConfig>(
        "SELECT key, value, updated_at FROM app_config WHERE key = $1",
    )
    .bind(key)
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    config.map(Json).ok_or(StatusCode::NOT_FOUND)
}

pub async fn set_config(
    State(pool): State<PgPool>,
    Json(payload): Json<SetAppConfigRequest>,
) -> Result<(StatusCode, Json<AppConfig>), (StatusCode, String)> {
    let config = sqlx::query_as::<sqlx::Postgres, AppConfig>(
        "INSERT INTO app_config (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value, updated_at = NOW()
         RETURNING key, value, updated_at",
    )
    .bind(payload.key)
    .bind(payload.value)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::OK, Json(config)))
}

pub async fn delete_config(
    Path(key): Path<String>,
    State(pool): State<PgPool>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query!("DELETE FROM app_config WHERE key = $1", key)
        .execute(&pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "config key not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// =============================================================================
// HELPERS
// =============================================================================

fn generate_api_key() -> String {
    format!("wt_live_{}", Uuid::new_v4().simple())
}