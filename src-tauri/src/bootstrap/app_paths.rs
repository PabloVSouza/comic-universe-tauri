use std::path::PathBuf;
#[cfg(not(debug_assertions))]
use tauri::Manager;

pub struct AppPaths {
    pub profile: String,
    pub base_root: PathBuf,
    pub root: PathBuf,
    pub database: PathBuf,
    pub comics: PathBuf,
    pub covers: PathBuf,
    pub settings: PathBuf,
    pub wallpapers: PathBuf,
}

pub fn resolve_app_paths(_app: &tauri::App) -> Result<AppPaths, String> {
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
