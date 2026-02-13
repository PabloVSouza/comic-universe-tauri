mod app_paths;
mod system;

use std::sync::Arc;
use std::{error::Error, io};

use app_paths::resolve_app_paths;
use tauri::menu::Menu;
use tauri::{Emitter, Manager, RunEvent};

use crate::{
    application::{AdminService, DocumentService},
    infrastructure::SqliteDocumentStore,
    presentation::{start_rest_api, ApiEndpointPayload, RestApiState},
};

use self::system::resolve_machine_hostname;

struct ApiEndpointState(ApiEndpointPayload);

#[tauri::command]
fn get_machine_hostname() -> String {
    resolve_machine_hostname()
}

#[tauri::command]
fn minimize_main_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    println!("[window] minimize_main_window invoked");
    window
        .minimize()
        .map_err(|error| {
            let message = format!("Failed to minimize main window: {error}");
            eprintln!("[window] {message}");
            message
        })?;

    println!("[window] minimize_main_window succeeded");
    Ok(())
}

fn boxed_error(message: String) -> Box<dyn Error> {
    Box::new(io::Error::other(message))
}

fn setup_app(app: &mut tauri::App) -> Result<(), Box<dyn Error>> {
    #[cfg(target_os = "macos")]
    if let Some(main_window) = app.get_webview_window("main") {
        let default_menu = Menu::default(&app.handle())
            .map_err(|e| boxed_error(format!("Failed to create macOS default menu: {e}")))?;
        app.set_menu(default_menu)
            .map_err(|e| boxed_error(format!("Failed to set macOS default menu: {e}")))?;

        main_window
            .set_minimizable(true)
            .map_err(|e| boxed_error(format!("Failed to enable minimize on macOS window: {e}")))?;
    }

    let paths = resolve_app_paths(app).map_err(boxed_error)?;
    println!("Active OS profile: {}", paths.profile);
    println!("Base data root: {}", paths.base_root.display());
    println!("Data root: {}", paths.root.display());
    println!("Database dir: {}", paths.database.display());
    println!("Comics dir: {}", paths.comics.display());
    println!("Settings dir: {}", paths.settings.display());
    println!("Wallpapers dir: {}", paths.wallpapers.display());

    let store = Arc::new(
        SqliteDocumentStore::initialize(&paths.database).map_err(|e| boxed_error(e.to_string()))?,
    );
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
}

fn emit_endpoint_on_page_load(window: &tauri::Webview) {
    if let Some(endpoint_state) = window.app_handle().try_state::<ApiEndpointState>() {
        let _ = window.emit("api://endpoint", &endpoint_state.0);
    }
}

fn handle_run_event(app_handle: &tauri::AppHandle, event: RunEvent) {
    match event {
        #[cfg(target_os = "macos")]
        RunEvent::Reopen {
            has_visible_windows,
            ..
        } => {
            if !has_visible_windows {
                if let Some(main_window) = app_handle.get_webview_window("main") {
                    let _ = main_window.show();
                    let _ = main_window.unminimize();
                    let _ = main_window.set_focus();
                }
            }
        }
        RunEvent::Exit => {
            if let Some(api) = app_handle.try_state::<RestApiState>() {
                api.stop();
            }
        }
        _ => {}
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .enable_macos_default_menu(true)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_machine_hostname,
            minimize_main_window
        ])
        .setup(setup_app)
        .on_page_load(|window, _| emit_endpoint_on_page_load(window))
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(handle_run_event);
}
