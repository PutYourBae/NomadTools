use sysinfo::System;

/// Check if FiveM.exe is currently running on the system.
/// Checks for FiveM.exe and common versioned variants like FiveM_b*.exe
#[tauri::command]
pub fn is_fivem_running() -> bool {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    sys.processes().values().any(|proc| {
        let name = proc.name().to_string_lossy().to_lowercase();
        name.contains("fivem") || name.contains("citizenfx")
    })
}
