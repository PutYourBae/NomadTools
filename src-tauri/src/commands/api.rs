use reqwest::Client;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use serde::Deserialize;

use crate::models::config::{PlayerInfo, ServerInfo};

// ─── Endpoint Cache (Tauri managed state) ────────────────────────────────────

#[derive(Clone, Debug)]
pub struct CachedServerData {
    pub endpoint: Option<String>,
    pub clients: u32,
    pub max_clients: u32,
    pub hostname: String,
    pub icon_url: Option<String>,
    pub players: Vec<PlayerInfo>,
    pub resolved_at: Instant,
}

pub struct EndpointCache {
    pub map: Mutex<HashMap<String, CachedServerData>>,
}

impl EndpointCache {
    pub fn new() -> Self {
        EndpointCache {
            map: Mutex::new(HashMap::new()),
        }
    }

    fn get(&self, join_code: &str) -> Option<CachedServerData> {
        let map = self.map.lock().unwrap();
        if let Some(data) = map.get(join_code) {
            if data.resolved_at.elapsed().as_secs() < ENDPOINT_CACHE_TTL_SECS {
                return Some(data.clone());
            }
        }
        None
    }

    fn insert(&self, join_code: &str, data: CachedServerData) {
        let mut map = self.map.lock().unwrap();
        map.insert(join_code.to_string(), data);
    }

    fn clear(&self) {
        self.map.lock().unwrap().clear();
    }
}

const ENDPOINT_CACHE_TTL_SECS: u64 = 300; // 5 minutes cache TTL

// ─── Sanitizer Helper ─────────────────────────────────────────────────────────

/// Clean raw input like "cfx.re/join/kr7k7d" or "https://cfx.re/join/kr7k7d?foo=bar" → "kr7k7d"
fn sanitize_join_code(raw: &str) -> String {
    let mut s = raw.trim();
    if let Some(pos) = s.rfind('/') {
        s = &s[pos + 1..];
    }
    if let Some(pos) = s.find('?') {
        s = &s[..pos];
    }
    s.trim().to_lowercase()
}

// ─── CFX API Response Structs ─────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
struct CfxServerResponse {
    #[serde(alias = "data", alias = "Data")]
    data: Option<CfxServerData>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct CfxServerData {
    connect_end_points: Option<Vec<String>>,
    clients: Option<u32>,
    sv_maxclients: Option<u32>,
    hostname: Option<String>,
    icon_version: Option<serde_json::Value>,
    raw_icon: Option<String>,
    owner_avatar: Option<String>,
    players: Option<Vec<CfxPlayer>>,
}

#[derive(Deserialize, Debug)]
struct CfxPlayer {
    id: Option<u32>,
    name: Option<String>,
    ping: Option<u32>,
}

#[derive(Deserialize, Debug)]
struct DynamicJson {
    clients: Option<u32>,
    sv_maxclients: Option<u32>,
    hostname: Option<String>,
}

#[derive(Deserialize, Debug)]
struct PlayersJsonEntry {
    id: Option<u32>,
    name: Option<String>,
    ping: Option<u32>,
}

// ─── HTTP Client ──────────────────────────────────────────────────────────────

fn build_http_client() -> reqwest::Result<Client> {
    Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
        .build()
}

// ─── Endpoint Resolver with CFX Fallback ──────────────────────────────────────

async fn resolve_cfx_server(
    raw_code: &str,
    cache: &EndpointCache,
    client: &Client,
) -> Result<CachedServerData, String> {
    let clean_code = sanitize_join_code(raw_code);
    if clean_code.is_empty() {
        return Err("Join code tidak boleh kosong.".to_string());
    }

    // Return cached if still valid
    if let Some(cached) = cache.get(&clean_code) {
        return Ok(cached);
    }

    // Direct IP:PORT support (e.g. user entered "123.45.67.89:30120")
    if clean_code.contains(':') && !clean_code.contains('/') {
        let cached = CachedServerData {
            endpoint: Some(clean_code.clone()),
            clients: 0,
            max_clients: 0,
            hostname: clean_code.clone(),
            icon_url: None,
            players: Vec::new(),
            resolved_at: Instant::now(),
        };
        cache.insert(&clean_code, cached.clone());
        return Ok(cached);
    }

    // Try primary CFX API endpoint, then secondary domain fallbacks
    let urls = [
        format!("https://frontend.cfx-services.net/api/servers/single/{}", clean_code),
        format!("https://servers-frontend.fivem.net/api/servers/single/{}", clean_code),
        format!("https://keymaster.fivem.net/api/servers/single/{}", clean_code),
    ];

    let mut last_err = String::from("No response");

    for url in &urls {
        match client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(body) = resp.json::<CfxServerResponse>().await {
                    if let Some(d) = body.data {
                        let endpoint = d.connect_end_points
                            .and_then(|eps| eps.into_iter().next());

                        // Resolve official in-game server icon
                        let mut icon_url = None;

                        // 1. Check raw_icon from CFX API
                        if let Some(ref raw) = d.raw_icon {
                            if !raw.trim().is_empty() {
                                let full_b64 = if raw.starts_with("data:image") || raw.starts_with("http") {
                                    raw.to_string()
                                } else {
                                    format!("data:image/png;base64,{}", raw)
                                };
                                icon_url = Some(full_b64);
                            }
                        }

                        // 2. Check icon_version CDN URL if no raw_icon
                        if icon_url.is_none() {
                            if let Some(ref ver) = d.icon_version {
                                let ver_str = ver.to_string().replace('"', "");
                                if !ver_str.is_empty() && ver_str != "null" {
                                    icon_url = Some(format!("https://servers-frontend.fivem.net/api/servers/icon/{}/{}.png", clean_code, ver_str));
                                }
                            }
                        }

                        // 3. Fetch from endpoint /info.json if available
                        if icon_url.is_none() {
                            if let Some(ref ep) = endpoint {
                                let info_url = format!("http://{}/info.json", ep);
                                if let Ok(info_resp) = client.get(&info_url).timeout(std::time::Duration::from_secs(2)).send().await {
                                    if let Ok(info_json) = info_resp.json::<serde_json::Value>().await {
                                        if let Some(icon_str) = info_json.get("icon").and_then(|v| v.as_str()) {
                                            if !icon_str.is_empty() {
                                                let full_b64 = if icon_str.starts_with("data:image") {
                                                    icon_str.to_string()
                                                } else {
                                                    format!("data:image/png;base64,{}", icon_str)
                                                };
                                                icon_url = Some(full_b64);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // 4. Fallback to owner_avatar (FiveM keymaster server avatar)
                        if icon_url.is_none() {
                            if let Some(ref avatar) = d.owner_avatar {
                                if !avatar.trim().is_empty() {
                                    icon_url = Some(avatar.clone());
                                }
                            }
                        }

                        let players = d.players.unwrap_or_default()
                            .into_iter()
                            .map(|p| PlayerInfo {
                                id: p.id.unwrap_or(0),
                                name: p.name.unwrap_or_else(|| "Unknown".to_string()),
                                ping: p.ping.unwrap_or(0),
                            })
                            .collect();

                        let cached = CachedServerData {
                            endpoint,
                            clients: d.clients.unwrap_or(0),
                            max_clients: d.sv_maxclients.unwrap_or(0),
                            hostname: d.hostname.unwrap_or_default(),
                            icon_url,
                            players,
                            resolved_at: Instant::now(),
                        };

                        cache.insert(&clean_code, cached.clone());
                        return Ok(cached);
                    }
                }
            }
            Ok(resp) => {
                last_err = format!("HTTP Status {}", resp.status());
            }
            Err(e) => {
                last_err = format!("{e}");
            }
        }
    }

    Err(format!("CFX API error: {last_err}"))
}

// ─── Internal Fetch Helpers ───────────────────────────────────────────────────

async fn fetch_live_info(
    client: &Client,
    cached: &CachedServerData,
    join_code: String,
) -> ServerInfo {
    // If we have an endpoint IP:PORT, try hitting direct FXServer dynamic.json
    if let Some(ref endpoint) = cached.endpoint {
        let url = format!("http://{}/dynamic.json", endpoint);
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(data) = resp.json::<DynamicJson>().await {
                    return ServerInfo {
                        join_code,
                        clients: data.clients.unwrap_or(cached.clients),
                        max_clients: data.sv_maxclients.unwrap_or(cached.max_clients),
                        hostname: data.hostname.unwrap_or_else(|| cached.hostname.clone()),
                        icon_url: cached.icon_url.clone(),
                        offline: false,
                    };
                }
            }
        }
    }

    // Fallback: If direct dynamic.json failed, but CFX API gave us client info
    ServerInfo {
        join_code,
        clients: cached.clients,
        max_clients: cached.max_clients,
        hostname: cached.hostname.clone(),
        icon_url: cached.icon_url.clone(),
        offline: false, // CFX API responded, so server is reachable via directory
    }
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

/// Fetch live server info (player count) for a single join code.
#[tauri::command]
pub async fn fetch_server_info(
    join_code: String,
    state: tauri::State<'_, EndpointCache>,
) -> Result<ServerInfo, String> {
    let client = build_http_client().map_err(|e| format!("HTTP client error: {e}"))?;

    match resolve_cfx_server(&join_code, &state, &client).await {
        Err(_) => Ok(ServerInfo {
            join_code,
            clients: 0,
            max_clients: 0,
            hostname: String::new(),
            icon_url: None,
            offline: true,
        }),
        Ok(cached) => Ok(fetch_live_info(&client, &cached, join_code).await),
    }
}

/// Fetch player list for a single server.
#[tauri::command]
pub async fn fetch_player_list(
    join_code: String,
    state: tauri::State<'_, EndpointCache>,
) -> Result<Vec<PlayerInfo>, String> {
    let client = build_http_client().map_err(|e| format!("HTTP client error: {e}"))?;

    let cached = resolve_cfx_server(&join_code, &state, &client).await
        .map_err(|e| format!("Tidak bisa resolve server: {e}"))?;

    // Try direct players.json if endpoint is available
    if let Some(ref endpoint) = cached.endpoint {
        let url = format!("http://{}/players.json", endpoint);
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(players) = resp.json::<Vec<PlayersJsonEntry>>().await {
                    return Ok(players.into_iter().map(|p| PlayerInfo {
                        id: p.id.unwrap_or(0),
                        name: p.name.unwrap_or_else(|| "Unknown".to_string()),
                        ping: p.ping.unwrap_or(0),
                    }).collect());
                }
            }
        }
    }

    // Fallback to players list returned in CFX API data
    if !cached.players.is_empty() {
        return Ok(cached.players);
    }

    Err(String::from("Tidak dapat mengambil daftar player (server menonaktifkan endpoint publik)"))
}

/// Fetch server info for multiple servers concurrently.
#[tauri::command]
pub async fn fetch_all_servers_info(
    join_codes: Vec<String>,
    state: tauri::State<'_, EndpointCache>,
) -> Result<Vec<ServerInfo>, String> {
    let client = build_http_client().map_err(|e| format!("HTTP client error: {e}"))?;

    // Phase 1: Resolve all server data via CFX
    let mut resolved: Vec<(String, Option<CachedServerData>)> = Vec::new();
    for code in &join_codes {
        let cached = resolve_cfx_server(code, &state, &client).await.ok();
        resolved.push((code.clone(), cached));
    }

    // Phase 2: Fetch live dynamic info for all concurrently
    let futures: Vec<_> = resolved.into_iter().map(|(code, cached)| {
        let c = client.clone();
        async move {
            match cached {
                None => ServerInfo {
                    join_code: code,
                    clients: 0,
                    max_clients: 0,
                    hostname: String::new(),
                    icon_url: None,
                    offline: true,
                },
                Some(cached_data) => fetch_live_info(&c, &cached_data, code).await,
            }
        }
    }).collect();

    let results = futures::future::join_all(futures).await;
    Ok(results)
}

/// Force-clear the endpoint resolution cache.
#[tauri::command]
pub fn clear_endpoint_cache(state: tauri::State<'_, EndpointCache>) {
    state.clear();
}

/// Check if a local FiveM FXServer is running on 127.0.0.1:30120.
/// Returns Option<ServerInfo> if running, None if offline.
#[tauri::command]
pub async fn check_localhost_server() -> Result<Option<ServerInfo>, String> {
    let client = match Client::builder()
        .timeout(Duration::from_secs(1))
        .build()
    {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    let url = "http://127.0.0.1:30120/dynamic.json";
    if let Ok(resp) = client.get(url).send().await {
        if resp.status().is_success() {
            if let Ok(data) = resp.json::<DynamicJson>().await {
                let hostname = data.hostname.unwrap_or_else(|| "Localhost FXServer".to_string());
                return Ok(Some(ServerInfo {
                    join_code: "127.0.0.1:30120".to_string(),
                    clients: data.clients.unwrap_or(0),
                    max_clients: data.sv_maxclients.unwrap_or(32),
                    hostname,
                    icon_url: None,
                    offline: false,
                }));
            }
        }
    }

    Ok(None)
}
