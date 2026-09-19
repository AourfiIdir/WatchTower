use std::net::SocketAddr;
mod server;
mod db;
mod assets;
mod models;
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load .env file (if present)
    dotenvy::dotenv().ok();

    // 1. Establish database connection pool & run migrations
    let pool = db::establish_connection().await?;

    // 2. Build application routes and attach pool state
    let app = server::routers::create_routers(pool).await.unwrap();
    
    // 3. Start Tokio HTTP server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 WatchTour API server running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    
    Ok(())
}

