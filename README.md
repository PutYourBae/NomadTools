# 🗺️ NomadTools

**FiveM Indonesia Cache Manager** — Pindah antar server tanpa download ulang dari nol!

![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)
![Built with](https://img.shields.io/badge/built%20with-Tauri%20%2B%20Rust-orange?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 🔄 **1-Click Cache Swap** | Pindah cache antar server FiveM Indonesia hanya dengan satu klik |
| 🇮🇩 **34+ Server Indonesia** | Semua server FiveM Indonesia populer sudah tersedia bawaan |
| 🟢 **Live Player Count** | Lihat jumlah pemain online secara real-time |
| 👥 **Player List** | Lihat daftar nama, ID, dan ping pemain yang sedang online |
| 🖼️ **Logo Server Resmi** | Logo resmi setiap server ditampilkan otomatis dari direktori FiveM |
| 📌 **Smart Cache Adoption** | Punya cache lama? Langsung hubungkan tanpa download ulang! |
| 📁 **Cache Storage Terpusat** | Semua cache server tersimpan rapi dalam satu folder utama |
| 🔍 **Cari Server & Player** | Filter server dan cari player berdasarkan nama atau ID |
| ⚡ **Portable** | Tidak perlu install — langsung double-click dan jalan! |

---

## 📥 Download

Unduh file **`NomadTools.exe`** dari halaman [**Releases**](../../releases) — langsung double-click, tidak perlu instalasi apapun!

---

## 🛠️ Build dari Source

### Prasyarat
- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) (stable)
- [Tauri CLI v2](https://tauri.app/)

### Langkah Build

```bash
# Clone repo
git clone https://github.com/USERNAME/NomadTools.git
cd NomadTools

# Install dependencies
npm install

# Jalankan development mode
npm run tauri dev

# Build portable executable
cd src-tauri
cargo build --release
# Output: src-tauri/target/release/nomad-tools.exe
```

---

## 🎮 Cara Penggunaan

### Pertama Kali Membuka
1. Double-click `NomadTools.exe`
2. Buka **Pengaturan (⚙️)** → klik **🇮🇩 Muat Preset Server Indonesia**
3. Semua server Indonesia langsung tampil dengan jumlah pemain live!

### Pindah Server (Cache Swap)
1. Klik tombol **▶ Play** pada server yang ingin kamu mainkan
2. Tools otomatis menyimpan cache server lama dan mengaktifkan cache server baru
3. Buka FiveM → langsung connect tanpa download ulang!

### Punya Cache Lama? (Smart Adoption)
Sudah punya cache CR / INDOPRIDE / server lain sebelum pakai NomadTools?  
Klik **⋮** pada card server → **"Hubungkan Cache Aktif Saat Ini"**  
Cache yang ada langsung terhubung — **0 file dihapus, 0 download ulang!**

---

## 📂 Struktur Project

```
NomadTools/
├── src/                    # Frontend (HTML + CSS + JS)
│   ├── index.html
│   ├── styles/             # CSS design system
│   └── scripts/            # JavaScript modules
├── src-tauri/              # Rust backend (Tauri)
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   └── models/         # Data models
│   └── tauri.conf.json
└── package.json
```

---

## 🙏 Kontribusi

Pull request dan issue sangat disambut!  
Jika ada server Indonesia yang belum ada atau join code yang berubah, silakan buka issue atau PR.

---

## 📜 Lisensi

MIT License — bebas digunakan dan dimodifikasi.
