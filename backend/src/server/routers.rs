use sqlx::PgPool;
use axum::{routing::*, Router};

use super::handlers::*;
use super::static_files::*;
pub async fn create_routers(pool: PgPool) -> Result<Router, ()> {
    let app = Router::new()
        // ── App ──
        .route("/", get(static_handler))
        // ── Accounts ──
        .route("/accounts", get(get_accounts))
        .route("/accounts/insert_account", post(create_account))
        .route("/accounts/id/:id", get(get_account_by_id))
        .route("/accounts/name/:name", get(get_account_by_name))
        .route("/accounts/:id", put(update_account).delete(delete_account))
        // ── Monitors ──
        .route("/monitors", get(get_monitors))
        .route("/monitors/insert_monitor", post(create_monitor))
        .route("/monitors/account/:account_id", get(get_monitors_by_account))
        .route(
            "/monitors/:id",
            get(get_monitor_by_id)
                .put(update_monitor)
                .delete(delete_monitor),
        )
        // ── Checks ──
        .route("/checks", get(get_checks).post(create_check))
        .route("/checks/monitor/:monitor_id", get(get_checks_by_monitor))
        .route("/checks/:id", delete(delete_check))
        // ── Incidents ──
        .route("/incidents", get(get_incidents).post(create_incident))
        .route("/incidents/monitor/:monitor_id", get(get_incidents_by_monitor))
        .route("/incidents/:id/resolve", put(resolve_incident))
        .route("/incidents/:id", delete(delete_incident))
        // ── App config ──
        .route("/config", get(get_config).put(set_config))
        .route("/config/:key", get(get_config_by_key).delete(delete_config))
        .fallback(static_handler)
        .with_state(pool);

    Ok(app)
}