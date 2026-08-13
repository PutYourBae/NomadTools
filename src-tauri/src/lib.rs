mod models;
mod commands;

use commands::api::EndpointCache;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(EndpointCache::new())
        .invoke_handler(tauri::generate_handler![
            // Config commands
            commands::config::load_config,
            commands::config::save_config,
            commands::config::get_default_fivem_path,
            commands::config::export_config,
            commands::config::import_config,
            commands::config::load_default_presets,
            commands::config::pick_folder,
            commands::config::pick_file,
            commands::config::pick_save_path,
            // Cache commands
            commands::cache::swap_cache,
            commands::cache::adopt_active_cache,
            commands::cache::get_storage_analytics,
            commands::cache::open_folder_in_explorer,
            commands::cache::delete_server_cache_folder,
            // Process commands
            commands::process::is_fivem_running,
            // API commands
            commands::api::fetch_server_info,
            commands::api::fetch_player_list,
            commands::api::fetch_all_servers_info,
            commands::api::clear_endpoint_cache,
            commands::api::check_localhost_server,
            // Remote sync
            commands::remote::sync_remote_servers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running NomadTools");
}
