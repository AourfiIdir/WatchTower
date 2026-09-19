use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::time::Duration;

pub async fn establish_connection() -> Result<PgPool, Box<dyn std::error::Error>> {
    // 1. Get DATABASE_URL from .env or environment
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL environment variable must be set");

    // 2. Configure connection pool limits & timeouts
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&database_url)
        .await?;

    println!("✅ Connected to PostgreSQL database!");

    // 3. Automatically run pending migrations from ./migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await?;

    println!("✅ SQLx database migrations applied successfully!");

    Ok(pool)
}