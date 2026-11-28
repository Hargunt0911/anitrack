import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = path.resolve(process.cwd(), '..');
const sourceLogo = path.join(rootDir, 'logo-anitrack.png');
const assetsDir = path.join(process.cwd(), 'assets');

if (!fs.existsSync(sourceLogo)) {
    throw new Error(`Logo tidak ditemukan di: ${sourceLogo}`);
}

fs.mkdirSync(assetsDir, { recursive: true });

// 1. Icon Only (1024x1024, TANPA frame putih — langsung full logo AniTrack transparan)
await sharp(sourceLogo)
    .trim()
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(assetsDir, 'icon-only.png'));

// 1B. Ikon PNG Transparan Murni untuk semua kepadatan layar Android (mdpi..xxxhdpi) — tanpa kotak background sama sekali!
const transparentIconsDir = path.join(assetsDir, 'transparent-icons');
fs.mkdirSync(transparentIconsDir, { recursive: true });
const densities = [
    { name: 'mdpi', size: 48 },
    { name: 'hdpi', size: 72 },
    { name: 'xhdpi', size: 96 },
    { name: 'xxhdpi', size: 144 },
    { name: 'xxxhdpi', size: 192 }
];
for (const d of densities) {
    // Isi penuh 100% kanvas (tanpa padding sisa) agar ukuran visual logo setara ikon aplikasi lain di layar utama HP
    await sharp(sourceLogo)
        .trim({ threshold: 25 })
        .resize(d.size, d.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(path.join(transparentIconsDir, `${d.name}.png`));
}

// 2. Adaptive Icon Foreground (1024x1024, logo 740x740 mengisi penuh area tampak 72% ikon Android tanpa pinggiran putih)
const logoForAdaptive = await sharp(sourceLogo)
    .trim()
    .resize(740, 740, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
    .composite([{ input: logoForAdaptive, gravity: 'center' }])
    .png()
    .toFile(path.join(assetsDir, 'icon-foreground.png'));

// 3. Adaptive Icon Background (1024x1024 warna gelap #141519 menyatu dengan outline logo — nol frame putih!)
await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 20, g: 21, b: 25, alpha: 1 } }
})
    .png()
    .toFile(path.join(assetsDir, 'icon-background.png'));

// 4. Splash Logo Terpusat 1:1 (512x512 transparan, logo 340x340 di safe-zone Android 12+ — lebih tegas & anti-gepeng)
const logoForSplashCenter = await sharp(sourceLogo)
    .trim({ threshold: 25 })
    .resize(340, 340, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
    .composite([{ input: logoForSplashCenter, gravity: 'center' }])
    .png()
    .toFile(path.join(assetsDir, 'splash-logo-center.png'));

// 4B. Ikon Notifikasi Full-Color (192x192 untuk Large Icon di kartu & banner notifikasi Android)
await sharp(sourceLogo)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(assetsDir, 'notif-large-icon.png'));

// 4C. Ikon Status Bar Notifikasi (96x96 monokrom putih + transparansi dari kontras logo AniTrack agar tidak jadi kotak putih polos)
const smallRaw = await sharp(sourceLogo)
    .resize(84, 84, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

const smallPixels = Buffer.alloc(smallRaw.info.width * smallRaw.info.height * 4);
for (let i = 0; i < smallRaw.data.length; i += 4) {
    const r = smallRaw.data[i];
    const g = smallRaw.data[i + 1];
    const b = smallRaw.data[i + 2];
    const a = smallRaw.data[i + 3];
    // Pertahankan outline/detail gelap + merah maskot sebagai putih solid, dan area putih terang jadi semi-transparan agar wajah maskot terbaca di status bar
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const outAlpha = a < 40 ? 0 : (lum > 215 ? Math.round(a * 0.22) : a);
    smallPixels[i] = 255;
    smallPixels[i + 1] = 255;
    smallPixels[i + 2] = 255;
    smallPixels[i + 3] = outAlpha;
}

const smallIconBuf = await sharp(smallPixels, {
    raw: { width: smallRaw.info.width, height: smallRaw.info.height, channels: 4 }
})
    .png()
    .toBuffer();

await sharp({
    create: { width: 96, height: 96, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
    .composite([{ input: smallIconBuf, gravity: 'center' }])
    .png()
    .toFile(path.join(assetsDir, 'notif-small-icon.png'));

// 5. Fallback splash untuk capacitor-assets (nanti diganti XML layer-list 1:1 oleh patch-android.mjs)
const logoForSplash = await sharp(sourceLogo)
    .resize(620, 620, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

await sharp({
    create: { width: 2732, height: 2732, channels: 4, background: { r: 243, g: 246, b: 251, alpha: 1 } }
})
    .composite([{ input: logoForSplash, gravity: 'center' }])
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));

await sharp({
    create: { width: 2732, height: 2732, channels: 4, background: { r: 11, g: 17, b: 32, alpha: 1 } }
})
    .composite([{ input: logoForSplash, gravity: 'center' }])
    .png()
    .toFile(path.join(assetsDir, 'splash-dark.png'));

console.log('OK: Semua aset ikon & splash 1:1 anti-gepeng berhasil dibuat dari logo-anitrack.png');
