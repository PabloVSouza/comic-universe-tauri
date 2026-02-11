# Comic Universe Tauri (3.0 Bootstrap)

Rust-first Tauri 2 app with an embedded REST API (`axum`) over a JSON-document SQLite layer.

## Architecture Boundary

- UI data access is REST-only.
- REST API runs inside the Tauri app process and starts with app boot.
- Tauri commands are reserved for native capabilities (window management, filesystem integration, platform-only features).
- Do not call Tauri `invoke` for domain data reads/writes from React views.

## Rust Layers

- `domain`: core models (`DbRecord`, `Table`)
- `application`: use-cases and `DocumentStore` port (`DocumentService`)
- `infrastructure`: `SqliteDocumentStore` adapter (rusqlite + migrations)
- `presentation`: REST handlers (`rest_api`) depending on `DocumentService`, not on rusqlite

## Database Model

The app initializes `comic_universe.db` in Tauri app data directory and creates six JSON-document tables inspired by the legacy app:

- `users`
- `comics`
- `chapters`
- `read_progress`
- `plugins`
- `changelog`

Each table uses:

- `id TEXT PRIMARY KEY`
- `data TEXT` with `CHECK(json_valid(data))`
- `created_at`
- `updated_at`

This keeps schema flexibility for dynamic fields while preserving per-entity table boundaries.

## REST API

Base URL (default):

```bash
http://127.0.0.1:8787/api
```

Routes:

- `GET /api/health`
- `GET /api/db/:table?limit=&offset=`
- `GET /api/db/:table/:id`
- `POST /api/db/:table` with `{ id?, data }`
- `POST /api/db/:table/find` with `{ jsonPath, value, limit? }`
- `DELETE /api/db/:table/:id`

## Local Development

```bash
npm install
npm run tauri dev
```

Set REST endpoint on frontend (optional):

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787/api
```

Change server port if needed:
```bash
REST_API_PORT=8787 npm run tauri dev
```
