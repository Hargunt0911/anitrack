import fs from 'node:fs';
import path from 'node:path';

const androidAppDir = path.join(process.cwd(), 'android', 'app');
const resDir = path.join(androidAppDir, 'src', 'main', 'res');
const manifestPath = path.join(androidAppDir, 'src', 'main', 'AndroidManifest.xml');
const buildGradlePath = path.join(androidAppDir, 'build.gradle');
const javaPkgDir = path.join(androidAppDir, 'src', 'main', 'java', 'id', 'sch', 'smkn4malang', 'anitrack');
const splashCenterSrc = path.join(process.cwd(), 'assets', 'splash-logo-center.png');

// ==================== 1. FIX SPLASH SCREEN ANTI-GEPENG (ANDROID <12 & ANDROID 12–15) ====================
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

const drawableNodpiDir = path.join(resDir, 'drawable-nodpi');
fs.mkdirSync(drawableNodpiDir, { recursive: true });
if (fs.existsSync(splashCenterSrc)) {
    fs.copyFileSync(splashCenterSrc, path.join(drawableNodpiDir, 'anitrack_splash_logo.png'));
}

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

fs.writeFileSync(
    path.join(valuesDir, 'styles.xml'),
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
console.log('OK: Splash XML 1:1 & Android 12+ styles.xml terpasang');

// ==================== 2. PATCH AndroidManifest.xml (IZIN POST_NOTIFICATIONS) ====================
if (fs.existsSync(manifestPath)) {
    let manifest = fs.readFileSync(manifestPath, 'utf8');
    if (!manifest.includes('android.permission.POST_NOTIFICATIONS')) {
        manifest = manifest.replace(
            '<application',
            '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n\n    <application'
        );
        fs.writeFileSync(manifestPath, manifest, 'utf8');
        console.log('OK: POST_NOTIFICATIONS ditambahkan ke AndroidManifest.xml');
    }
}

// ==================== 3. PATCH android/app/build.gradle (WorkManager) ====================
if (fs.existsSync(buildGradlePath)) {
    let gradle = fs.readFileSync(buildGradlePath, 'utf8');
    if (!gradle.includes('androidx.work:work-runtime')) {
        gradle = gradle.replace(
            'dependencies {',
            'dependencies {\n    implementation "androidx.work:work-runtime:2.9.0"'
        );
        fs.writeFileSync(buildGradlePath, gradle, 'utf8');
        console.log('OK: androidx.work:work-runtime:2.9.0 ditambahkan ke build.gradle');
    }
}

// ==================== 4. CREATE AniTrackNotifWorker.java (CEK PERUBAHAN OTOMATIS DI BACKGROUND) ====================
fs.mkdirSync(javaPkgDir, { recursive: true });
const workerJava = `package id.sch.smkn4malang.anitrack;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

public class AniTrackNotifWorker extends Worker {
    public static final String PREFS_NAME = "anitrack_app_prefs";
    public static final String CHANNEL_ID = "anitrack_updates";
    private static final String SUPABASE_URL = "https://izgcmhsobexicceqklqm.supabase.co";
    private static final String SUPABASE_KEY = "sb_publishable_T9eODcUv7nRBYgN-F24aRg_w-QOzKVu";

    public AniTrackNotifWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    public static void ensureNotificationChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID,
                "Notifikasi AniTrack",
                NotificationManager.IMPORTANCE_HIGH
            );
            ch.setDescription("Notifikasi pengumuman, revisi Project Update, dan setoran tugas AniTrack SMKN 4 Malang.");
            ch.enableVibration(true);
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    public static void showLocalNotification(Context ctx, int notifId, String title, String body) {
        try {
            ensureNotificationChannel(ctx);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    return;
                }
            }
            Intent intent = new Intent(ctx, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pi = PendingIntent.getActivity(ctx, notifId, intent, flags);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title != null && !title.isEmpty() ? title : "AniTrack SMKN 4 Malang")
                .setContentText(body != null ? body : "")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pi);

            NotificationManagerCompat.from(ctx).notify(notifId, builder.build());
        } catch (Exception ignored) {
        }
    }

    private String fetchJson(String restPath) throws Exception {
        URL url = new URL(SUPABASE_URL + "/rest/v1/" + restPath);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);
        conn.setRequestProperty("apikey", SUPABASE_KEY);
        conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
        conn.setRequestProperty("Accept", "application/json");
        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            conn.disconnect();
            return null;
        }
        BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line);
        br.close();
        conn.disconnect();
        return sb.toString();
    }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String userId = prefs.getString("user_id", "");
        String role = prefs.getString("user_role", "");
        boolean isAdmin = prefs.getBoolean("is_admin", false);
        if (userId == null || userId.isEmpty()) {
            return Result.success();
        }

        try {
            // 1. Cek Pengumuman Global terbaru (semua role)
            String annRaw = fetchJson("app_settings?select=value,updated_at&key=eq.global_announcement&limit=1");
            if (annRaw != null) {
                JSONArray arr = new JSONArray(annRaw);
                if (arr.length() > 0) {
                    JSONObject row = arr.getJSONObject(0);
                    String upd = row.optString("updated_at", "");
                    String prevAnn = prefs.getString("last_ann_ts", "");
                    if (!upd.isEmpty() && !upd.equals(prevAnn)) {
                        prefs.edit().putString("last_ann_ts", upd).apply();
                        if (!prevAnn.isEmpty()) {
                            String valStr = row.optString("value", "");
                            String msgText = valStr;
                            try {
                                JSONObject parsed = new JSONObject(valStr);
                                if (!parsed.optBoolean("active", true)) msgText = "";
                                else msgText = parsed.optString("message", parsed.optString("text", ""));
                            } catch (Exception ignored) {
                            }
                            if (msgText != null && !msgText.trim().isEmpty()) {
                                showLocalNotification(ctx, 2001, "📢 Pengumuman Baru — AniTrack", msgText.trim());
                            }
                        }
                    }
                }
            }

            if ("student".equals(role)) {
                // 2A. Khusus Siswa: Cek perubahan Project Update & Catatan Revisi per tahapan
                String ckKey = URLEncoder.encode("proj_checklist_row::" + userId, "UTF-8");
                String ckRaw = fetchJson("app_settings?select=value,updated_at&key=eq." + ckKey + "&limit=1");
                if (ckRaw != null) {
                    JSONArray arr = new JSONArray(ckRaw);
                    if (arr.length() > 0) {
                        JSONObject row = arr.getJSONObject(0);
                        String upd = row.optString("updated_at", "");
                        String prevCk = prefs.getString("last_ck_ts", "");
                        if (!upd.isEmpty() && !upd.equals(prevCk)) {
                            prefs.edit().putString("last_ck_ts", upd).apply();
                            if (!prevCk.isEmpty()) {
                                String title = "📊 Project Update Diperbarui";
                                String body = "Status tahapan produksi kamu baru saja diperbarui oleh Guru PJ.";
                                try {
                                    JSONObject val = new JSONObject(row.optString("value", "{}"));
                                    JSONObject items = val.optJSONObject("items");
                                    JSONObject itemNotes = val.optJSONObject("item_notes");
                                    String revStage = "";
                                    String revDetail = "";
                                    if (items != null) {
                                        Iterator<String> keys = items.keys();
                                        while (keys.hasNext()) {
                                            String k = keys.next();
                                            if ("revisi".equalsIgnoreCase(items.optString(k, ""))) {
                                                revStage = k;
                                                if (itemNotes != null && itemNotes.has(k)) {
                                                    revDetail = itemNotes.optString(k, "").trim();
                                                }
                                                break;
                                            }
                                        }
                                    }
                                    if (!revStage.isEmpty()) {
                                        title = "🔴 Revisi Project Update: " + revStage;
                                        body = !revDetail.isEmpty() ? revDetail : ("Tahapan " + revStage + " memerlukan revisi. Cek detail di AniTrack.");
                                    } else if (!val.optString("notes", "").trim().isEmpty()) {
                                        body = val.optString("notes", "").trim();
                                    }
                                } catch (Exception ignored) {
                                }
                                showLocalNotification(ctx, 2002, title, body);
                            }
                        }
                    }
                }

                // 2B. Khusus Siswa: Cek perubahan status / feedback Project Tracker
                String subRaw = fetchJson("project_submissions?select=id,status,mentor_feedback,updated_at&student_id=eq." + URLEncoder.encode(userId, "UTF-8") + "&order=updated_at.desc&limit=1");
                if (subRaw != null) {
                    JSONArray arr = new JSONArray(subRaw);
                    if (arr.length() > 0) {
                        JSONObject row = arr.getJSONObject(0);
                        String upd = row.optString("updated_at", "");
                        String prevSub = prefs.getString("last_stu_sub_ts", "");
                        if (!upd.isEmpty() && !upd.equals(prevSub)) {
                            prefs.edit().putString("last_stu_sub_ts", upd).apply();
                            if (!prevSub.isEmpty()) {
                                String st = row.optString("status", "");
                                String fb = row.optString("mentor_feedback", "").trim();
                                if ("revisi".equals(st)) {
                                    showLocalNotification(ctx, 2003, "🔴 Tugas Project Perlu Revisi", !fb.isEmpty() ? fb : "Guru pembimbing memberikan catatan revisi baru.");
                                } else if ("selesai".equals(st)) {
                                    showLocalNotification(ctx, 2003, "✅ Tugas Project Di-ACC!", !fb.isEmpty() ? fb : "Selamat, tugas project kamu sudah dinyatakan tuntas.");
                                }
                            }
                        }
                    }
                }
            } else {
                // 3. Khusus Pembimbing & Admin: Cek siswa yang baru setor tugas (menunggu_review)
                Set<String> allowedStudentIds = null;
                if (!isAdmin) {
                    allowedStudentIds = new HashSet<>();
                    String stuRaw = fetchJson("profiles?select=id&role=eq.student&mentor_id=eq." + URLEncoder.encode(userId, "UTF-8"));
                    if (stuRaw != null) {
                        JSONArray sArr = new JSONArray(stuRaw);
                        for (int i = 0; i < sArr.length(); i++) {
                            allowedStudentIds.add(sArr.getJSONObject(i).optString("id", ""));
                        }
                    }
                }
                String revRaw = fetchJson("project_submissions?select=id,student_id,updated_at&status=eq.menunggu_review&order=updated_at.desc&limit=25");
                if (revRaw != null) {
                    JSONArray arr = new JSONArray(revRaw);
                    int pendingCnt = 0;
                    String newestUpd = "";
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject row = arr.getJSONObject(i);
                        String sid = row.optString("student_id", "");
                        if (allowedStudentIds != null && !allowedStudentIds.contains(sid)) continue;
                        pendingCnt++;
                        if (newestUpd.isEmpty()) newestUpd = row.optString("updated_at", "");
                    }
                    String prevRev = prefs.getString("last_staff_rev_ts", "");
                    if (!newestUpd.isEmpty() && !newestUpd.equals(prevRev)) {
                        prefs.edit().putString("last_staff_rev_ts", newestUpd).apply();
                        if (!prevRev.isEmpty() && pendingCnt > 0) {
                            showLocalNotification(
                                ctx,
                                2004,
                                "📥 Setoran Tugas Baru Menunggu Review",
                                "Ada " + pendingCnt + " tugas siswa menunggu review di portal AniTrack."
                            );
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }

        return Result.success();
    }
}
`;
fs.writeFileSync(path.join(javaPkgDir, 'AniTrackNotifWorker.java'), workerJava, 'utf8');
console.log('OK: AniTrackNotifWorker.java dibuat untuk pengecekan notifikasi latar belakang');

// ==================== 5. PATCH MainActivity.java ====================
const mainActivityPath = path.join(javaPkgDir, 'MainActivity.java');
const customMainActivity = `package id.sch.smkn4malang.anitrack;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.BridgeActivity;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String WORK_NAME = "anitrack_bg_notif_sync";
    private static final int REQ_POST_NOTIF = 4091;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, true);
        applyNativeSystemBars(false);

        AniTrackNotifWorker.ensureNotificationChannel(this);
        requestNotificationPermissionIfNeeded();

        SharedPreferences prefs = getSharedPreferences(AniTrackNotifWorker.PREFS_NAME, Context.MODE_PRIVATE);
        if (!prefs.getString("user_id", "").isEmpty()) {
            scheduleBackgroundNotifWorker();
        }

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

                @JavascriptInterface
                public void setSession(final String jsonStr) {
                    try {
                        JSONObject obj = new JSONObject(jsonStr);
                        String uid = obj.optString("id", "");
                        if (uid.isEmpty()) return;
                        SharedPreferences sp = getSharedPreferences(AniTrackNotifWorker.PREFS_NAME, Context.MODE_PRIVATE);
                        String prevUid = sp.getString("user_id", "");
                        SharedPreferences.Editor ed = sp.edit();
                        if (!uid.equals(prevUid)) {
                            ed.remove("last_ann_ts");
                            ed.remove("last_ck_ts");
                            ed.remove("last_stu_sub_ts");
                            ed.remove("last_staff_rev_ts");
                        }
                        ed.putString("user_id", uid);
                        ed.putString("user_role", obj.optString("role", "student"));
                        ed.putBoolean("is_admin", obj.optBoolean("isAdmin", false));
                        ed.apply();
                        scheduleBackgroundNotifWorker();
                    } catch (Exception ignored) {
                    }
                }

                @JavascriptInterface
                public void clearSession() {
                    SharedPreferences sp = getSharedPreferences(AniTrackNotifWorker.PREFS_NAME, Context.MODE_PRIVATE);
                    sp.edit().clear().apply();
                    WorkManager.getInstance(getApplicationContext()).cancelUniqueWork(WORK_NAME);
                }

                @JavascriptInterface
                public void showNotification(final String title, final String body) {
                    int id = (int) (System.currentTimeMillis() & 0x7fffffff);
                    AniTrackNotifWorker.showLocalNotification(getApplicationContext(), id, title, body);
                }

                @JavascriptInterface
                public void testNotification() {
                    runOnUiThread(() -> {
                        requestNotificationPermissionIfNeeded();
                        AniTrackNotifWorker.showLocalNotification(
                            getApplicationContext(),
                            9901,
                            "✅ Notifikasi AniTrack Aktif!",
                            "Kamu akan otomatis menerima notifikasi HP saat ada pengumuman, revisi Project Update, atau setoran tugas baru."
                        );
                    });
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

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_POST_NOTIF);
            }
        }
    }

    private void scheduleBackgroundNotifWorker() {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(AniTrackNotifWorker.class, 15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build();
        WorkManager.getInstance(getApplicationContext()).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            req
        );
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
console.log('OK: MainActivity.java patched (persistent session + native notifications + WorkManager + Back)');
