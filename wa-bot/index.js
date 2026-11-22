/**
 * AniTrack — WhatsApp Bot Pengingat Deadline Otomatis (Jam 07:00 WIB)
 * Domain: https://anitrack.republikanimasi.my.id
 *
 * Aturan Pengiriman Otomatis (Setiap Hari Pukul 07:00 WIB):
 *  1. H-2, H-1, dan Hari-H deadline -> kirim WA pengingat ke siswa.
 *  2. Melebihi deadline & belum lapor selesai (status bukan 'menunggu_review' / 'selesai')
 *     -> kirim WA setiap hari pukul 07:00 WIB sampai siswa melapor selesai.
 *  3. Lebih dari 2 hari sebelum deadline atau sudah lapor selesai -> tidak dikirim.
 *
 * Endpoint HTTP (di-proxy via Nginx di https://anitrack.republikanimasi.my.id/wa-api/...):
 *  - GET  /health               -> cek status koneksi WhatsApp
 *  - POST /send                 -> kirim 1 pesan WA (kompatibel Custom Webhook di Portal Admin)
 *  - POST /run-deadline-check   -> jalankan pengecekan & pengiriman deadline sekarang juga
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
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
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
const CRON_SCHEDULE = (process.env.CRON_SCHEDULE || '0 7 * * *').trim();
const SEND_DELAY_MS = Math.max(1500, Number(process.env.SEND_DELAY_MS || 3000));

let sock = null;
let waStatus = 'starting'; // starting | qr | open | close
let connectedPhone = null;
let isRunningJob = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    console.error('[WA Log] Gagal mencatat log ke Supabase:', err.message);
  }
}

async function sendWhatsAppMessage(rawPhone, text) {
  if (!sock || waStatus !== 'open') {
    throw new Error(`WhatsApp belum terhubung (status: ${waStatus}). Scan QR di terminal VPS terlebih dahulu.`);
  }
  const phone = normalizeWaPhone(rawPhone);
  if (!phone) throw new Error(`Nomor WA tidak valid: ${rawPhone}`);
  const jid = `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text: String(text || '') });
  return phone;
}

const DEFAULT_WA_TEMPLATE = [
  'Halo *{nama}* ({kelas}),',
  'Pengingat Project Tracker *AniTrack — SMKN 4 Malang*:',
  '',
  '{daftar_tugas}',
  '📌 Segera upload file (sesuai contoh penamaan) ke Folder Google Drive Project kamu, lalu lapor selesai + unggah bukti screenshot di AniTrack.',
  '{pembimbing}',
  '{link_anitrack}'
].join('\n');

function renderWaTemplateBot(template, vars) {
  const raw = (template && String(template).trim()) ? String(template) : DEFAULT_WA_TEMPLATE;
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
  let rendered = raw.replace(/\{(nama|kelas|subkonsentrasi|daftar_tugas|tugas_terlambat|tugas_mendekati|pembimbing|link_anitrack)\}/gi, (_, k) => map[String(k).toLowerCase()] ?? '');
  const autoExtra = [];
  if (!hasTaskToken && map.daftar_tugas && map.daftar_tugas !== '-') autoExtra.push(map.daftar_tugas);
  if (!hasMentorToken && map.pembimbing) autoExtra.push(map.pembimbing);
  if (!hasLinkToken && map.link_anitrack) autoExtra.push(map.link_anitrack);
  if (autoExtra.length) rendered = `${rendered.trim()}\n\n${autoExtra.join('\n')}`;
  return rendered.replace(/\n{3,}/g, '\n\n').trim();
}

async function runDeadlineReminderJob(source = 'cron') {
  if (isRunningJob) {
    return { ok: false, error: 'Proses pengiriman pengingat deadline masih berjalan.' };
  }
  if (!sock || waStatus !== 'open') {
    return { ok: false, error: `WhatsApp belum terhubung (status: ${waStatus}).` };
  }

  isRunningJob = true;
  const todayStr = getTodayJakartaYmd();
  const todayMs = parseYmdToUtcMs(todayStr);
  console.log(`[${new Date().toISOString()}] Memulai pengecekan deadline (${source}) untuk tanggal WIB: ${todayStr}`);

  let eligibleStudents = 0;
  let sentCount = 0;
  let failedCount = 0;
  let skippedNoWa = 0;

  try {
    const [profiles, tasks, subs, cfgRows] = await Promise.all([
      fetchSupabase('profiles?select=id,full_name,username,class_name,sub_concentration,role,mentor_id,whatsapp_number'),
      fetchSupabase('project_tasks?select=id,title,pipeline_stage,sub_concentration,due_date'),
      fetchSupabase('project_submissions?select=project_task_id,student_id,status'),
      fetchSupabase('app_settings?select=value&key=eq.wa_gateway_config').catch(() => [])
    ]);

    let waCfg = {};
    if (cfgRows && cfgRows.length && cfgRows[0].value) {
      try { waCfg = JSON.parse(cfgRows[0].value); } catch { /* ignore */ }
    }
    const effectiveAppUrl = (waCfg.appUrl || APP_URL || '').trim();
    const messageTemplate = (waCfg.messageTemplate || '').trim();

    const mentorMap = {};
    const students = [];
    for (const p of profiles) {
      if (p.role === 'mentor') mentorMap[p.id] = p;
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
        // Berhenti mengirim jika siswa sudah lapor selesai (Menunggu Review atau Selesai ACC)
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

      const phone = normalizeWaPhone(s.whatsapp_number);
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
      const mentorLine = mentor
        ? `👨‍🏫 Pembimbing: *${mentor.full_name}*${formatWaLocal(mentor.whatsapp_number) !== '-' ? ` (WA: ${formatWaLocal(mentor.whatsapp_number)})` : ''}`
        : '';
      const appUrlLine = effectiveAppUrl ? `🔗 Buka AniTrack: ${effectiveAppUrl}` : '';

      const messageText = renderWaTemplateBot(messageTemplate, {
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
      const taskSummary = [
        ...overdueList.map((x) => `[Telat ${x.lateDays}h] ${x.title}`),
        ...upcomingList.map((x) => `[H-${x.diffDays}] ${x.title}`)
      ].join('; ').slice(0, 400);

      try {
        await sendWhatsAppMessage(phone, messageText);
        sentCount++;
        console.log(`  [TERKIRIM] ${s.full_name} (${phone}) — ${reminderType}`);
        await insertWaLog({
          sent_date: todayStr,
          student_id: s.id,
          student_name: s.full_name,
          whatsapp_number: phone,
          reminder_type: reminderType,
          task_summary: taskSummary,
          provider: 'oracle_vps_baileys',
          status: 'sent',
          response_detail: `OK (${source})`
        });
      } catch (err) {
        failedCount++;
        console.error(`  [GAGAL] ${s.full_name} (${phone}):`, err.message);
        await insertWaLog({
          sent_date: todayStr,
          student_id: s.id,
          student_name: s.full_name,
          whatsapp_number: phone,
          reminder_type: reminderType,
          task_summary: taskSummary,
          provider: 'oracle_vps_baileys',
          status: 'failed',
          response_detail: err.message
        });
      }

      await sleep(SEND_DELAY_MS);
    }

    const result = { ok: true, sentDate: todayStr, eligibleStudents, sentCount, failedCount, skippedNoWa };
    console.log('[Selesai Pengingat Deadline]', result);
    return result;
  } catch (err) {
    console.error('[Error Job Pengingat Deadline]', err);
    return { ok: false, error: err.message };
  } finally {
    isRunningJob = false;
  }
}

async function startWhatsAppSocket() {
  const authDir = path.join(__dirname, 'auth_info');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['AniTrack SMKN 4 Malang', 'Chrome', '1.0.0'],
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      waStatus = 'qr';
      console.log('\n=======================================================');
      console.log('SCAN QR CODE INI DI WHATSAPP (Perangkat Tertaut):');
      console.log('=======================================================');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      waStatus = 'open';
      connectedPhone = sock.user?.id?.split(':')[0] || null;
      console.log(`\n✅ WhatsApp Bot AniTrack TERHUBUNG! Nomor aktif: ${connectedPhone}`);
    } else if (connection === 'close') {
      waStatus = 'close';
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`⚠️ Koneksi WhatsApp terputus (kode: ${statusCode}). Reconnect: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startWhatsAppSocket, 4000);
      } else {
        console.log('❌ Sesi WhatsApp di-logout. Hapus folder auth_info lalu restart untuk scan QR baru.');
      }
    }
  });
}

// ==================== EXPRESS API (CUSTOM WEBHOOK UNTUK ANITRACK ADMIN) ====================
const app = express();
app.use(express.json({ limit: '1mb' }));

function verifySecret(req, res, next) {
  if (!WA_API_SECRET) return next();
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const bodySecret = String(req.body?.secret || '').trim();
  if (auth === WA_API_SECRET || bodySecret === WA_API_SECRET) return next();
  return res.status(401).json({ ok: false, status: false, error: 'Unauthorized: API Token tidak sesuai.' });
}

app.get('/health', (_req, res) => {
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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 AniTrack WA Bot API berjalan di http://127.0.0.1:${PORT}`);
  console.log(`⏰ Jadwal otomatis aktif: "${CRON_SCHEDULE}" (Asia/Jakarta / WIB)`);
  startWhatsAppSocket();
});
