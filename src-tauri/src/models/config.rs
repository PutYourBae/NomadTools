use serde::{Deserialize, Serialize};

/// Root application config — mirrors the JSON data model from PRD
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub servers: Vec<ServerProfile>,
    pub active_server_id: Option<String>,
    pub fivem_cache_path: String,
    pub settings: Settings,
    pub history: Vec<HistoryEntry>,
}

/// A registered FiveM server profile
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerProfile {
    pub id: String,
    pub name: String,
    pub join_code: String,
    pub cache_path: String,
    pub last_played: Option<String>,
}

/// App-level settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub refresh_interval_seconds: u64,
    pub auto_connect_after_swap: bool,
    #[serde(default = "get_default_global_cache_dir")]
    pub global_cache_dir: String,
}

/// A single entry in swap history log
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub timestamp: String,
    pub from: Option<String>,
    pub to: String,
    pub status: String, // "success" | "failed"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Result of a swap cache operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapResult {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}


/// Detailed cache size & status breakdown for a single server profile
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerCacheSizeInfo {
    pub server_id: String,
    pub server_name: String,
    pub join_code: String,
    pub cache_path: String,
    pub is_active: bool,
    pub exists: bool,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub file_count: usize,
    pub is_valid: bool,
}

/// Comprehensive storage analytics across active FiveM cache & global cache container
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageAnalyticsResult {
    pub total_size_bytes: u64,
    pub total_size_formatted: String,
    pub active_size_bytes: u64,
    pub active_size_formatted: String,
    pub storage_size_bytes: u64,
    pub storage_size_formatted: String,
    pub total_caches_count: usize,
    pub global_cache_dir: String,
    pub fivem_cache_path: String,
    pub servers: Vec<ServerCacheSizeInfo>,
}

/// Live server info from FiveM API including official logo/icon URL
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    pub join_code: String,
    pub clients: u32,
    pub max_clients: u32,
    pub hostname: String,
    pub icon_url: Option<String>,
    pub offline: bool,
}

/// A player entry from players.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerInfo {
    pub id: u32,
    pub name: String,
    pub ping: u32,
}

/// Helper function to create full list of verified active Indonesian FiveM server profiles
pub fn get_default_indonesian_servers(global_cache_dir: &str) -> Vec<ServerProfile> {
    vec![
        ServerProfile {
            id: "ime_rp".to_string(),
            name: "iMe RP".to_string(),
            join_code: "zrvmg4".to_string(),
            cache_path: format!("{}\\iMe RP", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "satu_mimpi".to_string(),
            name: "Satu Mimpi".to_string(),
            join_code: "6gk4e4".to_string(),
            cache_path: format!("{}\\Satu Mimpi", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "indopride_rp".to_string(),
            name: "#INDOPRIDE ROLEPLAY INDONESIA".to_string(),
            join_code: "bak4pl".to_string(),
            cache_path: format!("{}\\INDOPRIDE ROLEPLAY INDONESIA", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "garuda_prime".to_string(),
            name: "Garuda Prime Roleplay Indonesia".to_string(),
            join_code: "vgaqm5".to_string(),
            cache_path: format!("{}\\Garuda Prime Roleplay Indonesia", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "nusa_v".to_string(),
            name: "NUSA V ROLEPLAY INDONESIA".to_string(),
            join_code: "ele3bm".to_string(),
            cache_path: format!("{}\\NUSA V ROLEPLAY INDONESIA", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "cr_rp".to_string(),
            name: "CR ROLEPLAY INDONESIA".to_string(),
            join_code: "kr7k7d".to_string(),
            cache_path: format!("{}\\CR ROLEPLAY INDONESIA", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "kotakita_rp".to_string(),
            name: "KOTAKITA ROLEPLAY INDONESIA".to_string(),
            join_code: "r35px8".to_string(),
            cache_path: format!("{}\\KOTAKITA ROLEPLAY INDONESIA", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "rumah_kita".to_string(),
            name: "Rumah Kita Roleplay Indonesia".to_string(),
            join_code: "bdx4lql".to_string(),
            cache_path: format!("{}\\Rumah Kita Roleplay Indonesia", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "project_zero".to_string(),
            name: "PROJECT ZERO".to_string(),
            join_code: "jygd5m".to_string(),
            cache_path: format!("{}\\PROJECT ZERO", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "teman_main".to_string(),
            name: "TEMAN MAIN ROLEPLAY".to_string(),
            join_code: "rmavmzx".to_string(),
            cache_path: format!("{}\\TEMAN MAIN ROLEPLAY", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "rewind_rp".to_string(),
            name: "REWIND ROLEPLAY".to_string(),
            join_code: "oaxkl8x".to_string(),
            cache_path: format!("{}\\REWIND ROLEPLAY", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "vmachi_rp".to_string(),
            name: "VMachi Roleplay".to_string(),
            join_code: "6my3348".to_string(),
            cache_path: format!("{}\\VMachi Roleplay", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "townshine_rp".to_string(),
            name: "Townshine Roleplay".to_string(),
            join_code: "5oopzmd".to_string(),
            cache_path: format!("{}\\Townshine Roleplay", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "kampoeng_rp".to_string(),
            name: "Kampoeng Roleplay Indonesia".to_string(),
            join_code: "55kd96".to_string(),
            cache_path: format!("{}\\Kampoeng Roleplay Indonesia", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "coffee_shop".to_string(),
            name: "Coffee Shop 45".to_string(),
            join_code: "javo7a".to_string(),
            cache_path: format!("{}\\Coffee Shop 45", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "last_paradise".to_string(),
            name: "LP LAST PARADISE ROLEPLAY INDONESIA".to_string(),
            join_code: "eql83a".to_string(),
            cache_path: format!("{}\\LP LAST PARADISE ROLEPLAY INDONESIA", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "dunia_baru".to_string(),
            name: "DUNIA BARU ROLEPLAY".to_string(),
            join_code: "lervmdv".to_string(),
            cache_path: format!("{}\\DUNIA BARU ROLEPLAY", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "urban_stories".to_string(),
            name: "URBAN STORIES".to_string(),
            join_code: "a4zkp7k".to_string(),
            cache_path: format!("{}\\URBAN STORIES", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "kerta969a".to_string(),
            name: "KERTA969A".to_string(),
            join_code: "vq3m54e".to_string(),
            cache_path: format!("{}\\KERTA969A", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "kota_indah".to_string(),
            name: "KOTA INDAH INDONESIA".to_string(),
            join_code: "o47de7".to_string(),
            cache_path: format!("{}\\KOTA INDAH INDONESIA", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "maple_story".to_string(),
            name: "Maple Story Roleplay Indonesia".to_string(),
            join_code: "rmae5q8".to_string(),
            cache_path: format!("{}\\Maple Story Roleplay Indonesia", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "dreamlife_rp".to_string(),
            name: "DREAMLIFE ROLEPLAY INDONESIA".to_string(),
            join_code: "7b9gz3b".to_string(),
            cache_path: format!("{}\\DREAMLIFE ROLEPLAY INDONESIA", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "morp_dnr".to_string(),
            name: "#MORP DNR ROLEPLAY INDONESIA".to_string(),
            join_code: "yoqgay".to_string(),
            cache_path: format!("{}\\MORP DNR ROLEPLAY INDONESIA", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "fortyfive_rp".to_string(),
            name: "FORTYFIVE ROLEPLAY".to_string(),
            join_code: "5ool4x7".to_string(),
            cache_path: format!("{}\\FORTYFIVE ROLEPLAY", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "kisah_manis".to_string(),
            name: "KISAH MANIS ROLEPLAY INDONESIA".to_string(),
            join_code: "rmaeo37".to_string(),
            cache_path: format!("{}\\KISAH MANIS ROLEPLAY INDONESIA", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "mandara_rp".to_string(),
            name: "MANDARA ROLEPLAY INDONESIA".to_string(),
            join_code: "m4z9xpv".to_string(),
            cache_path: format!("{}\\MANDARA ROLEPLAY INDONESIA", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "jing_arena".to_string(),
            name: "JING".to_string(),
            join_code: "5oovv4r".to_string(),
            cache_path: format!("{}\\JING", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "dunia_kita".to_string(),
            name: "DUNIA KITA".to_string(),
            join_code: "6mypej8".to_string(),
            cache_path: format!("{}\\DUNIA KITA", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "golden_state".to_string(),
            name: "GOLDEN STATE ROLEPLAY".to_string(),
            join_code: "oqmkgr".to_string(),
            cache_path: format!("{}\\GOLDEN STATE ROLEPLAY", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "bintang_rp".to_string(),
            name: "BINTANG ROLEPLAY".to_string(),
            join_code: "lq35k4".to_string(),
            cache_path: format!("{}\\BINTANG ROLEPLAY", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "mercy_rp".to_string(),
            name: "MERCY ROLEPLAY".to_string(),
            join_code: "xj9l5r".to_string(),
            cache_path: format!("{}\\MERCY ROLEPLAY", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "indonesia_freeroam".to_string(),
            name: "INDONESIA FREEROAM".to_string(),
            join_code: "gmx73o".to_string(),
            cache_path: format!("{}\\INDONESIA FREEROAM", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "cemara_rp".to_string(),
            name: "Cemara Roleplay".to_string(),
            join_code: "xllpy65".to_string(),
            cache_path: format!("{}\\Cemara Roleplay", global_cache_dir),
            last_played: None,
        },
        ServerProfile {
            id: "militia_rp".to_string(),
            name: "Militia Roleplay Indonesia".to_string(),
            join_code: "kqmr8zv".to_string(),
            cache_path: format!("{}\\Militia Roleplay Indonesia", global_cache_dir),
            last_played: None,
        },
    ]
}

impl Default for AppConfig {
    fn default() -> Self {
        let fivem_path = get_default_fivem_cache_path();
        let global_cache = get_default_global_cache_dir();
        let default_servers = get_default_indonesian_servers(&global_cache);

        AppConfig {
            servers: default_servers,
            active_server_id: None,
            fivem_cache_path: fivem_path,
            settings: Settings::default(),
            history: Vec::new(),
        }
    }
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            refresh_interval_seconds: 30,
            auto_connect_after_swap: false,
            global_cache_dir: get_default_global_cache_dir(),
        }
    }
}

/// Returns the default FiveM server-cache-priv path on Windows
pub fn get_default_fivem_cache_path() -> String {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        format!(
            "{}\\FiveM\\FiveM.app\\data\\server-cache-priv",
            local_app_data
        )
    } else {
        String::from("C:\\Users\\User\\AppData\\Local\\FiveM\\FiveM.app\\data\\server-cache-priv")
    }
}

/// Returns default global cache directory for storing inactive server caches
pub fn get_default_global_cache_dir() -> String {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        format!("{}\\NomadTools\\ServerCaches", local_app_data)
    } else {
        String::from("C:\\NomadTools\\ServerCaches")
    }
}
