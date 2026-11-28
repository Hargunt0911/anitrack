# Panduan Aktivasi Keamanan Penuh AniTrack (1x Setup)

Kode website, APK Android, dan WA Bot sudah disiapkan mendukung **Bcrypt Password Hash + Sesi Token Server + Row Level Security (RLS) penuh** serta **Release Keystore Android**.

---

## Langkah 1 (Wajib) — Aktifkan Pengamanan Database Supabase
1. Buka **Supabase Dashboard** proyek AniTrack (`izgcmhsobexicceqklqm`) → klik menu **SQL Editor** → **New Query**.
2. Buka file `supabase-security-hardening.sql`, salin seluruh isinya, tempel ke SQL Editor, lalu klik **Run**.
3. Begitu sukses:
   - Seluruh password di tabel `profiles` otomatis dienkripsi dengan **Bcrypt** (tidak ada lagi teks biasa).
   - Kolom `pin_or_password` tidak bisa lagi dibaca oleh API publik / *Inspect Element*.
   - Login menggunakan **Sesi Token Server 90 hari (`x-anitrack-session`)** — memalsukan `localStorage` tidak akan berhasil.
   - **Row Level Security (RLS)** aktif di semua tabel: siswa tidak bisa mengubah status tugas/Project Update miliknya sendiri menjadi `Done`/`ACC`, dan tidak bisa membaca `wa_gateway_config`.
   - Portal Orang Tua (`pantau.html`) otomatis memakai fungsi server aman `anitrack_parent_watch(token)`.
   - Pengguna yang sudah login sebelumnya akan diminta **login ulang 1x** untuk menerima token sesi resmi baru.

---

## Langkah 2 (Jika Menjalankan WA Bot di PC Kantor)
Karena RLS sekarang mengunci akses anonim ke database, WA Bot di PC kantor perlu kunci `service_role` Supabase:
1. Buka **Supabase Dashboard** → **Project Settings** → **API** → salin kunci **`service_role` (secret)**.
2. Di PC kantor, buka file `wa-bot/.env` lalu tambahkan 1 baris:
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...kunci_service_role_anda
   ```
3. *(Jangan pernah membagikan atau meng-upload `wa-bot/.env` ke GitHub — file ini sudah otomatis diabaikan oleh `.gitignore`).*

---

## Langkah 3 (Opsional — Untuk Update APK Tanpa Uninstall / Play Store)
Secara bawaan, GitHub Actions membuat **Debug APK**. Jika Bapak ingin APK ke depannya bisa langsung di-**Update** menimpa versi lama (tanpa *Uninstall* dulu) dan siap Play Store:
1. Buat 1 file keystore permanen di PC (sekali seumur hidup) dengan perintah:
   ```powershell
   keytool -genkey -v -keystore anitrack-release.jks -alias anitrack -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Ubah file `anitrack-release.jks` ke Base64:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("anitrack-release.jks")) | Set-Clipboard
   ```
3. Buka GitHub Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, lalu masukkan 4 secret ini:
   - `ANDROID_KEYSTORE_BASE64` *(hasil Base64 dari langkah 2)*
   - `ANDROID_KEYSTORE_PASSWORD` *(password keystore yang Bapak buat)*
   - `ANDROID_KEY_ALIAS` (`anitrack`)
   - `ANDROID_KEY_PASSWORD` *(password key yang Bapak buat)*
4. Jalankan ulang workflow **Build AniTrack Android APK** di tab **Actions** → otomatis menghasilkan **`AniTrack-Android.apk` versi Release bertanda tangan tetap**!
