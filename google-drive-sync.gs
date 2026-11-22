/**
 * AniTrack — Google Drive Sync (.xlsx & Material Storage Bridge)
 * Folder Tujuan: https://drive.google.com/drive/folders/1XSLl2xb6-WxrtHNS3SEUrgC2rpLeWdBT?usp=sharing
 *
 * CARA DEPLOY / UPDATE:
 * 1. Buka https://script.google.com -> buka proyek AniTrack (atau buat proyek baru).
 * 2. Ganti seluruh kode dengan kode ini, lalu simpan (Ctrl+S).
 * 3. Untuk proyek baru: klik "Deploy" -> "New deployment" -> tipe "Web app"
 *    (Execute as: "Me" | Who has access: "Anyone").
 *    Untuk update versi: klik "Deploy" -> "Manage deployments" -> ikon Edit ->
 *    Version: "New version" -> klik "Deploy".
 * 4. Pastikan URL Web App (/exec) sudah tersimpan di menu "Drive & Backup" AniTrack.
 */

const ROOT_FOLDER_ID = '1XSLl2xb6-WxrtHNS3SEUrgC2rpLeWdBT';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SUPABASE_URL = 'https://izgcmhsobexicceqklqm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_T9eODcUv7nRBYgN-F24aRg_w-QOzKVu';
const WA_TRIGGER_HANDLER = 'runScheduledDailyWaReminder';

function getOrCreateSubfolder(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function extractDriveFileId(url) {
  if (!url) return '';
  const str = String(url).trim();
  const m1 = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  const m3 = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m3) return m3[1];
  return '';
}

function isInsideRootFolder(file, rootId) {
  try {
    const queue = [];
    const visited = {};
    const parents = file.getParents();
    while (parents.hasNext()) {
      queue.push(parents.next());
    }
    while (queue.length > 0) {
      const folder = queue.shift();
      const fid = folder.getId();
      if (fid === rootId) return true;
      if (visited[fid]) continue;
      visited[fid] = true;
      const up = folder.getParents();
      while (up.hasNext()) {
        queue.push(up.next());
      }
    }
  } catch (err) {
    return false;
  }
  return false;
}

function doGet() {
  try {
    const root = DriveApp.getFolderById(ROOT_FOLDER_ID);
    return jsonResponse({
      ok: true,
      message: 'Koneksi Google Drive AniTrack aktif.',
      folderName: root.getName(),
      folderUrl: root.getUrl()
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const action = payload.action || '';
    const root = DriveApp.getFolderById(ROOT_FOLDER_ID);

    // 1. Upload file Materi Ajar & Aset langsung ke subfolder "Materi Ajar - <Tahap>"
    if (action === 'upload_material') {
      const folderName = payload.stage ? `Materi Ajar - ${payload.stage}` : 'Materi Ajar';
      const targetFolder = getOrCreateSubfolder(root, folderName);

      const bytes = Utilities.base64Decode(payload.base64Data);
      const mimeType = payload.mimeType || 'application/octet-stream';
      const fileName = payload.fileName || `materi-${Date.now()}`;
      const blob = Utilities.newBlob(bytes, mimeType, fileName);

      const file = targetFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return jsonResponse({
        ok: true,
        fileId: file.getId(),
        fileName: file.getName(),
        fileUrl: file.getUrl()
      });
    }

    // 1b. Hapus file Materi Ajar di Google Drive saat materi dihapus dari AniTrack
    if (action === 'delete_material_files') {
      const rawUrls = Array.isArray(payload.fileUrls) ? payload.fileUrls : [];
      const rawIds = Array.isArray(payload.fileIds) ? payload.fileIds : [];
      const idSet = {};

      rawIds.forEach(function (id) {
        if (id) idSet[String(id).trim()] = true;
      });
      rawUrls.forEach(function (u) {
        const fid = extractDriveFileId(u);
        if (fid) idSet[fid] = true;
      });

      const deletedIds = [];
      const skipped = [];

      Object.keys(idSet).forEach(function (fid) {
        try {
          const file = DriveApp.getFileById(fid);
          if (isInsideRootFolder(file, ROOT_FOLDER_ID)) {
            file.setTrashed(true);
            deletedIds.push(fid);
          } else {
            skipped.push({ id: fid, reason: 'File berada di luar folder pusat AniTrack' });
          }
        } catch (err) {
          skipped.push({ id: fid, reason: err.message });
        }
      });

      return jsonResponse({
        ok: true,
        deletedCount: deletedIds.length,
        deletedIds: deletedIds,
        skipped: skipped
      });
    }

    // 1c. Upload Foto Profil ke subfolder "Foto Profil" (otomatis ganti foto lama user tsb)
    if (action === 'upload_avatar') {
      const avatarFolder = getOrCreateSubfolder(root, 'Foto Profil');
      const safeUser = String(payload.username || 'user').replace(/[^a-zA-Z0-9._-]/g, '_');
      const safeRole = String(payload.role || 'akun').replace(/[^a-zA-Z0-9._-]/g, '_');
      const mimeType = payload.mimeType || 'image/webp';
      const ext = mimeType.indexOf('png') >= 0 ? 'png' : (mimeType.indexOf('jpeg') >= 0 ? 'jpg' : 'webp');
      const fileName = `avatar-${safeUser}-${safeRole}.${ext}`;

      // Pindahkan foto profil lama milik user ini ke Trash agar folder tetap rapi
      const prevId = extractDriveFileId(payload.previousFileUrl || '');
      if (prevId) {
        try {
          const oldFile = DriveApp.getFileById(prevId);
          if (isInsideRootFolder(oldFile, ROOT_FOLDER_ID)) oldFile.setTrashed(true);
        } catch (err) { /* ignore */ }
      }
      const existingIt = avatarFolder.getFilesByName(fileName);
      while (existingIt.hasNext()) {
        existingIt.next().setTrashed(true);
      }

      const bytes = Utilities.base64Decode(payload.base64Data);
      const blob = Utilities.newBlob(bytes, mimeType, fileName);
      const file = avatarFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const fid = file.getId();

      return jsonResponse({
        ok: true,
        fileId: fid,
        fileName: file.getName(),
        fileUrl: file.getUrl(),
        imageUrl: `https://lh3.googleusercontent.com/d/${fid}=w400`
      });
    }

    // 1d. Hapus Foto Profil di Google Drive saat user menekan "Hapus Foto"
    if (action === 'delete_avatar') {
      const avatarFolder = getOrCreateSubfolder(root, 'Foto Profil');
      let deleted = 0;
      const prevId = extractDriveFileId(payload.previousFileUrl || '');
      if (prevId) {
        try {
          const oldFile = DriveApp.getFileById(prevId);
          if (isInsideRootFolder(oldFile, ROOT_FOLDER_ID)) {
            oldFile.setTrashed(true);
            deleted++;
          }
        } catch (err) { /* ignore */ }
      }
      if (payload.username) {
        const prefix = `avatar-${String(payload.username).replace(/[^a-zA-Z0-9._-]/g, '_')}-`;
        const it = avatarFolder.getFiles();
        while (it.hasNext()) {
          const f = it.next();
          if (f.getName().indexOf(prefix) === 0) {
            f.setTrashed(true);
            deleted++;
          }
        }
      }
      return jsonResponse({ ok: true, deletedCount: deleted });
    }

    // 2. Auto-log setiap Daily Task ke Google Spreadsheet bulanan di subfolder "Rekap Daily Task"
    if (action === 'sync_daily_task') {
      const logFolder = getOrCreateSubfolder(root, 'Rekap Daily Task');
      const monthKey = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM');
      const sheetName = `Rekap-DailyTask-${monthKey}`;

      let ss;
      const existing = logFolder.getFilesByName(sheetName);
      if (existing.hasNext()) {
        ss = SpreadsheetApp.openById(existing.next().getId());
      } else {
        ss = SpreadsheetApp.create(sheetName);
        const ssFile = DriveApp.getFileById(ss.getId());
        logFolder.addFile(ssFile);
        DriveApp.getRootFolder().removeFile(ssFile);

        const firstSheet = ss.getSheets()[0];
        firstSheet.setName('Daily Task');
        firstSheet.appendRow([
          'Waktu',
          'Nama Siswa',
          'Username',
          'Kelas',
          'Sub-Konsentrasi',
          'Judul Daily Task',
          'Status',
          'Catatan Siswa',
          'Feedback Pembimbing',
          'Tautan'
        ]);
        firstSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#EAF4FF');
        firstSheet.setFrozenRows(1);
      }

      const sheet = ss.getSheets()[0];
      sheet.appendRow([
        payload.updated_at || new Date().toISOString(),
        payload.student_name || '',
        payload.student_username || '',
        payload.class_name || '',
        payload.sub_concentration || '',
        payload.task_title || '',
        payload.status || '',
        payload.student_notes || '',
        payload.mentor_feedback || '',
        payload.submission_url || ''
      ]);

      return jsonResponse({
        ok: true,
        fileName: sheetName,
        fileUrl: ss.getUrl()
      });
    }

    // 3. Full Backup & Rekap Semua Data dalam format Excel (.xlsx)
    if (action === 'backup_all') {
      const backupFolder = getOrCreateSubfolder(root, 'Backup Data AniTrack');
      const stamp = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd_HH-mm');

      let fullUrl = null;
      if (payload.fullXlsxBase64) {
        const blob = Utilities.newBlob(
          Utilities.base64Decode(payload.fullXlsxBase64),
          XLSX_MIME,
          `AniTrack-FullBackup-${stamp}.xlsx`
        );
        fullUrl = backupFolder.createFile(blob).getUrl();
      }

      let tasksUrl = null;
      if (payload.tasksXlsxBase64) {
        const blob = Utilities.newBlob(
          Utilities.base64Decode(payload.tasksXlsxBase64),
          XLSX_MIME,
          `Rekap-DailyTask-${stamp}.xlsx`
        );
        tasksUrl = backupFolder.createFile(blob).getUrl();
      }

      let materialsUrl = null;
      if (payload.materialsXlsxBase64) {
        const blob = Utilities.newBlob(
          Utilities.base64Decode(payload.materialsXlsxBase64),
          XLSX_MIME,
          `Daftar-MateriAjar-${stamp}.xlsx`
        );
        materialsUrl = backupFolder.createFile(blob).getUrl();
      }

      return jsonResponse({
        ok: true,
        backupUrl: fullUrl,
        tasksUrl: tasksUrl,
        materialsUrl: materialsUrl,
        folderUrl: backupFolder.getUrl()
      });
    }

    // 4. Simpan Pengaturan Notifikasi WA & Pasang/Hapus Trigger Harian Jam 07:00 WIB
    if (action === 'save_wa_config') {
      const cfg = {
        enabled: Boolean(payload.enabled),
        provider: String(payload.provider || 'fonnte'),
        apiToken: String(payload.apiToken || '').trim(),
        customUrl: String(payload.customUrl || '').trim(),
        appUrl: String(payload.appUrl || '').trim(),
        messageTemplate: String(payload.messageTemplate || '').trim(),
        hour: Number(payload.hour || 7)
      };
      PropertiesService.getScriptProperties().setProperty('ANITRACK_WA_CONFIG', JSON.stringify(cfg));
      const triggerActive = syncDailyWaTrigger(cfg.enabled, cfg.hour);
      return jsonResponse({
        ok: true,
        triggerActive: triggerActive,
        hour: cfg.hour,
        message: triggerActive
          ? `Jadwal otomatis WA aktif setiap hari pukul 0${cfg.hour}:00 WIB.`
          : 'Pengaturan WA tersimpan (jadwal otomatis nonaktif).'
      });
    }

    // 4b. Cek Status Trigger WA Harian
    if (action === 'get_wa_status') {
      const triggers = ScriptApp.getProjectTriggers().filter(function (t) {
        return t.getHandlerFunction() === WA_TRIGGER_HANDLER;
      });
      const cfg = getWaConfigFromProperties();
      return jsonResponse({
        ok: true,
        triggerActive: triggers.length > 0,
        triggerCount: triggers.length,
        hour: cfg.hour || 7,
        provider: cfg.provider || 'fonnte',
        hasToken: Boolean(cfg.apiToken),
        hasTemplate: Boolean(cfg.messageTemplate)
      });
    }

    // 4c. Tes Kirim 1 Pesan WA
    if (action === 'test_send_wa') {
      const cfg = payload.config ? payload.config : getWaConfigFromProperties();
      const targetPhone = normalizeWaPhoneGas(payload.phone || '');
      if (!targetPhone) return jsonResponse({ ok: false, error: 'Nomor WA tujuan tidak valid.' });
      const sampleTasks = '🟡 *MENDEKATI DEADLINE:*\n1. *Storyline, Treatment & Storyboard* — *Besok (H-1)* (Contoh Tes)';
      const msg = payload.message || (
        '🔔 *[TES TEMPLATE WA ANITRACK]*\n\n' +
        renderWaTemplateGas(cfg.messageTemplate || '', {
          nama: payload.sampleName || 'Budi Santoso (Contoh)',
          kelas: 'X ANI A',
          subkonsentrasi: '3D Animator',
          daftar_tugas: sampleTasks,
          tugas_terlambat: '',
          tugas_mendekati: sampleTasks,
          pembimbing: '👨‍🏫 Pembimbing: *Guru Pembimbing*',
          link_anitrack: cfg.appUrl ? `🔗 Buka AniTrack: ${cfg.appUrl}` : ''
        })
      );
      const sendRes = sendWaMessageViaGateway(cfg, targetPhone, msg);
      insertWaLogToSupabase({
        sent_date: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
        student_id: null,
        student_name: 'TES KIRIM ADMIN',
        whatsapp_number: targetPhone,
        reminder_type: 'test',
        task_summary: 'Tes koneksi WA Gateway',
        provider: cfg.provider || 'fonnte',
        status: sendRes.ok ? 'sent' : 'failed',
        response_detail: sendRes.detail
      });
      return jsonResponse({
        ok: sendRes.ok,
        detail: sendRes.detail,
        error: sendRes.ok ? null : sendRes.detail
      });
    }

    // 4d. Jalankan Pengingat WA Deadline Sekarang (Manual Trigger dari Admin)
    if (action === 'run_wa_deadline_check_now') {
      if (payload.config) {
        PropertiesService.getScriptProperties().setProperty('ANITRACK_WA_CONFIG', JSON.stringify(payload.config));
      }
      const summary = executeDailyWaDeadlineReminder(true);
      return jsonResponse(summary);
    }

    return jsonResponse({ ok: false, error: 'Action tidak dikenali.' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

/* ==================== ENGINE NOTIFIKASI WA OTOMATIS JAM 07:00 WIB ==================== */

const DEFAULT_WA_TEMPLATE_GAS = [
  'Halo *{nama}* ({kelas}),',
  'Pengingat Project Tracker *AniTrack — SMKN 4 Malang*:',
  '',
  '{daftar_tugas}',
  '📌 Segera upload file (sesuai contoh penamaan) ke Folder Google Drive Project kamu, lalu lapor selesai + unggah bukti screenshot di AniTrack.',
  '{pembimbing}',
  '{link_anitrack}'
].join('\n');

function renderWaTemplateGas(template, vars) {
  const raw = (template && String(template).trim()) ? String(template) : DEFAULT_WA_TEMPLATE_GAS;
  const map = {
    nama: vars.nama || 'Siswa',
    kelas: vars.kelas || 'Siswa Animasi',
    subkonsentrasi: vars.subkonsentrasi || 'Animasi',
    daftar_tugas: vars.daftar_tugas || '-',
    tugas_terlambat: vars.tugas_terlambat || '',
    tugas_mendekati: vars.tugas_mendekati || '',
    pembimbing: vars.pembimbing || '',
    link_anitrack: vars.link_anitrack || ''
  };
  const hasTaskToken = /\{(daftar_tugas|tugas_terlambat|tugas_mendekati)\}/i.test(raw);
  const hasMentorToken = /\{pembimbing\}/i.test(raw);
  const hasLinkToken = /\{link_anitrack\}/i.test(raw);
  let rendered = raw.replace(/\{(nama|kelas|subkonsentrasi|daftar_tugas|tugas_terlambat|tugas_mendekati|pembimbing|link_anitrack)\}/gi, function (_, k) {
    const key = String(k).toLowerCase();
    return map[key] !== undefined ? map[key] : '';
  });
  const autoExtra = [];
  if (!hasTaskToken && map.daftar_tugas && map.daftar_tugas !== '-') autoExtra.push(map.daftar_tugas);
  if (!hasMentorToken && map.pembimbing) autoExtra.push(map.pembimbing);
  if (!hasLinkToken && map.link_anitrack) autoExtra.push(map.link_anitrack);
  if (autoExtra.length) rendered = rendered.trim() + '\n\n' + autoExtra.join('\n');
  return rendered.replace(/\n{3,}/g, '\n\n').trim();
}

function getWaConfigFromProperties() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('ANITRACK_WA_CONFIG');
    if (raw) return JSON.parse(raw);
  } catch (err) { /* ignore */ }
  // Fallback baca dari tabel app_settings Supabase
  try {
    const rows = fetchSupabaseRest('app_settings?select=value&key=eq.wa_gateway_config');
    if (rows && rows.length && rows[0].value) {
      return JSON.parse(rows[0].value);
    }
  } catch (err) { /* ignore */ }
  return { enabled: false, provider: 'fonnte', apiToken: '', customUrl: '', appUrl: '', messageTemplate: '', hour: 7 };
}

function syncDailyWaTrigger(enabled, hour) {
  const existing = ScriptApp.getProjectTriggers();
  existing.forEach(function (t) {
    if (t.getHandlerFunction() === WA_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(t);
    }
  });
  if (!enabled) return false;
  const targetHour = (typeof hour === 'number' && hour >= 0 && hour <= 23) ? hour : 7;
  ScriptApp.newTrigger(WA_TRIGGER_HANDLER)
    .timeBased()
    .atHour(targetHour)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone('Asia/Jakarta')
    .create();
  return true;
}

function normalizeWaPhoneGas(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.indexOf('0') === 0) digits = '62' + digits.slice(1);
  else if (digits.indexOf('8') === 0) digits = '62' + digits;
  return /^628\d{7,12}$/.test(digits) ? digits : '';
}

function formatWaLocalGas(wa) {
  const clean = normalizeWaPhoneGas(wa);
  if (!clean) return '-';
  return '0' + clean.slice(2);
}

function fetchSupabaseRest(path) {
  const res = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'get',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json'
    },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    throw new Error(`Supabase GET gagal (${res.getResponseCode()}): ${res.getContentText()}`);
  }
  return JSON.parse(res.getContentText() || '[]');
}

function insertWaLogToSupabase(entry) {
  try {
    UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/wa_notification_logs`, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal'
      },
      payload: JSON.stringify(entry),
      muteHttpExceptions: true
    });
  } catch (err) { /* ignore log errors */ }
}

function sendWaMessageViaGateway(cfg, phone, message) {
  const provider = String(cfg.provider || 'fonnte');
  const token = String(cfg.apiToken || '').trim();
  const customUrl = String(cfg.customUrl || '').trim();

  if (!token && provider !== 'custom_webhook') {
    return { ok: false, detail: 'API Token WA Gateway belum diisi.' };
  }

  try {
    let res;
    if (provider === 'fonnte') {
      res = UrlFetchApp.fetch('https://api.fonnte.com/send', {
        method: 'post',
        headers: { Authorization: token },
        payload: {
          target: phone,
          message: message,
          countryCode: '62'
        },
        muteHttpExceptions: true
      });
    } else if (provider === 'wablas') {
      const endpoint = customUrl || 'https://pati.wablas.com/api/send-message';
      res = UrlFetchApp.fetch(endpoint, {
        method: 'post',
        headers: { Authorization: token },
        payload: {
          phone: phone,
          message: message
        },
        muteHttpExceptions: true
      });
    } else {
      if (!customUrl) return { ok: false, detail: 'URL Custom Webhook WA belum diisi.' };
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      res = UrlFetchApp.fetch(customUrl, {
        method: 'post',
        contentType: 'application/json',
        headers: headers,
        payload: JSON.stringify({ target: phone, phone: phone, message: message }),
        muteHttpExceptions: true
      });
    }

    const code = res.getResponseCode();
    const txt = String(res.getContentText() || '').slice(0, 260);
    let parsedOk = code >= 200 && code < 300;
    try {
      const js = JSON.parse(txt);
      if (js && js.status === false) parsedOk = false;
    } catch (e) { /* non-json response */ }
    return { ok: parsedOk, detail: `HTTP ${code}: ${txt}` };
  } catch (err) {
    return { ok: false, detail: err.message };
  }
}

function parseYmdToUtcMs(ymd) {
  if (!ymd) return null;
  const parts = String(ymd).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Fungsi yang otomatis dijalankan setiap hari pukul 07:00 WIB oleh Google Apps Script Trigger.
 */
function runScheduledDailyWaReminder() {
  return executeDailyWaDeadlineReminder(false);
}

function executeDailyWaDeadlineReminder(forceRun) {
  const cfg = getWaConfigFromProperties();
  if (!forceRun && !cfg.enabled) {
    return { ok: true, skipped: true, message: 'Jadwal pengingat WA sedang nonaktif.' };
  }
  if (!cfg.apiToken && cfg.provider !== 'custom_webhook') {
    return { ok: false, error: 'API Token WA Gateway belum diatur di Portal Admin.' };
  }

  const todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  const todayMs = parseYmdToUtcMs(todayStr);

  const profiles = fetchSupabaseRest('profiles?select=id,full_name,username,class_name,sub_concentration,role,mentor_id,whatsapp_number');
  const tasks = fetchSupabaseRest('project_tasks?select=id,title,pipeline_stage,sub_concentration,due_date');
  const subs = fetchSupabaseRest('project_submissions?select=project_task_id,student_id,status');

  const mentorMap = {};
  const students = [];
  profiles.forEach(function (p) {
    if (p.role === 'mentor') mentorMap[p.id] = p;
    else if (p.role === 'student') students.push(p);
  });

  const subMap = {};
  subs.forEach(function (ps) {
    subMap[`${ps.project_task_id}__${ps.student_id}`] = ps;
  });

  let eligibleStudents = 0;
  let sentCount = 0;
  let failedCount = 0;
  let skippedNoWa = 0;

  students.forEach(function (s) {
    const overdueList = [];
    const upcomingList = [];

    tasks.forEach(function (t) {
      if (!t.due_date) return;
      if (t.sub_concentration && s.sub_concentration !== t.sub_concentration) return;

      const ps = subMap[`${t.id}__${s.id}`];
      const st = ps ? ps.status : 'belum_mulai';
      // Berhenti mengirim WA jika siswa sudah melapor selesai (Menunggu Review atau ACC)
      if (st === 'selesai' || st === 'menunggu_review') return;

      const dueMs = parseYmdToUtcMs(t.due_date);
      if (dueMs === null) return;
      const diffDays = Math.round((dueMs - todayMs) / 86400000);

      if (diffDays < 0) {
        overdueList.push({
          title: t.title,
          stage: t.pipeline_stage,
          dueDate: String(t.due_date).slice(0, 10),
          lateDays: Math.abs(diffDays),
          status: st
        });
      } else if (diffDays <= 2) {
        upcomingList.push({
          title: t.title,
          stage: t.pipeline_stage,
          dueDate: String(t.due_date).slice(0, 10),
          diffDays: diffDays,
          status: st
        });
      }
    });

    if (!overdueList.length && !upcomingList.length) return;
    eligibleStudents++;

    const phone = normalizeWaPhoneGas(s.whatsapp_number);
    if (!phone) {
      skippedNoWa++;
      return;
    }

    const mentor = s.mentor_id ? mentorMap[s.mentor_id] : null;
    const overdueLines = [];
    if (overdueList.length) {
      overdueLines.push('🔴 *MELEBIHI DEADLINE (Belum Lapor Selesai):*');
      overdueList.forEach(function (item, idx) {
        const revTag = item.status === 'revisi' ? ' [Revisi]' : '';
        overdueLines.push(`${idx + 1}. *${item.title}*${revTag} — Terlambat *${item.lateDays} hari* (Deadline: ${item.dueDate})`);
      });
      overdueLines.push('_Notifikasi ini akan dikirim setiap hari pukul 07:00 WIB sampai kamu melapor selesai di AniTrack._');
    }

    const upcomingLines = [];
    if (upcomingList.length) {
      upcomingLines.push('🟡 *MENDEKATI DEADLINE:*');
      upcomingList.forEach(function (item, idx) {
        const whenLabel = item.diffDays === 0 ? 'HARI INI' : (item.diffDays === 1 ? 'Besok (H-1)' : '2 Hari Lagi (H-2)');
        const revTag = item.status === 'revisi' ? ' [Revisi]' : '';
        upcomingLines.push(`${idx + 1}. *${item.title}*${revTag} — *${whenLabel}* (${item.dueDate})`);
      });
    }

    const overdueBlock = overdueLines.join('\n');
    const upcomingBlock = upcomingLines.join('\n');
    const combinedTasks = [overdueBlock, upcomingBlock].filter(Boolean).join('\n\n');
    const mentorLine = mentor
      ? `👨‍🏫 Pembimbing: *${mentor.full_name}*${formatWaLocalGas(mentor.whatsapp_number) !== '-' ? ` (WA: ${formatWaLocalGas(mentor.whatsapp_number)})` : ''}`
      : '';
    const appUrlLine = cfg.appUrl ? `🔗 Buka AniTrack: ${cfg.appUrl}` : '';

    const messageText = renderWaTemplateGas(cfg.messageTemplate || '', {
      nama: s.full_name || 'Siswa',
      kelas: s.class_name || 'Siswa Animasi',
      subkonsentrasi: s.sub_concentration || 'Animasi',
      daftar_tugas: combinedTasks,
      tugas_terlambat: overdueBlock,
      tugas_mendekati: upcomingBlock,
      pembimbing: mentorLine,
      link_anitrack: appUrlLine
    });

    const reminderType = (overdueList.length && upcomingList.length)
      ? 'mixed'
      : (overdueList.length ? 'overdue' : 'h_minus_2');
    const summaryTitles = overdueList.map(function (x) { return `[Telat ${x.lateDays}h] ${x.title}`; })
      .concat(upcomingList.map(function (x) { return `[H-${x.diffDays}] ${x.title}`; }))
      .join('; ');

    const sendRes = sendWaMessageViaGateway(cfg, phone, messageText);
    if (sendRes.ok) sentCount++;
    else failedCount++;

    insertWaLogToSupabase({
      sent_date: todayStr,
      student_id: s.id,
      student_name: s.full_name,
      whatsapp_number: phone,
      reminder_type: reminderType,
      task_summary: summaryTitles.slice(0, 400),
      provider: cfg.provider || 'fonnte',
      status: sendRes.ok ? 'sent' : 'failed',
      response_detail: sendRes.detail
    });

    Utilities.sleep(1200);
  });

  return {
    ok: true,
    sentDate: todayStr,
    eligibleStudents: eligibleStudents,
    sentCount: sentCount,
    failedCount: failedCount,
    skippedNoWa: skippedNoWa
  };
}
