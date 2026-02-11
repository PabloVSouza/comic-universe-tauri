mod application;
mod domain;
mod infrastructure;
mod presentation;

use std::{path::PathBuf, sync::Arc};

use application::{AdminService, DocumentService};
use infrastructure::SqliteDocumentStore;
use presentation::{start_rest_api, ApiEndpointPayload, RestApiState};
use tauri::{Emitter, Manager, RunEvent};

struct ApiEndpointState(ApiEndpointPayload);
struct AppPaths {
    profile: String,
    base_root: PathBuf,
    root: PathBuf,
    database: PathBuf,
    comics: PathBuf,
    covers: PathBuf,
    settings: PathBuf,
    wallpapers: PathBuf,
}

fn current_os_profile() -> String {
    let raw = std::env::var("CU_OS_PROFILE")
        .ok()
        .or_else(|| std::env::var("USER").ok())
        .or_else(|| std::env::var("USERNAME").ok())
        .unwrap_or_else(|| "default".to_string());

    let cleaned: String = raw
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect();

    let cleaned = cleaned.trim_matches('_').to_string();
    if cleaned.is_empty() {
        "default".to_string()
    } else {
        cleaned
    }
}

fn resolve_app_paths(_app: &tauri::App) -> Result<AppPaths, String> {
    #[cfg(debug_assertions)]
    let base_root = std::env::var("CU_DEV_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .join("dev-data")
        });

    #[cfg(not(debug_assertions))]
    let base_root = _app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Unable to resolve app data dir: {e}"))?;

    let profile = current_os_profile();
    let root = base_root.join("profiles").join(&profile);

    let paths = AppPaths {
        profile,
        base_root: base_root.clone(),
        database: root.join("database"),
        comics: root.join("comics"),
        covers: root.join("comics").join("covers"),
        settings: root.join("settings"),
        wallpapers: root.join("wallpapers"),
        root,
    };

    std::fs::create_dir_all(&paths.database)
        .map_err(|e| format!("Unable to create database dir: {e}"))?;
    std::fs::create_dir_all(&paths.comics)
        .map_err(|e| format!("Unable to create comics dir: {e}"))?;
    std::fs::create_dir_all(&paths.covers)
        .map_err(|e| format!("Unable to create covers dir: {e}"))?;
    std::fs::create_dir_all(&paths.settings)
        .map_err(|e| format!("Unable to create settings dir: {e}"))?;
    std::fs::create_dir_all(&paths.wallpapers)
        .map_err(|e| format!("Unable to create wallpapers dir: {e}"))?;

    Ok(paths)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let paths = resolve_app_paths(app)?;
            println!("Active OS profile: {}", paths.profile);
            println!("Base data root: {}", paths.base_root.display());
            println!("Data root: {}", paths.root.display());
            println!("Database dir: {}", paths.database.display());
            println!("Comics dir: {}", paths.comics.display());
            println!("Settings dir: {}", paths.settings.display());
            println!("Wallpapers dir: {}", paths.wallpapers.display());

            let store = Arc::new(SqliteDocumentStore::initialize(&paths.database)?);
            let service = DocumentService::new(store.clone());
            let admin_service = AdminService::new(store.clone());

            match start_rest_api(service, admin_service, paths.comics.clone()) {
                Ok(api) => {
                    let endpoint = api.endpoint();
                    println!(
                        "REST API listening on {} (port {})",
                        endpoint.base_url, endpoint.port
                    );
                    app.manage(ApiEndpointState(endpoint));
                    app.manage(api);
                }
                Err(error) => {
                    eprintln!("Failed to start REST API: {error}");
                    app.handle().exit(1);
                }
            }

            Ok(())
        })
        .on_page_load(|window, _| {
            if let Some(endpoint_state) = window.app_handle().try_state::<ApiEndpointState>() {
                let _ = window.emit("api://endpoint", &endpoint_state.0);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            if let Some(api) = app_handle.try_state::<RestApiState>() {
                api.stop();
            }
        }
    });
}
