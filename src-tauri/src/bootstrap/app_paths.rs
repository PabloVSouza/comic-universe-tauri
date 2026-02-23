use std::path::PathBuf;
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
    let (base_root, mode) = if let Ok(dev_root) = std::env::var("CU_DEV_DATA_DIR") {
        (PathBuf::from(dev_root), "env:CU_DEV_DATA_DIR")
    } else if is_ios_simulator_runtime() {
        (project_dev_data_dir(), "ios_simulator_runtime")
    } else if cfg!(debug_assertions) && !is_mobile_runtime() {
        (project_dev_data_dir(), "debug_assertions_desktop")
    } else {
        (
            _app.path()
                .app_data_dir()
                .map_err(|e| format!("Unable to resolve app data dir: {e}"))?,
            "app_data_dir",
        )
    };

    println!("[app_paths] base root mode: {mode}");

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

fn is_mobile_runtime() -> bool {
    cfg!(target_os = "ios") || cfg!(target_os = "android")
}

fn project_dev_data_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."))
        .join("dev-data")
}

fn is_ios_simulator_runtime() -> bool {
    if !cfg!(target_os = "ios") {
        return false;
    }

    if std::env::var("SIMULATOR_DEVICE_NAME").is_ok() || std::env::var("SIMULATOR_UDID").is_ok() {
        return true;
    }

    std::env::var("HOME")
        .map(|home| home.contains("CoreSimulator"))
        .unwrap_or(false)
}

fn current_os_profile() -> String {
    let raw = std::env::var("CU_OS_PROFILE")
        .ok()
        .or_else(|| std::env::var("USER").ok())
        .or_else(|| std::env::var("USERNAME").ok())
        .or_else(|| std::env::var("LOGNAME").ok())
        .or_else(dev_host_user_from_manifest_dir)
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

fn dev_host_user_from_manifest_dir() -> Option<String> {
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let mut prev_was_users = false;

    for component in manifest.components() {
        let segment = component.as_os_str().to_string_lossy();
        if prev_was_users && !segment.is_empty() {
            return Some(segment.to_string());
        }
        prev_was_users = segment == "Users";
    }

    None
}
