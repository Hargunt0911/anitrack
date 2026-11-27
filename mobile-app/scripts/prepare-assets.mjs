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

// 1. Icon Only (1024x1024, latar putih bersih dengan logo proporsional)
const logoForIcon = await sharp(sourceLogo)
    .resize(820, 820, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
})
    .composite([{ input: logoForIcon, gravity: 'center' }])
    .png()
    .toFile(path.join(assetsDir, 'icon-only.png'));

// 2. Adaptive Icon Foreground (1024x1024, logo di safe-zone 66% agar tidak terpotong ikon bulat Android)
const logoForAdaptive = await sharp(sourceLogo)
    .resize(670, 670, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
    .composite([{ input: logoForAdaptive, gravity: 'center' }])
    .png()
    .toFile(path.join(assetsDir, 'icon-foreground.png'));

// 3. Adaptive Icon Background (1024x1024 solid putih)
await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
})
    .png()
    .toFile(path.join(assetsDir, 'icon-background.png'));

// 4. Splash Screen Light & Dark (2732x2732)
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

console.log('OK: Semua aset ikon & splash Android berhasil dibuat dari logo-anitrack.png');
