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

    // 1e. Upload Gambar Coretan Revisi Guru ke subfolder "AniTrack_Revisi"
    if (action === 'upload_revisi_image') {
      const revFolder = getOrCreateSubfolder(root, 'AniTrack_Revisi');
      const mimeType = payload.mimeType || 'image/jpeg';
      const ext = mimeType.indexOf('png') >= 0 ? 'png' : (mimeType.indexOf('webp') >= 0 ? 'webp' : 'jpg');
      const safeName = String(payload.fileName || `revisi_${Date.now()}.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const bytes = Utilities.base64Decode(payload.base64Data);
      const blob = Utilities.newBlob(bytes, mimeType, safeName);
      const file = revFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const fid = file.getId();
      return jsonResponse({
        ok: true,
        fileId: fid,
        fileUrl: file.getUrl(),
        imageUrl: `https://lh3.googleusercontent.com/d/${fid}=w1200`
      });
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

    // 4. Simpan Pengaturan Notifikasi WA & Telegram + Pasang/Hapus Trigger Harian Jam 07:00 WIB
    if (action === 'save_wa_config') {
      const cfg = {
        enabled: Boolean(payload.enabled),
        waEnabled: payload.waEnabled !== undefined ? Boolean(payload.waEnabled) : Boolean(payload.apiToken || payload.provider === 'custom_webhook'),
        provider: String(payload.provider || 'fonnte'),
        apiToken: String(payload.apiToken || '').trim(),
        customUrl: String(payload.customUrl || '').trim(),
        waTestPhone: String(payload.waTestPhone || '081259699623').trim(),
        waDummyMode: Boolean(payload.waDummyMode),
        tgEnabled: Boolean(payload.tgEnabled),
        tgBotUsername: String(payload.tgBotUsername || '').trim().replace(/^@+/, ''),
        tgBotToken: String(payload.tgBotToken || '').trim(),
        tgSendDm: payload.tgSendDm !== undefined ? Boolean(payload.tgSendDm) : true,
        tgChatId: String(payload.tgChatId || '').trim(),
        tgClassChatMap: payload.tgClassChatMap && typeof payload.tgClassChatMap === 'object' ? payload.tgClassChatMap : {},
        appUrl: String(payload.appUrl || '').trim(),
        messageTemplate: String(payload.messageTemplate || '').trim(),
        hour: Number(payload.hour || 7)
      };
      PropertiesService.getScriptProperties().setProperty('ANITRACK_WA_CONFIG', JSON.stringify(cfg));
      const triggerActive = syncDailyWaTrigger(cfg.enabled, cfg.hour);
      const channels = [];
      if (cfg.waEnabled) channels.push('WhatsApp');
      if (cfg.tgEnabled) channels.push('Telegram');
      const chLabel = channels.length ? channels.join(' + ') : 'WA/Telegram';
      return jsonResponse({
        ok: true,
        triggerActive: triggerActive,
        hour: cfg.hour,
        message: triggerActive
          ? `Jadwal otomatis ${chLabel} aktif setiap hari pukul 0${cfg.hour}:00 WIB.`
          : `Pengaturan ${chLabel} tersimpan (jadwal otomatis nonaktif).`
      });
    }

    // 4b. Cek Status Trigger WA/Telegram Harian
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
        waEnabled: cfg.waEnabled !== false,
        tgEnabled: Boolean(cfg.tgEnabled),
        hasToken: Boolean(cfg.apiToken),
        hasTgToken: Boolean(cfg.tgBotToken),
        hasTemplate: Boolean(cfg.messageTemplate)
      });
    }

    // 4c. Tes Kirim 1 Pesan WA
    if (action === 'test_send_wa') {
      const cfg = payload.config ? payload.config : getWaConfigFromProperties();
      const targetPhone = normalizeWaPhoneGas(payload.phone || '');
      if (!targetPhone) return jsonResponse({ ok: false, error: 'Nomor WA tujuan tidak valid.' });
      const sampleTasks = '🟡 *MENDEKATI DEADLINE:*\n1. *Storyline, Treatment & Storyboard* — *Besok (H-1)* (Contoh Tes)';
      const sampleProjUpd = '📊 *PROJECT UPDATE (3D Animator — 1/3 Done • 33%):*\n✅ Compose & Audio Video: *Done*\n🟡 Grading: *WIP*\n🔴 Final Film + Credit Title: *Revisi*\n📝 Notes PJ Subkon: _Perbaiki timing animasi_';
      const msg = payload.message || (
        '🔔 *[TES TEMPLATE WA ANITRACK]*\n\n' +
        renderWaTemplateGas(cfg.messageTemplate || '', {
          nama: payload.sampleName || 'Budi Santoso (Contoh)',
          kelas: 'X ANI A',
          subkonsentrasi: '3D Animator',
          daftar_tugas: sampleTasks,
          tugas_terlambat: '',
          tugas_mendekati: sampleTasks,
          project_update: sampleProjUpd,
          pembimbing: '👨‍🏫 Pembimbing: *Guru Pembimbing*',
          link_anitrack: cfg.appUrl ? `🔗 Buka AniTrack: ${cfg.appUrl}` : ''
        })
      );
      const sendRes = sendWaMessageViaGateway(cfg, targetPhone, msg);
      insertWaLogToSupabase({
        sent_date: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
        student_id: null,
        student_name: 'TES KIRIM ADMIN (WA)',
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

    // 4c-2. Tes Kirim 1 Pesan Telegram Bot (mengirimkan contoh pesan penuh sesuai template)
    if (action === 'test_send_telegram') {
      const cfg = payload.config ? payload.config : getWaConfigFromProperties();
      const botToken = String(payload.tgBotToken || cfg.tgBotToken || '').trim();
      const chatId = String(payload.chatId || cfg.tgChatId || '').trim();
      if (!botToken) return jsonResponse({ ok: false, error: 'Bot Token Telegram belum diisi.' });
      if (!chatId) return jsonResponse({ ok: false, error: 'Chat ID Telegram tujuan belum diisi.' });
      const sampleLate = '🔴 MELEBIHI DEADLINE (Belum Lapor Selesai):\n1. Storyline, Treatment & Storyboard — Terlambat 2 hari (Contoh Tes)';
      const sampleSoon = '🟡 MENDEKATI DEADLINE:\n1. Character Turnaround & Model Sheet — Besok (H-1) (Contoh Tes)';
      const sampleProjUpd = '📊 PROJECT UPDATE (3D Modeller — 1/3 Done • 33%):\n✅ Compose & Audio Video: Done\n🟡 Grading: WIP\n🔴 Final Film + Credit Title: Revisi\n📝 Notes PJ Subkon: Perbaiki lighting scene 02';
      const renderedSample = renderWaTemplateGas(cfg.messageTemplate || '', {
        nama: payload.sampleName || 'Zahira Aulia Putri (Contoh)',
        kelas: 'X ANI A',
        subkonsentrasi: '3D Modeller',
        daftar_tugas: `${sampleLate}\n\n${sampleSoon}`,
        tugas_terlambat: sampleLate,
        tugas_mendekati: sampleSoon,
        project_update: sampleProjUpd,
        pembimbing: '👨‍🏫 Pembimbing: Guru Pembimbing (WA: 0812-3456-7890)',
        link_anitrack: cfg.appUrl ? `🔗 Buka AniTrack: ${cfg.appUrl}` : '🔗 Buka AniTrack: https://anitrack.republikanimasi.my.id'
      }).replace(/\*([^*\n]+)\*/g, '$1').replace(/_([^_\n]+)_/g, '$1');
      const msg = payload.message || (
        '✅ [TES BOT TELEGRAM ANITRACK — BERHASIL]\n' +
        'Berikut contoh pesan pengingat yang akan diterima siswa setiap jam 07:00 WIB:\n' +
        '────────────────────────\n\n' +
        renderedSample
      );
      const sendRes = sendTelegramMessageGas(botToken, chatId, msg);
      insertWaLogToSupabase({
        sent_date: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
        student_id: null,
        student_name: 'TES KIRIM ADMIN (TELEGRAM)',
        whatsapp_number: `TG:${chatId}`,
        reminder_type: 'test_telegram',
        task_summary: 'Tes koneksi Telegram Bot API',
        provider: 'telegram',
        status: sendRes.ok ? 'sent' : 'failed',
        response_detail: sendRes.detail
      });
      return jsonResponse({
        ok: sendRes.ok,
        detail: sendRes.detail,
        error: sendRes.ok ? null : sendRes.detail
      });
    }

    // 4c-3. Sinkronkan Akun Telegram Siswa dari perintah /start <studentId>
    if (action === 'sync_telegram_students') {
      const cfg = payload.config ? payload.config : getWaConfigFromProperties();
      const targetStudentId = String(payload.targetStudentId || '').trim();
      const syncRes = syncTelegramStudentsFromUpdates(cfg, targetStudentId);
      return jsonResponse(syncRes);
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
  '{project_update}',
  '📌 Segera upload file (sesuai contoh penamaan) ke Folder Google Drive Project kamu, lalu lapor selesai + unggah bukti screenshot di AniTrack.',
  '{pembimbing}',
  '{link_anitrack}'
].join('\n');

const DEFAULT_CHECKLIST_COLS_GAS = ['Compose & Audio Video', 'Grading', 'Final Film + Credit Title'];

function normalizeChecklistStatusGas(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'done' || v === 'selesai' || v === 'acc') return 'done';
  if (v === 'revisi' || v === 'revision') return 'revisi';
  if (v === 'wip' || v === 'proses' || v === 'in progress' || v === 'sedang_dikerjakan') return 'wip';
  return 'none';
}

function formatProjectUpdateBlockGas(student, colsMap, rowMap) {
  if (!student) return '';
  const sc = student.sub_concentration || '';
  const cols = (sc && Array.isArray(colsMap[sc]) && colsMap[sc].length) ? colsMap[sc] : DEFAULT_CHECKLIST_COLS_GAS;
  const rd = rowMap[student.id] || { items: {}, notes: '' };
  const labelMap = { none: 'None', wip: 'WIP', revisi: 'Revisi', done: 'Done' };
  let doneCnt = 0;
  cols.forEach(function (c) { if (normalizeChecklistStatusGas(rd.items && rd.items[c]) === 'done') doneCnt++; });
  const pct = cols.length ? Math.round((doneCnt / cols.length) * 100) : 0;
  const lines = [`📊 *PROJECT UPDATE (${sc || 'Animasi'} — ${doneCnt}/${cols.length} Done • ${pct}%):*`];
  cols.forEach(function (c) {
    const st = normalizeChecklistStatusGas(rd.items && rd.items[c]);
    const icon = st === 'done' ? '✅' : (st === 'revisi' ? '🔴' : (st === 'wip' ? '🟡' : '⚪'));
    lines.push(`${icon} ${c}: *${labelMap[st] || 'None'}*`);
  });
  if (rd.notes && String(rd.notes).trim()) {
    lines.push(`📝 Notes PJ Subkon: _${String(rd.notes).trim()}_`);
  }
  return lines.join('\n');
}

function renderWaTemplateGas(template, vars) {
  const raw = (template && String(template).trim()) ? String(template) : DEFAULT_WA_TEMPLATE_GAS;
  const map = {
    nama: vars.nama || 'Siswa',
    kelas: vars.kelas || 'Siswa Animasi',
    subkonsentrasi: vars.subkonsentrasi || 'Animasi',
    daftar_tugas: vars.daftar_tugas || '-',
    tugas_terlambat: vars.tugas_terlambat || '',
    tugas_mendekati: vars.tugas_mendekati || '',
    project_update: vars.project_update || '',
    pembimbing: vars.pembimbing || '',
    link_anitrack: vars.link_anitrack || ''
  };
  const hasTaskToken = /\{(daftar_tugas|tugas_terlambat|tugas_mendekati)\}/i.test(raw);
  const hasProjectUpdateToken = /\{project_update\}/i.test(raw);
  const hasMentorToken = /\{pembimbing\}/i.test(raw);
  const hasLinkToken = /\{link_anitrack\}/i.test(raw);
  let rendered = raw.replace(/\{(nama|kelas|subkonsentrasi|daftar_tugas|tugas_terlambat|tugas_mendekati|project_update|pembimbing|link_anitrack)\}/gi, function (_, k) {
    const key = String(k).toLowerCase();
    return map[key] !== undefined ? map[key] : '';
  });
  const autoExtra = [];
  if (!hasTaskToken && map.daftar_tugas && map.daftar_tugas !== '-') autoExtra.push(map.daftar_tugas);
  if (!hasProjectUpdateToken && map.project_update) autoExtra.push(map.project_update);
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

function upsertAppSettingSupabase(key, valueObj) {
  const res = UrlFetchApp.fetch(`${SUPABASE_URL}/rest/v1/app_settings?on_conflict=key`, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    payload: JSON.stringify({
      key: key,
      value: typeof valueObj === 'string' ? valueObj : JSON.stringify(valueObj),
      updated_at: new Date().toISOString()
    }),
    muteHttpExceptions: true
  });
  return res.getResponseCode() >= 200 && res.getResponseCode() < 300;
}

function syncTelegramStudentsFromUpdates(cfg, targetStudentId) {
  const token = String((cfg && cfg.tgBotToken) || '').trim();
  if (!token) {
    return { ok: false, error: 'Bot Token Telegram belum diatur oleh Admin.' };
  }
  const props = PropertiesService.getScriptProperties();
  const lastOffset = Number(props.getProperty('ANITRACK_TG_LAST_UPDATE_ID') || 0);
  const url = `https://api.telegram.org/bot${token}/getUpdates?limit=100${lastOffset > 0 ? `&offset=${lastOffset}` : ''}`;

  try {
    const res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code >= 300) {
      return { ok: false, error: `Telegram getUpdates gagal (HTTP ${code}): ${res.getContentText().slice(0, 200)}` };
    }
    const body = JSON.parse(res.getContentText() || '{}');
    if (!body.ok) {
      return { ok: false, error: body.description || 'Gagal membaca update dari Telegram Bot.' };
    }

    const updates = Array.isArray(body.result) ? body.result : [];
    let maxUpdateId = lastOffset - 1;
    const profiles = fetchSupabaseRest('profiles?select=id,full_name,username,class_name,role');
    const byId = {};
    const byUsername = {};
    profiles.forEach(function (p) {
      byId[String(p.id)] = p;
      if (p.username) byUsername[String(p.username).toLowerCase()] = p;
    });

    let linkedCount = 0;
    let targetRecord = null;

    updates.forEach(function (u) {
      if (typeof u.update_id === 'number' && u.update_id > maxUpdateId) maxUpdateId = u.update_id;
      const msg = u.message || u.edited_message;
      if (!msg || !msg.text || !msg.chat) return;
      const text = String(msg.text).trim();
      const match = text.match(/^\/start(?:@\w+)?\s+([^\s]+)/i);
      if (!match) return;
      const param = String(match[1] || '').trim();
      const student = byId[param] || byUsername[param.toLowerCase()];
      if (!student) return;

      const rec = {
        student_id: student.id,
        chat_id: String(msg.chat.id),
        username: (msg.from && msg.from.username) ? String(msg.from.username) : '',
        first_name: (msg.from && msg.from.first_name) ? String(msg.from.first_name) : (student.full_name || ''),
        connected_at: new Date().toISOString()
      };
      const saved = upsertAppSettingSupabase(`student_telegram::${student.id}`, rec);
      if (saved) {
        linkedCount++;
        if (targetStudentId && student.id === targetStudentId) targetRecord = rec;
        sendTelegramMessageGas(
          token,
          rec.chat_id,
          `✅ Halo ${student.full_name} (${student.class_name || 'Animasi'}),\n\nAkun Telegram kamu berhasil terhubung ke AniTrack SMKN 4 Malang! Mulai sekarang kamu akan otomatis menerima pengingat deadline Project Tracker setiap pagi pukul 07:00 WIB.`
        );
      }
    });

    if (maxUpdateId >= lastOffset && updates.length) {
      props.setProperty('ANITRACK_TG_LAST_UPDATE_ID', String(maxUpdateId + 1));
    }

    if (targetStudentId && !targetRecord) {
      try {
        const existing = fetchSupabaseRest(`app_settings?select=value&key=eq.${encodeURIComponent(`student_telegram::${targetStudentId}`)}`);
        if (existing && existing.length && existing[0].value) {
          targetRecord = JSON.parse(existing[0].value);
        }
      } catch (e) { /* ignore */ }
    }

    return {
      ok: true,
      linkedCount: linkedCount,
      checkedUpdates: updates.length,
      connected: Boolean(targetRecord && targetRecord.chat_id),
      telegram: targetRecord
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function sendTelegramMessageGas(botToken, chatId, text) {
  const token = String(botToken || '').trim();
  const cid = String(chatId || '').trim();
  if (!token || !cid) {
    return { ok: false, detail: 'Bot Token atau Chat ID Telegram belum diisi.' };
  }
  const cleanText = String(text || '').trim();
  if (!cleanText) return { ok: false, detail: 'Pesan Telegram kosong.' };

  // Bagi otomatis jika pesan melebihi batas 4096 karakter Telegram
  const chunks = [];
  let cursor = cleanText;
  while (cursor.length > 3800) {
    let splitIdx = cursor.lastIndexOf('\n', 3800);
    if (splitIdx < 1000) splitIdx = 3800;
    chunks.push(cursor.slice(0, splitIdx).trim());
    cursor = cursor.slice(splitIdx).trim();
  }
  if (cursor) chunks.push(cursor);

  try {
    let lastDetail = 'OK';
    for (let i = 0; i < chunks.length; i++) {
      const res = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: cid,
          text: chunks[i],
          disable_web_page_preview: true
        }),
        muteHttpExceptions: true
      });
      const code = res.getResponseCode();
      const txt = String(res.getContentText() || '').slice(0, 260);
      lastDetail = `HTTP ${code}: ${txt}`;
      let ok = code >= 200 && code < 300;
      try {
        const js = JSON.parse(txt);
        if (js && js.ok === false) ok = false;
      } catch (e) { /* ignore */ }
      if (!ok) return { ok: false, detail: lastDetail };
      if (chunks.length > 1) Utilities.sleep(400);
    }
    return { ok: true, detail: lastDetail };
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
    return { ok: true, skipped: true, message: 'Jadwal pengingat WA/Telegram sedang nonaktif.' };
  }

  const useWa = (cfg.waEnabled !== false) && Boolean(cfg.apiToken || cfg.provider === 'custom_webhook');
  const classChatMap = (cfg.tgClassChatMap && typeof cfg.tgClassChatMap === 'object') ? cfg.tgClassChatMap : {};
  const hasAnyTgGroup = Boolean(String(cfg.tgChatId || '').trim()) || Object.keys(classChatMap).length > 0;
  const useTgDm = Boolean(cfg.tgEnabled && String(cfg.tgBotToken || '').trim() && cfg.tgSendDm !== false);
  const useTgGroup = Boolean(cfg.tgEnabled && String(cfg.tgBotToken || '').trim() && hasAnyTgGroup);
  const useTg = useTgDm || useTgGroup;

  if (!useWa && !useTg) {
    return { ok: false, error: 'Aktifkan dan lengkapi minimal 1 kanal pengiriman (WhatsApp atau Telegram Bot) di Portal Admin.' };
  }

  // Otomatis sinkronkan siswa yang baru menekan /start di Bot Telegram sebelum mengirim
  if (useTgDm) {
    try { syncTelegramStudentsFromUpdates(cfg, ''); } catch (e) { /* ignore */ }
  }

  const todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  const todayMs = parseYmdToUtcMs(todayStr);

  const profiles = fetchSupabaseRest('profiles?select=id,full_name,username,class_name,sub_concentration,role,mentor_id,whatsapp_number');
  const tasks = fetchSupabaseRest('project_tasks?select=id,title,pipeline_stage,sub_concentration,due_date');
  const subs = fetchSupabaseRest('project_submissions?select=project_task_id,student_id,status');
  let checklistColsMap = {};
  const checklistRowMap = {};
  try {
    const colsRows = fetchSupabaseRest('app_settings?select=value&key=eq.proj_checklist_cols');
    if (colsRows && colsRows.length && colsRows[0].value) checklistColsMap = JSON.parse(colsRows[0].value) || {};
  } catch (e) { /* ignore */ }
  try {
    const ckRows = fetchSupabaseRest('app_settings?select=key,value&key=like.proj_checklist_row::*');
    ckRows.forEach(function (r) {
      try {
        const p = JSON.parse(r.value || '{}');
        const sid = p.student_id || String(r.key || '').replace('proj_checklist_row::', '');
        if (sid) checklistRowMap[sid] = p;
      } catch (e) { /* ignore */ }
    });
  } catch (e) { /* ignore */ }
  const studentTgMap = {};
  if (useTgDm) {
    try {
      const tgRows = fetchSupabaseRest('app_settings?select=key,value&key=like.student_telegram::*');
      tgRows.forEach(function (r) {
        try {
          const parsed = JSON.parse(r.value || '{}');
          if (parsed && parsed.student_id && parsed.chat_id) studentTgMap[parsed.student_id] = parsed;
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  }

  const mentorMap = {};
  const students = [];
  profiles.forEach(function (p) {
    if (p.role === 'mentor' || p.role === 'superadmin') mentorMap[p.id] = p;
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
  let tgDmSentCount = 0;
  let tgDmFailedCount = 0;
  let skippedNoTg = 0;
  let tgSentCount = 0;
  let tgFailedCount = 0;
  let dummyWaSentAlready = false;
  const isDummyWa = Boolean(cfg.waDummyMode);
  const dummyWaTarget = normalizeWaPhoneGas(cfg.waTestPhone || '081259699623');
  const tgBuckets = {}; // chatId -> array of student digest lines

  students.forEach(function (s) {
    const overdueList = [];
    const upcomingList = [];

    tasks.forEach(function (t) {
      if (!t.due_date) return;
      if (t.sub_concentration && s.sub_concentration !== t.sub_concentration) return;

      const ps = subMap[`${t.id}__${s.id}`];
      const st = ps ? ps.status : 'belum_mulai';
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

    const mentor = s.mentor_id ? mentorMap[s.mentor_id] : null;
    const summaryTitles = overdueList.map(function (x) { return `[Telat ${x.lateDays}h] ${x.title}`; })
      .concat(upcomingList.map(function (x) { return `[${x.diffDays === 0 ? 'Hari Ini' : `H-${x.diffDays}`}] ${x.title}`; }))
      .join('; ');

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

    const projectUpdateBlock = formatProjectUpdateBlockGas(s, checklistColsMap, checklistRowMap);

    const messageText = renderWaTemplateGas(cfg.messageTemplate || '', {
      nama: s.full_name || 'Siswa',
      kelas: s.class_name || 'Siswa Animasi',
      subkonsentrasi: s.sub_concentration || 'Animasi',
      daftar_tugas: combinedTasks,
      tugas_terlambat: overdueBlock,
      tugas_mendekati: upcomingBlock,
      project_update: projectUpdateBlock,
      pembimbing: mentorLine,
      link_anitrack: appUrlLine
    });

    const reminderType = (overdueList.length && upcomingList.length)
      ? 'mixed'
      : (overdueList.length ? 'overdue' : 'h_minus_2');

    // 1. Kumpulkan untuk rekap Grup Telegram (opsional)
    if (useTgGroup) {
      const clsKey = String(s.class_name || '').trim();
      const targetChat = String(classChatMap[clsKey] || cfg.tgChatId || '').trim();
      if (targetChat) {
        if (!tgBuckets[targetChat]) tgBuckets[targetChat] = { label: classChatMap[clsKey] ? clsKey : 'Semua Kelas', entries: [] };
        const badge = overdueList.length ? '🔴' : '🟡';
        tgBuckets[targetChat].entries.push(
          `${badge} ${s.full_name} (${s.class_name || '-'} • ${s.sub_concentration || 'Umum'})\n   ${summaryTitles}`
        );
      }
    }

    // 2. Kirim DM Pribadi ke Akun Telegram Siswa (mirip WA)
    if (useTgDm) {
      const tgRec = studentTgMap[s.id];
      if (!tgRec || !tgRec.chat_id) {
        skippedNoTg++;
      } else {
        const cleanTgMsg = messageText.replace(/\*([^*\n]+)\*/g, '$1').replace(/_([^_\n]+)_/g, '$1');
        const dmRes = sendTelegramMessageGas(cfg.tgBotToken, tgRec.chat_id, cleanTgMsg);
        if (dmRes.ok) tgDmSentCount++;
        else tgDmFailedCount++;
        insertWaLogToSupabase({
          sent_date: todayStr,
          student_id: s.id,
          student_name: s.full_name,
          whatsapp_number: tgRec.username ? `@${tgRec.username}` : `TG:${tgRec.chat_id}`,
          reminder_type: `${reminderType}_tg`,
          task_summary: summaryTitles.slice(0, 400),
          provider: 'telegram_dm',
          status: dmRes.ok ? 'sent' : 'failed',
          response_detail: dmRes.detail
        });
        Utilities.sleep(350);
      }
    }

    // 3. Kirim WA personal jika kanal WA aktif (jika Mode Dummy aktif, hanya kirim 1 sampel ke nomor tes agar tidak spam siswa asli)
    if (useWa) {
      if (isDummyWa) {
        if (!dummyWaSentAlready && dummyWaTarget) {
          dummyWaSentAlready = true;
          const dummyMsg = `🧪 *[MODE PERCOBAAN DUMMY WA]*\n_(Dialihkan ke nomor tes — tidak dikirim ke siswa asli)_\n\n${messageText}`;
          const sendRes = sendWaMessageViaGateway(cfg, dummyWaTarget, dummyMsg);
          if (sendRes.ok) sentCount++;
          else failedCount++;
          insertWaLogToSupabase({
            sent_date: todayStr,
            student_id: s.id,
            student_name: `[DUMMY] ${s.full_name}`,
            whatsapp_number: dummyWaTarget,
            reminder_type: `${reminderType}_dummy`,
            task_summary: summaryTitles.slice(0, 400),
            provider: cfg.provider || 'fonnte',
            status: sendRes.ok ? 'sent' : 'failed',
            response_detail: sendRes.detail
          });
        }
      } else {
        const phone = normalizeWaPhoneGas(s.whatsapp_number);
        if (!phone) {
          skippedNoWa++;
        } else {
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
        }
      }
    }
  });

  // Kirim Rekap Harian Grup Telegram (opsional jika Chat ID Grup diisi)
  if (useTgGroup) {
    Object.keys(tgBuckets).forEach(function (chatId) {
      const bucket = tgBuckets[chatId];
      if (!bucket.entries.length) return;
      const header = `🔔 PENGINGAT DEADLINE ANITRACK — SMKN 4 MALANG\n📅 Tanggal: ${todayStr} (${bucket.label})\nTotal: ${bucket.entries.length} siswa perlu segera lapor selesai:\n\n`;
      const footer = `\n\n📌 Segera upload file ke Folder Drive Project lalu klik Lapor Selesai + bukti di AniTrack.${cfg.appUrl ? `\n🔗 ${cfg.appUrl}` : ''}`;
      const tgText = header + bucket.entries.join('\n\n') + footer;
      const tgRes = sendTelegramMessageGas(cfg.tgBotToken, chatId, tgText);
      if (tgRes.ok) tgSentCount++;
      else tgFailedCount++;

      insertWaLogToSupabase({
        sent_date: todayStr,
        student_id: null,
        student_name: `TELEGRAM GRUP (${bucket.label})`,
        whatsapp_number: `TG:${chatId}`,
        reminder_type: 'telegram_digest',
        task_summary: `${bucket.entries.length} siswa diingatkan via Grup Telegram`,
        provider: 'telegram',
        status: tgRes.ok ? 'sent' : 'failed',
        response_detail: tgRes.detail
      });
      Utilities.sleep(500);
    });
  }

  return {
    ok: true,
    sentDate: todayStr,
    eligibleStudents: eligibleStudents,
    sentCount: sentCount,
    failedCount: failedCount,
    skippedNoWa: skippedNoWa,
    tgDmSentCount: tgDmSentCount,
    tgDmFailedCount: tgDmFailedCount,
    skippedNoTg: skippedNoTg,
    tgSentCount: tgSentCount,
    tgFailedCount: tgFailedCount
  };
}
