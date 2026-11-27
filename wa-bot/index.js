/**
 * AniTrack — WhatsApp Bot Pengingat Deadline Otomatis (Jam 07:00 WIB)
 * Jalan langsung di PC Windows (tanpa Docker, gratis Rp 0, tanpa watermark)
 * Panel Web Lokal (Scan QR + Tes Kirim): http://127.0.0.1:3001
 *
 * Aturan Pengiriman Otomatis (Setiap Hari Pukul 07:00 WIB):
 *  1. H-2, H-1, dan Hari-H deadline -> kirim WA pengingat ke siswa.
 *  2. Melebihi deadline & belum lapor selesai (status bukan 'menunggu_review' / 'selesai')
 *     -> kirim WA setiap hari pukul 07:00 WIB sampai siswa melapor selesai.
 *  3. Otomatis mengikuti pengaturan Dashboard Admin AniTrack (Template Custom,
 *     {project_update}, Mode Percobaan Dummy + Nomor WA Tes, & status aktif WA).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const pino = require('pino');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const PORT = Number(process.env.PORT || 3001);
const WA_API_SECRET = (process.env.WA_API_SECRET || '').trim();
const APP_URL = (process.env.APP_URL || 'https://anitrack.republikanimasi.my.id').trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://izgcmhsobexicceqklqm.supabase.co').trim();
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || 'sb_publishable_T9eODcUv7nRBYgN-F24aRg_w-QOzKVu').trim();
const CRON_SCHEDULE = (process.env.CRON_SCHEDULE || '0 7 * * *').trim();
// Mode Ekstra Aman (Anti-Ban Ketat):
// - Simulasi mengetik 2-4 detik sebelum kirim
// - Jeda acak 25-45 detik antar siswa
// - Istirahat (cooldown) 3 menit setiap 10 pesan
const TYPING_MIN_MS = Math.max(1000, Number(process.env.TYPING_MIN_MS || 2000));
const TYPING_MAX_MS = Math.max(TYPING_MIN_MS, Number(process.env.TYPING_MAX_MS || 4000));
const SEND_DELAY_MIN_MS = Math.max(5000, Number(process.env.SEND_DELAY_MIN_MS || 25000));
const SEND_DELAY_MAX_MS = Math.max(SEND_DELAY_MIN_MS, Number(process.env.SEND_DELAY_MAX_MS || 45000));
const COOLDOWN_EVERY = Math.max(1, Number(process.env.COOLDOWN_EVERY || 10));
const COOLDOWN_MS = Math.max(15000, Number(process.env.COOLDOWN_MS || 180000));
const AUTO_REPLY_ENABLED = String(process.env.AUTO_REPLY_ENABLED ?? 'true').toLowerCase() !== 'false';
const AUTO_REPLY_COOLDOWN_MS = Math.max(3000, Number(process.env.AUTO_REPLY_COOLDOWN_MS || 6000));
const PANEL_ENABLED = String(process.env.PANEL_ENABLED ?? 'true').toLowerCase() !== 'false';
const PANEL_USER = (process.env.PANEL_USER || 'hargunt').trim();
const PANEL_PASSWORD = (process.env.PANEL_PASSWORD || 'anitrack2026').trim();
const AUTH_DIR = path.join(__dirname, 'auth_info');
const PID_FILE = path.join(__dirname, '.bot.pid');

const lastAutoReplyAt = new Map(); // senderKey -> timestamp ms

function randBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

let sock = null;
let waStatus = 'starting'; // starting | qr | open | close | logged_out
let connectedPhone = null;
let latestQrDataUrl = null;
let lastRunSummary = null;
let isRunningJob = false;
let reconnectTimer = null;
const recentLogs = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function addLog(msg, level = 'info') {
  const time = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date());
  const entry = { time, level, msg: String(msg) };
  recentLogs.unshift(entry);
  if (recentLogs.length > 40) recentLogs.pop();
  if (level === 'error') console.error(`[${time}] ${msg}`);
  else console.log(`[${time}] ${msg}`);
}

function normalizeWaPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return /^628\d{7,12}$/.test(digits) ? digits : '';
}

function formatWaLocal(wa) {
  const clean = normalizeWaPhone(wa);
  if (!clean) return '-';
  return '0' + clean.slice(2);
}

function getTodayJakartaYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function parseYmdToUtcMs(ymd) {
  if (!ymd) return null;
  const parts = String(ymd).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

async function fetchSupabase(endpoint) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`Supabase GET ${endpoint} gagal (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

let cachedWaCfg = null;
let cachedWaCfgAt = 0;

async function fetchWaGatewayConfig(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && cachedWaCfg && (now - cachedWaCfgAt) < 15000) {
    return cachedWaCfg;
  }
  try {
    const rows = await fetchSupabase('app_settings?select=value&key=eq.wa_gateway_config');
    if (rows && rows.length && rows[0].value) {
      cachedWaCfg = JSON.parse(rows[0].value) || {};
      cachedWaCfgAt = now;
      return cachedWaCfg;
    }
  } catch (err) {
    addLog(`Gagal baca wa_gateway_config: ${err.message}`, 'error');
  }
  return cachedWaCfg || {};
}

async function insertWaLog(entry) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wa_notification_logs`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(entry)
    });
  } catch (err) {
    addLog(`Gagal mencatat log ke Supabase: ${err.message}`, 'error');
  }
}

async function sendWhatsAppMessage(rawPhone, text, withTyping = true) {
  if (!sock || waStatus !== 'open') {
    throw new Error(`WhatsApp belum terhubung (status: ${waStatus}). Scan QR di http://127.0.0.1:${PORT} terlebih dahulu.`);
  }
  const phone = normalizeWaPhone(rawPhone);
  if (!phone) throw new Error(`Nomor WA tidak valid: ${rawPhone}`);
  const jid = `${phone}@s.whatsapp.net`;
  if (withTyping) {
    try {
      await sock.presenceSubscribe(jid).catch(() => {});
      await sock.sendPresenceUpdate('composing', jid).catch(() => {});
      await sleep(randBetween(TYPING_MIN_MS, TYPING_MAX_MS));
      await sock.sendPresenceUpdate('paused', jid).catch(() => {});
    } catch { /* ignore presence errors */ }
  }
  await sock.sendMessage(jid, { text: String(text || '') });
  return phone;
}

const DEFAULT_WA_TEMPLATE = [
  'Halo *{nama}* ({kelas}),',
  'Pengingat Project Tracker *AniTrack — SMKN 4 Malang*:',
  '',
  '{daftar_tugas}',
  '{project_update}',
  '📌 Segera upload file (sesuai contoh penamaan) ke Folder Google Drive Project kamu, lalu klik Laporkan Tugas Selesai di AniTrack.',
  '{pembimbing}',
  '{link_anitrack}'
].join('\n');

const DEFAULT_CHECKLIST_COLS = ['Compose & Audio Video', 'Grading', 'Final Film + Credit Title'];

function normalizeChecklistStatus(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'done' || v === 'selesai' || v === 'acc') return 'done';
  if (v === 'revisi' || v === 'revision') return 'revisi';
  if (v === 'wip' || v === 'proses' || v === 'in progress' || v === 'sedang_dikerjakan') return 'wip';
  return 'none';
}

function formatProjectUpdateBlock(student, colsMap, rowMap) {
  if (!student) return '';
  const sc = student.sub_concentration || '';
  const cols = (sc && Array.isArray(colsMap[sc]) && colsMap[sc].length) ? colsMap[sc] : DEFAULT_CHECKLIST_COLS;
  const rd = rowMap[student.id] || { items: {}, notes: '' };
  const labelMap = { none: 'None', wip: 'WIP', revisi: 'Revisi', done: 'Done' };
  let doneCnt = 0;
  cols.forEach((c) => {
    if (normalizeChecklistStatus(rd.items && rd.items[c]) === 'done') doneCnt++;
  });
  const pct = cols.length ? Math.round((doneCnt / cols.length) * 100) : 0;
  const lines = [`📊 *PROJECT UPDATE (${sc || 'Animasi'} — ${doneCnt}/${cols.length} Done • ${pct}%):*`];
  cols.forEach((c) => {
    const st = normalizeChecklistStatus(rd.items && rd.items[c]);
    const icon = st === 'done' ? '✅' : (st === 'revisi' ? '🔴' : (st === 'wip' ? '🟡' : '⚪'));
    lines.push(`${icon} ${c}: *${labelMap[st] || 'None'}*`);
  });
  if (rd.notes && String(rd.notes).trim()) {
    lines.push(`📝 Notes PJ Subkon: _${String(rd.notes).trim()}_`);
  }
  return lines.join('\n');
}

function renderWaTemplateBot(template, vars) {
  const raw = (template && String(template).trim()) ? String(template) : DEFAULT_WA_TEMPLATE;
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
  let rendered = raw.replace(
    /\{(nama|kelas|subkonsentrasi|daftar_tugas|tugas_terlambat|tugas_mendekati|project_update|pembimbing|link_anitrack)\}/gi,
    (_, k) => map[String(k).toLowerCase()] ?? ''
  );
  const autoExtra = [];
  if (!hasTaskToken && map.daftar_tugas && map.daftar_tugas !== '-') autoExtra.push(map.daftar_tugas);
  if (!hasProjectUpdateToken && map.project_update) autoExtra.push(map.project_update);
  if (!hasMentorToken && map.pembimbing) autoExtra.push(map.pembimbing);
  if (!hasLinkToken && map.link_anitrack) autoExtra.push(map.link_anitrack);
  if (autoExtra.length) rendered = `${rendered.trim()}\n\n${autoExtra.join('\n')}`;
  return rendered.replace(/\n{3,}/g, '\n\n').trim();
}

async function runDeadlineReminderJob(source = 'cron', options = {}) {
  if (isRunningJob) {
    return { ok: false, error: 'Proses pengiriman pengingat deadline masih berjalan.' };
  }
  if (!sock || waStatus !== 'open') {
    return { ok: false, error: `WhatsApp belum terhubung (status: ${waStatus}). Scan QR dulu di http://127.0.0.1:${PORT}` };
  }

  isRunningJob = true;
  const todayStr = getTodayJakartaYmd();
  const todayMs = parseYmdToUtcMs(todayStr);
  addLog(`Memulai pengecekan deadline (${source}) — tanggal WIB: ${todayStr}`);

  let eligibleStudents = 0;
  let sentCount = 0;
  let failedCount = 0;
  let skippedNoWa = 0;
  let dummySentAlready = false;

  try {
    const [profiles, tasks, subs, waCfg, colsRows, ckRows] = await Promise.all([
      fetchSupabase('profiles?select=id,full_name,username,class_name,sub_concentration,role,mentor_id,whatsapp_number'),
      fetchSupabase('project_tasks?select=id,title,pipeline_stage,sub_concentration,due_date'),
      fetchSupabase('project_submissions?select=project_task_id,student_id,status'),
      fetchWaGatewayConfig(),
      fetchSupabase('app_settings?select=value&key=eq.proj_checklist_cols').catch(() => []),
      fetchSupabase('app_settings?select=key,value&key=like.proj_checklist_row::*').catch(() => [])
    ]);

    // Jika dijalankan oleh cron otomatis dan kanal WA dimatikan di Dashboard Admin, lewati
    if (source === 'cron_07_wib' && waCfg.waEnabled === false) {
      addLog('Kanal WhatsApp sedang dinonaktifkan di Dashboard Admin. Jadwal dilewati.');
      return { ok: true, skipped: true, message: 'Kanal WhatsApp dinonaktifkan di Dashboard Admin.' };
    }

    let checklistColsMap = {};
    if (colsRows && colsRows.length && colsRows[0].value) {
      try { checklistColsMap = JSON.parse(colsRows[0].value) || {}; } catch { /* ignore */ }
    }
    const checklistRowMap = {};
    (ckRows || []).forEach((r) => {
      try {
        const p = JSON.parse(r.value || '{}');
        const sid = p.student_id || String(r.key || '').replace('proj_checklist_row::', '');
        if (sid) checklistRowMap[sid] = p;
      } catch { /* ignore */ }
    });

    const effectiveAppUrl = (waCfg.appUrl || APP_URL || '').trim();
    const messageTemplate = (waCfg.messageTemplate || '').trim();
    const isDummyMode = options.forceReal ? false : Boolean(waCfg.waDummyMode);
    const dummyTargetPhone = normalizeWaPhone(options.dummyPhone || waCfg.waTestPhone || '081259699623');

    if (isDummyMode) {
      addLog(`Mode Percobaan Dummy AKTIF -> WA hanya dikirim 1 contoh ke ${formatWaLocal(dummyTargetPhone)} (tidak ke siswa asli).`);
    }

    const mentorMap = {};
    const students = [];
    for (const p of profiles) {
      if (p.role === 'mentor' || p.role === 'superadmin') mentorMap[p.id] = p;
      else if (p.role === 'student') students.push(p);
    }

    const subMap = {};
    for (const ps of subs) {
      subMap[`${ps.project_task_id}__${ps.student_id}`] = ps;
    }

    for (const s of students) {
      const overdueList = [];
      const upcomingList = [];

      for (const t of tasks) {
        if (!t.due_date) continue;
        if (t.sub_concentration && s.sub_concentration !== t.sub_concentration) continue;

        const ps = subMap[`${t.id}__${s.id}`];
        const st = ps ? ps.status : 'belum_mulai';
        if (st === 'selesai' || st === 'menunggu_review') continue;

        const dueMs = parseYmdToUtcMs(t.due_date);
        if (dueMs === null) continue;
        const diffDays = Math.round((dueMs - todayMs) / 86400000);

        if (diffDays < 0) {
          overdueList.push({
            title: t.title,
            dueDate: String(t.due_date).slice(0, 10),
            lateDays: Math.abs(diffDays),
            status: st
          });
        } else if (diffDays <= 2) {
          upcomingList.push({
            title: t.title,
            dueDate: String(t.due_date).slice(0, 10),
            diffDays,
            status: st
          });
        }
      }

      if (!overdueList.length && !upcomingList.length) continue;
      eligibleStudents++;

      if (isDummyMode && dummySentAlready) continue;

      const phone = isDummyMode ? dummyTargetPhone : normalizeWaPhone(s.whatsapp_number);
      if (!phone) {
        skippedNoWa++;
        continue;
      }

      const mentor = s.mentor_id ? mentorMap[s.mentor_id] : null;
      const overdueLines = [];
      if (overdueList.length) {
        overdueLines.push('🔴 *MELEBIHI DEADLINE (Belum Lapor Selesai):*');
        overdueList.forEach((item, idx) => {
          const revTag = item.status === 'revisi' ? ' [Revisi]' : '';
          overdueLines.push(`${idx + 1}. *${item.title}*${revTag} — Terlambat *${item.lateDays} hari* (Deadline: ${item.dueDate})`);
        });
        overdueLines.push('_Notifikasi ini akan terus dikirim setiap hari pukul 07:00 WIB sampai kamu melapor selesai di AniTrack._');
      }

      const upcomingLines = [];
      if (upcomingList.length) {
        upcomingLines.push('🟡 *MENDEKATI DEADLINE:*');
        upcomingList.forEach((item, idx) => {
          const whenLabel = item.diffDays === 0 ? 'HARI INI' : (item.diffDays === 1 ? 'Besok (H-1)' : '2 Hari Lagi (H-2)');
          const revTag = item.status === 'revisi' ? ' [Revisi]' : '';
          upcomingLines.push(`${idx + 1}. *${item.title}*${revTag} — *${whenLabel}* (${item.dueDate})`);
        });
      }

      const overdueBlock = overdueLines.join('\n');
      const upcomingBlock = upcomingLines.join('\n');
      const combinedTasks = [overdueBlock, upcomingBlock].filter(Boolean).join('\n\n');
      const projectUpdateBlock = formatProjectUpdateBlock(s, checklistColsMap, checklistRowMap);
      const mentorLine = mentor
        ? `👨‍🏫 Pembimbing: *${mentor.full_name}*${formatWaLocal(mentor.whatsapp_number) !== '-' ? ` (WA: ${formatWaLocal(mentor.whatsapp_number)})` : ''}`
        : '';
      const appUrlLine = effectiveAppUrl ? `🔗 Buka AniTrack: ${effectiveAppUrl}` : '';

      let messageText = renderWaTemplateBot(messageTemplate, {
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

      if (isDummyMode) {
        messageText = `🧪 *[MODE PERCOBAAN DUMMY — Contoh untuk ${s.full_name}]*\n_(Mode Dummy aktif di Admin AniTrack sehingga siswa asli belum dikirimi pesan)_\n\n${messageText}`;
      } else {
        // Variasi ringan unik per siswa agar payload tidak identik 100%
        const refCode = `${todayStr.replace(/-/g, '')}-${String(sentCount + 1).padStart(3, '0')}`;
        messageText = `${messageText}\n\n_Ref: #${refCode}_`;
      }

      const reminderType = isDummyMode
        ? 'dummy_test'
        : ((overdueList.length && upcomingList.length) ? 'mixed' : (overdueList.length ? 'overdue' : 'h_minus_2'));
      const taskSummary = [
        ...overdueList.map((x) => `[Telat ${x.lateDays}h] ${x.title}`),
        ...upcomingList.map((x) => `[H-${x.diffDays}] ${x.title}`)
      ].join('; ').slice(0, 400);

      try {
        await sendWhatsAppMessage(phone, messageText);
        sentCount++;
        if (isDummyMode) dummySentAlready = true;
        addLog(`[TERKIRIM] ${isDummyMode ? 'DUMMY -> ' : ''}${s.full_name} (${formatWaLocal(phone)}) — ${reminderType}`);
        await insertWaLog({
          sent_date: todayStr,
          student_id: isDummyMode ? null : s.id,
          student_name: isDummyMode ? `DUMMY (${s.full_name})` : s.full_name,
          whatsapp_number: phone,
          reminder_type: reminderType,
          task_summary: taskSummary,
          provider: 'local_pc_baileys',
          status: 'sent',
          response_detail: `OK (${source})`
        });
      } catch (err) {
        failedCount++;
        addLog(`[GAGAL] ${s.full_name} (${phone}): ${err.message}`, 'error');
        await insertWaLog({
          sent_date: todayStr,
          student_id: isDummyMode ? null : s.id,
          student_name: isDummyMode ? `DUMMY (${s.full_name})` : s.full_name,
          whatsapp_number: phone,
          reminder_type: reminderType,
          task_summary: taskSummary,
          provider: 'local_pc_baileys',
          status: 'failed',
          response_detail: err.message
        });
      }

      if (!isDummyMode) {
        // Mode Ekstra Aman: cooldown 3 menit tiap 10 pesan + jeda acak 25-45 detik antar siswa
        if (sentCount > 0 && sentCount % COOLDOWN_EVERY === 0) {
          const coolSec = Math.round(COOLDOWN_MS / 1000);
          addLog(`☕ Istirahat Anti-Ban ${Math.round(coolSec / 60)} menit (${coolSec} dtk) setelah ${sentCount} pesan terkirim...`);
          await sleep(COOLDOWN_MS);
        } else {
          const waitMs = randBetween(SEND_DELAY_MIN_MS, SEND_DELAY_MAX_MS);
          addLog(`⏳ Jeda ekstra aman ${Math.round(waitMs / 1000)} detik sebelum siswa berikutnya...`);
          await sleep(waitMs);
        }
      }
    }

    const result = {
      ok: true,
      sentDate: todayStr,
      dummyMode: isDummyMode,
      eligibleStudents,
      sentCount,
      failedCount,
      skippedNoWa
    };
    lastRunSummary = { ...result, at: new Date().toISOString(), source };
    addLog(`Selesai (${source}): ${sentCount} terkirim, ${failedCount} gagal, ${skippedNoWa} tanpa WA (dari ${eligibleStudents} siswa memenuhi syarat).`);
    return result;
  } catch (err) {
    addLog(`Error job pengingat deadline: ${err.message}`, 'error');
    return { ok: false, error: err.message };
  } finally {
    isRunningJob = false;
  }
}

async function sendToJidWithTyping(jid, text, withTyping = true) {
  if (!sock || waStatus !== 'open') {
    throw new Error(`WhatsApp belum terhubung (status: ${waStatus}).`);
  }
  if (withTyping) {
    try {
      await sock.presenceSubscribe(jid).catch(() => {});
      await sock.sendPresenceUpdate('composing', jid).catch(() => {});
      await sleep(randBetween(TYPING_MIN_MS, TYPING_MAX_MS));
      await sock.sendPresenceUpdate('paused', jid).catch(() => {});
    } catch { /* ignore presence errors */ }
  }
  await sock.sendMessage(jid, { text: String(text || '') });
}

function extractIncomingText(msg) {
  const m = msg?.message;
  if (!m) return '';
  if (typeof m.conversation === 'string') return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return m.imageMessage.caption;
  if (m.videoMessage?.caption) return m.videoMessage.caption;
  if (m.ephemeralMessage?.message) return extractIncomingText({ message: m.ephemeralMessage.message });
  if (m.viewOnceMessage?.message) return extractIncomingText({ message: m.viewOnceMessage.message });
  return '';
}

function buildAutoReplyMenuText(waCfg = {}) {
  const baseUrl = (waCfg.appUrl || APP_URL || 'https://anitrack.republikanimasi.my.id').trim().replace(/\/+$/, '');
  const pantauUrl = `${baseUrl}/pantau.html`;
  const customTpl = String(waCfg.autoReplyMenuTemplate || '').trim();
  if (customTpl) {
    return customTpl
      .replace(/\{link_anitrack\}/gi, baseUrl)
      .replace(/\{link_pantau\}/gi, pantauUrl);
  }
  return [
    '🤖 *AniTrack — SMKN 4 Malang (Balas Otomatis)*',
    '',
    'Ketik salah satu kata kunci berikut:',
    '• *cek* — Cek progres & deadline akun kamu (otomatis dari nomor WA terdaftar)',
    '• *cek <nama/username>* — Cek progres siswa tertentu *(cocok untuk Orang Tua/Wali, contoh: `cek zahira`)*',
    '• *tugas* — Lihat daftar tugas & deadline terdekat kamu',
    '• *menu* — Tampilkan daftar perintah ini',
    '',
    `🌐 Portal Siswa: ${baseUrl}`,
    `👨‍👩‍👧 Portal Pantau Ortu: ${pantauUrl}`
  ].join('\n');
}

async function buildStudentProgressReply(student, allProfiles, tasks, subs, colsMap, rowMap, mode = 'all', waCfg = {}) {
  const todayStr = getTodayJakartaYmd();
  const todayMs = parseYmdToUtcMs(todayStr);
  const mentor = student.mentor_id ? allProfiles.find((p) => p.id === student.mentor_id) : null;
  const subMap = {};
  subs.forEach((ps) => {
    if (ps.student_id === student.id) subMap[ps.project_task_id] = ps;
  });

  const eligibleTasks = tasks.filter((t) => !t.sub_concentration || t.sub_concentration === student.sub_concentration);
  let accCount = 0;
  let reviewCount = 0;
  let revisiCount = 0;
  const overdueItems = [];
  const upcomingItems = [];

  eligibleTasks.forEach((t) => {
    const ps = subMap[t.id];
    const st = ps ? ps.status : 'belum_mulai';
    if (st === 'selesai') { accCount++; return; }
    if (st === 'menunggu_review') { reviewCount++; return; }
    if (st === 'revisi') revisiCount++;
    if (!t.due_date) return;
    const dueMs = parseYmdToUtcMs(t.due_date);
    if (dueMs === null) return;
    const diffDays = Math.round((dueMs - todayMs) / 86400000);
    if (diffDays < 0) {
      overdueItems.push({ title: t.title, dueDate: String(t.due_date).slice(0, 10), lateDays: Math.abs(diffDays), status: st });
    } else {
      upcomingItems.push({ title: t.title, dueDate: String(t.due_date).slice(0, 10), diffDays, status: st });
    }
  });

  overdueItems.sort((a, b) => b.lateDays - a.lateDays);
  upcomingItems.sort((a, b) => a.diffDays - b.diffDays);

  const lines = [
    `📌 *UPDATE PROGRES ANITRACK*`,
    `👤 *${student.full_name}* (@${student.username})`,
    `🏫 ${student.class_name || '-'} • ${student.sub_concentration || 'Belum pilih subkon'}`,
    mentor ? `👨‍🏫 Pembimbing: *${mentor.full_name}*${formatWaLocal(mentor.whatsapp_number) !== '-' ? ` (${formatWaLocal(mentor.whatsapp_number)})` : ''}` : '',
    ''
  ].filter((x) => x !== '');

  if (mode !== 'tasks_only') {
    lines.push(formatProjectUpdateBlock(student, colsMap, rowMap));
    lines.push('');
  }

  lines.push(`📋 *RINGKASAN PROJECT TRACKER:*`);
  lines.push(`• Tuntas (ACC): *${accCount}/${eligibleTasks.length}* tugas`);
  if (reviewCount) lines.push(`• Menunggu Review Guru: *${reviewCount}*`);
  if (revisiCount) lines.push(`• Perlu Revisi: *${revisiCount}*`);

  if (overdueItems.length) {
    lines.push('');
    lines.push('🔴 *MELEBIHI DEADLINE:*');
    overdueItems.slice(0, 5).forEach((item, i) => {
      const rev = item.status === 'revisi' ? ' [Revisi]' : '';
      lines.push(`${i + 1}. ${item.title}${rev} — *Telat ${item.lateDays} hari* (${item.dueDate})`);
    });
    if (overdueItems.length > 5) lines.push(`_...dan ${overdueItems.length - 5} tugas terlambat lainnya._`);
  }

  if (upcomingItems.length) {
    lines.push('');
    lines.push('🟡 *DEADLINE TERDEKAT:*');
    upcomingItems.slice(0, 4).forEach((item, i) => {
      const when = item.diffDays === 0 ? 'HARI INI' : (item.diffDays === 1 ? 'Besok' : `H-${item.diffDays}`);
      const rev = item.status === 'revisi' ? ' [Revisi]' : '';
      lines.push(`${i + 1}. ${item.title}${rev} — *${when}* (${item.dueDate})`);
    });
  }

  if (!overdueItems.length && !upcomingItems.length && eligibleTasks.length > 0 && accCount === eligibleTasks.length) {
    lines.push('');
    lines.push('🎉 *Luar biasa!* Semua tugas project sudah tuntas (ACC).');
  }

  const customFooter = String(waCfg.autoReplyCekFooter || '').trim();
  if (customFooter) {
    lines.push('');
    lines.push(customFooter);
  }

  lines.push('');
  lines.push(`🔗 Portal AniTrack: ${(waCfg.appUrl || APP_URL || '').trim()}`);
  return lines.join('\n');
}

async function handleIncomingAutoReply(msg) {
  if (!AUTO_REPLY_ENABLED) return;
  if (!msg || !msg.key || msg.key.fromMe) return;

  const remoteJid = String(msg.key.remoteJid || '');
  // HANYA balas chat pribadi (jangan pernah balas di grup @g.us atau status@broadcast)
  if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast' || remoteJid.endsWith('@newsletter')) return;

  const rawText = extractIncomingText(msg).trim();
  if (!rawText || rawText.length > 120) return;

  const lower = rawText.toLowerCase().replace(/\s+/g, ' ');
  const isMenuCmd = /^(menu|bantu|help|info|halo|hai|hi|mulai|start)$/i.test(lower);
  const isSiapCmd = /^(siap|oke|ok|hadir|tersimpan)$/i.test(lower);
  const cekMatch = lower.match(/^(cek|progres|progress|status|pantau|tugas|deadline)(?:\s+(.+))?$/i);
  if (!isMenuCmd && !isSiapCmd && !cekMatch) return;

  // Anti-spam rate limit per pengirim
  const now = Date.now();
  const prevAt = lastAutoReplyAt.get(remoteJid) || 0;
  if (now - prevAt < AUTO_REPLY_COOLDOWN_MS) return;
  lastAutoReplyAt.set(remoteJid, now);

  // Ambil nomor pengirim dari remoteJid atau remoteJidAlt (untuk dukungan LID Baileys)
  const altJid = String(msg.key.remoteJidAlt || '');
  const phoneSource = remoteJid.endsWith('@s.whatsapp.net')
    ? remoteJid.split('@')[0]
    : (altJid.endsWith('@s.whatsapp.net') ? altJid.split('@')[0] : '');
  const senderPhone = normalizeWaPhone(phoneSource);

  try {
    const waCfg = await fetchWaGatewayConfig();
    if (waCfg.autoReplyEnabled === false) return;

    if (isMenuCmd) {
      await sendToJidWithTyping(remoteJid, buildAutoReplyMenuText(waCfg), true);
      addLog(`[AUTO-REPLY] "${rawText}" -> kirim menu ke ${senderPhone ? formatWaLocal(senderPhone) : remoteJid}`);
      return;
    }

    if (isSiapCmd) {
      const siapReply = String(waCfg.autoReplySiapTemplate || '').trim() ||
        '✅ Terima kasih! Nomor kamu sudah terhubung dengan *AniTrack SMKN 4 Malang*.\n\nKapan saja ingin melihat progres project & deadline, cukup ketik *cek* atau *menu*.';
      await sendToJidWithTyping(remoteJid, siapReply, true);
      addLog(`[AUTO-REPLY] "${rawText}" -> konfirmasi siap ke ${senderPhone ? formatWaLocal(senderPhone) : remoteJid}`);
      return;
    }

    const cmd = cekMatch[1].toLowerCase();
    const queryRaw = (cekMatch[2] || '').trim();
    const mode = (cmd === 'tugas' || cmd === 'deadline') ? 'tasks_only' : 'all';

    const [profiles, tasks, subs, colsRows, ckRows] = await Promise.all([
      fetchSupabase('profiles?select=id,full_name,username,class_name,sub_concentration,role,mentor_id,whatsapp_number'),
      fetchSupabase('project_tasks?select=id,title,pipeline_stage,sub_concentration,due_date'),
      fetchSupabase('project_submissions?select=project_task_id,student_id,status'),
      fetchSupabase('app_settings?select=value&key=eq.proj_checklist_cols').catch(() => []),
      fetchSupabase('app_settings?select=key,value&key=like.proj_checklist_row::*').catch(() => [])
    ]);

    const students = profiles.filter((p) => p.role === 'student');
    let colsMap = {};
    if (colsRows && colsRows.length && colsRows[0].value) {
      try { colsMap = JSON.parse(colsRows[0].value) || {}; } catch { /* ignore */ }
    }
    const rowMap = {};
    (ckRows || []).forEach((r) => {
      try {
        const p = JSON.parse(r.value || '{}');
        const sid = p.student_id || String(r.key || '').replace('proj_checklist_row::', '');
        if (sid) rowMap[sid] = p;
      } catch { /* ignore */ }
    });

    let matchedStudent = null;
    if (!queryRaw) {
      // Cari otomatis berdasarkan nomor WA pengirim
      if (senderPhone) {
        matchedStudent = students.find((s) => normalizeWaPhone(s.whatsapp_number) === senderPhone) || null;
      }
      if (!matchedStudent) {
        await sendToJidWithTyping(
          remoteJid,
          'ℹ️ Nomor WhatsApp ini belum terdaftar pada profil siswa di AniTrack.\n\nJika Anda *Orang Tua/Wali* atau menggunakan nomor lain, ketik:\n*cek <nama atau username siswa>*\nContoh: `cek zahira`',
          true
        );
        addLog(`[AUTO-REPLY] "${rawText}" -> nomor belum terdaftar (${senderPhone ? formatWaLocal(senderPhone) : remoteJid})`);
        return;
      }
    } else {
      const q = queryRaw.replace(/^@+/, '').toLowerCase();
      const exact = students.filter((s) =>
        String(s.username || '').toLowerCase() === q ||
        String(s.full_name || '').toLowerCase() === q
      );
      const matches = exact.length
        ? exact
        : students.filter((s) =>
            String(s.full_name || '').toLowerCase().includes(q) ||
            String(s.username || '').toLowerCase().includes(q)
          );

      if (!matches.length) {
        await sendToJidWithTyping(
          remoteJid,
          `❌ Siswa dengan kata kunci *"${queryRaw}"* tidak ditemukan.\nCoba ketik sebagian nama depan atau username siswa (contoh: *cek zahira*).`,
          true
        );
        addLog(`[AUTO-REPLY] "${rawText}" -> tidak ditemukan`);
        return;
      }
      if (matches.length > 1) {
        const listText = matches.slice(0, 8).map((s, i) =>
          `${i + 1}. *${s.full_name}* (${s.class_name || '-'}) → ketik: *cek ${s.username}*`
        ).join('\n');
        await sendToJidWithTyping(
          remoteJid,
          `🔎 Ditemukan ${matches.length} siswa cocok dengan *"${queryRaw}"*:\n\n${listText}\n\nSilakan ketik perintah di sebelah kanan nama yang dimaksud.`,
          true
        );
        addLog(`[AUTO-REPLY] "${rawText}" -> ${matches.length} kandidat dikirim`);
        return;
      }
      matchedStudent = matches[0];
    }

    const replyText = await buildStudentProgressReply(matchedStudent, profiles, tasks, subs, colsMap, rowMap, mode, waCfg);
    await sendToJidWithTyping(remoteJid, replyText, true);
    addLog(`[AUTO-REPLY] "${rawText}" -> kirim progres ${matchedStudent.full_name} ke ${senderPhone ? formatWaLocal(senderPhone) : remoteJid}`);
  } catch (err) {
    addLog(`[AUTO-REPLY ERROR] ${err.message}`, 'error');
  }
}

async function startWhatsAppSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  waStatus = 'starting';
  latestQrDataUrl = null;
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['AniTrack SMKN 4 Malang', 'Chrome', '1.0.0'],
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (event) => {
    if (event.type !== 'notify') return;
    for (const msg of event.messages || []) {
      handleIncomingAutoReply(msg);
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      waStatus = 'qr';
      connectedPhone = null;
      try {
        latestQrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
      } catch {
        latestQrDataUrl = null;
      }
      addLog(`QR Code siap! Buka http://127.0.0.1:${PORT} di browser untuk scan dengan WhatsApp.`);
      qrcodeTerminal.generate(qr, { small: true });
    }
    if (connection === 'open') {
      waStatus = 'open';
      latestQrDataUrl = null;
      connectedPhone = sock.user?.id?.split(':')[0]?.split('@')[0] || null;
      addLog(`WhatsApp Bot AniTrack TERHUBUNG! Nomor aktif: ${formatWaLocal(connectedPhone)} (+${connectedPhone})`);
    } else if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      waStatus = shouldReconnect ? 'close' : 'logged_out';
      connectedPhone = null;
      addLog(`Koneksi WhatsApp terputus (kode: ${statusCode || 'unknown'}). Auto-reconnect: ${shouldReconnect}`, 'error');
      if (shouldReconnect) {
        reconnectTimer = setTimeout(startWhatsAppSocket, 4000);
      } else {
        latestQrDataUrl = null;
        addLog('Sesi WhatsApp di-logout. Klik tombol "Reset Sesi & Scan QR Baru" di halaman web lokal.');
      }
    }
  });
}

// ==================== EXPRESS API & PANEL WEB LOKAL ====================
const app = express();
app.use(express.json({ limit: '1mb' }));

function verifySecret(req, res, next) {
  if (!WA_API_SECRET) return next();
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const bodySecret = String(req.body?.secret || '').trim();
  if (auth === WA_API_SECRET || bodySecret === WA_API_SECRET) return next();
  return res.status(401).json({ ok: false, status: false, error: 'Unauthorized: API Token tidak sesuai.' });
}

function requirePanelAuth(req, res, next) {
  if (!PANEL_ENABLED) {
    return res.status(404).send('Panel web dinonaktifkan (PANEL_ENABLED=false). Bot tetap aktif di background.');
  }
  if (!PANEL_PASSWORD) return next();
  const header = String(req.headers.authorization || '');
  if (header.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const sepIdx = decoded.indexOf(':');
      if (sepIdx !== -1) {
        const u = decoded.slice(0, sepIdx);
        const p = decoded.slice(sepIdx + 1);
        if (u === PANEL_USER && p === PANEL_PASSWORD) return next();
      }
    } catch { /* invalid base64 */ }
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="AniTrack WA Bot Admin"');
  return res.status(401).send('Akses dibatasi. Masukkan Username & Password Admin AniTrack WA Bot.');
}

function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AniTrack WA Bot — PC Lokal</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
    body { margin: 0; background: #f3f6fb; color: #1e293b; padding: 24px 16px; }
    .wrap { max-width: 860px; margin: 0 auto; display: grid; gap: 16px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 4px 16px rgba(15,23,42,.04); }
    .row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
    h1 { margin: 0; font-size: 20px; }
    h2 { margin: 0 0 10px; font-size: 15px; }
    .sub { font-size: 12.5px; color: #64748b; margin-top: 4px; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .ok { background: #dcfce7; color: #15803d; }
    .warn { background: #fef9c3; color: #a16207; }
    .err { background: #ffe4e6; color: #be123c; }
    .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .qr-box { text-align: center; padding: 16px; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 14px; }
    .qr-box img { max-width: 260px; width: 100%; border-radius: 10px; background: #fff; padding: 8px; box-shadow: 0 4px 14px rgba(0,0,0,.08); }
    input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 13px; margin-bottom: 10px; }
    .btn { border: 0; border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 700; cursor: pointer; transition: .15s; }
    .btn:disabled { opacity: .55; cursor: not-allowed; }
    .btn-green { background: #16a34a; color: #fff; }
    .btn-green:hover { background: #15803d; }
    .btn-blue { background: #0095ff; color: #fff; }
    .btn-blue:hover { background: #007ee0; }
    .btn-red { background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3; }
    .btn-red:hover { background: #e11d48; color: #fff; }
    .msg { font-size: 12.5px; font-weight: 600; margin-top: 8px; min-height: 18px; }
    .log-box { background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 12px; font-family: Consolas, monospace; font-size: 12px; max-height: 240px; overflow-y: auto; line-height: 1.55; }
    .log-err { color: #fda4af; }
    .pill { display: inline-block; padding: 3px 8px; border-radius: 8px; background: #eff6ff; color: #1d4ed8; font-size: 11.5px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="row">
        <div>
          <h1>🤖 AniTrack WhatsApp Bot (PC Lokal — Tanpa Docker)</h1>
          <div class="sub">Gratis Rp 0 • Unlimited • Tanpa Watermark • Otomatis Setiap Hari Pukul <strong>07:00 WIB</strong></div>
        </div>
        <div id="statusBadge" class="badge warn">Memuat status...</div>
      </div>
      <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <span class="pill" id="phonePill">Nomor WA: -</span>
        <span class="pill" id="cronPill">Jadwal: ${CRON_SCHEDULE} WIB</span>
        <span class="pill" style="background:#fef3c7;color:#92400e;">🛡️ Mode Ekstra Aman: ${Math.round(SEND_DELAY_MIN_MS / 1000)}–${Math.round(SEND_DELAY_MAX_MS / 1000)} dtk + Istirahat ${Math.round(COOLDOWN_MS / 60000)} mnt / ${COOLDOWN_EVERY} pesan</span>
        <span class="pill" style="background:#dcfce7;color:#15803d;">💬 Auto-Reply Kata Kunci: ${AUTO_REPLY_ENABLED ? 'AKTIF (menu, cek, cek &lt;nama&gt;, tugas)' : 'NONAKTIF'}</span>
        <span class="pill" style="background:#f1f5f9;color:#334155;">🔒 Panel Terkunci Password</span>
        <span class="pill" id="dummyPill">Mode Dummy: memuat...</span>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <h2>1. Koneksi WhatsApp (Scan QR 1x)</h2>
        <div id="qrArea" class="qr-box">
          <div class="sub">Menghubungkan ke server WhatsApp...</div>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-red" id="logoutBtn" onclick="resetSession()">🔄 Reset Sesi / Ganti Nomor WA</button>
        </div>
      </div>

      <div class="card">
        <h2>2. Tes Kirim &amp; Jalankan Pengingat</h2>
        <label style="display:block;font-size:12px;font-weight:700;margin-bottom:4px;color:#475569;">Nomor WA Tujuan Tes</label>
        <input id="testPhone" type="tel" value="081259699623" placeholder="081259699623" />
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-green" id="btnTest" onclick="sendTestWa()">🧪 Tes Kirim 1 WA</button>
          <button class="btn btn-blue" id="btnRun" onclick="runReminderNow()">📨 Jalankan Pengingat Sekarang</button>
        </div>
        <div id="actionMsg" class="msg"></div>
        <div class="sub" style="margin-top:12px; padding-top:10px; border-top:1px solid #f1f5f9;">
          Template pesan &amp; sakelar <strong>Mode Percobaan Dummy</strong> otomatis mengikuti pengaturan yang Anda simpan di <strong>Dashboard Admin AniTrack → Drive &amp; Notifikasi WA</strong>.
        </div>
      </div>
    </div>

    <div class="card">
      <h2>3. Aktivitas Bot Terbaru</h2>
      <div id="logBox" class="log-box">Menunggu log...</div>
    </div>
  </div>

  <script>
    let phonePrefilled = false;
    async function refreshStatus() {
      try {
        const res = await fetch('/api/status');
        const d = await res.json();
        const badge = document.getElementById('statusBadge');
        const qrArea = document.getElementById('qrArea');
        document.getElementById('phonePill').textContent = 'Nomor WA: ' + (d.connectedPhoneLocal || '-');
        document.getElementById('dummyPill').textContent = d.waDummyMode
          ? 'Mode Dummy: AKTIF (kirim ke ' + (d.waTestPhone || '081259699623') + ' saja)'
          : 'Mode Dummy: NONAKTIF (kirim ke siswa asli)';

        if (!phonePrefilled && d.waTestPhone) {
          document.getElementById('testPhone').value = d.waTestPhone;
          phonePrefilled = true;
        }

        if (d.whatsappStatus === 'open') {
          badge.className = 'badge ok';
          badge.textContent = '✅ WhatsApp Terhubung';
          qrArea.innerHTML = '<div style="font-size:36px;">✅</div><div style="font-weight:800;color:#15803d;margin-top:6px;">WhatsApp Aktif &amp; Siap Kirim!</div><div class="sub">Nomor terhubung: <strong>' + (d.connectedPhoneLocal || d.connectedPhone) + '</strong><br/>Biarkan jendela bot tetap berjalan di PC ini.</div>';
        } else if (d.whatsappStatus === 'qr' && d.qrDataUrl) {
          badge.className = 'badge warn';
          badge.textContent = '📱 Menunggu Scan QR';
          qrArea.innerHTML = '<img src="' + d.qrDataUrl + '" alt="QR WhatsApp" /><div class="sub" style="margin-top:8px;">Buka WhatsApp di HP → <strong>Perangkat Tertaut → Tautkan Perangkat</strong> → Scan QR di atas.</div>';
        } else if (d.whatsappStatus === 'logged_out') {
          badge.className = 'badge err';
          badge.textContent = '❌ Sesi Terputus (Logout)';
          qrArea.innerHTML = '<div class="sub">Sesi WhatsApp di-logout. Klik <strong>Reset Sesi / Ganti Nomor WA</strong> di bawah untuk memunculkan QR baru.</div>';
        } else {
          badge.className = 'badge warn';
          badge.textContent = '⏳ Menghubungkan (' + d.whatsappStatus + ')...';
        }

        const logBox = document.getElementById('logBox');
        logBox.innerHTML = (d.logs || []).map(l =>
          '<div class="' + (l.level === 'error' ? 'log-err' : '') + '">[' + l.time + '] ' + l.msg.replace(/</g, '&lt;') + '</div>'
        ).join('') || 'Belum ada aktivitas.';
      } catch (e) {}
    }

    async function sendTestWa() {
      const btn = document.getElementById('btnTest');
      const msg = document.getElementById('actionMsg');
      const phone = document.getElementById('testPhone').value.trim();
      btn.disabled = true;
      msg.style.color = '#0095ff';
      msg.textContent = 'Mengirim pesan tes WA...';
      try {
        const res = await fetch('/api/test-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const d = await res.json();
        msg.style.color = d.ok ? '#15803d' : '#be123c';
        msg.textContent = d.ok ? '✅ Pesan tes WA berhasil terkirim ke ' + d.sentTo + '!' : '❌ Gagal: ' + (d.error || 'Unknown error');
      } catch (err) {
        msg.style.color = '#be123c';
        msg.textContent = '❌ Error: ' + err.message;
      } finally {
        btn.disabled = false;
        refreshStatus();
      }
    }

    async function runReminderNow() {
      if (!confirm('Jalankan pengecekan & pengiriman pengingat WA deadline sekarang? (Jika Mode Dummy aktif di Admin, hanya kirim 1 contoh ke nomor tes.)')) return;
      const btn = document.getElementById('btnRun');
      const msg = document.getElementById('actionMsg');
      btn.disabled = true;
      msg.style.color = '#0095ff';
      msg.textContent = 'Menjalankan pengiriman pengingat deadline...';
      try {
        const res = await fetch('/api/run-now', { method: 'POST' });
        const d = await res.json();
        msg.style.color = d.ok ? '#15803d' : '#be123c';
        msg.textContent = d.ok
          ? '✅ Selesai (' + (d.dummyMode ? 'Mode Dummy' : 'Siswa Asli') + '): ' + d.sentCount + ' terkirim, ' + d.failedCount + ' gagal (dari ' + d.eligibleStudents + ' siswa memenuhi syarat).'
          : '❌ Gagal: ' + (d.error || 'Unknown error');
      } catch (err) {
        msg.style.color = '#be123c';
        msg.textContent = '❌ Error: ' + err.message;
      } finally {
        btn.disabled = false;
        refreshStatus();
      }
    }

    async function resetSession() {
      if (!confirm('Hapus sesi WhatsApp saat ini dan buat QR Code baru?')) return;
      await fetch('/api/logout', { method: 'POST' });
      refreshStatus();
    }

    refreshStatus();
    setInterval(refreshStatus, 3000);
  </script>
</body>
</html>`;
}

app.get('/', requirePanelAuth, (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderDashboardHtml());
});

app.get('/api/status', requirePanelAuth, async (_req, res) => {
  const cfg = await fetchWaGatewayConfig();
  res.json({
    ok: true,
    whatsappStatus: waStatus,
    connectedPhone,
    connectedPhoneLocal: connectedPhone ? formatWaLocal(connectedPhone) : null,
    qrDataUrl: latestQrDataUrl,
    cronSchedule: CRON_SCHEDULE,
    waDummyMode: Boolean(cfg.waDummyMode),
    waTestPhone: cfg.waTestPhone || '081259699623',
    lastRunSummary,
    logs: recentLogs
  });
});

app.post('/api/test-send', requirePanelAuth, async (req, res) => {
  try {
    const cfg = await fetchWaGatewayConfig();
    const targetPhone = req.body?.phone || cfg.waTestPhone || '081259699623';
    const sampleTasks = '🟡 *MENDEKATI DEADLINE:*\n1. *Storyline, Treatment & Storyboard* — *Besok (H-1)* (Contoh Tes)';
    const sampleUpdate = '📊 *PROJECT UPDATE (3D Animator — 1/3 Done • 33%):*\n✅ Compose & Audio Video: *Done*\n🟡 Grading: *WIP*\n⚪ Final Film + Credit Title: *None*';
    const msg =
      '🔔 *[TES BOT WA LOKAL ANITRACK — TANPA WATERMARK]*\n\n' +
      renderWaTemplateBot(cfg.messageTemplate || '', {
        nama: 'Budi Santoso (Contoh)',
        kelas: 'X ANI A',
        subkonsentrasi: '3D Animator',
        daftar_tugas: sampleTasks,
        tugas_terlambat: '',
        tugas_mendekati: sampleTasks,
        project_update: sampleUpdate,
        pembimbing: '👨‍🏫 Pembimbing: *Guru Pembimbing*',
        link_anitrack: (cfg.appUrl || APP_URL) ? `🔗 Buka AniTrack: ${cfg.appUrl || APP_URL}` : ''
      });
    const sentTo = await sendWhatsAppMessage(targetPhone, msg);
    addLog(`[TES BERHASIL] Pesan tes terkirim ke ${formatWaLocal(sentTo)}`);
    await insertWaLog({
      sent_date: getTodayJakartaYmd(),
      student_id: null,
      student_name: 'TES KIRIM WA LOKAL',
      whatsapp_number: sentTo,
      reminder_type: 'test',
      task_summary: 'Tes koneksi WA Bot PC Lokal',
      provider: 'local_pc_baileys',
      status: 'sent',
      response_detail: 'OK (local_ui_test)'
    });
    res.json({ ok: true, sentTo: formatWaLocal(sentTo) });
  } catch (err) {
    addLog(`[TES GAGAL] ${err.message}`, 'error');
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/run-now', requirePanelAuth, async (_req, res) => {
  const result = await runDeadlineReminderJob('local_ui_manual');
  res.status(result.ok ? 200 : 500).json(result);
});

app.post('/api/logout', requirePanelAuth, async (_req, res) => {
  try {
    if (sock) {
      try { await sock.logout(); } catch { /* ignore */ }
      try { sock.end(); } catch { /* ignore */ }
    }
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
    addLog('Sesi WhatsApp direset. Membuat QR Code baru...');
    setTimeout(startWhatsAppSocket, 1000);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/health', requirePanelAuth, (_req, res) => {
  res.json({
    ok: true,
    service: 'anitrack-wa-bot',
    whatsappStatus: waStatus,
    connectedPhone,
    cronSchedule: CRON_SCHEDULE,
    timezone: 'Asia/Jakarta',
    todayWib: getTodayJakartaYmd()
  });
});

app.post('/send', verifySecret, async (req, res) => {
  try {
    const phone = req.body?.target || req.body?.phone || '';
    const message = req.body?.message || '';
    if (!phone || !message) {
      return res.status(400).json({ ok: false, status: false, error: 'Parameter target/phone dan message wajib diisi.' });
    }
    const sentTo = await sendWhatsAppMessage(phone, message);
    return res.json({ ok: true, status: true, sentTo });
  } catch (err) {
    return res.status(500).json({ ok: false, status: false, error: err.message });
  }
});

app.post('/run-deadline-check', verifySecret, async (_req, res) => {
  const result = await runDeadlineReminderJob('manual_api');
  return res.status(result.ok ? 200 : 500).json(result);
});

// ==================== CRON HARIAN JAM 07:00 WIB ====================
cron.schedule(
  CRON_SCHEDULE,
  () => {
    runDeadlineReminderJob('cron_07_wib');
  },
  { timezone: 'Asia/Jakarta' }
);

function cleanupPidFile() {
  try {
    if (fs.existsSync(PID_FILE) && String(fs.readFileSync(PID_FILE, 'utf8')).trim() === String(process.pid)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch { /* ignore */ }
}
process.on('exit', cleanupPidFile);
process.on('SIGINT', () => { cleanupPidFile(); process.exit(0); });
process.on('SIGTERM', () => { cleanupPidFile(); process.exit(0); });

app.listen(PORT, '127.0.0.1', () => {
  try { fs.writeFileSync(PID_FILE, String(process.pid), 'utf8'); } catch { /* ignore */ }
  addLog(
    PANEL_ENABLED
      ? `AniTrack WA Bot aktif di http://127.0.0.1:${PORT} (terkunci password untuk user "${PANEL_USER}")`
      : 'AniTrack WA Bot aktif dalam MODE SENYAP PENUH (panel web dinonaktifkan).'
  );
  addLog(`Jadwal otomatis aktif: "${CRON_SCHEDULE}" (Asia/Jakarta / WIB)`);
  startWhatsAppSocket();
});
