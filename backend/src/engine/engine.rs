use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use hickory_resolver::TokioResolver;
use reqwest::Client;
use sqlx::{PgPool, Postgres};
use tokio::task::{JoinHandle, JoinSet};
use uuid::Uuid;

use super::engine_models::*;
use super::handlers::*;
use crate::models::*;

const MONITOR_COLUMNS: &str = "id, account_id, name, type, target, port, http_method,
    expected_status_code, headers, body, dns_query_type, dns_expected_result,
    interval_seconds, timeout_seconds, is_active, created_at, updated_at";

/// How often the scheduler wakes up to look for monitors that are due.
/// `interval_seconds` is honoured per monitor, this is only the tick granularity.
const TICK: Duration = Duration::from_secs(5);

/// How often the supervisor reconciles the set of accounts with running engines.
const SUPERVISOR_INTERVAL: Duration = Duration::from_secs(30);

pub struct Engine {
    pool: PgPool,
    client: Client,
    resolver: TokioResolver,
    last_checked: Mutex<HashMap<Uuid, Instant>>,
}

impl Engine {
    fn with_shared(pool: PgPool, client: Client, resolver: TokioResolver) -> Self {
        Self {
            pool,
            client,
            resolver,
            last_checked: Mutex::new(HashMap::new()),
        }
    }

    /// Keeps exactly one engine running per account, so accounts created after
    /// boot are picked up and engines for deleted accounts are stopped.
    pub async fn supervise(pool: PgPool) {
        let client = build_http_client();
        let resolver = build_dns_resolver();
        let mut engines: HashMap<Uuid, JoinHandle<()>> = HashMap::new();

        loop {
            match account_ids(&pool).await {
                Ok(ids) => {
                    for id in &ids {
                        if !engines.contains_key(id) {
                            let engine =
                                Engine::with_shared(pool.clone(), client.clone(), resolver.clone());
                            engines.insert(*id, engine.start(*id));
                        }
                    }

                    engines.retain(|id, handle| {
                        if ids.contains(id) {
                            true
                        } else {
                            handle.abort();
                            false
                        }
                    });
                }
                Err(err) => eprintln!("engine supervisor: failed to list accounts: {err}"),
            }

            tokio::time::sleep(SUPERVISOR_INTERVAL).await;
        }
    }

    pub fn start(self, account_id: Uuid) -> JoinHandle<()> {
        tokio::spawn(async move {
            println!("WatchTour tokio engine is running for account {account_id} ....");
            let mut ticker = tokio::time::interval(TICK);
            ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                ticker.tick().await;

                if let Err(err) = self.run_check_cycle(&account_id).await {
                    eprintln!("Error during check cycle: {:?}", err);
                }
            }
        })
    }

    pub async fn run_check_cycle(&self, account_id: &Uuid) -> Result<(), sqlx::Error> {
        let monitors = sqlx::query_as::<Postgres, Monitor>(&format!(
            "SELECT {MONITOR_COLUMNS} FROM monitors
             WHERE is_active = true AND account_id = $1
             ORDER BY created_at ASC"
        ))
        .bind(*account_id)
        .fetch_all(&self.pool)
        .await?;

        // Run every due monitor concurrently: a slow monitor no longer delays
        // the rest of the cycle. Dropping the JoinSet (e.g. if the engine task
        // is aborted) cancels all still-running checks.
        let mut checks = JoinSet::new();
        for monitor in monitors {
            if !self.take_if_due(&monitor) {
                continue;
            }

            let pool = self.pool.clone();
            let client = self.client.clone();
            let resolver = self.resolver.clone();

            checks.spawn(async move {
                let result = match &monitor.r#type {
                    MonitorType::Http => execute_http_req(&client, &monitor).await,
                    MonitorType::Tcp => execute_tcp_req(&monitor).await,
                    MonitorType::Dns => execute_dns_req(&resolver, &monitor).await,
                    MonitorType::Icmp => execute_icmp_req(&monitor).await,
                };

                record_check(&pool, &monitor, &result).await;
            });
        }

        while let Some(outcome) = checks.join_next().await {
            if let Err(err) = outcome {
                eprintln!("engine: check task failed: {err}");
            }
        }

        Ok(())
    }

    /// Returns `true` when `monitor.interval_seconds` has elapsed since its last
    /// check, marking it as checked so it is not run twice in the same cycle.
    fn take_if_due(&self, monitor: &Monitor) -> bool {
        let mut last_checked = self.last_checked.lock().unwrap_or_else(|e| e.into_inner());
        let interval = Duration::from_secs(monitor.interval_seconds.max(1) as u64);

        match last_checked.get(&monitor.id) {
            Some(last) if last.elapsed() < interval => false,
            _ => {
                last_checked.insert(monitor.id, Instant::now());
                true
            }
        }
    }
}

async fn account_ids(pool: &PgPool) -> Result<Vec<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM accounts")
        .fetch_all(pool)
        .await
}

async fn record_check(pool: &PgPool, monitor: &Monitor, result: &PingResponse) {
    let outcome = sqlx::query(
        "INSERT INTO monitor_checks
            (monitor_id, is_up, status_code, response_time_ms, error_message)
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(monitor.id)
    .bind(result.is_up)
    .bind(result.status_code)
    .bind(result.response_time_ms)
    .bind(result.error_message.as_deref())
    .execute(pool)
    .await;

    if let Err(err) = outcome {
        eprintln!(
            "failed to record check for monitor {} ({}): {}",
            monitor.id, monitor.name, err
        );
    }
}

fn build_http_client() -> Client {
    Client::builder()
        .pool_max_idle_per_host(10)
        .user_agent("WatchTower-Engine/1.0")
        .build()
        .expect("failed to initialize reqwest client")
}

/// System-default async DNS resolver (/etc/resolv.conf on Unix).
fn build_dns_resolver() -> TokioResolver {
    TokioResolver::builder_tokio()
        .expect("failed to read the system DNS configuration")
        .build()
        .expect("failed to initialize the DNS resolver")
}
