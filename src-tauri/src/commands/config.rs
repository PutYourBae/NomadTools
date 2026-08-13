use std::fs;
use std::path::PathBuf;
use tauri::Manager;

use crate::models::config::{AppConfig, get_default_fivem_cache_path, get_default_indonesian_servers};

/// Returns the path to the config JSON file: {AppData}\NomadTools\config.json
pub fn get_config_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to resolve app data dir");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join("config.json")
}

/// Load config from disk. Creates a default config if file doesn't exist.
#[tauri::command]
pub fn load_config(app_handle: tauri::AppHandle) -> Result<AppConfig, String> {
    let path = get_config_path(&app_handle);

    if !path.exists() {
        let default = AppConfig::default();
        save_config_to_path(&path, &default)?;
        return Ok(default);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config: {e}"))?;

    let mut config = serde_json::from_str::<AppConfig>(&content)
        .map_err(|e| format!("Failed to parse config JSON: {e}"))?;

    // If config has empty server list, auto-populate default Indonesian servers
    if config.servers.is_empty() {
        config.servers = get_default_indonesian_servers(&config.settings.global_cache_dir);
        save_config_to_path(&path, &config)?;
    }

    Ok(config)
}

/// Save config to disk atomically (write to temp, then rename)
#[tauri::command]
pub fn save_config(app_handle: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let path = get_config_path(&app_handle);
    save_config_to_path(&path, &config)
}

/// Internal helper — atomic write via temp file
pub fn save_config_to_path(path: &PathBuf, config: &AppConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;

    let tmp_path = path.with_extension("json.tmp");
    fs::write(&tmp_path, &json)
        .map_err(|e| format!("Failed to write temp config: {e}"))?;
    fs::rename(&tmp_path, path)
        .map_err(|e| format!("Failed to finalize config write: {e}"))?;

    Ok(())
}

/// Load / Reset default Indonesian server profiles into current config
#[tauri::command]
pub fn load_default_presets(app_handle: tauri::AppHandle, mut config: AppConfig) -> Result<AppConfig, String> {
    let presets = get_default_indonesian_servers(&config.settings.global_cache_dir);
    config.servers = presets;
    let path = get_config_path(&app_handle);
    save_config_to_path(&path, &config)?;
    Ok(config)
}

/// Get the default FiveM server-cache-priv path
#[tauri::command]
pub fn get_default_fivem_path() -> String {
    get_default_fivem_cache_path()
}

/// Export config JSON to a user-specified path
#[tauri::command]
pub fn export_config(app_handle: tauri::AppHandle, dest_path: String) -> Result<(), String> {
    let src = get_config_path(&app_handle);
    let dest = PathBuf::from(&dest_path);

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Cannot create destination directory: {e}"))?;
    }

    fs::copy(&src, &dest)
        .map_err(|e| format!("Failed to export config: {e}"))?;

    Ok(())
}

/// Import config JSON from a user-specified path (validates schema first)
#[tauri::command]
pub fn import_config(app_handle: tauri::AppHandle, src_path: String) -> Result<AppConfig, String> {
    let content = fs::read_to_string(&src_path)
        .map_err(|e| format!("Failed to read import file: {e}"))?;

    let imported: AppConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid config file format: {e}"))?;

    let dest = get_config_path(&app_handle);
    save_config_to_path(&dest, &imported)?;

    Ok(imported)
}

/// Open a native folder picker dialog. Returns selected path or None.
#[tauri::command]
pub async fn pick_folder(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app_handle
        .dialog()
        .file()
        .blocking_pick_folder();

    Ok(folder.map(|p| p.to_string()))
}

/// Open a native file picker dialog for JSON files. Returns selected path or None.
#[tauri::command]
pub async fn pick_file(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let file = app_handle
        .dialog()
        .file()
        .add_filter("Config JSON", &["json"])
        .blocking_pick_file();

    Ok(file.map(|p| p.to_string()))
}

/// Open a native save file dialog. Returns chosen path or None.
#[tauri::command]
pub async fn pick_save_path(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let file = app_handle
        .dialog()
        .file()
        .add_filter("Config JSON", &["json"])
        .set_file_name("nomadtools_config.json")
        .blocking_save_file();

    Ok(file.map(|p| p.to_string()))
}
