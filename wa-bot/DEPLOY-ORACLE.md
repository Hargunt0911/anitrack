# Panduan Deploy AniTrack + Bot WA Otomatis (07:00 WIB) di Oracle Cloud Free Tier

Subdomain Portal: **`https://anitrack.republikanimasi.my.id`**  
Webhook Bot WA: **`https://anitrack.republikanimasi.my.id/wa-api/send`**  
Status Cek Bot WA: **`https://anitrack.republikanimasi.my.id/wa-api/health`**

---

## 1. Buat VM Ubuntu di Oracle Cloud Always Free
1. Daftar/login di [cloud.oracle.com](https://cloud.oracle.com) (pilih region **Singapore** atau **Tokyo/Osaka**).
2. Klik **Compute → Instances → Create Instance**:
   - **Image**: Ubuntu 22.04 atau 24.04 LTS.
   - **Shape**: `VM.Standard.A1.Flex` *(ARM Always Free, mis. 2 OCPU + 12 GB RAM)* atau `VM.Standard.E2.1.Micro` *(AMD Always Free, 1 OCPU + 1 GB RAM — sudah sangat cukup)*.
   - **SSH Keys**: download *Private Key* (`.key`) agar bisa login SSH.
3. Catat **Public IP Address** VM Anda.

## 2. Buka Port HTTP (80) & HTTPS (443) di Oracle Cloud
1. Di halaman detail Instance → klik nama **Subnet** → klik **Default Security List**.
2. Klik **Add Ingress Rules**, tambahkan 2 rule:
   - Source CIDR: `0.0.0.0/0`, Protocol: `TCP`, Destination Port Range: `80`
   - Source CIDR: `0.0.0.0/0`, Protocol: `TCP`, Destination Port Range: `443`

## 3. Arahkan DNS Subdomain `anitrack.republikanimasi.my.id`
Di dashboard registrar domain `republikanimasi.my.id` (atau Cloudflare), tambahkan 1 **A Record**:
- Type: `A` | Name / Host: `anitrack` | Value / Target: `<PUBLIC_IP_VPS_ORACLE>` | TTL: `Auto / 300`

*(Dengan ini domain utama `republikanimasi.my.id` tetap bebas dipakai untuk website lain jika diperlukan!)*

## 4. Install Node.js, PM2, Nginx, dan Certbot di VPS Ubuntu
Login via SSH (`ssh -i kunci.key ubuntu@<PUBLIC_IP_VPS_ORACLE>`), lalu jalankan:

```bash
# Update sistem & buka firewall Ubuntu (iptables bawaan Oracle)
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx curl git

sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true

# Install Node.js 20 LTS & PM2 (agar bot jalan 24/7 otomatis walau VPS reboot)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 5. Upload File Web AniTrack & Folder `wa-bot`
Di VPS, buat foldernya:
```bash
sudo mkdir -p /var/www/anitrack /opt/anitrack-wa-bot
sudo chown -R $USER:$USER /var/www/anitrack /opt/anitrack-wa-bot
```

Dari komputer Windows Anda (PowerShell di folder `e:\Project\Animasi GRF`), upload file memakai `scp`:
```powershell
# Upload portal web AniTrack
scp -i "kunci.key" Index.html siswa.html pembimbing.html admin.html anitrack-core.js logo-anitrack.png ubuntu@<PUBLIC_IP>:/var/www/anitrack/

# Upload Bot WA
scp -i "kunci.key" -r wa-bot/* ubuntu@<PUBLIC_IP>:/opt/anitrack-wa-bot/
```

## 6. Pasang Nginx & SSL HTTPS Gratis (`https://anitrack.republikanimasi.my.id`)
Kembali ke SSH VPS:
```bash
sudo cp /opt/anitrack-wa-bot/nginx-anitrack.conf /etc/nginx/sites-available/anitrack.republikanimasi.my.id
sudo ln -sf /etc/nginx/sites-available/anitrack.republikanimasi.my.id /etc/nginx/sites-enabled/anitrack.republikanimasi.my.id
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Pasang SSL HTTPS gratis (Let's Encrypt)
sudo certbot --nginx -d anitrack.republikanimasi.my.id
```
Sekarang buka **`https://anitrack.republikanimasi.my.id`** di browser — Portal **AniTrack** sudah online dengan HTTPS!

## 7. Jalankan Bot WA & Scan QR WhatsApp (1x Saja)
```bash
cd /opt/anitrack-wa-bot
cp .env.example .env
nano .env   # Ubah WA_API_SECRET menjadi token rahasia Anda, lalu simpan (Ctrl+O, Enter, Ctrl+X)

npm install
node index.js
```
1. Di terminal akan muncul **QR Code WhatsApp**.
2. Buka WhatsApp di HP khusus sekolah → **Titik 3 → Perangkat Tertaut → Tautkan Perangkat** → Scan QR tersebut.
3. Setelah muncul tulisan **`✅ WhatsApp Bot AniTrack TERHUBUNG!`**, tekan `Ctrl+C`, lalu jalankan permanen 24/7 dengan PM2:
```bash
pm2 start index.js --name anitrack-wa-bot
pm2 save
pm2 startup
```
*(Salin & jalankan perintah `sudo env ...` yang ditampilkan oleh `pm2 startup` agar bot otomatis menyala saat VPS restart.)*

## 8. Cek Status & Hubungkan ke Portal Admin
- Cek status bot di browser: **`https://anitrack.republikanimasi.my.id/wa-api/health`** (pastikan `"whatsappStatus": "open"`).
- **Cron Jam 07:00 WIB sudah langsung berjalan otomatis di VPS Oracle!**
- *(Opsional — supaya tombol 🧪 Tes Kirim WA di Portal Admin juga bisa dipakai)*:
  Di `https://anitrack.republikanimasi.my.id/admin.html` → tab **Drive & Backup** → **Notifikasi WA**:
  - **Provider**: `Custom Webhook URL`
  - **Endpoint URL Gateway**: `https://anitrack.republikanimasi.my.id/wa-api/send`
  - **API Token**: isi sama persis dengan `WA_API_SECRET` di file `.env`
  - **Link Portal AniTrack**: `https://anitrack.republikanimasi.my.id`
  - **Catatan**: Karena jadwal jam 07:00 WIB sudah jalan mandiri di VPS (`node-cron`), **tidak perlu** mencentang jadwal Apps Script agar tidak terkirim dobel (cukup gunakan tombol **🧪 Tes Kirim WA** untuk menguji koneksi).
