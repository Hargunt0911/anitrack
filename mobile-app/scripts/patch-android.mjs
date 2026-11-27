import fs from 'node:fs';
import path from 'node:path';

// 1. Patch MainActivity.java agar tombol Back HP Android kembali ke riwayat halaman WebView sebelum keluar app
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

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }
}
`;
    fs.writeFileSync(mainActivityPath, customMainActivity, 'utf8');
    console.log('OK: MainActivity.java patched untuk navigasi Back HP Android');
} else {
    console.warn('WARN: MainActivity.java tidak ditemukan di', mainActivityPath);
}
