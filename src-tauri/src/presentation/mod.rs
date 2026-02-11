mod dto;

use std::{
    collections::HashSet,
    fs::{self, File},
    io::{ErrorKind, Read},
    net::TcpListener,
    path::{Path as FsPath, PathBuf},
    sync::Mutex,
};

use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use mime_guess::from_path;
use tauri::async_runtime;
use tokio::sync::oneshot;
use tower_http::cors::CorsLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use zip::ZipArchive;

use crate::{
    application::{AdminService, DocumentService},
    domain::{AppError, DbRecord},
};
pub use dto::ApiEndpointPayload;
use dto::{
    ChapterPage, ChapterPagesResponse, DeleteResponse, ErrorResponse, FindBody, HealthResponse,
    ListQuery, MigrateLegacyBody, MigrateLegacyResponse, UpsertBody,
};

#[derive(Clone)]
struct RestState {
    service: DocumentService,
    admin_service: AdminService,
    admin_enabled: bool,
    comics_dir: PathBuf,
}

#[derive(Clone)]
struct CbzPageEntry {
    archive_index: usize,
    file_name: String,
}

#[derive(OpenApi)]
#[openapi(
    paths(
        health,
        upsert_record,
        get_record,
        list_records,
        find_records,
        delete_record,
        list_chapter_pages,
        get_chapter_page,
        migrate_legacy
    ),
    components(
        schemas(
            DbRecord,
            UpsertBody,
            FindBody,
            HealthResponse,
            DeleteResponse,
            ErrorResponse,
            ChapterPage,
            ChapterPagesResponse,
            MigrateLegacyBody,
            MigrateLegacyResponse
        )
    ),
    tags(
        (name = "db", description = "JSON document storage API")
    )
)]
struct ApiDoc;

pub struct RestApiState {
    shutdown: Mutex<Option<oneshot::Sender<()>>>,
    endpoint: ApiEndpointPayload,
}

impl RestApiState {
    pub fn endpoint(&self) -> ApiEndpointPayload {
        self.endpoint.clone()
    }

    pub fn stop(&self) {
        if let Ok(mut guard) = self.shutdown.lock() {
            if let Some(tx) = guard.take() {
                let _ = tx.send(());
            }
        }
    }
}

pub fn start_rest_api(
    service: DocumentService,
    admin_service: AdminService,
    comics_dir: PathBuf,
) -> Result<RestApiState, String> {
    let preferred_port = std::env::var("REST_API_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8787);
    let (listener, port) = bind_listener(preferred_port)?;
    let host = "127.0.0.1".to_string();
    let base_url = format!("http://{host}:{port}/api");
    let endpoint = ApiEndpointPayload {
        host,
        port,
        base_url,
    };

    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Failed to configure REST API listener: {e}"))?;

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    let app = build_router(RestState {
        service,
        admin_service,
        admin_enabled: admin_endpoints_enabled(),
        comics_dir,
    });

    async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(listener) {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!("REST API listener error: {error}");
                return;
            }
        };

        let server = axum::serve(listener, app).with_graceful_shutdown(async move {
            let _ = shutdown_rx.await;
        });

        if let Err(error) = server.await {
            eprintln!("REST API server terminated with error: {error}");
        }
    });

    Ok(RestApiState {
        shutdown: Mutex::new(Some(shutdown_tx)),
        endpoint,
    })
}

fn bind_listener(preferred_port: u16) -> Result<(TcpListener, u16), String> {
    let preferred_addr = format!("127.0.0.1:{preferred_port}");
    match TcpListener::bind(&preferred_addr) {
        Ok(listener) => Ok((listener, preferred_port)),
        Err(error) if error.kind() == ErrorKind::AddrInUse => {
            let listener = TcpListener::bind("127.0.0.1:0")
                .map_err(|e| format!("Failed to bind dynamic REST API port: {e}"))?;
            let port = listener
                .local_addr()
                .map_err(|e| format!("Failed to read dynamic REST API port: {e}"))?
                .port();
            Ok((listener, port))
        }
        Err(error) => Err(format!(
            "Failed to bind REST API on preferred port {preferred_port}: {error}"
        )),
    }
}

fn build_router(state: RestState) -> Router {
    let mut router = Router::new()
        .route("/api/health", get(health))
        .route("/api/db/{table}", get(list_records).post(upsert_record))
        .route(
            "/api/db/{table}/{id}",
            get(get_record).delete(delete_record),
        )
        .route("/api/db/{table}/find", post(find_records))
        .route("/api/chapters/{chapter_id}/pages", get(list_chapter_pages))
        .route(
            "/api/chapters/{chapter_id}/pages/{page_index}",
            get(get_chapter_page),
        )
        .merge(SwaggerUi::new("/swagger").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .layer(CorsLayer::permissive());

    if state.admin_enabled {
        router = router.route("/api/admin/migrate-legacy", post(migrate_legacy));
    }

    router.with_state(state)
}

#[utoipa::path(
    get,
    path = "/api/health",
    tag = "db",
    responses(
        (status = 200, description = "API health", body = HealthResponse)
    )
)]
async fn health() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok".to_string(),
    })
}

#[utoipa::path(
    post,
    path = "/api/db/{table}",
    tag = "db",
    params(
        ("table" = String, Path, description = "Table name")
    ),
    request_body = UpsertBody,
    responses(
        (status = 200, description = "Upserted record", body = DbRecord),
        (status = 400, description = "Invalid request", body = ErrorResponse),
        (status = 500, description = "Internal error", body = ErrorResponse)
    )
)]
async fn upsert_record(
    State(state): State<RestState>,
    Path(table): Path<String>,
    Json(payload): Json<UpsertBody>,
) -> Result<Json<DbRecord>, (StatusCode, String)> {
    let record = state
        .service
        .upsert(&table, payload.id, payload.data)
        .map_err(internal_error)?;
    Ok(Json(record))
}

#[utoipa::path(
    get,
    path = "/api/db/{table}/{id}",
    tag = "db",
    params(
        ("table" = String, Path, description = "Table name"),
        ("id" = String, Path, description = "Record id")
    ),
    responses(
        (status = 200, description = "Record found", body = DbRecord),
        (status = 404, description = "Record not found", body = ErrorResponse),
        (status = 400, description = "Invalid request", body = ErrorResponse),
        (status = 500, description = "Internal error", body = ErrorResponse)
    )
)]
async fn get_record(
    State(state): State<RestState>,
    Path((table, id)): Path<(String, String)>,
) -> Result<Json<DbRecord>, (StatusCode, String)> {
    let record = state.service.get(&table, &id).map_err(internal_error)?;

    match record {
        Some(value) => Ok(Json(value)),
        None => Err((StatusCode::NOT_FOUND, "Record not found".to_string())),
    }
}

#[utoipa::path(
    get,
    path = "/api/db/{table}",
    tag = "db",
    params(
        ("table" = String, Path, description = "Table name"),
        ("limit" = Option<u32>, Query, description = "Limit"),
        ("offset" = Option<u32>, Query, description = "Offset")
    ),
    responses(
        (status = 200, description = "Record list", body = [DbRecord]),
        (status = 400, description = "Invalid request", body = ErrorResponse),
        (status = 500, description = "Internal error", body = ErrorResponse)
    )
)]
async fn list_records(
    State(state): State<RestState>,
    Path(table): Path<String>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<DbRecord>>, (StatusCode, String)> {
    let values = state
        .service
        .list(&table, query.limit, query.offset)
        .map_err(internal_error)?;
    Ok(Json(values))
}

#[utoipa::path(
    post,
    path = "/api/db/{table}/find",
    tag = "db",
    params(
        ("table" = String, Path, description = "Table name")
    ),
    request_body = FindBody,
    responses(
        (status = 200, description = "Matching records", body = [DbRecord]),
        (status = 400, description = "Invalid request", body = ErrorResponse),
        (status = 500, description = "Internal error", body = ErrorResponse)
    )
)]
async fn find_records(
    State(state): State<RestState>,
    Path(table): Path<String>,
    Json(payload): Json<FindBody>,
) -> Result<Json<Vec<DbRecord>>, (StatusCode, String)> {
    let values = state
        .service
        .find_by_json_field(&table, &payload.json_path, payload.value, payload.limit)
        .map_err(internal_error)?;
    Ok(Json(values))
}

#[utoipa::path(
    delete,
    path = "/api/db/{table}/{id}",
    tag = "db",
    params(
        ("table" = String, Path, description = "Table name"),
        ("id" = String, Path, description = "Record id")
    ),
    responses(
        (status = 200, description = "Delete result", body = DeleteResponse),
        (status = 400, description = "Invalid request", body = ErrorResponse),
        (status = 500, description = "Internal error", body = ErrorResponse)
    )
)]
async fn delete_record(
    State(state): State<RestState>,
    Path((table, id)): Path<(String, String)>,
) -> Result<Json<DeleteResponse>, (StatusCode, String)> {
    let deleted = state.service.delete(&table, &id).map_err(internal_error)?;
    Ok(Json(DeleteResponse { deleted }))
}

#[utoipa::path(
    get,
    path = "/api/chapters/{chapter_id}/pages",
    tag = "db",
    params(
        ("chapter_id" = String, Path, description = "Chapter id")
    ),
    responses(
        (status = 200, description = "Chapter page URLs", body = ChapterPagesResponse),
        (status = 404, description = "Chapter or CBZ not found", body = ErrorResponse),
        (status = 500, description = "Internal error", body = ErrorResponse)
    )
)]
async fn list_chapter_pages(
    State(state): State<RestState>,
    Path(chapter_id): Path<String>,
) -> Result<Json<ChapterPagesResponse>, (StatusCode, String)> {
    let chapter = state
        .service
        .get("chapters", &chapter_id)
        .map_err(internal_error)?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Chapter not found".to_string()))?;

    let comic_id = chapter_value_as_string(&chapter, "comicId").ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Chapter has no comicId".to_string(),
        )
    })?;
    let chapter_name = chapter_display_name(&chapter);
    let chapter_number = chapter_value_as_string(&chapter, "number");

    let comic = state
        .service
        .get("comics", &comic_id)
        .map_err(internal_error)?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Comic not found".to_string()))?;
    let comic_name = chapter_value_as_string(&comic, "name").unwrap_or_else(|| comic_id.clone());

    let cbz_path = resolve_chapter_cbz_path(
        &state.comics_dir,
        &comic_id,
        &comic_name,
        &chapter_name,
        chapter_number.as_deref(),
    )
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            "Chapter CBZ file not found in comics directory".to_string(),
        )
    })?;

    let entries = list_image_entries(&cbz_path).map_err(internal_error)?;
    if entries.is_empty() {
        return Err((StatusCode::NOT_FOUND, "CBZ has no image pages".to_string()));
    }

    let pages = entries
        .iter()
        .enumerate()
        .map(|(index, entry)| ChapterPage {
            index,
            file_name: entry.file_name.clone(),
            url: format!("/api/chapters/{chapter_id}/pages/{index}"),
        })
        .collect::<Vec<_>>();

    Ok(Json(ChapterPagesResponse {
        chapter_id,
        comic_id,
        comic_name,
        chapter_name,
        page_count: pages.len(),
        pages,
    }))
}

#[utoipa::path(
    get,
    path = "/api/chapters/{chapter_id}/pages/{page_index}",
    tag = "db",
    params(
        ("chapter_id" = String, Path, description = "Chapter id"),
        ("page_index" = usize, Path, description = "Page index (0-based)")
    ),
    responses(
        (status = 200, description = "Image bytes"),
        (status = 404, description = "Page not found", body = ErrorResponse),
        (status = 500, description = "Internal error", body = ErrorResponse)
    )
)]
async fn get_chapter_page(
    State(state): State<RestState>,
    Path((chapter_id, page_index)): Path<(String, usize)>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let chapter = state
        .service
        .get("chapters", &chapter_id)
        .map_err(internal_error)?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Chapter not found".to_string()))?;

    let comic_id = chapter_value_as_string(&chapter, "comicId").ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "Chapter has no comicId".to_string(),
        )
    })?;
    let chapter_name = chapter_display_name(&chapter);
    let chapter_number = chapter_value_as_string(&chapter, "number");

    let comic = state
        .service
        .get("comics", &comic_id)
        .map_err(internal_error)?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Comic not found".to_string()))?;
    let comic_name = chapter_value_as_string(&comic, "name").unwrap_or_else(|| comic_id.clone());

    let cbz_path = resolve_chapter_cbz_path(
        &state.comics_dir,
        &comic_id,
        &comic_name,
        &chapter_name,
        chapter_number.as_deref(),
    )
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            "Chapter CBZ file not found in comics directory".to_string(),
        )
    })?;

    let entries = list_image_entries(&cbz_path).map_err(internal_error)?;
    let page = entries.get(page_index).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            "Page index out of bounds".to_string(),
        )
    })?;

    let bytes = read_entry_bytes(&cbz_path, page.archive_index).map_err(internal_error)?;
    let content_type = from_path(&page.file_name).first_or_octet_stream();

    Ok((
        [
            (header::CONTENT_TYPE, content_type.to_string()),
            (header::CACHE_CONTROL, "public, max-age=300".to_string()),
        ],
        bytes,
    ))
}

#[utoipa::path(
    post,
    path = "/api/admin/migrate-legacy",
    tag = "db",
    request_body = MigrateLegacyBody,
    responses(
        (status = 200, description = "Legacy migration result", body = MigrateLegacyResponse),
        (status = 404, description = "Admin endpoints disabled", body = ErrorResponse),
        (status = 500, description = "Internal error", body = ErrorResponse)
    )
)]
async fn migrate_legacy(
    State(state): State<RestState>,
    Json(payload): Json<MigrateLegacyBody>,
) -> Result<Json<MigrateLegacyResponse>, (StatusCode, String)> {
    if !state.admin_enabled {
        return Err((StatusCode::NOT_FOUND, "Not Found".to_string()));
    }

    let report = state
        .admin_service
        .migrate_legacy(payload.legacy_db_path)
        .map_err(internal_error)?;

    let response = match report {
        Some(report) => MigrateLegacyResponse {
            performed: true,
            imported_rows: report.imported_rows,
            legacy_db_path: Some(report.legacy_db_path),
        },
        None => MigrateLegacyResponse {
            performed: false,
            imported_rows: 0,
            legacy_db_path: None,
        },
    };

    Ok(Json(response))
}

fn admin_endpoints_enabled() -> bool {
    if let Ok(value) = std::env::var("REST_ADMIN_ENABLED") {
        let normalized = value.trim().to_ascii_lowercase();
        return matches!(normalized.as_str(), "1" | "true" | "yes" | "on");
    }

    cfg!(debug_assertions)
}

fn internal_error(error: AppError) -> (StatusCode, String) {
    match error {
        AppError::InvalidTable(message) => (StatusCode::BAD_REQUEST, message),
        AppError::Validation(message) => (StatusCode::BAD_REQUEST, message),
        AppError::Infrastructure(message) => (StatusCode::INTERNAL_SERVER_ERROR, message),
    }
}

fn chapter_value_as_string(record: &DbRecord, field: &str) -> Option<String> {
    record
        .data
        .get(field)
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn chapter_display_name(chapter: &DbRecord) -> String {
    chapter_value_as_string(chapter, "name")
        .or_else(|| {
            chapter_value_as_string(chapter, "number").map(|number| format!("Chapter {number}"))
        })
        .unwrap_or_else(|| "chapter".to_string())
}

fn resolve_chapter_cbz_path(
    comics_dir: &FsPath,
    comic_id: &str,
    comic_name: &str,
    chapter_name: &str,
    chapter_number: Option<&str>,
) -> Option<PathBuf> {
    let comic_base = sanitize_segment(comic_name);
    let chapter_file_candidates = chapter_file_candidates(chapter_name, chapter_number);
    let mut dir_candidates = vec![
        comics_dir.join(&comic_base),
        comics_dir.join(sanitize_segment(comic_id)),
    ];

    if let Ok(entries) = fs::read_dir(comics_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            if let Some(name) = path.file_name().and_then(|value| value.to_str()) {
                if name == comic_base || name.starts_with(&format!("{comic_base} (")) {
                    dir_candidates.push(path);
                }
            }
        }
    }

    for dir in dir_candidates {
        for candidate in &chapter_file_candidates {
            let cbz = dir.join(candidate);
            if cbz.exists() {
                return Some(cbz);
            }
        }
    }

    None
}

fn chapter_file_candidates(chapter_name: &str, chapter_number: Option<&str>) -> Vec<String> {
    let mut values = Vec::new();
    let mut seen = HashSet::new();
    let sanitized_name = sanitize_segment(chapter_name);

    if seen.insert(sanitized_name.clone()) {
        values.push(format!("{sanitized_name}.cbz"));
    }

    if let Some(number) = chapter_number {
        let sanitized_number = sanitize_segment(number);
        if seen.insert(sanitized_number.clone()) {
            values.push(format!("{sanitized_number}.cbz"));
        }

        let old_format = sanitize_segment(&format!("{number} - {chapter_name}"));
        if seen.insert(old_format.clone()) {
            values.push(format!("{old_format}.cbz"));
        }

        let fallback = sanitize_segment(&format!("Chapter {number}"));
        if seen.insert(fallback.clone()) {
            values.push(format!("{fallback}.cbz"));
        }
    }

    values
}

fn sanitize_segment(value: &str) -> String {
    let mut out = String::new();
    for ch in value.chars() {
        let accepted = ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '.' | ' ');
        if accepted {
            out.push(ch);
        } else {
            out.push('_');
        }
    }

    let cleaned = out.trim().trim_start_matches('.').to_string();
    if cleaned.is_empty() {
        "untitled".to_string()
    } else if cleaned.len() > 180 {
        cleaned[..180].to_string()
    } else {
        cleaned
    }
}

fn list_image_entries(cbz_path: &FsPath) -> Result<Vec<CbzPageEntry>, AppError> {
    let file = File::open(cbz_path).map_err(|error| AppError::infrastructure(error.to_string()))?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| AppError::infrastructure(error.to_string()))?;

    let mut pages = Vec::new();
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|error| AppError::infrastructure(error.to_string()))?;
        if !entry.is_file() {
            continue;
        }

        let file_name = entry.name().to_string();
        if !is_image_file(&file_name) {
            continue;
        }

        pages.push(CbzPageEntry {
            archive_index: index,
            file_name,
        });
    }

    Ok(pages)
}

fn read_entry_bytes(cbz_path: &FsPath, archive_index: usize) -> Result<Vec<u8>, AppError> {
    let file = File::open(cbz_path).map_err(|error| AppError::infrastructure(error.to_string()))?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| AppError::infrastructure(error.to_string()))?;
    let mut entry = archive
        .by_index(archive_index)
        .map_err(|error| AppError::infrastructure(error.to_string()))?;
    let mut bytes = Vec::new();
    entry
        .read_to_end(&mut bytes)
        .map_err(|error| AppError::infrastructure(error.to_string()))?;
    Ok(bytes)
}

fn is_image_file(path: &str) -> bool {
    path.rsplit('.')
        .next()
        .map(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "jpg" | "jpeg" | "png" | "webp" | "gif" | "bmp" | "avif"
            )
        })
        .unwrap_or(false)
}
