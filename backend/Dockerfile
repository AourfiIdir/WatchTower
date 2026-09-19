FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/WatchTower_Gui/package.json frontend/WatchTower_Gui/package-lock.json ./
RUN npm ci
COPY frontend/WatchTower_Gui/ ./
RUN npm run build

FROM rust:1.97-bookworm AS backend-builder
WORKDIR /app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src
COPY backend/migrations ./migrations
COPY backend/.sqlx ./.sqlx
COPY --from=frontend-builder /app/frontend/dist ./public
ENV SQLX_OFFLINE=true
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=backend-builder /app/target/release/backend ./backend
COPY --from=backend-builder /app/migrations ./migrations
EXPOSE 3000
CMD ["./backend"]
