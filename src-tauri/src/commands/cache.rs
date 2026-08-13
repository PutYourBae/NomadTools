use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use chrono::Utc;
use serde::Serialize;
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
/// Hide the console/CMD window on Windows.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

use crate::models::config::{AppConfig, HistoryEntry, ServerCacheSizeInfo, ServerProfile, StorageAnalyticsResult, SwapResult};
use crate::commands::config::save_config_to_path;

// ─── Progress Event ───────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
struct SwapProgress {
    percent: u8,
    label: String,
}

fn emit_progress(app: &tauri::AppHandle, percent: u8, label: &str) {
    let _ = app.emit("swap-progress", SwapProgress {
        percent,
        label: label.to_string(),
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Sanitize server name into a safe subfolder name (e.g. "CR 2.0" -> "CR 2.0")
pub fn sanitize_folder_name(name: &str) -> String {
    let clean: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' || c == '.' { c } else { '_' })
        .collect();
    let trimmed = clean.trim();
    if trimmed.is_empty() {
        "ServerCache".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Helper: Resolve the effective storage path for a profile's cache.
/// Guaranteed to be a subfolder inside a container directory (e.g. D:\CacheFiveM\PROJECT ZERO)
pub fn get_effective_cache_path(profile: &ServerProfile, config: &AppConfig) -> PathBuf {
    let raw = profile.cache_path.trim();
    let global_dir = config.settings.global_cache_dir.trim();
    let folder_name = sanitize_folder_name(&profile.name);

    if raw.is_empty() {
        return PathBuf::from(global_dir).join(&folder_name);
    }

    let raw_buf = PathBuf::from(raw);

    if !global_dir.is_empty() && (raw.eq_ignore_ascii_case(global_dir) || raw_buf.file_name().map_or(true, |f| f.to_string_lossy().eq_ignore_ascii_case(&global_dir))) {
        return raw_buf.join(&folder_name);
    }

    if raw_buf.file_name().map_or(false, |f| f.to_string_lossy().eq_ignore_ascii_case(&folder_name)) {
        raw_buf
    } else {
        if raw_buf.parent().is_none() || raw_buf.to_string_lossy().len() <= 3 {
            raw_buf.join("CacheFiveM").join(&folder_name)
        } else {
            raw_buf.join(&folder_name)
        }
    }
}

/// Count files in a directory recursively (used by get_storage_analytics)
fn count_files_recursive(dir: &Path) -> usize {
    let mut count = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                count += 1;
            } else if p.is_dir() {
                count += count_files_recursive(&p);
            }
        }
    }
    count
}

/// Explicitly adopt current active FiveM cache folder as belonging to target server profile
#[tauri::command]
pub fn adopt_active_cache(
    app_handle: tauri::AppHandle,
    profile_id: String,
    mut config: AppConfig,
) -> Result<AppConfig, String> {
    let target_profile = config.servers.iter().find(|s| s.id == profile_id)
        .ok_or_else(|| format!("Server ID '{profile_id}' tidak ditemukan."))?.clone();

    let target_cache_dest = get_effective_cache_path(&target_profile, &config);

    // Update target profile path
    if let Some(p) = config.servers.iter_mut().find(|s| s.id == profile_id) {
        p.cache_path = target_cache_dest.to_string_lossy().to_string();
        p.last_played = Some(Utc::now().to_rfc3339());
    }

    config.active_server_id = Some(profile_id.clone());

    log_history(
        &app_handle,
        &mut config,
        "unassigned",
        &profile_id,
        "success",
        None,
    );

    let config_path = crate::commands::config::get_config_path(&app_handle);
    save_config_to_path(&config_path, &config)?;

    Ok(config)
}

// ─── NTFS Junction Helpers ───────────────────────────────────────────────────

/// Check if a path is a directory junction or symlink (reparse point).
fn is_junction_or_symlink(path: &Path) -> bool {
    if !path.exists() {
        // Check with metadata that follows symlinks=false
        if let Ok(meta) = std::fs::symlink_metadata(path) {
            return meta.file_type().is_symlink();
        }
        return false;
    }
    if let Ok(meta) = std::fs::symlink_metadata(path) {
        if meta.file_type().is_symlink() {
            return true;
        }
        // On Windows, NTFS junctions have the reparse point attribute
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
            if meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
                return true;
            }
        }
    }
    false
}

/// Remove a junction point or symlink WITHOUT deleting the target contents.
/// On Windows: `rmdir` on a junction removes only the link, not the data.
fn remove_junction_point(path: &Path) -> std::io::Result<()> {
    let path_str = path.to_string_lossy().to_string();
    let mut cmd = Command::new("cmd");
    cmd.args(["/C", "rmdir", &path_str]);
    #[cfg(windows)] { cmd.creation_flags(CREATE_NO_WINDOW); }
    let status = cmd.status()?;
    if status.success() {
        Ok(())
    } else {
        // Fallback: fs::remove_dir only works on empty or junction dirs
        std::fs::remove_dir(path)
    }
}

/// Create an NTFS Directory Junction at `link` pointing to `target`.
/// This is instant (1ms) regardless of cache size or drive letter.
fn create_junction_point(link: &Path, target: &Path) -> std::io::Result<()> {
    let link_str = format!("\"{}\"", link.to_string_lossy());
    let target_str = format!("\"{}\"", target.to_string_lossy());
    let cmd_str = format!("mklink /J {} {}", link_str, target_str);
    let mut cmd = Command::new("cmd");
    cmd.args(["/C", &cmd_str]);
    #[cfg(windows)] { cmd.creation_flags(CREATE_NO_WINDOW); }
    let status = cmd.status()?;
    if status.success() {
        Ok(())
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("mklink /J failed: {} -> {}", link.display(), target.display()),
        ))
    }
}

// ─── Swap Cache ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn swap_cache(
    app_handle: tauri::AppHandle,
    profile_id: String,
    config: AppConfig,
) -> SwapResult {
    tokio::task::spawn_blocking(move || {
        swap_cache_internal(app_handle, profile_id, config)
    })
    .await
    .unwrap_or_else(|e| SwapResult {
        success: false,
        message: format!("Task error: {e}"),
        error: Some(format!("{e}")),
    })
}

pub fn swap_cache_internal(
    app_handle: tauri::AppHandle,
    profile_id: String,
    mut config: AppConfig,
) -> SwapResult {
    emit_progress(&app_handle, 5, "Mencari profil server...");

    let target_profile = match config.servers.iter().find(|s| s.id == profile_id) {
        Some(p) => p.clone(),
        None => {
            return SwapResult {
                success: false,
                message: "Profile tidak ditemukan.".to_string(),
                error: Some(format!("ID '{}' tidak ada di config.", profile_id)),
            };
        }
    };

    let official_path = PathBuf::from(&config.fivem_cache_path);
    let target_cache_dest = get_effective_cache_path(&target_profile, &config);
    let old_profile_id = config.active_server_id.clone();

    if let Some(ref old_id) = old_profile_id {
        if old_id == &profile_id && (official_path.exists() || is_junction_or_symlink(&official_path)) {
            return SwapResult {
                success: false,
                message: format!("'{}' sudah aktif.", target_profile.name),
                error: None,
            };
        }
    }

    emit_progress(&app_handle, 20, "Menyiapkan folder penyimpanan...");

    // Ensure target storage directory exists
    if !target_cache_dest.exists() {
        if let Err(e) = fs::create_dir_all(&target_cache_dest) {
            return SwapResult {
                success: false,
                message: format!("Gagal membuat folder storage server: {e}"),
                error: Some(format!("{e}")),
            };
        }
    }

    emit_progress(&app_handle, 40, "Melepas cache lama...");

    // Handle existing official_path (FiveM cache directory)
    if official_path.exists() || is_junction_or_symlink(&official_path) {
        if is_junction_or_symlink(&official_path) {
            // Unlink junction (0.0001s instant)
            let _ = remove_junction_point(&official_path);
        } else if let Some(ref old_id) = old_profile_id {
            emit_progress(&app_handle, 55, "Memindahkan cache lama ke storage...");
            if let Some(old_profile) = config.servers.iter().find(|s| &s.id == old_id).cloned() {
                let old_cache_dest = get_effective_cache_path(&old_profile, &config);
                let _ = move_folder_cross_drive(&official_path, &old_cache_dest);
            }
        }
    }

    emit_progress(&app_handle, 70, "Menghubungkan cache baru...");

    // Ensure parent directory of official_path exists
    if let Some(parent) = official_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // Create Instant NTFS Junction (0.001s instant)
    if let Err(_e) = create_junction_point(&official_path, &target_cache_dest) {
        // Fallback to fast move if junction creation is not supported
        emit_progress(&app_handle, 75, "Menyalin file cache (fallback)...");
        if let Err(e2) = move_folder_cross_drive(&target_cache_dest, &official_path) {
            let msg = format!("Gagal menghubungkan cache '{}': {}", target_profile.name, e2);
            log_history(&app_handle, &mut config, old_profile_id.as_deref().unwrap_or("none"), &profile_id, "failed", Some(&msg));
            return SwapResult {
                success: false,
                message: msg.clone(),
                error: Some(msg),
            };
        }
    }

    emit_progress(&app_handle, 88, "Menyimpan konfigurasi...");

    // Update active profile
    if let Some(p) = config.servers.iter_mut().find(|s| s.id == profile_id) {
        p.cache_path = target_cache_dest.to_string_lossy().to_string();
        p.last_played = Some(Utc::now().to_rfc3339());
    }
    config.active_server_id = Some(profile_id.clone());

    log_history(
        &app_handle,
        &mut config,
        old_profile_id.as_deref().unwrap_or("none"),
        &profile_id,
        "success",
        None,
    );

    let config_path = crate::commands::config::get_config_path(&app_handle);
    let _ = save_config_to_path(&config_path, &config);

    emit_progress(&app_handle, 100, "Selesai!");

    SwapResult {
        success: true,
        message: format!("Berhasil secara instant (1ms) berpindah ke '{}'!", target_profile.name),
        error: None,
    }
}

// ─── Storage Analytics & Management ──────────────────────────────────────────

/// Format byte count into human-readable string (e.g. "1.45 GB", "320 MB", "45 KB")
pub fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = 1024 * KB;
    const GB: u64 = 1024 * MB;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.0} KB", bytes as f64 / KB as f64)
    } else if bytes > 0 {
        format!("{} B", bytes)
    } else {
        "0 B".to_string()
    }
}

/// Calculate total size in bytes of a folder recursively
fn dir_size_recursive(dir: &Path) -> u64 {
    let mut total = 0;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Ok(metadata) = p.metadata() {
                    total += metadata.len();
                }
            } else if p.is_dir() {
                total += dir_size_recursive(&p);
            }
        }
    }
    total
}

/// Calculate storage analytics across active FiveM cache & global cache storage container
#[tauri::command]
pub fn get_storage_analytics(config: AppConfig) -> StorageAnalyticsResult {
    let fivem_path = PathBuf::from(&config.fivem_cache_path);
    let active_id = config.active_server_id.clone();
    let global_dir_str = config.settings.global_cache_dir.clone();

    let mut server_infos = Vec::new();
    let mut total_size: u64 = 0;
    let mut active_size: u64 = 0;
    let mut storage_size: u64 = 0;
    let mut total_caches_count = 0;

    for server in &config.servers {
        let is_active = active_id.as_deref() == Some(&server.id);

        let target_path = if is_active {
            fivem_path.clone()
        } else {
            get_effective_cache_path(server, &config)
        };

        let exists = target_path.exists() && target_path.is_dir();
        let (size_bytes, file_count) = if exists {
            let s = dir_size_recursive(&target_path);
            let fc = count_files_recursive(&target_path);
            (s, fc)
        } else {
            (0, 0)
        };

        if exists && file_count > 0 {
            total_caches_count += 1;
            total_size += size_bytes;
            if is_active {
                active_size += size_bytes;
            } else {
                storage_size += size_bytes;
            }
        }

        let is_valid = exists && file_count >= 5;

        server_infos.push(ServerCacheSizeInfo {
            server_id: server.id.clone(),
            server_name: server.name.clone(),
            join_code: server.join_code.clone(),
            cache_path: target_path.to_string_lossy().to_string(),
            is_active,
            exists,
            size_bytes,
            size_formatted: format_bytes(size_bytes),
            file_count,
            is_valid,
        });
    }

    StorageAnalyticsResult {
        total_size_bytes: total_size,
        total_size_formatted: format_bytes(total_size),
        active_size_bytes: active_size,
        active_size_formatted: format_bytes(active_size),
        storage_size_bytes: storage_size,
        storage_size_formatted: format_bytes(storage_size),
        total_caches_count,
        global_cache_dir: global_dir_str,
        fivem_cache_path: config.fivem_cache_path,
        servers: server_infos,
    }
}

/// Open target folder in Windows File Explorer
#[tauri::command]
pub fn open_folder_in_explorer(folder_path: String) -> Result<(), String> {
    let path = PathBuf::from(&folder_path);
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }

    let mut cmd = Command::new("explorer");
    cmd.arg(&folder_path);
    // Explorer is a GUI app and doesn't need CREATE_NO_WINDOW, but suppress any flash
    #[cfg(windows)] { cmd.creation_flags(CREATE_NO_WINDOW); }
    cmd.spawn().map_err(|e| format!("Gagal membuka Windows Explorer: {e}"))?;

    Ok(())
}

/// Delete stored cache folder for a server
#[tauri::command]
pub fn delete_server_cache_folder(cache_path: String) -> Result<(), String> {
    let path = PathBuf::from(&cache_path);
    if path.exists() && path.is_dir() {
        fs::remove_dir_all(&path)
            .map_err(|e| format!("Gagal menghapus folder cache: {e}"))?;
    }
    Ok(())
}

// ─── Cross-Drive Folder Move ─────────────────────────────────────────────────

pub fn move_folder_cross_drive(src: &Path, dest: &Path) -> std::io::Result<()> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }

    if dest.exists() {
        if dest.is_dir() {
            let _ = fs::remove_dir_all(dest);
        } else {
            let _ = fs::remove_file(dest);
        }
    }

    // 1. Try instant OS rename (0.001s if on same drive)
    if fs::rename(src, dest).is_ok() {
        return Ok(());
    }

    // 2. High-speed multi-threaded Windows robocopy for cross-drive transfer (MT:16)
    if cfg!(target_os = "windows") {
        let mut rcmd = Command::new("robocopy");
        rcmd.arg(src)
            .arg(dest)
            .args(&["/MOVE", "/E", "/MT:16", "/NJH", "/NJS", "/NC", "/NS", "/NP", "/R:1", "/W:1"]);
        #[cfg(windows)] { rcmd.creation_flags(CREATE_NO_WINDOW); }
        let status = rcmd.status();

        if let Ok(st) = status {
            if st.code().unwrap_or(8) <= 7 {
                if src.exists() {
                    let _ = fs::remove_dir_all(src);
                }
                return Ok(());
            }
        }
    }

    // 3. Fallback to recursive copy
    copy_dir_recursive(src, dest)?;
    let _ = fs::remove_dir_all(src);
    Ok(())
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dest)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)?;
        }
    }

    Ok(())
}

// ─── History Logging ─────────────────────────────────────────────────────────

fn log_history(
    app_handle: &tauri::AppHandle,
    config: &mut AppConfig,
    from: &str,
    to: &str,
    status: &str,
    error: Option<&str>,
) {
    let entry = HistoryEntry {
        timestamp: Utc::now().to_rfc3339(),
        from: if from == "none" { None } else { Some(from.to_string()) },
        to: to.to_string(),
        status: status.to_string(),
        error: error.map(String::from),
    };
    config.history.push(entry);

    if config.history.len() > 200 {
        let overflow = config.history.len() - 200;
        config.history.drain(0..overflow);
    }

    let config_path = crate::commands::config::get_config_path(app_handle);
    let _ = save_config_to_path(&config_path, config);
}
