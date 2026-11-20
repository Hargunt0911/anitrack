# AniTrack — SMKN 4 Malang Animasi

Portal LMS, Monitoring Daily Task, Project Tracker, Plotting Pembimbing, dan Notifikasi WhatsApp Otomatis untuk Jurusan Animasi **SMKN 4 Malang**.

🌐 **Live Portal:** `https://anitrack.republikanimasi.my.id`

## Portal
- `index.html` — Halaman Login (otomatis mengarahkan ke portal sesuai peran)
- `siswa.html` — Portal Siswa (Daily Task Gate, Kelas & Course Player, Project Tracker, Akun)
- `pembimbing.html` — Portal Guru Pembimbing (Dashboard, Kelola Materi Ajar, Monitoring Daily Task, Project Tracker, Drive & Backup `.xlsx`)
- `admin.html` — Portal Superadmin (Kelola Guru Pembimbing, Plotting Lintas Kelas + Import/Export `.xlsx`, Notifikasi WA Otomatis Jam 07:00 WIB)

## Pengaturan Domain GitHub Pages (`anitrack.republikanimasi.my.id`)
1. Pastikan **Settings → Pages** mengarah ke branch `main` folder `/ (root)`.
2. Tambahkan **CNAME Record** di DNS domain `republikanimasi.my.id`:
   - Type: `CNAME`
   - Name / Host: `anitrack`
   - Target / Value: `hargunt0911.github.io`
3. Centang **Enforce HTTPS** di **Settings → Pages**.
