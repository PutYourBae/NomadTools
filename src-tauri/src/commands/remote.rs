use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

use crate::models::config::{AppConfig, ServerProfile};
use crate::commands::config::{get_config_path, save_config_to_path};

/// GitHub Raw URL — file servers.json di repo NomadTools
const REMOTE_SERVERS_URL: &str =
    "https://raw.githubusercontent.com/PutYourBae/NomadTools/main/servers.json";

/// Minimal server entry dari remote JSON
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct RemoteServer {
    id: String,
    name: String,
    join_code: String,
}

/// Fetch remote server list dari GitHub dan merge ke config user.
/// - Server baru dari remote → ditambahkan ke config user
/// - Server yang sudah ada (by id) → nama diperbarui, cache_path tetap milik user
/// - Server custom user → tidak disentuh
/// - Offline / fetch gagal → silent fail, return config tidak berubah
#[tauri::command]
pub async fn sync_remote_servers(
    app_handle: tauri::AppHandle,
    mut config: AppConfig,
) -> Result<SyncResult, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(6))
        .user_agent("NomadTools/1.0")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let resp = match client.get(REMOTE_SERVERS_URL).send().await {
        Ok(r) if r.status().is_success() => r,
        Ok(r) => {
            return Ok(SyncResult { added: 0, updated: 0, error: Some(format!("HTTP {}", r.status())) });
        }
        Err(e) => {
            // Silent fail — no internet or GitHub unreachable
            return Ok(SyncResult { added: 0, updated: 0, error: Some(format!("{e}")) });
        }
    };

    let remote_servers: Vec<RemoteServer> = match resp.json().await {
        Ok(list) => list,
        Err(e) => {
            return Ok(SyncResult { added: 0, updated: 0, error: Some(format!("Parse error: {e}")) });
        }
    };

    let global_cache_dir = config.settings.global_cache_dir.clone();
    let mut added = 0u32;
    let mut updated = 0u32;

    for remote in remote_servers {
        if let Some(existing) = config.servers.iter_mut().find(|s| s.id == remote.id) {
            // Server sudah ada — update nama jika berbeda
            if existing.name != remote.name {
                existing.name = remote.name.clone();
                updated += 1;
            }
        } else {
            // Server baru dari remote — tambahkan ke list user
            let cache_path = format!("{}\\{}", global_cache_dir, sanitize_folder_name(&remote.name));
            config.servers.push(ServerProfile {
                id: remote.id,
                name: remote.name,
                join_code: remote.join_code,
                cache_path,
                last_played: None,
            });
            added += 1;
        }
    }

    // Simpan ke disk hanya jika ada perubahan
    if added > 0 || updated > 0 {
        let path = get_config_path(&app_handle);
        save_config_to_path(&path, &config)?;
    }

    Ok(SyncResult { added, updated, error: None })
}

/// Result struct yang dikembalikan ke frontend
#[derive(serde::Serialize, Debug)]
pub struct SyncResult {
    pub added: u32,
    pub updated: u32,
    pub error: Option<String>,
}

/// Bersihkan nama server jadi nama folder yang aman (hapus karakter #, *, dll)
fn sanitize_folder_name(name: &str) -> String {
    name.chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .collect::<String>()
        .trim_start_matches('#')
        .trim()
        .to_string()
}
