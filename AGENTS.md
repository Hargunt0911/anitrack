# AniTrack Workspace Rules

## 1. Auto-Sync dari GitHub di Awal Setiap Sesi
- Pada **awal setiap percakapan/sesi baru** di workspace ini (sebelum membaca banyak file atau melakukan edit apa pun), jalankan sinkronisasi otomatis dari GitHub `origin/main` **satu kali per sesi**:
  1. Jalankan `git fetch --all --prune`.
  2. Cek status lokal (`git status -sb`).
  3. Jika working tree bersih dan branch lokal tertinggal (`behind`), jalankan `git pull --ff-only origin main` lalu sampaikan secara singkat ke pengguna jika ada commit baru yang masuk.
  4. Jika working tree memiliki perubahan lokal yang belum di-commit atau branch diverged (tidak bisa fast-forward), **jangan** lakukan `git reset --hard` atau menimpa perubahan lokal — beri tahu pengguna dan minta konfirmasi terlebih dahulu.
- Jika pengguna hanya mengajukan pertanyaan ringan yang tidak menyentuh kode, tetap sinkronkan cepat jika belum dilakukan di sesi ini.

## 2. Konvensi Git & Lingkungan Windows
- Binary Git di mesin ini berada di `C:\Program Files\Git\cmd\git.exe`.
- Gunakan identitas commit berikut saat melakukan commit:
  - `user.name`: `Hargunt0911`
  - `user.email`: `119555620+Hargunt0911@users.noreply.github.com`
- Branch utama: `main` (`origin/main`).
