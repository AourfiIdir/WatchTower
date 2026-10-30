use std::net::SocketAddr;
mod server;
mod db;
mod assets;
mod engine;
mod models;
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load .env file (if present)
    dotenvy::dotenv().ok();

    // 1. Establish database connection pool & run migrations
    let pool = db::establish_connection().await?;

    // 2. Start the engine supervisor: it keeps one check engine per account,
    //    including accounts created after boot.
    tokio::spawn(engine::Engine::supervise(pool.clone()));

    // 3. Build application routes and attach pool state
    let app = server::routers::create_routers(pool).await.unwrap();
    
    // 4. Start Tokio HTTP server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 WatchTour API server running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    
    Ok(())
}


