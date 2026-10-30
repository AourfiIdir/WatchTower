# WatchTower

A self-hosted uptime monitoring app. WatchTower runs scheduled checks against your HTTP, TCP, DNS and ICMP targets, stores the results, and raises incidents when something goes down — all behind a React dashboard.

## Features

- **Multiple check types** — HTTP(S), TCP, DNS and ICMP monitors
- **Per-monitor scheduling** — configurable interval, timeout, HTTP method/headers/body, expected status code and DNS record type
- **Concurrent engine** — a Tokio task per account checks every due monitor in parallel
- **Historical results** — every check is stored with response time, status and protocol-specific detail
- **Incident tracking** — downtime events are opened and resolved automatically
- **Multi-account workspaces** — monitors, checks and incidents are scoped to an account
- **Single binary deployment** — the built React app is embedded into the Rust backend
- **Dockerized** — one command brings up the whole stack

## Tech stack

| Layer     | Technology                                              |
| --------- | ------------------------------------------------------- |
| Backend   | Rust, Axum, Tokio, SQLx, Reqwest, Hickory DNS           |
| Database  | PostgreSQL 16                                           |
| Frontend  | React 19, TypeScript, Vite, React Router                |
| Packaging | Docker, Docker Compose                                  |

## Project structure

```
.
├── backend/                 # Rust API + monitoring engine
│   ├── src/
│   │   ├── db/              # Connection pool and migrations runner
│   │   ├── engine/          # Scheduler and protocol check handlers
│   │   ├── models/          # SQLx row models
│   │   ├── server/          # Axum routers, handlers, static files
│   │   ├── assets.rs        # Embedded frontend assets
│   │   └── main.rs          # Entry point
│   ├── migrations/          # SQL migrations (run automatically on boot)
│   └── Dockerfile
├── frontend/WatchTower_Gui/ # React + Vite dashboard
├── docker-compose.yaml
├── Makefile
└── .env.example
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose, **or**
- Rust (2024 edition toolchain), Node.js 20+, npm and a running PostgreSQL 16 instance

## Quick start (Docker)

1. Create your environment file:

   ```bash
   cp .env.example .env
   ```

2. Set real values in `.env` (at minimum `POSTGRES_PASSWORD` and the matching `DATABASE_URL`).

3. Build and start the stack:

   ```bash
   make up
   ```

4. Open <http://localhost:3000>. The backend runs pending migrations automatically on startup.

To follow logs and stop the stack:

```bash
make logs
make down
```

`make watch` uses Docker Compose watch to rebuild on source changes.

## Local development

### Database

```bash
make db
```

### Backend

Copy the backend environment template and point it at your database:

```bash
cp backend/.env.example backend/.env
# edit DATABASE_URL if needed
make backend
```

`make backend` builds the frontend, copies the output into `backend/public/` and runs the API on port `3000`.

### Frontend (hot reload)

```bash
cd frontend/WatchTower_Gui
npm install
npm run dev
```

The Vite dev server proxies API routes to `http://localhost:3000`, so run the backend alongside it.

## Environment variables

| Variable            | Used by          | Description                                                        |
| ------------------- | ---------------- | ------------------------------------------------------------------ |
| `POSTGRES_USER`     | Docker Compose   | PostgreSQL user (default `idir`)                                   |
| `POSTGRES_PASSWORD` | Docker Compose   | PostgreSQL password (**required**)                                 |
| `POSTGRES_DB`       | Docker Compose   | Database name (default `watchtower_db`)                            |
| `DATABASE_URL`      | Backend          | PostgreSQL connection string (**required**)                        |

See `.env.example` (Docker) and `backend/.env.example` (local backend) for templates. Never commit real credentials.

## API

All routes are served by the backend and, when the frontend is embedded, also by the same origin.

### Accounts

| Method   | Path                          | Description                 |
| -------- | ----------------------------- | --------------------------- |
| `GET`    | `/accounts`                   | List accounts               |
| `POST`   | `/accounts/insert_account`    | Create an account           |
| `GET`    | `/accounts/id/:id`            | Get account by ID           |
| `GET`    | `/accounts/name/:name`        | Get account by name         |
| `PUT`    | `/accounts/:id`               | Update an account           |
| `DELETE` | `/accounts/:id`               | Delete an account           |

### Monitors

| Method   | Path                          | Description                 |
| -------- | ----------------------------- | --------------------------- |
| `GET`    | `/monitors`                   | List monitors               |
| `POST`   | `/monitors/insert_monitor`    | Create a monitor            |
| `GET`    | `/monitors/account/:account_id` | List monitors for an account |
| `GET`    | `/monitors/:id`               | Get a monitor               |
| `PUT`    | `/monitors/:id`               | Update a monitor            |
| `DELETE` | `/monitors/:id`               | Delete a monitor            |

### Checks

| Method   | Path                          | Description                 |
| -------- | ----------------------------- | --------------------------- |
| `GET`    | `/checks`                     | List checks                 |
| `POST`   | `/checks`                     | Create a check manually     |
| `GET`    | `/checks/monitor/:monitor_id` | List checks for a monitor   |
| `DELETE` | `/checks/:id`                 | Delete a check              |

### Incidents

| Method   | Path                            | Description                 |
| -------- | ------------------------------- | --------------------------- |
| `GET`    | `/incidents`                    | List incidents              |
| `POST`   | `/incidents`                    | Create an incident          |
| `GET`    | `/incidents/monitor/:monitor_id` | List incidents for a monitor |
| `PUT`    | `/incidents/:id/resolve`        | Resolve an incident         |
| `DELETE` | `/incidents/:id`                | Delete an incident          |

### Config

| Method   | Path             | Description                 |
| -------- | ---------------- | --------------------------- |
| `GET`    | `/config`        | List config entries         |
| `PUT`    | `/config`        | Set config entries          |
| `GET`    | `/config/:key`   | Get a config value          |
| `DELETE` | `/config/:key`   | Delete a config entry       |

## Database

Migrations live in `backend/migrations/` and run automatically when the backend starts.

| Table            | Purpose                                              |
| ---------------- | ---------------------------------------------------- |
| `accounts`       | Workspaces, each with an optional API key            |
| `monitors`       | Targets and protocol-specific configuration          |
| `monitor_checks` | Time-series check results                            |
| `dns_checks`     | DNS detail for a check (records, rcode)              |
| `tcp_checks`     | TCP detail for a check (port, resolved IPs)          |
| `http_checks`    | HTTP detail for a check (status, timings, TLS)       |
| `incidents`      | Downtime events from onset to resolution             |
| `app_config`     | Global settings such as retention and webhooks       |

The seed migration (`0002_seed.sql`) inserts a demo account, monitors, checks and an incident.

## Makefile commands

| Command        | Description                                             |
| -------------- | ------------------------------------------------------- |
| `make help`    | List available commands                                 |
| `make frontend`| Build the React frontend into `dist/`                   |
| `make backend` | Build frontend, copy into `public/`, run backend        |
| `make dev`     | Start the database, then run the backend locally        |
| `make db`      | Start only the PostgreSQL container                     |
| `make up`      | Build and start the full stack via Docker               |
| `make watch`   | Docker Compose watch mode (rebuild on changes)          |
| `make logs`    | Tail Docker logs                                        |
| `make down`    | Stop containers (keeps the `pgdata` volume)             |
| `make clean`   | Remove build output                                     |
| `make lint`    | Lint the frontend                                       |

## License

No license has been specified for this project yet.
