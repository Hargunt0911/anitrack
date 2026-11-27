import fs from 'node:fs';
import path from 'node:path';

const resDir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res');
const splashCenterSrc = path.join(process.cwd(), 'assets', 'splash-logo-center.png');

// ==================== 1. FIX SPLASH SCREEN ANTI-GEPENG (ANDROID <12 & ANDROID 12–15) ====================
// Hapus semua splash.png raster hasil generate agar Android tidak pernah melakukan stretch fillXY pada layar 20:9
if (fs.existsSync(resDir)) {
    for (const entry of fs.readdirSync(resDir)) {
        if (entry.startsWith('drawable')) {
            const candidate = path.join(resDir, entry, 'splash.png');
            if (fs.existsSync(candidate)) {
                fs.unlinkSync(candidate);
                console.log('Removed stretched raster splash:', candidate);
            }
        }
    }
}

// Salin logo 512x512 terpusat (rasio 1:1 terkunci) ke drawable-nodpi
const drawableNodpiDir = path.join(resDir, 'drawable-nodpi');
fs.mkdirSync(drawableNodpiDir, { recursive: true });
if (fs.existsSync(splashCenterSrc)) {
    fs.copyFileSync(splashCenterSrc, path.join(drawableNodpiDir, 'anitrack_splash_logo.png'));
}

// Warna background splash (Light & Night)
const valuesDir = path.join(resDir, 'values');
const valuesNightDir = path.join(resDir, 'values-night');
const valuesV31Dir = path.join(resDir, 'values-v31');
const drawableDir = path.join(resDir, 'drawable');

fs.mkdirSync(valuesDir, { recursive: true });
fs.mkdirSync(valuesNightDir, { recursive: true });
fs.mkdirSync(valuesV31Dir, { recursive: true });
fs.mkdirSync(drawableDir, { recursive: true });

fs.writeFileSync(
    path.join(valuesDir, 'anitrack_colors.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="anitrack_splash_bg">#F3F6FB</color>
</resources>
`,
    'utf8'
);

fs.writeFileSync(
    path.join(valuesNightDir, 'anitrack_colors.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="anitrack_splash_bg">#0B1120</color>
</resources>
`,
    'utf8'
);

// Layer-list XML 1:1 (220dp x 220dp center) — tidak mungkin gepeng di rasio layar apa pun!
fs.writeFileSync(
    path.join(drawableDir, 'splash.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/anitrack_splash_bg" />
    <item android:width="220dp" android:height="220dp" android:gravity="center">
        <bitmap
            android:gravity="fill"
            android:src="@drawable/anitrack_splash_logo" />
    </item>
</layer-list>
`,
    'utf8'
);

// Patch values/styles.xml: matikan forceDarkAllowed Android agar tidak bentrok dengan tombol Dark/Light web!
const stylesPath = path.join(valuesDir, 'styles.xml');
fs.writeFileSync(
    stylesPath,
    `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:forceDarkAllowed" tools:targetApi="q">false</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowBackground">@color/anitrack_splash_bg</item>
        <item name="android:forceDarkAllowed" tools:targetApi="q">false</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
`,
    'utf8'
);

// Android 12+ (API 31+) SplashScreen API: gunakan ikon 1:1 terpusat agar tidak gepeng & tidak dobel
fs.writeFileSync(
    path.join(valuesV31Dir, 'styles.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@null</item>
        <item name="windowSplashScreenBackground">@color/anitrack_splash_bg</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/anitrack_splash_logo</item>
        <item name="android:windowSplashScreenBackground">@color/anitrack_splash_bg</item>
        <item name="android:windowSplashScreenAnimatedIcon">@drawable/anitrack_splash_logo</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
`,
    'utf8'
);
console.log('OK: Splash XML 1:1 & Android 12+ styles.xml terpasang (anti-gepeng & anti force-dark)');

// ==================== 2. PATCH MainActivity.java ====================
// - Matikan Android WebView Force Dark / Algorithmic Darkening (agar tombol Dark/Light web 100% berkuasa)
// - Aktifkan fitsSystemWindows agar status bar tidak menutupi tombol atas
// - Sinkronkan warna Status Bar & Nav Bar Android saat user klik tombol Dark/Light (window.AniTrackNative.setTheme)
// - Navigasi Back HP kembali ke halaman WebView sebelumnya
const mainActivityPath = path.join(
    process.cwd(),
    'android',
    'app',
    'src',
    'main',
    'java',
    'id',
    'sch',
    'smkn4malang',
    'anitrack',
    'MainActivity.java'
);

if (fs.existsSync(mainActivityPath)) {
    const customMainActivity = `package id.sch.smkn4malang.anitrack;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, true);
        applyNativeSystemBars(false);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                settings.setAlgorithmicDarkeningAllowed(false);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                settings.setForceDark(WebSettings.FORCE_DARK_OFF);
            }
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void setTheme(final boolean isDark) {
                    runOnUiThread(() -> applyNativeSystemBars(isDark));
                }
            }, "AniTrackNative");
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv != null && wv.canGoBack()) {
                    wv.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }

    private void applyNativeSystemBars(boolean isDark) {
        Window window = getWindow();
        int barColor = isDark ? Color.parseColor("#111827") : Color.parseColor("#FFFFFF");
        window.setStatusBarColor(barColor);
        window.setNavigationBarColor(barColor);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(!isDark);
            controller.setAppearanceLightNavigationBars(!isDark);
        }
    }
}
`;
    fs.writeFileSync(mainActivityPath, customMainActivity, 'utf8');
    console.log('OK: MainActivity.java patched (WebView anti-force-dark + native status bar theme + Back button)');
} else {
    console.warn('WARN: MainActivity.java tidak ditemukan di', mainActivityPath);
}
