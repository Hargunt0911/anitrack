(function (global) {
    'use strict';

    const SUPABASE_URL = 'https://izgcmhsobexicceqklqm.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_T9eODcUv7nRBYgN-F24aRg_w-QOzKVu';
    const GOOGLE_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1XSLl2xb6-WxrtHNS3SEUrgC2rpLeWdBT?usp=sharing';

    const ROLE_PAGES = {
        student: './siswa.html',
        mentor: './pembimbing.html',
        superadmin: './admin.html'
    };

    const SUBCONCS = [
        '2D Animator',
        '2D Motion Graphic',
        '3D Animator',
        '3D Modeller',
        '3D Motion Graphic'
    ];

    const STATUS_OPTIONS = [
        { value: 'belum_mulai', label: 'Belum Mulai', badge: 'bg-slate-100 text-slate-600 border-slate-200', dot: '#94A3B8' },
        { value: 'sedang_dikerjakan', label: 'Sedang Dikerjakan', badge: 'bg-[#EAF4FF] text-[#0082E6] border-[#CBE5FF]', dot: '#0095FF' },
        { value: 'menunggu_review', label: 'Menunggu Review', badge: 'bg-[#FFF6D6] text-[#C99200] border-[#FDE68A]', dot: '#F7C200' },
        { value: 'revisi', label: 'Revisi', badge: 'bg-[#FFF0F4] text-[#E11D48] border-[#FECDD6]', dot: '#F13B6E' },
        { value: 'selesai', label: 'Selesai', badge: 'bg-[#E3F6F3] text-[#2F8F81] border-[#BBE9E2]', dot: '#4CB6A7' }
    ];

    const TYPE_LABELS = {
        modul_pdf: 'Modul PDF',
        video_youtube: 'Video',
        pdf_dan_video: 'PDF + Video',
        aset_drive: 'Aset Drive',
        tautan_lain: 'Tautan Lain'
    };

    const COURSE_PALETTE = [
        { box: 'bg-[#F7C200] text-white', pill: 'bg-[#FFF6D6] text-[#D19B00] hover:bg-[#F7C200] hover:text-white' },
        { box: 'bg-[#F13B6E] text-white', pill: 'bg-[#FFE7EE] text-[#E62E63] hover:bg-[#F13B6E] hover:text-white' },
        { box: 'bg-[#4CB6A7] text-white', pill: 'bg-[#E2F5F2] text-[#329889] hover:bg-[#4CB6A7] hover:text-white' },
        { box: 'bg-[#1392FF] text-white', pill: 'bg-[#E4F2FF] text-[#0A84F0] hover:bg-[#1392FF] hover:text-white' }
    ];

    const AVATAR_PALETTE = [
        'bg-[#EAF4FF] text-[#0095FF]',
        'bg-[#FFE8EF] text-[#F13B6E]',
        'bg-[#FFF6D6] text-[#D49B00]',
        'bg-[#E3F6F3] text-[#359B8C]'
    ];

    const STAGE_ORDER = { 'Pre-Production': 1, 'Production': 2, 'Post-Production': 3 };

    const supabase = global.supabase
        ? global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        : null;

    let toastTimer = null;

    // ==================== AUTH & SESSION ====================
    function getUser() {
        try {
            return JSON.parse(sessionStorage.getItem('anitrack_user') || 'null');
        } catch {
            return null;
        }
    }

    function setUser(user) {
        if (user) sessionStorage.setItem('anitrack_user', JSON.stringify(user));
        else sessionStorage.removeItem('anitrack_user');
    }

    function clearUser() {
        sessionStorage.removeItem('anitrack_user');
    }

    function getRolePage(role) {
        return ROLE_PAGES[role] || './index.html';
    }

    function redirectToRole(role) {
        global.location.replace(getRolePage(role));
    }

    function requireRole(expectedRole) {
        const user = getUser();
        if (!user || !user.id) {
            global.location.replace('./index.html');
            return null;
        }
        if (expectedRole && user.role !== expectedRole) {
            global.location.replace(getRolePage(user.role));
            return null;
        }
        return user;
    }

    function logout() {
        clearUser();
        global.location.replace('./index.html');
    }

    async function syncFreshProfile(userId, onFresh) {
        if (!supabase || !userId) return null;
        const { data: fresh } = await supabase
            .from('profiles')
            .select('id, full_name, username, class_name, sub_concentration, role, mentor_id, avatar_url, whatsapp_number, project_drive_url')
            .eq('id', userId)
            .maybeSingle();
        if (fresh) {
            setUser(fresh);
            if (typeof onFresh === 'function') onFresh(fresh);
        }
        return fresh;
    }

    // ==================== FORMAT & UI HELPERS ====================
    function esc(v = '') {
        return String(v)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;');
    }

    function initials(name = '') {
        const parts = String(name).trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return 'A2';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    function roleLabel(role = '') {
        if (role === 'superadmin') return 'ADMIN';
        if (role === 'mentor') return 'PEMBIMBING';
        return 'SISWA';
    }

    function getStartOfTodayIso() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    }

    function isTodayIso(isoStr) {
        if (!isoStr) return false;
        const d = new Date(isoStr);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate();
    }

    function formatDateTime(isoStr) {
        if (!isoStr) return '-';
        try {
            return new Intl.DateTimeFormat('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date(isoStr));
        } catch {
            return isoStr;
        }
    }

    function showToast(msg) {
        const el = document.getElementById('appToast');
        const txt = document.getElementById('appToastText');
        if (!el || !txt) return;
        txt.textContent = msg;
        el.classList.remove('hidden');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
    }

    // ==================== WHATSAPP & PROJECT FILE NAMING HELPERS ====================
    function normalizeWhatsapp(raw) {
        let digits = String(raw || '').replace(/\D/g, '');
        if (!digits) return null;
        if (digits.startsWith('0')) digits = '62' + digits.slice(1);
        else if (digits.startsWith('8')) digits = '62' + digits;
        if (!/^628\d{7,12}$/.test(digits)) return null;
        return digits;
    }

    function formatWhatsappDisplay(wa) {
        const clean = normalizeWhatsapp(wa);
        if (!clean) return '';
        const local = '0' + clean.slice(2);
        return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
    }

    function getWhatsappUrl(wa, text = '') {
        const clean = normalizeWhatsapp(wa);
        if (!clean) return '';
        return `https://wa.me/${clean}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
    }

    function renderWhatsappLink(wa, compact = false, prefillText = '') {
        const url = getWhatsappUrl(wa, prefillText);
        if (!url) {
            return compact
                ? `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">WA -</span>`
                : `<span class="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-400">WA belum diisi</span>`;
        }
        const label = compact ? '💬 WA' : `💬 ${formatWhatsappDisplay(wa)}`;
        return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Chat WhatsApp: ${esc(formatWhatsappDisplay(wa))}"
            class="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-[#E7F9EE] hover:bg-[#16A34A] text-[#15803D] hover:text-white transition shrink-0">${esc(label)}</a>`;
    }

    function toSlugPascal(str, maxWords = 5, maxLen = 34) {
        const words = String(str || '')
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, maxWords);
        if (!words.length) return 'TugasProject';
        const joined = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        return joined.slice(0, maxLen);
    }

    function detectSuggestedFileExt(task) {
        const blob = `${task?.title || ''} ${task?.description || ''} ${task?.sub_concentration || ''}`.toLowerCase();
        if (/\b(mp4|mov|video|animasi|animatic|playblast|walk\s*cycle|lipsync|motion|render|compositing|editing|reel)\b/.test(blob)) return '.mp4';
        if (/\b(blend|fbx|obj|maya|rigging|rig|3d\s*model|modelling|modeling|sculpt|retopo|uv|texturing)\b/.test(blob)) return '.blend';
        if (/\b(pdf|storyboard|script|naskah|treatment|sinopsis|dokumen|laporan|proposal|concept\s*doc)\b/.test(blob)) return '.pdf';
        if (/\b(png|jpg|jpeg|turnaround|model\s*sheet|character|poster|desain|ilustrasi|background|color\s*script|key\s*art|sheet)\b/.test(blob)) return '.png';
        return '.pdf';
    }

    function buildProjectFileNaming(task, student = null) {
        const stageShortMap = {
            'Pre-Production': 'PreProd',
            'Production': 'Prod',
            'Post-Production': 'PostProd'
        };
        const stageTag = stageShortMap[task?.pipeline_stage] || 'Project';
        const taskTag = toSlugPascal(task?.title || 'Tugas', 5, 36);
        const ext = detectSuggestedFileExt(task);
        const classTag = student?.class_name
            ? String(student.class_name).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
            : 'XANIA';
        const studentTag = student?.full_name
            ? toSlugPascal(student.full_name, 2, 22)
            : 'NamaSiswa';
        const pattern = `[Kelas]_[NamaSiswa]_${stageTag}_${taskTag}${ext}`;
        const exampleBase = `${classTag}_${studentTag}_${stageTag}_${taskTag}`;
        const exampleFull = `${exampleBase}${ext}`;
        return { stageTag, taskTag, ext, pattern, exampleBase, exampleFull };
    }

    async function copyTextToClipboard(text, successMsg) {
        if (!text) return;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
            showToast(successMsg || `Disalin: ${text}`);
        } catch {
            showToast(`Salin manual: ${text}`);
        }
    }
    global.copyProjectFileName = function (name) {
        copyTextToClipboard(name, `Contoh nama file disalin: ${name}`);
    };

    const DEFAULT_WA_TEMPLATE = [
        'Halo *{nama}* ({kelas}),',
        'Pengingat Project Tracker *AniTrack — SMKN 4 Malang*:',
        '',
        '{daftar_tugas}',
        '📌 Segera upload file ke Folder Google Drive Project kamu, lalu lapor selesai + unggah bukti screenshot di AniTrack.',
        '{pembimbing}',
        '{link_anitrack}'
    ].join('\n');

    function renderWaReminderMessage(template, vars = {}) {
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
        let rendered = raw.replace(/\{(nama|kelas|subkonsentrasi|daftar_tugas|tugas_terlambat|tugas_mendekati|pembimbing|link_anitrack)\}/gi, (_, k) => {
            return map[String(k).toLowerCase()] ?? '';
        });
        // Jika admin hanya menulis kalimat pembuka/salam tanpa placeholder tugas, sistem otomatis melampirkan rinciannya
        const autoExtra = [];
        if (!hasTaskToken && map.daftar_tugas && map.daftar_tugas !== '-') autoExtra.push(map.daftar_tugas);
        if (!hasMentorToken && map.pembimbing) autoExtra.push(map.pembimbing);
        if (!hasLinkToken && map.link_anitrack) autoExtra.push(map.link_anitrack);
        if (autoExtra.length) rendered = `${rendered.trim()}\n\n${autoExtra.join('\n')}`;
        return rendered.replace(/\n{3,}/g, '\n\n').trim();
    }

    // ==================== WEEKLY PROJECT UPDATE HELPERS ====================
    const PROJECT_WEEKLY_PREFIX = 'proj_weekly::';

    function getWeekKey(dateInput = new Date()) {
        const d = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput);
        const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = target.getUTCDay() || 7;
        target.setUTCDate(target.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
        const weekNum = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
        return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    }

    function getWeekRangeInfo(weekKey) {
        const m = String(weekKey || '').match(/^(\d{4})-W(\d{2})$/);
        if (!m) return getWeekRangeInfo(getWeekKey());
        const year = Number(m[1]);
        const weekNum = Number(m[2]);
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const jan4Day = jan4.getUTCDay() || 7;
        const monday = new Date(jan4.getTime() + ((weekNum - 1) * 7 - (jan4Day - 1)) * 86400000);
        const sunday = new Date(monday.getTime() + 6 * 86400000);
        const fmtShort = (dt) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(dt);
        const startYmd = monday.toISOString().slice(0, 10);
        const endYmd = sunday.toISOString().slice(0, 10);
        const isCurrent = getWeekKey() === `${year}-W${String(weekNum).padStart(2, '0')}`;
        const label = `Minggu ${weekNum} (${fmtShort(monday)} – ${fmtShort(sunday)} ${sunday.getUTCFullYear()})${isCurrent ? ' • Minggu Ini' : ''}`;
        return { weekKey: `${year}-W${String(weekNum).padStart(2, '0')}`, weekNum, year, startDate: startYmd, endDate: endYmd, isCurrent, label };
    }

    function getRecentWeekKeys(count = 8, extraKeys = []) {
        const set = new Set();
        const now = new Date();
        for (let i = 0; i < count; i++) {
            const dt = new Date(now.getTime() - i * 7 * 86400000);
            set.add(getWeekKey(dt));
        }
        (extraKeys || []).forEach((k) => {
            if (/^\d{4}-W\d{2}$/.test(String(k || ''))) set.add(String(k));
        });
        return [...set].sort((a, b) => b.localeCompare(a));
    }

    function makeWeeklyUpdateKey(weekKey, projectTaskId, studentId) {
        return `${PROJECT_WEEKLY_PREFIX}${weekKey}::${projectTaskId}::${studentId}`;
    }

    function parseWeeklyUpdateRows(rows = []) {
        const list = [];
        (rows || []).forEach((r) => {
            if (!r?.key || !String(r.key).startsWith(PROJECT_WEEKLY_PREFIX)) return;
            try {
                const parsed = JSON.parse(r.value || '{}');
                const parts = String(r.key).split('::');
                list.push({
                    key: r.key,
                    week_key: parsed.week_key || parts[1] || '',
                    project_task_id: parsed.project_task_id || parts[2] || '',
                    student_id: parsed.student_id || parts[3] || '',
                    progress_percent: Math.min(100, Math.max(0, Number(parsed.progress_percent || 0))),
                    summary: parsed.summary || '',
                    blockers: parsed.blockers || '',
                    proof_image: parsed.proof_image || '',
                    proof_url: parsed.proof_url || '',
                    mentor_note: parsed.mentor_note || '',
                    checked_by: parsed.checked_by || null,
                    checked_by_name: parsed.checked_by_name || '',
                    checked_at: parsed.checked_at || null,
                    updated_at: parsed.updated_at || r.updated_at || null
                });
            } catch { /* ignore malformed entry */ }
        });
        list.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
        return list;
    }

    // ==================== LENCANA EMAS, KETEPATAN, RIWAYAT CATATAN, WALI KELAS & ARSIP ====================
    const PROJECT_FB_LOG_PREFIX = 'proj_fb_log::';
    const PROJECT_ARCHIVE_PREFIX = 'proj_archive::';
    const HOMEROOM_MAP_KEY = 'homeroom_teachers_map';
    const SUBCONC_PJ_MAP_KEY = 'subconc_pj_map';
    const CHECKLIST_COLS_KEY = 'proj_checklist_cols';
    const CHECKLIST_ROW_PREFIX = 'proj_checklist_row::';

    const DEFAULT_CHECKLIST_COLS = ['Compose & Audio Video', 'Grading', 'Final Film + Credit Title'];
    const CHECKLIST_STATUS_OPTIONS = [
        { value: 'belum', label: 'Belum', short: '– Belum', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
        { value: 'proses', label: 'Proses', short: '⋯ Proses', cls: 'bg-[#EAF4FF] text-[#0082E6] border-[#CBE5FF]' },
        { value: 'revisi', label: 'Revisi', short: '! Revisi', cls: 'bg-[#FFF0F4] text-[#E11D48] border-[#FECDD6]' },
        { value: 'done', label: 'Done', short: '✓ Done', cls: 'bg-[#E7F9EE] text-[#15803D] border-[#BBF7D0]' }
    ];

    function getJakartaYmd(dateInput = new Date()) {
        try {
            const dt = dateInput instanceof Date ? dateInput : new Date(dateInput);
            if (isNaN(dt.getTime())) return '';
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Jakarta',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(dt);
        } catch {
            return '';
        }
    }

    function parseYmdUtcMs(ymd) {
        if (!ymd) return null;
        const parts = String(ymd).slice(0, 10).split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return null;
        return Date.UTC(parts[0], parts[1] - 1, parts[2]);
    }

    function evaluateSubmissionTimeliness(dueDate, updatedAt, status) {
        const dueMs = parseYmdUtcMs(dueDate);
        if (status === 'selesai') {
            if (dueMs === null) {
                return { tier: 'ontime', label: 'Tuntas ✓', shortLabel: 'Tuntas', icon: '✓', badgeClass: 'bg-[#E3F6F3] text-[#1D5E55] border-[#BBE9E2]', lateDays: 0, earlyDays: 0 };
            }
            const refYmd = getJakartaYmd(updatedAt || new Date());
            const refMs = parseYmdUtcMs(refYmd);
            if (refMs === null) {
                return { tier: 'ontime', label: 'Tuntas ✓', shortLabel: 'Tuntas', icon: '✓', badgeClass: 'bg-[#E3F6F3] text-[#1D5E55] border-[#BBE9E2]', lateDays: 0, earlyDays: 0 };
            }
            const diffDays = Math.round((dueMs - refMs) / 86400000);
            if (diffDays >= 1) {
                return {
                    tier: 'gold',
                    label: `Tuntas (🌟 Lencana Emas • H-${diffDays})`,
                    shortLabel: '🌟 Lencana Emas',
                    icon: '🌟',
                    badgeClass: 'bg-[#FFF6D6] text-[#9A6F00] border-[#F7C200]',
                    lateDays: 0,
                    earlyDays: diffDays
                };
            }
            if (diffDays === 0) {
                return { tier: 'ontime', label: 'Tuntas Tepat Waktu ✓', shortLabel: 'Tuntas', icon: '✓', badgeClass: 'bg-[#E3F6F3] text-[#1D5E55] border-[#BBE9E2]', lateDays: 0, earlyDays: 0 };
            }
            const lateDays = Math.abs(diffDays);
            return {
                tier: 'late',
                label: `Tuntas (Terlambat ${lateDays}h)`,
                shortLabel: 'Terlambat',
                icon: '⏱',
                badgeClass: 'bg-[#FFF1EB] text-[#C2410C] border-[#FDBA74]',
                lateDays,
                earlyDays: 0
            };
        }
        if (dueMs !== null) {
            const todayMs = parseYmdUtcMs(getJakartaYmd(new Date()));
            if (todayMs !== null && todayMs > dueMs) {
                const lateDays = Math.round((todayMs - dueMs) / 86400000);
                return {
                    tier: 'overdue',
                    label: `Terlambat ${lateDays} hari`,
                    shortLabel: `Telat ${lateDays}h`,
                    icon: '!',
                    badgeClass: 'bg-[#FFF0F4] text-[#E11D48] border-[#FECDD6]',
                    lateDays,
                    earlyDays: 0
                };
            }
        }
        return { tier: 'normal', label: '', shortLabel: '', icon: '', badgeClass: '', lateDays: 0, earlyDays: 0 };
    }

    function computeStudentIssueStats(student, tasks = [], subMap = {}) {
        let eligibleCount = 0;
        let accCount = 0;
        let goldCount = 0;
        let lateAccCount = 0;
        let overdueCount = 0;
        let totalRevisions = 0;

        (tasks || []).forEach((t) => {
            if (t.sub_concentration && student.sub_concentration !== t.sub_concentration) return;
            eligibleCount++;
            const ps = subMap[`${t.id}__${student.id}`] || {};
            const st = ps.status || 'belum_mulai';
            const revNum = Number(ps.revision_count || 0);
            totalRevisions += revNum;
            const tm = evaluateSubmissionTimeliness(t.due_date, ps.updated_at, st);
            if (st === 'selesai') {
                accCount++;
                if (tm.tier === 'gold') goldCount++;
                else if (tm.tier === 'late') lateAccCount++;
            } else if (tm.tier === 'overdue') {
                overdueCount++;
            }
        });

        const totalIssues = overdueCount + lateAccCount + totalRevisions;
        const detailText = `${totalIssues} masalah (${overdueCount} lewat deadline, ${lateAccCount} tuntas terlambat, ${totalRevisions} revisi)`;
        return { eligibleCount, accCount, goldCount, lateAccCount, overdueCount, totalRevisions, totalIssues, detailText };
    }

    function parseFeedbackLogMap(rows = []) {
        const map = {};
        (rows || []).forEach((r) => {
            if (!r?.key || !String(r.key).startsWith(PROJECT_FB_LOG_PREFIX)) return;
            const studentId = String(r.key).slice(PROJECT_FB_LOG_PREFIX.length);
            try {
                const arr = JSON.parse(r.value || '[]');
                if (Array.isArray(arr)) map[studentId] = arr;
            } catch { /* ignore */ }
        });
        return map;
    }

    async function appendFeedbackLogEntry(studentId, entry) {
        if (!supabase || !studentId || !entry) return;
        const key = `${PROJECT_FB_LOG_PREFIX}${studentId}`;
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
            let arr = [];
            if (data?.value) {
                try {
                    const parsed = JSON.parse(data.value);
                    if (Array.isArray(parsed)) arr = parsed;
                } catch { /* ignore */ }
            }
            arr.unshift({
                at: entry.at || new Date().toISOString(),
                task_id: entry.task_id || '',
                task_title: entry.task_title || 'Tugas Project',
                status: entry.status || '',
                revision_no: Number(entry.revision_no || 0),
                feedback: String(entry.feedback || '').trim(),
                reviewer_name: entry.reviewer_name || 'Guru'
            });
            await supabase.from('app_settings').upsert({
                key,
                value: JSON.stringify(arr.slice(0, 80)),
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
        } catch { /* silent */ }
    }

    async function loadHomeroomMap() {
        if (!supabase) return {};
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', HOMEROOM_MAP_KEY).maybeSingle();
            if (data?.value) {
                const parsed = JSON.parse(data.value);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch { /* silent */ }
        return {};
    }

    async function saveHomeroomMap(mapObj) {
        if (!supabase) return { error: null };
        return supabase.from('app_settings').upsert({
            key: HOMEROOM_MAP_KEY,
            value: JSON.stringify(mapObj || {}),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    }

    async function loadSubconcPjMap() {
        if (!supabase) return {};
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', SUBCONC_PJ_MAP_KEY).maybeSingle();
            if (data?.value) {
                const parsed = JSON.parse(data.value);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch { /* silent */ }
        return {};
    }

    async function saveSubconcPjMap(mapObj) {
        if (!supabase) return { error: null };
        return supabase.from('app_settings').upsert({
            key: SUBCONC_PJ_MAP_KEY,
            value: JSON.stringify(mapObj || {}),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    }

    async function loadChecklistColsMap() {
        const base = {};
        SUBCONCS.forEach((sc) => { base[sc] = [...DEFAULT_CHECKLIST_COLS]; });
        if (!supabase) return base;
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', CHECKLIST_COLS_KEY).maybeSingle();
            if (data?.value) {
                const parsed = JSON.parse(data.value);
                if (parsed && typeof parsed === 'object') {
                    SUBCONCS.forEach((sc) => {
                        if (Array.isArray(parsed[sc]) && parsed[sc].length) base[sc] = parsed[sc];
                    });
                }
            }
        } catch { /* silent */ }
        return base;
    }

    async function saveChecklistColsMap(colsMap) {
        if (!supabase) return { error: null };
        return supabase.from('app_settings').upsert({
            key: CHECKLIST_COLS_KEY,
            value: JSON.stringify(colsMap || {}),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    }

    function parseChecklistRowMap(rows = []) {
        const map = {};
        (rows || []).forEach((r) => {
            if (!r?.key || !String(r.key).startsWith(CHECKLIST_ROW_PREFIX)) return;
            const sid = String(r.key).slice(CHECKLIST_ROW_PREFIX.length);
            try {
                const parsed = JSON.parse(r.value || '{}');
                map[sid] = {
                    student_id: sid,
                    items: (parsed.items && typeof parsed.items === 'object') ? parsed.items : {},
                    notes: parsed.notes || '',
                    updated_by: parsed.updated_by || '',
                    updated_at: parsed.updated_at || r.updated_at || null
                };
            } catch { /* ignore */ }
        });
        return map;
    }

    function openFeedbackHistoryModal(studentName, entries = []) {
        let modal = document.getElementById('anitrackFbHistoryModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'anitrackFbHistoryModal';
            modal.className = 'fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4';
            modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
            modal.innerHTML = `
                <div class="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#EDF1F7]">
                    <div class="px-5 py-3.5 border-b border-[#EDF1F7] bg-[#F7FAFF] flex items-center justify-between gap-3">
                        <div>
                            <div class="text-[10.5px] font-extrabold uppercase tracking-wider text-[#0082E6]">Audit Log Revisi &amp; Evaluasi</div>
                            <div id="fbHistModalTitle" class="text-sm font-extrabold text-[#1E293B]">Riwayat Catatan Guru</div>
                        </div>
                        <button type="button" onclick="document.getElementById('anitrackFbHistoryModal').classList.add('hidden')"
                            class="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#FFF1F5] text-slate-600 hover:text-[#F13B6E] font-bold text-sm cursor-pointer">✕</button>
                    </div>
                    <div id="fbHistModalBody" class="p-4 max-h-[72vh] overflow-y-auto space-y-2.5 text-xs"></div>
                </div>`;
            document.body.appendChild(modal);
        }
        document.getElementById('fbHistModalTitle').textContent = `Riwayat Catatan Guru — ${studentName || 'Siswa'}`;
        const body = document.getElementById('fbHistModalBody');
        if (!entries.length) {
            body.innerHTML = `<div class="p-8 text-center text-slate-400">Belum ada riwayat catatan / revisi guru untuk siswa ini.</div>`;
        } else {
            body.innerHTML = entries.map((e) => {
                const isRev = e.status === 'revisi';
                const isAcc = e.status === 'selesai';
                const tag = isRev
                    ? `<span class="px-2 py-0.5 rounded bg-[#FFF0F4] text-[#E11D48] font-bold">Revisi ke-${e.revision_no || 1}</span>`
                    : isAcc
                        ? `<span class="px-2 py-0.5 rounded bg-[#E3F6F3] text-[#1D5E55] font-bold">✓ ACC Selesai</span>`
                        : `<span class="px-2 py-0.5 rounded bg-[#EAF4FF] text-[#0082E6] font-bold">${esc(e.status || 'Catatan')}</span>`;
                return `
                    <div class="rounded-xl border ${isRev ? 'border-[#FECDD6] bg-[#FFF8FA]' : 'border-[#EDF1F7] bg-[#FAFBFD]'} p-3.5 space-y-1.5">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="flex flex-wrap items-center gap-1.5">
                                ${tag}
                                <span class="font-extrabold text-[#1E293B]">${esc(e.task_title || 'Tugas Project')}</span>
                            </div>
                            <span class="font-mono text-[10.5px] text-slate-400">${esc(formatDateTime(e.at))}</span>
                        </div>
                        <p class="text-slate-700 leading-relaxed">${esc(e.feedback || '(Tanpa catatan tambahan)')}</p>
                        <div class="text-[10.5px] text-slate-400">Oleh: <strong class="text-slate-600">${esc(e.reviewer_name || 'Guru')}</strong></div>
                    </div>`;
            }).join('');
        }
        modal.classList.remove('hidden');
    }

    function computeDeadlineReminderQueue(students, mentors, tasks, submissions, waConfig = {}) {
        const now = new Date();
        const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const mentorMap = Object.fromEntries((mentors || []).map((m) => [m.id, m]));
        const subMap = {};
        (submissions || []).forEach((ps) => {
            subMap[`${ps.project_task_id}__${ps.student_id}`] = ps;
        });

        const template = waConfig?.messageTemplate || '';
        const appUrl = (waConfig?.appUrl || '').trim();
        const queue = [];
        (students || []).forEach((s) => {
            const overdue = [];
            const upcoming = [];
            (tasks || []).forEach((t) => {
                if (!t.due_date) return;
                if (t.sub_concentration && s.sub_concentration !== t.sub_concentration) return;
                const ps = subMap[`${t.id}__${s.id}`];
                const st = ps?.status || 'belum_mulai';
                // Berhenti mengingatkan jika siswa sudah lapor selesai (Menunggu Review / ACC)
                if (st === 'selesai' || st === 'menunggu_review') return;

                const parts = String(t.due_date).slice(0, 10).split('-').map(Number);
                if (parts.length !== 3 || parts.some(isNaN)) return;
                const dueMs = Date.UTC(parts[0], parts[1] - 1, parts[2]);
                const diffDays = Math.round((dueMs - todayMs) / 86400000);

                if (diffDays < 0) {
                    overdue.push({ task: t, status: st, lateDays: Math.abs(diffDays) });
                } else if (diffDays <= 2) {
                    upcoming.push({ task: t, status: st, diffDays });
                }
            });

            if (!overdue.length && !upcoming.length) return;
            const mentor = s.mentor_id ? mentorMap[s.mentor_id] : null;
            const overdueLines = [];
            if (overdue.length) {
                overdueLines.push('🔴 *MELEBIHI DEADLINE (Belum Lapor Selesai):*');
                overdue.forEach((item, idx) => {
                    const revTag = item.status === 'revisi' ? ' [Revisi]' : '';
                    overdueLines.push(`${idx + 1}. *${item.task.title}*${revTag} — Terlambat *${item.lateDays} hari* (${String(item.task.due_date).slice(0, 10)})`);
                });
            }
            const upcomingLines = [];
            if (upcoming.length) {
                upcomingLines.push('🟡 *MENDEKATI DEADLINE:*');
                upcoming.forEach((item, idx) => {
                    const label = item.diffDays === 0 ? 'HARI INI' : (item.diffDays === 1 ? 'Besok (H-1)' : '2 Hari Lagi (H-2)');
                    const revTag = item.status === 'revisi' ? ' [Revisi]' : '';
                    upcomingLines.push(`${idx + 1}. *${item.task.title}*${revTag} — *${label}* (${String(item.task.due_date).slice(0, 10)})`);
                });
            }
            const overdueBlock = overdueLines.join('\n');
            const upcomingBlock = upcomingLines.join('\n');
            const combinedTasks = [overdueBlock, upcomingBlock].filter(Boolean).join('\n\n');
            const mentorLine = mentor
                ? `👨‍🏫 Pembimbing: *${mentor.full_name}*${formatWhatsappDisplay(mentor.whatsapp_number) ? ` (WA: ${formatWhatsappDisplay(mentor.whatsapp_number)})` : ''}`
                : '';
            const appUrlLine = appUrl ? `🔗 Buka AniTrack: ${appUrl}` : '';

            const message = renderWaReminderMessage(template, {
                nama: s.full_name || 'Siswa',
                kelas: s.class_name || 'Siswa Animasi',
                subkonsentrasi: s.sub_concentration || 'Animasi',
                daftar_tugas: combinedTasks,
                tugas_terlambat: overdueBlock,
                tugas_mendekati: upcomingBlock,
                pembimbing: mentorLine,
                link_anitrack: appUrlLine
            });

            queue.push({
                student: s,
                mentor,
                overdue,
                upcoming,
                type: (overdue.length && upcoming.length) ? 'mixed' : (overdue.length ? 'overdue' : 'h_minus_2'),
                hasWa: Boolean(normalizeWhatsapp(s.whatsapp_number)),
                message
            });
        });

        queue.sort((a, b) => (b.overdue.length - a.overdue.length) || (a.student.class_name || '').localeCompare(b.student.class_name || '') || (a.student.full_name || '').localeCompare(b.student.full_name || ''));
        return queue;
    }

    function renderAvatarMarkup(avatarUrl, fullName) {
        if (avatarUrl) {
            return `<img src="${esc(avatarUrl)}" alt="${esc(fullName || 'Avatar')}" class="w-full h-full object-cover bg-transparent" />`;
        }
        return esc(initials(fullName));
    }

    function setAvatarEl(elId, avatarUrl, fullName) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.classList.add('overflow-hidden');
        el.classList.toggle('bg-transparent', Boolean(avatarUrl));
        el.classList.toggle('bg-[#EAF4FF]', !avatarUrl);
        el.innerHTML = renderAvatarMarkup(avatarUrl, fullName);
    }

    function formatDateOnly(dateStr) {
        if (!dateStr) return 'Tanpa deadline';
        try {
            const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
            return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
        } catch {
            return dateStr;
        }
    }

    function getDeadlineMeta(dueDate, isCompleted = false) {
        if (!dueDate) {
            return { label: 'Tanpa deadline', badgeClass: 'bg-slate-100 text-slate-500 border-slate-200', overdue: false, soon: false };
        }
        const due = new Date(`${String(dueDate).slice(0, 10)}T23:59:59`);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        const diffDays = Math.round((dueStart - todayStart) / 86400000);
        const dateTxt = formatDateOnly(dueDate);

        if (isCompleted) {
            return { label: `Deadline ${dateTxt} • Tuntas ✓`, badgeClass: 'bg-[#E3F6F3] text-[#2F8F81] border-[#BBE9E2]', overdue: false, soon: false };
        }
        if (diffDays < 0) {
            return { label: `Terlambat ${Math.abs(diffDays)} hari (${dateTxt})`, badgeClass: 'bg-[#FFF0F4] text-[#E11D48] border-[#FECDD6]', overdue: true, soon: false };
        }
        if (diffDays === 0) {
            return { label: `Deadline Hari Ini (${dateTxt})`, badgeClass: 'bg-[#FFF6D6] text-[#B88600] border-[#FDE68A]', overdue: false, soon: true };
        }
        if (diffDays <= 2) {
            return { label: `H-${diffDays} • ${dateTxt}`, badgeClass: 'bg-[#FFF6D6] text-[#B88600] border-[#FDE68A]', overdue: false, soon: true };
        }
        return { label: `Deadline ${dateTxt} (${diffDays} hari lagi)`, badgeClass: 'bg-[#EAF4FF] text-[#0082E6] border-[#CBE5FF]', overdue: false, soon: false };
    }

    function compressProofImage(file, maxDim = 960, quality = 0.76) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('File bukti harus berupa gambar (JPG, PNG, atau WebP).'));
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    let w = img.width;
                    let h = img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w >= h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                        else { w = Math.round((w * maxDim) / h); h = maxDim; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = () => reject(new Error('Gagal membaca file gambar bukti.'));
                img.src = reader.result;
            };
            reader.onerror = () => reject(new Error('Gagal memuat file bukti.'));
            reader.readAsDataURL(file);
        });
    }

    function openImageLightbox(src, title = 'Bukti Penyelesaian') {
        if (!src) return;
        let modal = document.getElementById('anitrackProofLightbox');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'anitrackProofLightbox';
            modal.className = 'fixed inset-0 z-[80] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4';
            modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
            modal.innerHTML = `
                <div class="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl">
                    <div class="px-4 py-3 border-b border-[#EDF1F7] flex items-center justify-between gap-3">
                        <div id="lightboxTitle" class="text-xs sm:text-sm font-bold text-[#1E293B] truncate"></div>
                        <button type="button" onclick="document.getElementById('anitrackProofLightbox').classList.add('hidden')"
                            class="w-8 h-8 rounded-lg bg-[#F3F6FB] hover:bg-[#FFF1F5] text-slate-600 hover:text-[#F13B6E] font-bold text-sm cursor-pointer">✕</button>
                    </div>
                    <div class="p-3 bg-slate-900 flex items-center justify-center max-h-[82vh] overflow-auto">
                        <img id="lightboxImg" src="" alt="Bukti" class="max-w-full max-h-[76vh] object-contain rounded-lg" />
                    </div>
                </div>`;
            document.body.appendChild(modal);
        }
        document.getElementById('lightboxTitle').textContent = title || 'Bukti Penyelesaian';
        document.getElementById('lightboxImg').src = src;
        modal.classList.remove('hidden');
    }
    global.openProofLightbox = openImageLightbox;

    // ==================== MATERIAL MEDIA HELPERS ====================
    function getMaterialMedia(m) {
        let pdfUrl = m.pdf_url || '';
        let videoUrl = m.video_url || '';
        if (!pdfUrl && !videoUrl && m.resource_url) {
            if (m.resource_type === 'modul_pdf') pdfUrl = m.resource_url;
            else if (m.resource_type === 'video_youtube') videoUrl = m.resource_url;
        }
        const genericUrl = (!pdfUrl && !videoUrl) ? (m.resource_url || '') : '';
        return { pdfUrl, videoUrl, genericUrl };
    }

    function renderMediaBadges(m) {
        const { pdfUrl, videoUrl } = getMaterialMedia(m);
        const badges = [];
        if (pdfUrl) badges.push('<span class="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-[#FFF6D6] text-[#C99200]">📄 PDF</span>');
        if (videoUrl) badges.push('<span class="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-[#FFE7EE] text-[#E62E63]">▶ Video</span>');
        if (!badges.length) badges.push(`<span class="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">${esc(TYPE_LABELS[m.resource_type] || 'Tautan')}</span>`);
        return badges.join('');
    }

    function toEmbedVideoUrl(url = '') {
        if (!url) return '';
        const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
        const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
        if (gdMatch) return `https://drive.google.com/file/d/${gdMatch[1]}/preview`;
        return '';
    }

    function toEmbedPdfUrl(url = '') {
        if (!url) return '';
        const gdMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
        if (gdMatch) return `https://drive.google.com/file/d/${gdMatch[1]}/preview`;
        return url;
    }

    function getYoutubeThumbUrl(url = '') {
        if (!url) return '';
        const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        return ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg` : '';
    }

    function sortMaterialsByPipeline(list = []) {
        return [...list].sort((a, b) => {
            const sa = STAGE_ORDER[a.pipeline_stage] || 99;
            const sb = STAGE_ORDER[b.pipeline_stage] || 99;
            if (sa !== sb) return sa - sb;
            return String(a.title || '').localeCompare(String(b.title || ''));
        });
    }

    function renderMaterialCoverHtml(m, isDone = false) {
        const { pdfUrl, videoUrl } = getMaterialMedia(m);
        const ytThumb = getYoutubeThumbUrl(videoUrl);
        const stageBg = m.pipeline_stage === 'Pre-Production'
            ? 'from-[#FFF4CC] via-[#FFE9A6] to-[#FFD86B] text-[#9A6F00]'
            : m.pipeline_stage === 'Production'
                ? 'from-[#DFF1FF] via-[#C3E4FF] to-[#98D2FF] text-[#0066B8]'
                : 'from-[#FFE4EC] via-[#FFC9DA] to-[#FFA3C0] text-[#B8164D]';

        const stageTag = `<span class="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/75 backdrop-blur-xs text-white text-[10px] font-bold tracking-wide">${esc(m.pipeline_stage)}</span>`;
        const doneTag = isDone
            ? `<span class="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-[#10B981] text-white text-[10px] font-extrabold shadow-sm">✓ Selesai</span>`
            : '';

        if (ytThumb) {
            return `
                <div class="relative h-40 w-full bg-slate-900 overflow-hidden">
                    <img src="${esc(ytThumb)}" alt="${esc(m.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/15 to-transparent flex items-center justify-center">
                        <span class="w-11 h-11 rounded-full bg-white/90 text-[#F13B6E] shadow-lg flex items-center justify-center text-sm font-black group-hover:scale-110 transition">▶</span>
                    </div>
                    ${stageTag}
                    ${doneTag}
                </div>`;
        }

        const iconSvg = videoUrl
            ? `<svg class="w-10 h-10 opacity-85" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
            : `<svg class="w-10 h-10 opacity-85" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path stroke-linecap="round" stroke-linejoin="round" d="M9 13h6m-6 4h4" /></svg>`;

        return `
            <div class="relative h-40 w-full bg-gradient-to-br ${stageBg} flex flex-col items-center justify-center gap-1.5 overflow-hidden">
                <div class="pointer-events-none absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-white/30"></div>
                <div class="pointer-events-none absolute -left-4 -top-6 w-20 h-20 rounded-full bg-white/25"></div>
                <div class="relative z-10 w-14 h-14 rounded-2xl bg-white/75 backdrop-blur-xs shadow-sm flex items-center justify-center group-hover:scale-105 transition">
                    ${iconSvg}
                </div>
                <span class="relative z-10 text-[11px] font-extrabold tracking-wide opacity-80">
                    ${pdfUrl && videoUrl ? 'MODUL PDF + VIDEO' : (pdfUrl ? 'MODUL PDF' : (videoUrl ? 'VIDEO PEMBELAJARAN' : 'REFERENSI MATERI'))}
                </span>
                ${stageTag}
                ${doneTag}
            </div>`;
    }

    // ==================== DASHBOARD CHARTS & WIDGETS ====================
    function buildSplineChart(values, labels = SUBCONCS) {
        const linePath = document.getElementById('chartLinePath');
        const areaPath = document.getElementById('chartAreaPath');
        const pointsEl = document.getElementById('chartPoints');
        if (!linePath || !areaPath || !pointsEl) return;

        const xs = [44, 104, 168, 232, 296];
        const pts = values.map((v, i) => {
            const clamped = Math.min(100, Math.max(0, Number(v) || 0));
            return { x: xs[i], y: 112 - (clamped / 100) * 95, val: clamped, label: labels[i] || '' };
        });
        if (!pts.length) return;

        let lineD = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const cx = (pts[i].x + pts[i + 1].x) / 2;
            lineD += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
        }

        const areaD = `${lineD} L ${pts[pts.length - 1].x} 112 L ${pts[0].x} 112 Z`;
        linePath.setAttribute('d', lineD);
        areaPath.setAttribute('d', areaD);
        pointsEl.innerHTML = pts.map((p) => `
            <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#FFFFFF" stroke="#0095FF" stroke-width="2.2">
                <title>${esc(p.label)}: ${p.val}%</title>
            </circle>
        `).join('');
    }

    function renderDashboardMentors(mentors, studentCountByMentor, actionCallbackName = 'handleMentorsAction') {
        const wrap = document.getElementById('dashboardMentorsList');
        if (!wrap) return;
        const items = (mentors || []).slice(0, 4);

        if (!items.length) {
            wrap.innerHTML = `<div class="bg-white rounded-xl p-6 text-center text-xs text-slate-400 border border-[#EDF1F7] shadow-card">Belum ada data pembimbing.</div>`;
            return;
        }

        wrap.innerHTML = items.map((m, idx) => {
            const avClass = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
            const cnt = studentCountByMentor[m.id] || 0;
            const waUrl = getWhatsappUrl(m.whatsapp_number);
            return `
                <div class="bg-white rounded-xl p-3.5 border border-[#EDF1F7] shadow-card hover:shadow-cardHover transition flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-11 h-11 rounded-full ${avClass} font-bold text-xs flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden">
                            ${renderAvatarMarkup(m.avatar_url, m.full_name)}
                        </div>
                        <div class="min-w-0">
                            <div class="font-bold text-[13.5px] text-[#1E293B] truncate">${esc(m.full_name)}</div>
                            <div class="text-[11px] text-slate-400 truncate mt-0.5">
                                @${esc(m.username || 'mentor')} • ${cnt} Siswa
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        ${waUrl ? `<a href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer" title="Chat WA ${esc(m.full_name)}" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#E7F9EE] hover:bg-[#16A34A] text-[#15803D] hover:text-white transition">💬 WA</a>` : ''}
                        <button onclick="${actionCallbackName}()"
                            class="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#F3F6FB] hover:bg-[#EAF4FF] text-slate-600 hover:text-[#0095FF] transition cursor-pointer">
                            Detail
                        </button>
                    </div>
                </div>`;
        }).join('');
    }

    function renderBottomAnalytics(students, progressRows, materials) {
        const progByStudent = {};
        (progressRows || []).forEach((r) => {
            if (!progByStudent[r.student_id]) progByStudent[r.student_id] = [];
            progByStudent[r.student_id].push(r.status === 'selesai' ? 100 : 0);
        });

        const subStats = SUBCONCS.map((sc) => {
            const matchedStudents = (students || []).filter((s) => s.sub_concentration === sc);
            const scores = matchedStudents.flatMap((s) => progByStudent[s.id] || []);
            const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            return { name: sc, students: matchedStudents.length, avg };
        });

        const hasAny = subStats.some((s) => s.avg > 0);
        const overallAvg = progressRows?.length
            ? Math.round((progressRows.filter((r) => r.status === 'selesai').length / progressRows.length) * 100)
            : 0;
        buildSplineChart(hasAny ? subStats.map((s) => s.avg) : [0, 0, overallAvg, overallAvg, overallAvg]);

        const subPerfEl = document.getElementById('subconcPerfList');
        if (subPerfEl) {
            const barColors = ['bg-[#F7C200]', 'bg-[#F13B6E]', 'bg-[#4CB6A7]', 'bg-[#0095FF]', 'bg-[#6366F1]'];
            subPerfEl.innerHTML = subStats.map((item, i) => `
                <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs gap-2">
                        <span class="font-semibold text-[#1E293B] truncate">${esc(item.name)}</span>
                        <span class="text-slate-400 font-medium shrink-0">${item.students} siswa • <strong class="text-[#1E293B]">${item.avg}%</strong></span>
                    </div>
                    <div class="w-full h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div class="h-full ${barColors[i % barColors.length]} rounded-full transition-all duration-500" style="width: ${item.avg}%"></div>
                    </div>
                </div>
            `).join('');
        }

        const totalProg = progressRows?.length || 0;
        const counts = {};
        STATUS_OPTIONS.forEach((s) => { counts[s.value] = 0; });
        (progressRows || []).forEach((r) => {
            const st = r.status || 'belum_mulai';
            counts[st] = (counts[st] || 0) + 1;
        });

        const completedCount = counts.selesai || 0;
        const passPct = totalProg ? Math.round((completedCount / totalProg) * 100) : 0;
        const circ = 238.76;
        const donutArc = document.getElementById('donutArc');
        if (donutArc) donutArc.setAttribute('stroke-dashoffset', String(circ - (circ * passPct) / 100));
        const passLabel = document.getElementById('passPctLabel');
        if (passLabel) passLabel.textContent = `${passPct}%`;
        const completedEl = document.getElementById('metricCompleted');
        if (completedEl) completedEl.textContent = completedCount;

        const attentionCount = (counts.menunggu_review || 0) + (counts.revisi || 0);
        document.getElementById('notifDot')?.classList.toggle('hidden', attentionCount === 0);

        const statusBreakdown = document.getElementById('statusBreakdownList');
        if (statusBreakdown) {
            statusBreakdown.innerHTML = STATUS_OPTIONS.map((st) => `
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${st.dot}"></span>
                        <span class="text-slate-600 truncate">${st.label}</span>
                    </div>
                    <span class="font-bold text-[#1E293B]">${counts[st.value] || 0}</span>
                </div>
            `).join('');
        }

        const contentUsageEl = document.getElementById('contentUsageList');
        if (contentUsageEl) {
            const typeKeys = [
                { key: 'pdf_dan_video', label: 'PDF + Video', color: 'bg-[#0095FF]' },
                { key: 'modul_pdf', label: 'Modul PDF', color: 'bg-[#F7C200]' },
                { key: 'video_youtube', label: 'Video', color: 'bg-[#F13B6E]' },
                { key: 'aset_drive', label: 'Aset Drive', color: 'bg-[#4CB6A7]' }
            ];
            const totalMat = materials?.length || 0;
            contentUsageEl.innerHTML = typeKeys.map((t) => {
                const c = (materials || []).filter((m) => m.resource_type === t.key).length;
                const pct = totalMat ? Math.round((c / totalMat) * 100) : 0;
                return `
                    <div class="space-y-1">
                        <div class="flex items-center justify-between text-xs">
                            <span class="font-semibold text-slate-600">${t.label}</span>
                            <span class="font-bold text-[#1E293B]">${c}</span>
                        </div>
                        <div class="w-full h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div class="h-full ${t.color} rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                        </div>
                    </div>`;
            }).join('');
        }
    }

    // ==================== SIDEBAR & TOPBAR CONTROLLER ====================
    function initLayoutControls() {
        let sidebarExpanded = false;

        function applyDesktopSidebarState() {
            const sb = document.getElementById('sidebar');
            if (!sb) return;
            sb.style.width = sidebarExpanded ? '220px' : '74px';
            sb.querySelectorAll('.sidebar-label').forEach((el) => el.classList.toggle('hidden', !sidebarExpanded));
            sb.querySelectorAll('.nav-tooltip').forEach((el) => el.classList.toggle('!hidden', sidebarExpanded));
            sb.querySelectorAll('.nav-item').forEach((el) => {
                el.classList.toggle('justify-center', !sidebarExpanded);
                el.classList.toggle('justify-start', sidebarExpanded);
                el.classList.toggle('px-3.5', sidebarExpanded);
            });
            const brand = sb.querySelector('.sidebar-brand-wrap');
            if (brand) {
                brand.classList.toggle('justify-center', !sidebarExpanded);
                brand.classList.toggle('justify-start', sidebarExpanded);
            }
        }

        global.toggleMobileSidebar = function (open) {
            const sb = document.getElementById('sidebar');
            const bd = document.getElementById('sidebarBackdrop');
            if (!sb || !bd) return;
            if (open) {
                sb.classList.remove('-translate-x-full');
                bd.classList.remove('hidden');
                sb.style.width = '240px';
                sb.querySelectorAll('.sidebar-label').forEach((el) => el.classList.remove('hidden'));
                sb.querySelectorAll('.nav-item').forEach((el) => {
                    el.classList.remove('justify-center');
                    el.classList.add('justify-start', 'px-3.5');
                });
                const brand = sb.querySelector('.sidebar-brand-wrap');
                if (brand) {
                    brand.classList.remove('justify-center');
                    brand.classList.add('justify-start', 'px-1.5');
                }
            } else {
                sb.classList.add('-translate-x-full');
                bd.classList.add('hidden');
                if (global.innerWidth >= 1024) applyDesktopSidebarState();
            }
        };

        global.handleSidebarToggle = function () {
            if (global.innerWidth < 1024) {
                const sb = document.getElementById('sidebar');
                global.toggleMobileSidebar(sb?.classList.contains('-translate-x-full'));
            } else {
                sidebarExpanded = !sidebarExpanded;
                applyDesktopSidebarState();
            }
        };

        global.toggleMobileSearch = function () {
            const row = document.getElementById('mobileSearchRow');
            if (!row) return;
            const isHidden = row.classList.toggle('hidden');
            if (!isHidden) setTimeout(() => document.getElementById('globalSearchMobile')?.focus(), 50);
        };

        global.toggleFullscreen = function () {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
            else document.exitFullscreen?.().catch(() => {});
        };

        global.logoutUser = logout;

        global.addEventListener('resize', () => {
            if (global.innerWidth >= 1024) {
                document.getElementById('sidebarBackdrop')?.classList.add('hidden');
                applyDesktopSidebarState();
            }
        });
    }

    // ==================== PROFILE & AVATAR CONTROLLER ====================
    function initProfileController(getCurrentUser, setCurrentUser, onAfterSave) {
        let pendingAvatarDataUrl = undefined;

        function paintProfile() {
            const user = getCurrentUser();
            if (!user) return;
            const effectiveAvatar = pendingAvatarDataUrl !== undefined ? pendingAvatarDataUrl : (user.avatar_url || null);

            const rolePill = document.getElementById('rolePill');
            if (rolePill) rolePill.textContent = roleLabel(user.role);
            const topName = document.getElementById('topUserName');
            if (topName) topName.textContent = user.full_name || '-';
            setAvatarEl('topUserAvatar', user.avatar_url || null, user.full_name);
            setAvatarEl('profileAvatarBig', effectiveAvatar, user.full_name);
            document.getElementById('removeAvatarBtn')?.classList.toggle('hidden', !effectiveAvatar);

            const pName = document.getElementById('profileName');
            if (pName) pName.textContent = user.full_name || '-';
            const pBadge = document.getElementById('profileBadge');
            if (pBadge) pBadge.textContent = roleLabel(user.role);
            const pMeta = document.getElementById('profileMeta');
            if (pMeta) {
                pMeta.textContent =
                    `@${user.username}` +
                    (user.class_name ? ` • ${user.class_name}` : '') +
                    (user.sub_concentration ? ` • ${user.sub_concentration}` : '');
            }
            const uInp = document.getElementById('newUsernameInput');
            if (uInp) uInp.value = user.username || '';
            const waInp = document.getElementById('newWhatsappInput');
            if (waInp) waInp.value = user.whatsapp_number ? formatWhatsappDisplay(user.whatsapp_number).replaceAll('-', '') : '';
            const drvInp = document.getElementById('newProjectDriveInput');
            if (drvInp) drvInp.value = user.project_drive_url || '';
        }

        global.toggleNewPasswordVis = function () {
            const inp = document.getElementById('newPasswordInput');
            if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
        };

        global.handleAvatarFilePick = function (inp) {
            const file = inp.files?.[0];
            if (!file) return;
            const hint = document.getElementById('avatarHint');
            if (!file.type.startsWith('image/')) {
                if (hint) hint.textContent = 'Harap pilih file gambar (JPG, PNG, atau WebP).';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const size = 200;
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, size, size);
                    const minDim = Math.min(img.width, img.height);
                    ctx.drawImage(img, (img.width - minDim) / 2, (img.height - minDim) / 2, minDim, minDim, 0, 0, size, size);
                    const webpUrl = canvas.toDataURL('image/webp', 0.86);
                    pendingAvatarDataUrl = webpUrl.startsWith('data:image/webp') ? webpUrl : canvas.toDataURL('image/png');
                    setAvatarEl('profileAvatarBig', pendingAvatarDataUrl, getCurrentUser()?.full_name);
                    document.getElementById('removeAvatarBtn')?.classList.remove('hidden');
                    if (hint) hint.textContent = 'Foto siap disimpan — klik "Simpan Perubahan".';
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        };

        global.removeAvatarDraft = function () {
            pendingAvatarDataUrl = null;
            setAvatarEl('profileAvatarBig', null, getCurrentUser()?.full_name);
            document.getElementById('removeAvatarBtn')?.classList.add('hidden');
            const fileInp = document.getElementById('avatarFileInput');
            if (fileInp) fileInp.value = '';
            const hint = document.getElementById('avatarHint');
            if (hint) hint.textContent = 'Foto profil akan dihapus saat Anda klik "Simpan Perubahan".';
        };

        global.saveAccountChanges = async function () {
            const user = getCurrentUser();
            if (!user) return;
            const fb = document.getElementById('accountFeedback');
            const btn = document.getElementById('saveAccountBtn');
            const cleanUsername = document.getElementById('newUsernameInput').value.trim().toLowerCase();
            const newPass = document.getElementById('newPasswordInput').value;
            const waEl = document.getElementById('newWhatsappInput');
            const drvEl = document.getElementById('newProjectDriveInput');

            if (!/^[a-z0-9._]{3,24}$/.test(cleanUsername)) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = 'Username harus 3–24 karakter (huruf kecil, angka, titik, atau underscore).';
                return;
            }

            let normalizedWa = undefined;
            if (waEl) {
                const rawWa = waEl.value.trim();
                if ((user.role === 'student' || user.role === 'mentor') && !rawWa) {
                    fb.className = 'text-xs font-semibold text-[#E11D48]';
                    fb.textContent = user.role === 'mentor'
                        ? 'Nomor WhatsApp aktif wajib diisi oleh setiap guru pembimbing.'
                        : 'Nomor WhatsApp aktif wajib diisi oleh setiap siswa.';
                    waEl.focus();
                    return;
                }
                if (rawWa) {
                    const cleanWa = normalizeWhatsapp(rawWa);
                    if (!cleanWa) {
                        fb.className = 'text-xs font-semibold text-[#E11D48]';
                        fb.textContent = 'Format Nomor WhatsApp tidak valid. Gunakan awalan 08 atau 628 (10–15 digit).';
                        waEl.focus();
                        return;
                    }
                    normalizedWa = cleanWa;
                } else {
                    normalizedWa = null;
                }
            }

            let cleanDriveUrl = undefined;
            if (drvEl) {
                const rawDrv = drvEl.value.trim();
                if (rawDrv && !/^https?:\/\//i.test(rawDrv)) {
                    fb.className = 'text-xs font-semibold text-[#E11D48]';
                    fb.textContent = 'Link folder Google Drive harus diawali https://';
                    drvEl.focus();
                    return;
                }
                cleanDriveUrl = rawDrv || null;
            }

            btn.disabled = true;
            btn.textContent = 'Menyimpan...';

            const { data: dup } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', cleanUsername)
                .neq('id', user.id)
                .maybeSingle();

            if (dup) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = 'Username sudah dipakai pengguna lain.';
                btn.disabled = false;
                btn.textContent = 'Simpan Perubahan';
                return;
            }

            const payload = { username: cleanUsername };
            if (newPass.length > 0) payload.pin_or_password = newPass;
            if (normalizedWa !== undefined) payload.whatsapp_number = normalizedWa;
            if (cleanDriveUrl !== undefined) payload.project_drive_url = cleanDriveUrl;

            let savedAvatarToDrive = false;
            if (pendingAvatarDataUrl !== undefined) {
                await loadSharedGasUrl();
                if (pendingAvatarDataUrl && String(pendingAvatarDataUrl).startsWith('data:image/') && getGasUrl()) {
                    btn.textContent = 'Mengunggah foto ke Drive...';
                    try {
                        const mimeMatch = pendingAvatarDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
                        const mimeType = mimeMatch ? mimeMatch[1] : 'image/webp';
                        const base64Data = pendingAvatarDataUrl.split(',')[1] || '';
                        const upRes = await postToGas({
                            action: 'upload_avatar',
                            username: cleanUsername,
                            role: user.role || 'user',
                            mimeType,
                            base64Data,
                            previousFileUrl: user.avatar_url || ''
                        });
                        if (upRes?.ok && upRes.imageUrl) {
                            payload.avatar_url = upRes.imageUrl;
                            savedAvatarToDrive = true;
                        } else {
                            payload.avatar_url = pendingAvatarDataUrl;
                        }
                    } catch {
                        payload.avatar_url = pendingAvatarDataUrl;
                    }
                    btn.textContent = 'Menyimpan...';
                } else if (pendingAvatarDataUrl === null) {
                    if (getGasUrl()) {
                        try {
                            await postToGas({
                                action: 'delete_avatar',
                                username: user.username || cleanUsername,
                                previousFileUrl: user.avatar_url || ''
                            });
                        } catch { /* silent */ }
                    }
                    payload.avatar_url = null;
                } else {
                    payload.avatar_url = pendingAvatarDataUrl;
                }
            }

            const { data: updated, error } = await supabase
                .from('profiles')
                .update(payload)
                .eq('id', user.id)
                .select('id, full_name, username, class_name, sub_concentration, role, mentor_id, avatar_url, whatsapp_number, project_drive_url')
                .single();

            btn.disabled = false;
            btn.textContent = 'Simpan Perubahan';

            if (error) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = error.message;
                return;
            }

            pendingAvatarDataUrl = undefined;
            setCurrentUser(updated);
            setUser(updated);
            document.getElementById('newPasswordInput').value = '';
            const fileInp = document.getElementById('avatarFileInput');
            if (fileInp) fileInp.value = '';
            const hint = document.getElementById('avatarHint');
            if (hint) hint.textContent = 'JPG/PNG/WebP, otomatis dipotong kotak rapi.';

            paintProfile();
            if (typeof onAfterSave === 'function') onAfterSave(updated);
            fb.className = 'text-xs font-semibold text-[#3FA496]';
            fb.textContent = savedAvatarToDrive
                ? `Profil diperbarui & foto tersimpan di Google Drive (@${updated.username}) ✓`
                : `Profil berhasil diperbarui (@${updated.username}) ✓`;
            showToast(savedAvatarToDrive ? 'Foto profil tersimpan di Google Drive & database!' : 'Perubahan profil tersimpan!');
        };

        loadSharedGasUrl();
        return { paintProfile };
    }

    // ==================== GOOGLE DRIVE SYNC & .XLSX EXPORT ====================
    function getGasUrl() {
        return localStorage.getItem('anitrack_gas_url') || '';
    }

    function setGasUrl(url) {
        if (url) localStorage.setItem('anitrack_gas_url', url);
        else localStorage.removeItem('anitrack_gas_url');
    }

    async function loadSharedGasUrl() {
        if (!supabase) return getGasUrl();
        try {
            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'gas_web_app_url')
                .maybeSingle();
            if (data?.value) {
                setGasUrl(data.value);
                updateDriveConnUI();
                return data.value;
            }
            // Jika localStorage sudah punya tapi DB belum, sinkronkan ke DB
            const local = getGasUrl();
            if (local) {
                await supabase.from('app_settings').upsert({
                    key: 'gas_web_app_url',
                    value: local,
                    updated_at: new Date().toISOString()
                });
            }
        } catch { /* silent */ }
        return getGasUrl();
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function postToGas(payload) {
        const url = getGasUrl();
        if (!url) return { ok: false, error: 'URL Apps Script belum diatur.' };
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    }

    async function syncDailyTaskToDrive(record) {
        if (!getGasUrl()) return;
        try {
            await postToGas({ action: 'sync_daily_task', ...record });
        } catch { /* silent background sync */ }
    }

    function updateDriveConnUI() {
        const gasUrl = getGasUrl();
        const connected = Boolean(gasUrl);
        const inp = document.getElementById('gasUrlInput');
        if (inp) inp.value = gasUrl;

        const dot = document.getElementById('driveSyncDot');
        if (dot) {
            dot.classList.toggle('bg-emerald-400', connected);
            dot.classList.toggle('bg-slate-300', !connected);
        }

        const badge = document.getElementById('storageConnBadge');
        if (badge) {
            badge.textContent = connected ? 'Auto-Sync Drive Aktif ✓' : 'Mode Manual / Export';
        }

        const hint = document.getElementById('matFileHint');
        if (hint) {
            hint.textContent = connected
                ? 'Terhubung ke Google Drive! File yang dipilih akan otomatis diunggah ke folder pusat & menghasilkan link.'
                : 'Opsional: hubungkan URL Apps Script di menu Drive & Backup agar file langsung terunggah otomatis ke Google Drive.';
        }
    }

    function makeWorksheet(rows, colWidths) {
        const ws = global.XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Belum ada data' }]);
        if (colWidths?.length) ws['!cols'] = colWidths.map((wch) => ({ wch }));
        return ws;
    }

    async function buildExportWorkbooks() {
        if (typeof global.XLSX === 'undefined') throw new Error('Library Excel (.xlsx) belum termuat.');

        const [{ data: profiles }, { data: materials }, { data: tasks }, { data: progress }, { data: projTasks }, { data: projSubs }, { data: weeklyRaw }, { data: fbLogRaw }] = await Promise.all([
            supabase.from('profiles').select('id, full_name, username, class_name, sub_concentration, role, mentor_id, whatsapp_number, project_drive_url').order('role').order('full_name'),
            supabase.from('learning_materials').select('*').order('id', { ascending: false }),
            supabase.from('daily_tasks').select('*').order('id', { ascending: false }),
            supabase.from('student_progress').select('*').order('updated_at', { ascending: false }),
            supabase.from('project_tasks').select('*').order('due_date', { ascending: true }),
            supabase.from('project_submissions').select('*').order('updated_at', { ascending: false }),
            supabase.from('app_settings').select('key, value, updated_at').like('key', `${PROJECT_WEEKLY_PREFIX}%`),
            supabase.from('app_settings').select('key, value, updated_at').like('key', `${PROJECT_FB_LOG_PREFIX}%`)
        ]);

        const pList = profiles || [];
        const mList = materials || [];
        const tList = tasks || [];
        const prList = progress || [];
        const pMap = Object.fromEntries(pList.map((p) => [p.id, p]));
        const tMap = Object.fromEntries(tList.map((t) => [t.id, t]));
        const statusLabels = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label]));

        const taskRows = prList.map((r, i) => {
            const s = pMap[r.student_id] || {};
            const t = tMap[r.task_id] || {};
            const mentor = s.mentor_id ? pMap[s.mentor_id] : null;
            return {
                No: i + 1,
                Waktu: formatDateTime(r.updated_at),
                'Nama Siswa': s.full_name || '-',
                Username: s.username ? `@${s.username}` : '-',
                Kelas: s.class_name || '-',
                'Sub-Konsentrasi': s.sub_concentration || '-',
                Pembimbing: mentor?.full_name || '-',
                'Judul Daily Task': t.title || '-',
                Status: statusLabels[r.status] || r.status || '-',
                'Catatan Siswa': r.student_notes || '-',
                'Feedback Pembimbing': r.mentor_feedback || '-',
                Tautan: r.submission_url || '-'
            };
        });

        const materialRows = mList.map((m, i) => {
            const { pdfUrl, videoUrl, genericUrl } = getMaterialMedia(m);
            return {
                No: i + 1,
                'Judul Materi': m.title || '-',
                'Tahap Pipeline': m.pipeline_stage || '-',
                'Sub-Konsentrasi': m.sub_concentration || 'Umum',
                'Tipe Materi': TYPE_LABELS[m.resource_type] || m.resource_type || '-',
                Deskripsi: m.description || '-',
                'Link PDF': pdfUrl || '-',
                'Link Video': videoUrl || '-',
                'Tautan Lainnya': genericUrl || '-',
                'Dibuat Oleh': (m.created_by && pMap[m.created_by]?.full_name) || '-'
            };
        });

        const ptList = projTasks || [];
        const psList = projSubs || [];
        const fbLogMap = parseFeedbackLogMap(fbLogRaw || []);
        const subMapExport = {};
        psList.forEach((ps) => { subMapExport[`${ps.project_task_id}__${ps.student_id}`] = ps; });

        const profileRows = pList.map((p, i) => {
            const stStats = p.role === 'student' ? computeStudentIssueStats(p, ptList, subMapExport) : null;
            const histLogs = (fbLogMap[p.id] || []).map((l) => `[${formatDateTime(l.at)}] ${l.task_title} | ${l.status === 'revisi' ? `Revisi ke-${l.revision_no || 1}` : l.status}: ${l.feedback}`).join('\n');
            return {
                No: i + 1,
                'Nama Lengkap': p.full_name || '-',
                Username: `@${p.username || '-'}`,
                Peran: roleLabel(p.role),
                Kelas: p.class_name || '-',
                'Sub-Konsentrasi': p.sub_concentration || '-',
                Pembimbing: (p.mentor_id && pMap[p.mentor_id]?.full_name) || '-',
                'Nomor WA': formatWhatsappDisplay(p.whatsapp_number) || '-',
                'Folder Drive Project': p.project_drive_url || '-',
                'Lencana Emas': stStats ? stStats.goldCount : '-',
                'Total Masalah': stStats ? stStats.totalIssues : '-',
                'Riwayat Catatan Guru': histLogs || '-'
            };
        });

        const completedTasksCount = prList.filter((r) => r.status === 'selesai').length;
        const summaryRows = [
            { Keterangan: 'Tanggal Export', Nilai: formatDateTime(new Date().toISOString()) },
            { Keterangan: 'Folder Google Drive Pusat', Nilai: GOOGLE_DRIVE_FOLDER_URL },
            { Keterangan: 'Total Siswa', Nilai: pList.filter((p) => p.role === 'student').length },
            { Keterangan: 'Total Pembimbing', Nilai: pList.filter((p) => p.role === 'mentor' || p.role === 'superadmin').length },
            { Keterangan: 'Total Materi Ajar', Nilai: mList.length },
            { Keterangan: 'Total Entri Daily Task', Nilai: prList.length },
            { Keterangan: 'Daily Task Selesai', Nilai: completedTasksCount }
        ];

        const ptMap = Object.fromEntries(ptList.map((pt) => [pt.id, pt]));
        const projectRows = psList.map((ps, i) => {
            const s = pMap[ps.student_id] || {};
            const pt = ptMap[ps.project_task_id] || {};
            const tm = evaluateSubmissionTimeliness(pt.due_date, ps.updated_at, ps.status);
            return {
                No: i + 1,
                'Tugas Project': pt.title || '-',
                'Tahap Pipeline': pt.pipeline_stage || '-',
                Deadline: formatDateOnly(pt.due_date),
                'Nama Siswa': s.full_name || '-',
                Kelas: s.class_name || '-',
                'Sub-Konsentrasi': s.sub_concentration || '-',
                Status: ps.status === 'selesai' ? tm.label : (statusLabels[ps.status] || ps.status || '-'),
                'Jumlah Revisi': Number(ps.revision_count || 0),
                'Bukti Foto': ps.proof_image ? 'Ada Bukti Foto' : '-',
                'Folder Drive Project': s.project_drive_url || ps.proof_url || '-',
                'Catatan Siswa': ps.student_notes || '-',
                'Catatan Revisi / Feedback Guru': ps.mentor_feedback || '-',
                'Diperbarui': formatDateTime(ps.updated_at)
            };
        });

        const weeklyList = parseWeeklyUpdateRows(weeklyRaw || []);
        const weeklyRows = weeklyList.map((u, i) => {
            const s = pMap[u.student_id] || {};
            const pt = ptMap[u.project_task_id] || {};
            const mentor = s.mentor_id ? pMap[s.mentor_id] : null;
            return {
                No: i + 1,
                Minggu: getWeekRangeInfo(u.week_key).label,
                'Nama Siswa': s.full_name || '-',
                Kelas: s.class_name || '-',
                'Sub-Konsentrasi': s.sub_concentration || '-',
                Pembimbing: mentor?.full_name || '-',
                'Tugas Project': pt.title || '-',
                'Progres (%)': `${u.progress_percent}%`,
                'Ringkasan Progres Mingguan': u.summary || '-',
                Kendala: u.blockers || '-',
                'Bukti WIP': u.proof_image ? 'Ada Screenshot' : '-',
                'Catatan Pembimbing': u.mentor_note || '-',
                'Status Cek Pembimbing': u.checked_at ? `Dicek (${u.checked_by_name || 'Guru'})` : 'Belum Dicek',
                'Diperbarui': formatDateTime(u.updated_at)
            };
        });

        const taskCols = [5, 18, 24, 16, 10, 20, 22, 30, 18, 34, 34, 32];
        const matCols = [5, 32, 16, 20, 16, 40, 38, 38, 30, 22];
        const profCols = [5, 26, 18, 12, 10, 20, 24, 18, 38];
        const projCols = [5, 30, 16, 16, 24, 10, 20, 18, 12, 16, 30, 32, 34, 18];
        const weeklyCols = [5, 28, 24, 10, 20, 22, 28, 12, 36, 28, 14, 30, 20, 18];
        const sumCols = [28, 48];

        const tasksWb = global.XLSX.utils.book_new();
        global.XLSX.utils.book_append_sheet(tasksWb, makeWorksheet(taskRows, taskCols), 'Rekap Daily Task');

        const materialsWb = global.XLSX.utils.book_new();
        global.XLSX.utils.book_append_sheet(materialsWb, makeWorksheet(materialRows, matCols), 'Daftar Materi Ajar');

        const fullWb = global.XLSX.utils.book_new();
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(summaryRows, sumCols), 'Ringkasan');
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(taskRows, taskCols), 'Rekap Daily Task');
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(projectRows, projCols), 'Project Tracker');
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(weeklyRows, weeklyCols), 'Update Mingguan');
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(materialRows, matCols), 'Daftar Materi Ajar');
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(profileRows, profCols), 'Siswa & Mentor');

        return { tasksWb, materialsWb, fullWb };
    }

    function bindDriveAndExportGlobals() {
        updateDriveConnUI();
        loadSharedGasUrl();

        global.saveAndTestGasUrl = async function () {
            const fb = document.getElementById('gasStatusFeedback');
            const val = document.getElementById('gasUrlInput').value.trim();
            if (!val) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = 'Masukkan URL Web App Google Apps Script terlebih dahulu.';
                return;
            }
            fb.className = 'text-xs font-semibold text-[#0095FF]';
            fb.textContent = 'Menguji koneksi ke Google Drive...';
            try {
                const res = await fetch(val);
                const json = await res.json();
                if (!json?.ok) throw new Error(json?.error || 'Respon tidak valid');
                setGasUrl(val);
                await supabase.from('app_settings').upsert({
                    key: 'gas_web_app_url',
                    value: val,
                    updated_at: new Date().toISOString()
                });
                updateDriveConnUI();
                fb.className = 'text-xs font-semibold text-[#3FA496]';
                fb.textContent = `Terhubung ke folder "${json.folderName || 'Google Drive'}" ✓ (sinkron untuk semua perangkat)`;
                showToast('Koneksi Google Drive aktif!');
            } catch (err) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = `Gagal terhubung: ${err.message}. Pastikan Deploy Web App menggunakan akses "Anyone".`;
            }
        };

        global.clearGasUrl = async function () {
            setGasUrl('');
            await supabase.from('app_settings').delete().eq('key', 'gas_web_app_url');
            updateDriveConnUI();
            const fb = document.getElementById('gasStatusFeedback');
            fb.className = 'text-xs font-semibold text-slate-400';
            fb.textContent = 'URL Apps Script dihapus. Kembali ke mode manual / export lokal.';
        };

        global.syncAllDataToDrive = async function () {
            const fb = document.getElementById('syncNowFeedback');
            const btn = document.getElementById('syncDriveNowBtn');
            if (!getGasUrl()) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = 'Isi & simpan URL Web App Google Apps Script di atas terlebih dahulu agar bisa sync otomatis.';
                return;
            }
            btn.disabled = true;
            btn.textContent = 'Menyinkronkan .xlsx ke Drive...';
            fb.className = 'text-xs font-semibold text-[#0095FF]';
            fb.textContent = 'Menyusun file Excel (.xlsx) & mengirim ke Google Drive...';
            try {
                const { tasksWb, materialsWb, fullWb } = await buildExportWorkbooks();
                const res = await postToGas({
                    action: 'backup_all',
                    fullXlsxBase64: global.XLSX.write(fullWb, { bookType: 'xlsx', type: 'base64' }),
                    tasksXlsxBase64: global.XLSX.write(tasksWb, { bookType: 'xlsx', type: 'base64' }),
                    materialsXlsxBase64: global.XLSX.write(materialsWb, { bookType: 'xlsx', type: 'base64' })
                });
                if (!res?.ok) throw new Error(res?.error || 'Gagal menyimpan backup.');
                fb.className = 'text-xs font-semibold text-[#3FA496]';
                fb.innerHTML = `File Excel (.xlsx) berhasil tersimpan di Google Drive ✓ <a href="${esc(res.folderUrl || GOOGLE_DRIVE_FOLDER_URL)}" target="_blank" rel="noopener noreferrer" class="underline text-[#0095FF] ml-1">Buka Folder Backup ↗</a>`;
                showToast('Backup Excel (.xlsx) berhasil tersimpan di Google Drive!');
            } catch (err) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = `Gagal sync: ${err.message}`;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Sync Semua Data (.xlsx) ke Google Drive';
            }
        };

        global.exportLocal = async function (kind) {
            try {
                const { tasksWb, materialsWb, fullWb } = await buildExportWorkbooks();
                const stamp = new Date().toISOString().slice(0, 10);
                if (kind === 'tasks') global.XLSX.writeFile(tasksWb, `Rekap-DailyTask-${stamp}.xlsx`);
                else if (kind === 'materials') global.XLSX.writeFile(materialsWb, `Daftar-MateriAjar-${stamp}.xlsx`);
                else global.XLSX.writeFile(fullWb, `AniTrack-FullBackup-${stamp}.xlsx`);
                showToast('File Excel (.xlsx) berhasil diunduh.');
            } catch (err) {
                showToast(`Gagal export: ${err.message}`);
            }
        };
    }

    // ==================== SHARED STAFF CONTROLLER (PEMBIMBING & ADMIN) ====================
    function initStaffPortal(options) {
        const expectedRole = options.role; // 'mentor' | 'superadmin'
        const tabTitles = options.tabTitles;
        const onTabChange = options.onTabChange || (() => {});
        const extraRefresh = options.extraRefresh || (() => Promise.resolve());
        const onSearchExtra = options.onSearchExtra || (() => {});

        let currentUser = requireRole(expectedRole);
        if (!currentUser) return null;

        let activeTab = 'overview';
        let globalSearchTerm = '';
        let allMaterialsCache = [];
        let materialsById = {};
        let currentPlayerMaterialId = null;
        let currentPlayerPlaylist = [];

        initLayoutControls();
        bindDriveAndExportGlobals();

        function updateMentorWaBanner() {
            const banner = document.getElementById('mentorWaRequiredBanner');
            if (!banner) return;
            const hasWa = Boolean(normalizeWhatsapp(currentUser?.whatsapp_number));
            banner.classList.toggle('hidden', expectedRole !== 'mentor' || hasWa);
        }

        global.saveQuickMentorWhatsapp = async function () {
            const inp = document.getElementById('quickMentorWaInput');
            const btn = document.getElementById('quickMentorWaSaveBtn');
            const fb = document.getElementById('quickMentorWaFeedback');
            const cleanWa = normalizeWhatsapp(inp?.value || '');
            if (!cleanWa) {
                if (fb) {
                    fb.className = 'text-xs font-semibold text-[#E11D48]';
                    fb.textContent = 'Format Nomor WA tidak valid. Gunakan awalan 08 atau 628 (10–15 digit).';
                }
                inp?.focus();
                return;
            }
            if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
            const { data: updated, error } = await supabase
                .from('profiles')
                .update({ whatsapp_number: cleanWa })
                .eq('id', currentUser.id)
                .select('id, full_name, username, class_name, sub_concentration, role, mentor_id, avatar_url, whatsapp_number, project_drive_url')
                .single();
            if (btn) { btn.disabled = false; btn.textContent = 'Simpan Nomor WA'; }
            if (error || !updated) {
                if (fb) {
                    fb.className = 'text-xs font-semibold text-[#E11D48]';
                    fb.textContent = error?.message || 'Gagal menyimpan Nomor WA.';
                }
                return;
            }
            currentUser = updated;
            setUser(updated);
            paintProfile();
            updateMentorWaBanner();
            if (fb) fb.textContent = '';
            showToast(`Nomor WA Pembimbing (${formatWhatsappDisplay(cleanWa)}) tersimpan ✓`);
            refreshMetrics();
        };

        const { paintProfile } = initProfileController(
            () => currentUser,
            (u) => { currentUser = u; updateMentorWaBanner(); },
            () => { loadDailyTaskFeed(); refreshMetrics(); }
        );

        function paintTabs() {
            const mobLabel = document.getElementById('mobileTabLabel');
            if (mobLabel) mobLabel.textContent = tabTitles[activeTab] || 'Dashboard';

            document.querySelectorAll('.tab-link').forEach((btn) => {
                const isActive = btn.dataset.tab === activeTab;
                btn.classList.toggle('bg-[#EAF4FF]', isActive);
                btn.classList.toggle('text-[#0095FF]', isActive);
                btn.classList.toggle('text-slate-400', !isActive);
                btn.classList.toggle('hover:bg-[#F4F8FF]', !isActive);
                btn.classList.toggle('hover:text-[#0095FF]', !isActive);
            });

            document.querySelectorAll('.mob-link').forEach((btn) => {
                const isActive = btn.dataset.tab === activeTab;
                btn.classList.toggle('text-[#0095FF]', isActive);
                btn.classList.toggle('text-slate-400', !isActive);
            });

            document.querySelectorAll('[id^="tab-"]').forEach((sec) => sec.classList.add('hidden'));
            document.getElementById(`tab-${activeTab}`)?.classList.remove('hidden');
            onTabChange(activeTab);
        }

        global.switchTab = function (tab) {
            if (tab !== 'materials' && currentPlayerMaterialId) {
                closeMaterialPlayer(false);
            }
            activeTab = tab;
            paintTabs();
            if (global.innerWidth < 1024) global.toggleMobileSidebar(false);
            global.scrollTo({ top: 0, behavior: 'smooth' });
        };

        global.handleHeroCta = function () {
            global.switchTab('materials');
            setTimeout(() => document.getElementById('matTitle')?.focus(), 100);
        };

        global.handleMentorsAction = function () {
            global.switchTab(expectedRole === 'superadmin' ? 'plotting' : 'tasks');
        };

        global.toggleMissingStudentsBox = function () {
            document.getElementById('missingStudentsBox')?.classList.toggle('hidden');
        };

        global.handlePdfFilePick = function (inp) {
            const file = inp.files?.[0];
            if (!file) return;
            const titleInp = document.getElementById('matTitle');
            if (titleInp && !titleInp.value.trim()) titleInp.value = file.name.replace(/\.[^.]+$/, '');
            document.getElementById('matPdfFileLabel').textContent = `Dipilih: ${file.name} (siap unggah ke Drive)`;
        };

        global.handleVideoFilePick = function (inp) {
            const file = inp.files?.[0];
            if (!file) return;
            const titleInp = document.getElementById('matTitle');
            if (titleInp && !titleInp.value.trim()) titleInp.value = file.name.replace(/\.[^.]+$/, '');
            document.getElementById('matVideoFileLabel').textContent = `Dipilih: ${file.name} (siap unggah ke Drive)`;
        };

        global.handleGlobalSearch = function (val) {
            globalSearchTerm = (val || '').trim().toLowerCase();
            const dInp = document.getElementById('globalSearch');
            const mInp = document.getElementById('globalSearchMobile');
            if (dInp && dInp.value !== val) dInp.value = val;
            if (mInp && mInp.value !== val) mInp.value = val;

            if (activeTab === 'tasks') loadDailyTaskFeed();
            else if (activeTab === 'projects') loadProjectTracker();
            else if (activeTab === 'materials') {
                if (currentPlayerMaterialId) closeMaterialPlayer(false);
                renderMaterialsView();
            } else if (activeTab === 'overview') {
                renderDashboardPopularMaterials(allMaterialsCache);
            } else {
                onSearchExtra(val, activeTab);
            }
        };

        function renderDashboardPopularMaterials(materials) {
            const wrap = document.getElementById('dashboardMaterialsList');
            if (!wrap) return;
            const filtered = sortMaterialsByPipeline(materials || []).filter((m) =>
                !globalSearchTerm ||
                (m.title || '').toLowerCase().includes(globalSearchTerm) ||
                (m.sub_concentration || '').toLowerCase().includes(globalSearchTerm) ||
                (m.pipeline_stage || '').toLowerCase().includes(globalSearchTerm)
            );
            const items = filtered.slice(0, 4);
            if (!items.length) {
                wrap.innerHTML = `<div class="bg-white rounded-xl p-6 text-center text-xs text-slate-400 border border-[#EDF1F7] shadow-card">Belum ada materi ajar tersedia.</div>`;
                return;
            }
            wrap.innerHTML = items.map((m, idx) => {
                const pal = COURSE_PALETTE[idx % COURSE_PALETTE.length];
                const letter = (m.sub_concentration || m.title || 'M').trim().charAt(0).toUpperCase();
                return `
                    <div onclick="openMaterialDetail('${m.id}')" class="bg-white rounded-xl p-3.5 border border-[#EDF1F7] shadow-card hover:shadow-cardHover transition flex items-center justify-between gap-3 cursor-pointer">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-11 h-11 rounded-xl ${pal.box} font-bold text-base flex items-center justify-center shrink-0">
                                ${esc(letter)}
                            </div>
                            <div class="min-w-0">
                                <div class="font-bold text-[13.5px] text-[#1E293B] truncate">${esc(m.title)}</div>
                                <div class="text-[11px] text-slate-400 truncate mt-0.5">
                                    ${esc(m.pipeline_stage)} • ${esc(TYPE_LABELS[m.resource_type] || m.sub_concentration || 'Umum')}
                                </div>
                            </div>
                        </div>
                        <span class="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold ${pal.pill} transition">
                            Buka
                        </span>
                    </div>`;
            }).join('');
        }

        async function refreshMetrics() {
            let sq = supabase.from('profiles').select('id, sub_concentration, mentor_id').eq('role', 'student');
            if (expectedRole === 'mentor') sq = sq.eq('mentor_id', currentUser.id);

            const [
                { count: matCount, data: matRows },
                { data: students },
                { data: prog },
                { data: mentors }
            ] = await Promise.all([
                supabase.from('learning_materials').select('*', { count: 'exact' }).order('id', { ascending: false }),
                sq,
                supabase.from('student_progress').select('student_id, status, updated_at'),
                supabase.from('profiles').select('id, full_name, username, avatar_url, whatsapp_number').in('role', ['mentor', 'superadmin']).order('full_name')
            ]);

            allMaterialsCache = matRows || [];
            allMaterialsCache.forEach((m) => { if (m?.id) materialsById[m.id] = m; });

            const studentList = students || [];
            const studentIds = new Set(studentList.map((s) => s.id));
            const scopedProg = expectedRole === 'mentor'
                ? (prog || []).filter((r) => studentIds.has(r.student_id))
                : (prog || []);

            const todayCount = scopedProg.filter((r) => isTodayIso(r.updated_at)).length;
            const donePct = scopedProg.length
                ? Math.round((scopedProg.filter((r) => r.status === 'selesai').length / scopedProg.length) * 100)
                : 0;

            document.getElementById('metricMaterials').textContent = matCount ?? 0;
            document.getElementById('metricTasks').textContent = scopedProg.length;
            document.getElementById('metricStudents').textContent = studentList.length;
            document.getElementById('metricMentors').textContent = mentors?.length ?? 0;
            document.getElementById('metricAvg').textContent = todayCount;
            document.getElementById('metricAvgBar').style.width = `${Math.min(100, Math.max(0, donePct))}%`;

            const countByMentor = {};
            studentList.forEach((s) => {
                if (s.mentor_id) countByMentor[s.mentor_id] = (countByMentor[s.mentor_id] || 0) + 1;
            });

            renderDashboardPopularMaterials(allMaterialsCache);
            renderDashboardMentors(mentors || [], countByMentor);
            renderBottomAnalytics(studentList, scopedProg, allMaterialsCache);
        }

        function renderMaterialsView() {
            const stage = document.getElementById('filterStage')?.value || '';
            const subconc = document.getElementById('filterMaterialSubconc')?.value || '';
            const list = document.getElementById('materialsList');
            const filtered = sortMaterialsByPipeline(allMaterialsCache).filter((m) => {
                if (stage && m.pipeline_stage !== stage) return false;
                if (subconc && m.sub_concentration !== subconc) return false;
                if (!globalSearchTerm) return true;
                return (m.title || '').toLowerCase().includes(globalSearchTerm) ||
                    (m.description || '').toLowerCase().includes(globalSearchTerm) ||
                    (m.sub_concentration || '').toLowerCase().includes(globalSearchTerm) ||
                    (m.pipeline_stage || '').toLowerCase().includes(globalSearchTerm);
            });

            if (!filtered.length) {
                list.innerHTML = `<div class="col-span-full bg-white border border-[#EDF1F7] rounded-2xl shadow-card p-10 text-center text-sm text-slate-400">Belum ada materi ajar untuk filter yang dipilih.</div>`;
                return;
            }

            list.innerHTML = filtered.map((m, idx) => {
                const pal = COURSE_PALETTE[idx % COURSE_PALETTE.length];
                const descSnippet = m.description
                    ? `<p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">${esc(m.description)}</p>`
                    : `<p class="text-xs text-slate-400 italic">Buka ruang materi untuk pratinjau lengkap.</p>`;
                return `
                    <article onclick="openMaterialDetail('${m.id}')"
                        class="group bg-white border border-[#EDF1F7] shadow-card hover:shadow-cardHover rounded-2xl overflow-hidden flex flex-col justify-between transition cursor-pointer">
                        <div>
                            ${renderMaterialCoverHtml(m, false)}
                            <div class="p-4 sm:p-5 space-y-2.5">
                                <div class="flex flex-wrap items-center gap-1.5">
                                    <span class="font-mono text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-[#F1F5F9] text-slate-600">${esc(m.sub_concentration || 'Umum')}</span>
                                    ${renderMediaBadges(m)}
                                </div>
                                <h3 class="font-extrabold text-sm sm:text-[15px] text-[#1E293B] leading-snug line-clamp-2 group-hover:text-[#0095FF] transition">${esc(m.title)}</h3>
                                ${descSnippet}
                            </div>
                        </div>
                        <div class="px-4 sm:px-5 py-3.5 border-t border-[#F1F5F9] bg-[#FAFBFD] flex items-center justify-between gap-2">
                            <span class="text-[11px] font-semibold text-slate-400">${esc(m.sub_concentration || 'Semua Konsentrasi')}</span>
                            <button type="button" onclick="event.stopPropagation(); openMaterialDetail('${m.id}')"
                                class="px-3.5 py-1.5 rounded-xl ${pal.pill} text-xs font-bold transition cursor-pointer">
                                Buka Materi →
                            </button>
                        </div>
                    </article>`;
            }).join('');
        }

        function renderPlayerCurriculumSidebar() {
            const listEl = document.getElementById('playerCurriculumList');
            document.getElementById('playerSidebarProgress').textContent = `${currentPlayerPlaylist.length} modul`;
            let lastStage = '';
            listEl.innerHTML = currentPlayerPlaylist.map((m, idx) => {
                const isActive = m.id === currentPlayerMaterialId;
                const { pdfUrl, videoUrl } = getMaterialMedia(m);
                const mediaIcons = `${videoUrl ? '▶' : ''}${videoUrl && pdfUrl ? ' ' : ''}${pdfUrl ? '📄' : ''}` || '🔗';
                const stageHeader = m.pipeline_stage !== lastStage
                    ? `<div class="px-4 py-2 bg-[#F7F9FC] text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-[#EDF1F7]">${esc(m.pipeline_stage)}</div>`
                    : '';
                lastStage = m.pipeline_stage;
                return `
                    ${stageHeader}
                    <button type="button" onclick="openMaterialDetail('${m.id}')"
                        class="w-full text-left px-4 py-3 flex items-start gap-3 transition cursor-pointer ${isActive
                            ? 'bg-[#EAF4FF] border-l-4 border-[#0095FF]'
                            : 'hover:bg-[#F7FAFF] border-l-4 border-transparent'}">
                        <span class="w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5 ${isActive ? 'bg-[#0095FF] text-white' : 'bg-[#F1F5F9] text-slate-500'}">
                            ${idx + 1}
                        </span>
                        <div class="min-w-0 flex-1">
                            <div class="text-xs font-bold leading-snug ${isActive ? 'text-[#0082E6]' : 'text-[#1E293B]'} line-clamp-2">${esc(m.title)}</div>
                            <div class="text-[10.5px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                                <span>${mediaIcons}</span>
                                <span>•</span>
                                <span class="truncate">${esc(m.sub_concentration || 'Umum')}</span>
                            </div>
                        </div>
                    </button>`;
            }).join('');
        }

        global.openMaterialDetail = function (id) {
            const m = materialsById[id] || allMaterialsCache.find((x) => x.id === id);
            if (!m) { showToast('Materi tidak ditemukan.'); return; }
            if (activeTab !== 'materials') { activeTab = 'materials'; paintTabs(); }

            currentPlayerMaterialId = m.id;
            currentPlayerPlaylist = sortMaterialsByPipeline(allMaterialsCache);
            const currentIdx = currentPlayerPlaylist.findIndex((x) => x.id === m.id);

            document.getElementById('playerBreadcrumb').textContent =
                `${m.pipeline_stage} • Materi ${currentIdx + 1} dari ${currentPlayerPlaylist.length}`;
            const { pdfUrl, videoUrl, genericUrl } = getMaterialMedia(m);
            document.getElementById('playerBadges').innerHTML = `
                <span class="font-mono text-[10.5px] font-bold px-2.5 py-1 rounded-md bg-[#EAF4FF] text-[#0082E6]">${esc(m.pipeline_stage)}</span>
                <span class="font-mono text-[10.5px] font-semibold px-2.5 py-1 rounded-md bg-[#F1F5F9] text-slate-600">${esc(m.sub_concentration || 'Semua Sub-Konsentrasi')}</span>
                ${renderMediaBadges(m)}
            `;
            document.getElementById('playerTitle').textContent = m.title || 'Detail Materi';
            document.getElementById('playerDesc').textContent =
                (m.description && m.description.trim()) ? m.description.trim() : 'Belum ada penjelasan detail tambahan untuk materi ini.';

            const tabsEl = document.getElementById('playerMediaTabs');
            const videoPane = document.getElementById('playerVideoPane');
            const pdfPane = document.getElementById('playerPdfPane');
            const genericPane = document.getElementById('playerGenericPane');
            const videoEmbed = document.getElementById('playerVideoEmbed');
            const pdfEmbed = document.getElementById('playerPdfEmbed');

            tabsEl.classList.add('hidden');
            videoPane.classList.add('hidden');
            pdfPane.classList.add('hidden');
            genericPane.classList.add('hidden');
            videoEmbed.innerHTML = '';
            pdfEmbed.innerHTML = '';

            if (videoUrl) {
                document.getElementById('playerVideoOpenLink').href = videoUrl;
                const embedUrl = toEmbedVideoUrl(videoUrl);
                if (embedUrl) {
                    videoEmbed.innerHTML = `<iframe src="${esc(embedUrl)}" title="Video Pembelajaran" class="w-full h-full border-0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`;
                } else if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(videoUrl)) {
                    videoEmbed.innerHTML = `<video src="${esc(videoUrl)}" controls class="w-full h-full bg-black"></video>`;
                } else {
                    videoEmbed.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white/90 space-y-2"><div class="text-sm font-bold">Pratinjau langsung tidak didukung untuk tautan video ini</div><p class="text-xs text-slate-300">Klik tombol "Buka Video di Tab Baru" di bawah untuk menonton.</p></div>`;
                }
            }
            if (pdfUrl) {
                document.getElementById('playerPdfOpenLink').href = pdfUrl;
                pdfEmbed.innerHTML = `<iframe src="${esc(toEmbedPdfUrl(pdfUrl))}" title="Modul PDF" class="w-full h-full border-0 bg-white" loading="lazy"></iframe>`;
            }

            if (videoUrl && pdfUrl) {
                tabsEl.classList.remove('hidden');
                global.switchPlayerMediaTab('video');
            } else if (videoUrl) {
                videoPane.classList.remove('hidden');
            } else if (pdfUrl) {
                pdfPane.classList.remove('hidden');
            } else if (genericUrl) {
                document.getElementById('playerGenericOpenLink').href = genericUrl;
                genericPane.classList.remove('hidden');
            }

            document.getElementById('playerPrevBtn').disabled = currentIdx <= 0;
            document.getElementById('playerNextBtn').disabled = currentIdx < 0 || currentIdx >= currentPlayerPlaylist.length - 1;
            renderPlayerCurriculumSidebar();

            document.getElementById('materialsCatalogView').classList.add('hidden');
            document.getElementById('materialPlayerView').classList.remove('hidden');
            global.scrollTo({ top: 0, behavior: 'smooth' });
        };

        global.switchPlayerMediaTab = function (tab) {
            const showVideo = tab === 'video';
            document.getElementById('playerVideoPane').classList.toggle('hidden', !showVideo);
            document.getElementById('playerPdfPane').classList.toggle('hidden', showVideo);
            document.getElementById('playerTabVideoBtn').className = showVideo
                ? 'flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-[#F13B6E] text-white transition cursor-pointer'
                : 'flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-white border border-[#E2E8F0] text-slate-600 hover:bg-[#FFE7EE] hover:text-[#E62E63] transition cursor-pointer';
            document.getElementById('playerTabPdfBtn').className = !showVideo
                ? 'flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-[#F7C200] text-white transition cursor-pointer'
                : 'flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-white border border-[#E2E8F0] text-slate-600 hover:bg-[#FFF6D6] hover:text-[#C99200] transition cursor-pointer';
        };

        function closeMaterialPlayer(shouldScroll = true) {
            document.getElementById('materialPlayerView')?.classList.add('hidden');
            document.getElementById('materialsCatalogView')?.classList.remove('hidden');
            const vEl = document.getElementById('playerVideoEmbed');
            const pEl = document.getElementById('playerPdfEmbed');
            if (vEl) vEl.innerHTML = '';
            if (pEl) pEl.innerHTML = '';
            currentPlayerMaterialId = null;
            if (shouldScroll) {
                renderMaterialsView();
                global.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
        global.closeMaterialPlayer = closeMaterialPlayer;

        global.navigatePlayerMaterial = function (delta) {
            if (!currentPlayerMaterialId || !currentPlayerPlaylist.length) return;
            const idx = currentPlayerPlaylist.findIndex((m) => m.id === currentPlayerMaterialId);
            const nextIdx = idx + delta;
            if (nextIdx >= 0 && nextIdx < currentPlayerPlaylist.length) {
                global.openMaterialDetail(currentPlayerPlaylist[nextIdx].id);
            }
        };

        global.deleteCurrentMaterial = async function () {
            if (!currentPlayerMaterialId) return;
            const mat = materialsById[currentPlayerMaterialId] || allMaterialsCache.find((x) => x.id === currentPlayerMaterialId);
            const allUrls = [...new Set([mat?.pdf_url, mat?.video_url, mat?.resource_url].filter(Boolean))];
            const driveUrls = allUrls.filter((u) => /drive\.google\.com/i.test(u));

            const confirmMsg = driveUrls.length
                ? 'Hapus materi ini secara permanen beserta file terkait di Google Drive?'
                : 'Hapus materi ini secara permanen?';
            if (!confirm(confirmMsg)) return;

            const btn = document.getElementById('playerDeleteBtn');
            btn.disabled = true;

            let driveDeletedCount = 0;
            let driveWarning = '';

            if (driveUrls.length) {
                if (getGasUrl()) {
                    btn.textContent = 'Menghapus file Drive...';
                    try {
                        const driveRes = await postToGas({
                            action: 'delete_material_files',
                            fileUrls: driveUrls
                        });
                        if (driveRes?.ok) {
                            driveDeletedCount = Number(driveRes.deletedCount || 0);
                        } else {
                            driveWarning = driveRes?.error || 'Apps Script belum diperbarui.';
                        }
                    } catch (err) {
                        driveWarning = err.message;
                    }
                } else {
                    driveWarning = 'URL Apps Script belum diatur';
                }
            }

            btn.textContent = 'Menghapus materi...';
            const { error } = await supabase.from('learning_materials').delete().eq('id', currentPlayerMaterialId);
            btn.disabled = false;
            btn.textContent = 'Hapus Materi';

            if (error) { showToast(`Gagal menghapus materi: ${error.message}`); return; }
            delete materialsById[currentPlayerMaterialId];
            closeMaterialPlayer(false);

            if (driveDeletedCount > 0) {
                showToast(`Materi & ${driveDeletedCount} file Google Drive berhasil dihapus ✓`);
            } else if (driveWarning) {
                showToast(`Materi dihapus. Catatan Drive: ${driveWarning}`);
            } else {
                showToast('Materi berhasil dihapus.');
            }
            await Promise.all([loadMaterials(), refreshMetrics()]);
        };

        async function loadMaterials() {
            const { data, error } = await supabase.from('learning_materials').select('*').order('id', { ascending: false });
            if (error) { renderMaterialsView(); return; }
            allMaterialsCache = data || [];
            allMaterialsCache.forEach((m) => { if (m?.id) materialsById[m.id] = m; });
            renderMaterialsView();
            if (currentPlayerMaterialId) {
                if (materialsById[currentPlayerMaterialId]) {
                    currentPlayerPlaylist = sortMaterialsByPipeline(allMaterialsCache);
                    renderPlayerCurriculumSidebar();
                } else {
                    closeMaterialPlayer(false);
                }
            }
        }
        global.loadMaterials = loadMaterials;

        document.getElementById('addMaterialForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fb = document.getElementById('materialFeedback');
            const btn = document.getElementById('saveMaterialBtn');
            const title = document.getElementById('matTitle').value.trim();
            const stage = document.getElementById('matStage').value;
            const subconc = document.getElementById('matSubconc').value || null;
            const desc = document.getElementById('matDesc').value.trim();
            const pdfFile = document.getElementById('matPdfFile')?.files?.[0] || null;
            const videoFile = document.getElementById('matVideoFile')?.files?.[0] || null;
            let pdfUrl = document.getElementById('matPdfUrl').value.trim();
            let videoUrl = document.getElementById('matVideoUrl').value.trim();

            if (!title) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = 'Judul materi wajib diisi.';
                return;
            }
            if ((pdfFile || videoFile) && !getGasUrl()) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = 'Atur URL Apps Script di menu Drive & Backup dulu untuk unggah file, atau tempel link manual.';
                return;
            }

            btn.disabled = true;
            try {
                if (pdfFile) {
                    btn.textContent = 'Mengunggah PDF ke Drive...';
                    const base64Data = await readFileAsBase64(pdfFile);
                    const uploadRes = await postToGas({ action: 'upload_material', fileName: pdfFile.name, mimeType: pdfFile.type || 'application/pdf', stage, base64Data });
                    if (!uploadRes?.ok || !uploadRes.fileUrl) throw new Error(uploadRes?.error || 'Gagal mengunggah PDF.');
                    pdfUrl = uploadRes.fileUrl;
                    document.getElementById('matPdfUrl').value = pdfUrl;
                }
                if (videoFile) {
                    btn.textContent = 'Mengunggah Video ke Drive...';
                    const base64Data = await readFileAsBase64(videoFile);
                    const uploadRes = await postToGas({ action: 'upload_material', fileName: videoFile.name, mimeType: videoFile.type || 'video/mp4', stage, base64Data });
                    if (!uploadRes?.ok || !uploadRes.fileUrl) throw new Error(uploadRes?.error || 'Gagal mengunggah Video.');
                    videoUrl = uploadRes.fileUrl;
                    document.getElementById('matVideoUrl').value = videoUrl;
                }
            } catch (err) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = `Upload Drive gagal: ${err.message}`;
                btn.disabled = false;
                btn.textContent = '+ Simpan Materi';
                return;
            }

            if (!pdfUrl && !videoUrl) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = 'Isi minimal salah satu: Modul PDF atau Video Pembelajaran (atau keduanya).';
                btn.disabled = false;
                btn.textContent = '+ Simpan Materi';
                return;
            }

            const resourceType = (pdfUrl && videoUrl) ? 'pdf_dan_video' : (pdfUrl ? 'modul_pdf' : 'video_youtube');
            btn.textContent = 'Menyimpan...';
            const { error } = await supabase.from('learning_materials').insert({
                title, pipeline_stage: stage, sub_concentration: subconc,
                description: desc || null, pdf_url: pdfUrl || null, video_url: videoUrl || null,
                resource_type: resourceType, resource_url: pdfUrl || videoUrl, created_by: currentUser.id
            });

            btn.disabled = false;
            btn.textContent = '+ Simpan Materi';
            if (!error) {
                e.target.reset();
                document.getElementById('matPdfFileLabel').textContent = 'Bisa isi PDF saja, Video saja, atau keduanya.';
                document.getElementById('matVideoFileLabel').textContent = 'Link YouTube & Google Drive Video otomatis tampil di player.';
                fb.className = 'text-xs font-semibold text-[#3FA496]';
                fb.textContent = (pdfFile || videoFile) ? 'Terunggah ke Drive & tersimpan ✓' : 'Materi tersimpan ✓';
                showToast('Materi baru berhasil ditambahkan!');
                setTimeout(() => { fb.textContent = ''; }, 2400);
                loadMaterials();
                refreshMetrics();
            } else {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = error.message;
            }
        });

        async function loadDailyTaskFeed() {
            const container = document.getElementById('taskProgressContainer');
            let sq = supabase
                .from('profiles')
                .select('id, full_name, username, class_name, sub_concentration, mentor_id, avatar_url, whatsapp_number, project_drive_url')
                .eq('role', 'student')
                .order('class_name')
                .order('full_name');
            if (expectedRole === 'mentor') {
                if (staffScopeMode === 'homeroom' && myHomeroomClass) sq = sq.eq('class_name', myHomeroomClass);
                else sq = sq.eq('mentor_id', currentUser.id);
            } else if (expectedRole === 'superadmin') {
                if (staffScopeMode === 'mentees') sq = sq.eq('mentor_id', currentUser.id);
                else if (staffScopeMode === 'homeroom' && myHomeroomClass) sq = sq.eq('class_name', myHomeroomClass);
            }

            const [{ data: students }, { data: progressRows }, { data: tasks }] = await Promise.all([
                sq,
                supabase.from('student_progress').select('*').order('updated_at', { ascending: false }),
                supabase.from('daily_tasks').select('*')
            ]);

            const studentList = students || [];
            scopedStudentsCache = studentList;
            populateResetStudentSelect(studentList);
            const studentMap = Object.fromEntries(studentList.map((s) => [s.id, s]));
            const taskMap = Object.fromEntries((tasks || []).map((t) => [t.id, t]));
            let scopedRows = (progressRows || []).filter((r) => Boolean(studentMap[r.student_id]));

            const filledTodayIds = new Set(scopedRows.filter((r) => isTodayIso(r.updated_at)).map((r) => r.student_id));
            const missingStudents = studentList.filter((s) => !filledTodayIds.has(s.id));
            document.getElementById('staffComplianceSummary').textContent =
                `${filledTodayIds.size} dari ${studentList.length} siswa sudah mengisi Daily Task hari ini.`;
            document.getElementById('missingCountBadge').textContent = missingStudents.length;
            document.getElementById('missingStudentsList').innerHTML = missingStudents.length
                ? missingStudents.map((s) => {
                    const waUrl = getWhatsappUrl(s.whatsapp_number, `Halo ${s.full_name}, jangan lupa isi Daily Task AniTrack hari ini ya.`);
                    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFF6D6] text-[#9A7000] font-semibold">${esc(s.full_name)} <span class="font-mono text-[10px] opacity-75">(${esc(s.class_name || '-')})</span>${waUrl ? `<a href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer" title="Ingatkan via WhatsApp" class="ml-0.5 px-1.5 py-0.5 rounded bg-[#16A34A] text-white text-[9.5px] font-bold hover:bg-[#15803D]">WA</a>` : ''}</span>`;
                }).join('')
                : `<span class="text-[#3FA496] font-semibold">Semua siswa sudah mengisi Daily Task hari ini!</span>`;

            const period = document.getElementById('filterTaskPeriod')?.value || 'all';
            const statusF = document.getElementById('filterTaskStatus')?.value || '';
            const classF = document.getElementById('filterTaskClass')?.value || '';
            if (period === 'today') scopedRows = scopedRows.filter((r) => isTodayIso(r.updated_at));
            if (statusF) scopedRows = scopedRows.filter((r) => r.status === statusF);
            if (classF) scopedRows = scopedRows.filter((r) => (studentMap[r.student_id]?.class_name || '') === classF);

            if (globalSearchTerm) {
                scopedRows = scopedRows.filter((r) => {
                    const s = studentMap[r.student_id] || {};
                    const t = taskMap[r.task_id] || {};
                    return (s.full_name || '').toLowerCase().includes(globalSearchTerm) ||
                        (s.username || '').toLowerCase().includes(globalSearchTerm) ||
                        (t.title || '').toLowerCase().includes(globalSearchTerm) ||
                        (r.student_notes || '').toLowerCase().includes(globalSearchTerm);
                });
            }

            document.getElementById('dailyTaskFeedCount').textContent = `${scopedRows.length} entri`;
            if (!scopedRows.length) {
                container.innerHTML = `<div class="bg-white border border-[#EDF1F7] rounded-2xl shadow-card p-10 text-center text-sm text-slate-400">Belum ada laporan Daily Task untuk filter yang dipilih.</div>`;
                return;
            }

            container.innerHTML = scopedRows.map((p, idx) => {
                const s = studentMap[p.student_id] || {};
                const t = taskMap[p.task_id] || { title: 'Daily Task' };
                const stVal = p.status || 'belum_mulai';
                const stObj = STATUS_OPTIONS.find((x) => x.value === stVal) || STATUS_OPTIONS[0];
                const avClass = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
                const todayTag = isTodayIso(p.updated_at) ? `<span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E3F6F3] text-[#2F8F81]">Hari Ini</span>` : '';
                return `
                    <div data-student-id="${p.student_id}" class="bg-white border border-[#EDF1F7] shadow-card rounded-2xl p-4 sm:p-5 space-y-4">
                        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 pb-3.5 border-b border-[#F1F5F9]">
                            <div class="flex items-start gap-3 min-w-0">
                                <div class="w-10 h-10 rounded-full ${avClass} font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                                    ${renderAvatarMarkup(s.avatar_url, s.full_name)}
                                </div>
                                <div class="min-w-0 space-y-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <h3 class="font-bold text-sm sm:text-[15px] text-[#1E293B] leading-snug">${esc(t.title)}</h3>
                                        ${todayTag}
                                    </div>
                                    <div class="text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span class="font-semibold text-slate-600">${esc(s.full_name || '-')}</span>
                                        <span class="font-mono">@${esc(s.username || '-')}</span>
                                        <span>• ${esc(s.class_name || '-')}</span>
                                        <span>• ${esc(s.sub_concentration || 'Umum')}</span>
                                        <span>• ${formatDateTime(p.updated_at)}</span>
                                        ${renderWhatsappLink(s.whatsapp_number, false)}
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 self-start shrink-0">
                                <span class="text-xs font-semibold px-3 py-1 rounded-full border ${stObj.badge}">${stObj.label}</span>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div class="md:col-span-4">
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
                                <select class="prog-status w-full px-3 py-2.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-sm sm:text-xs font-semibold focus:bg-white focus:outline-none focus:border-[#0095FF]">
                                    ${STATUS_OPTIONS.map((o) => `<option value="${o.value}" ${stVal === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                                </select>
                            </div>
                            <div class="md:col-span-5">
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Tautan Portofolio / Preview</label>
                                <div class="flex items-center gap-2">
                                    <input type="url" value="${esc(p.submission_url || '')}" placeholder="https://... (opsional)" class="prog-url flex-1 px-3 py-2.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-base sm:text-xs font-mono focus:bg-white focus:outline-none focus:border-[#0095FF]" />
                                    ${p.submission_url ? `<a href="${esc(p.submission_url)}" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-[#0095FF] hover:underline shrink-0">Buka ↗</a>` : ''}
                                </div>
                            </div>
                            <div class="md:col-span-3 flex items-center gap-2">
                                <button onclick="saveProgressRow('${p.task_id}', '${p.student_id}', this)" class="flex-1 py-2.5 px-3 bg-[#0095FF] hover:bg-[#0082E6] text-white text-sm sm:text-xs font-semibold rounded-xl shadow-blueGlow transition cursor-pointer">Simpan</button>
                                <button type="button" onclick="deleteDailyTaskEntry('${p.task_id}', '${p.student_id}', this)" title="Hapus / batalkan Daily Task ini"
                                    class="py-2.5 px-3 bg-[#FFF1F5] hover:bg-[#F13B6E] text-[#F13B6E] hover:text-white text-sm sm:text-xs font-bold rounded-xl transition cursor-pointer shrink-0">
                                    Hapus
                                </button>
                            </div>
                            <div class="md:col-span-6">
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Catatan Siswa</label>
                                <input type="text" value="${esc(p.student_notes || '')}" placeholder="Catatan siswa..." class="prog-notes w-full px-3 py-2.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-base sm:text-xs focus:bg-white focus:outline-none focus:border-[#0095FF]" />
                            </div>
                            <div class="md:col-span-6">
                                <label class="block text-[11px] font-semibold text-slate-500 mb-1">Feedback Pembimbing</label>
                                <input type="text" value="${esc(p.mentor_feedback || '')}" placeholder="Tuliskan arahan atau revisi..." class="prog-fb w-full px-3 py-2.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-base sm:text-xs focus:bg-white focus:outline-none focus:border-[#0095FF]" />
                            </div>
                            ${(stVal === 'selesai' && p.proof_image) ? `
                            <div class="md:col-span-12 pt-1 flex items-center gap-3 bg-[#F7FAFF] border border-[#DCEBFF] rounded-xl p-2.5">
                                <img src="${esc(p.proof_image)}" alt="Bukti Daily Task" onclick="openProofLightbox(this.src, '${esc(t.title)} — ${esc(s.full_name || '')}')"
                                    class="w-16 h-12 rounded-lg object-cover border border-[#CBD5E1] cursor-pointer hover:opacity-90 shrink-0" />
                                <div class="min-w-0">
                                    <div class="text-xs font-bold text-[#0082E6]">Bukti Penyelesaian Terlampir ✓</div>
                                    <button type="button" onclick="openProofLightbox(this.closest('div').previousElementSibling.src, '${esc(t.title)} — ${esc(s.full_name || '')}')"
                                        class="text-[11px] font-semibold text-slate-500 hover:text-[#0095FF] underline cursor-pointer">Klik untuk perbesar gambar</button>
                                </div>
                            </div>` : ''}
                        </div>
                    </div>`;
            }).join('');
        }
        global.loadDailyTaskFeed = loadDailyTaskFeed;

        global.saveProgressRow = async function (taskId, studentId, btn) {
            const card = btn.closest('[data-student-id]');
            const stVal = card.querySelector('.prog-status').value;
            const { error } = await supabase.from('student_progress').upsert({
                task_id: taskId,
                student_id: studentId,
                status: stVal,
                progress_percent: stVal === 'selesai' ? 100 : 0,
                submission_url: card.querySelector('.prog-url').value.trim() || null,
                student_notes: card.querySelector('.prog-notes').value.trim() || null,
                mentor_feedback: card.querySelector('.prog-fb').value.trim() || null,
                reviewed_by: currentUser.id,
                updated_at: new Date().toISOString()
            }, { onConflict: 'task_id,student_id' });

            const prevText = btn.textContent;
            btn.textContent = error ? 'Gagal' : 'Tersimpan ✓';
            refreshMetrics();
            loadDailyTaskFeed();
            setTimeout(() => { btn.textContent = prevText; }, 1400);
        };

        global.deleteDailyTaskEntry = async function (taskId, studentId, btn) {
            if (!confirm('Hapus / batalkan entri Daily Task siswa ini secara permanen?')) return;
            if (btn) { btn.disabled = true; btn.textContent = '...'; }

            const { error } = await supabase
                .from('student_progress')
                .delete()
                .eq('task_id', taskId)
                .eq('student_id', studentId);

            if (error) {
                if (btn) { btn.disabled = false; btn.textContent = 'Hapus'; }
                showToast(`Gagal menghapus Daily Task: ${error.message}`);
                return;
            }

            // Hapus daily_tasks yang dibuat siswa bila sudah tidak punya progres lain
            const { count } = await supabase
                .from('student_progress')
                .select('id', { count: 'exact', head: true })
                .eq('task_id', taskId);
            if ((count || 0) === 0) {
                await supabase.from('daily_tasks').delete().eq('id', taskId).eq('created_by', studentId);
            }

            showToast('Entri Daily Task siswa berhasil dihapus ✓');
            await Promise.all([loadDailyTaskFeed(), refreshMetrics()]);
        };

        // ==================== HAPUS / BATALKAN SEMUA INPUT SISWA (BULK RESET) ====================
        let scopedStudentsCache = [];

        function populateResetStudentSelect(studentList) {
            const sel = document.getElementById('resetTargetStudentSelect');
            if (!sel) return;
            const prev = sel.value;
            const scopeLabel = expectedRole === 'mentor'
                ? `Semua Siswa Bimbingan (${studentList.length} siswa)`
                : `Semua Siswa (${studentList.length} siswa)`;
            sel.innerHTML = `<option value="ALL">${scopeLabel}</option>` +
                studentList.map((s) => `<option value="${s.id}">${esc(s.full_name)} (@${esc(s.username)}) — ${esc(s.class_name || '-')}</option>`).join('');
            if (prev && (prev === 'ALL' || studentList.some((s) => s.id === prev))) sel.value = prev;
        }

        global.toggleResetInputsBox = function () {
            document.getElementById('resetInputsBox')?.classList.toggle('hidden');
        };

        global.executeResetStudentInputs = async function () {
            const sel = document.getElementById('resetTargetStudentSelect');
            const fb = document.getElementById('resetInputsFeedback');
            const btn = document.getElementById('executeResetInputsBtn');
            const delDaily = document.getElementById('resetOptDaily')?.checked;
            const delProject = document.getElementById('resetOptProject')?.checked;
            const delMaterial = document.getElementById('resetOptMaterial')?.checked;

            if (!delDaily && !delProject && !delMaterial) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = 'Centang minimal satu jenis input siswa yang ingin dihapus.';
                return;
            }

            const targetVal = sel?.value || 'ALL';
            const targetIds = targetVal === 'ALL'
                ? scopedStudentsCache.map((s) => s.id)
                : [targetVal];

            if (!targetIds.length) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = 'Tidak ada siswa dalam cakupan untuk dibersihkan.';
                return;
            }

            const targetLabel = targetVal === 'ALL'
                ? `SEMUA SISWA (${targetIds.length} siswa)`
                : (scopedStudentsCache.find((s) => s.id === targetVal)?.full_name || 'siswa terpilih');
            const chosenTypes = [
                delDaily ? 'Daily Task & Bukti Harian' : '',
                delProject ? 'Pengumpulan & Bukti Project Tracker' : '',
                delMaterial ? 'Tanda Selesai Materi Ajar' : ''
            ].filter(Boolean).join(', ');

            if (!confirm(`PERINGATAN!\n\nHapus / batalkan:\n• ${chosenTypes}\n\nUntuk: ${targetLabel}\n\nData yang dihapus tidak bisa dikembalikan. Lanjutkan?`)) {
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Menghapus data...';
            fb.className = 'text-xs font-semibold text-[#0095FF]';
            fb.textContent = 'Membersihkan input siswa di database...';

            const errors = [];
            if (delDaily) {
                const { error: e1 } = await supabase.from('student_progress').delete().in('student_id', targetIds);
                if (e1) errors.push(`Daily Task progress: ${e1.message}`);
                const { error: e2 } = await supabase.from('daily_tasks').delete().in('created_by', targetIds);
                if (e2) errors.push(`Daily Tasks: ${e2.message}`);
            }
            if (delProject) {
                const { error: e3 } = await supabase.from('project_submissions').delete().in('student_id', targetIds);
                if (e3) errors.push(`Project submissions: ${e3.message}`);
                await Promise.all(
                    targetIds.flatMap((sid) => [
                        supabase.from('app_settings').delete().like('key', `${PROJECT_WEEKLY_PREFIX}%::${sid}`),
                        supabase.from('app_settings').delete().eq('key', `${PROJECT_FB_LOG_PREFIX}${sid}`)
                    ])
                );
            }
            if (delMaterial) {
                const { error: e4 } = await supabase.from('student_material_progress').delete().in('student_id', targetIds);
                if (e4) errors.push(`Progres materi: ${e4.message}`);
            }

            btn.disabled = false;
            btn.textContent = 'Hapus / Batalkan Input Terpilih';

            if (errors.length) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = `Sebagian gagal: ${errors.join(' | ')}`;
            } else {
                fb.className = 'text-xs font-semibold text-[#3FA496]';
                fb.textContent = `Input terpilih untuk ${targetLabel} berhasil dihapus & direset ✓`;
                showToast(`Input siswa (${targetLabel}) berhasil dibersihkan ✓`);
            }

            await Promise.all([refreshMetrics(), loadDailyTaskFeed(), loadProjectTracker()]);
        };

        // ==================== STAFF PROJECT TRACKER (RINGKAS, CHECKLIST PJ SUBKON, MATRIX, UPDATE MINGGUAN & ARSIP) ====================
        let expandedProjectIds = new Set();
        let projectViewMode = 'tasks'; // 'tasks' | 'checklist' | 'weekly' | 'matrix'
        let projectDataCache = { allTasks: [], subMap: {}, studentList: [], allStudentsList: [], weeklyUpdates: [], mentorsList: [], fbLogMap: {}, archives: [], homeroomMap: {}, pjMap: {}, checklistColsMap: {}, checklistRowMap: {} };
        let projectReviewState = { status: 'active', className: '', search: '', page: 1 };
        let projectMatrixState = { className: '', search: '', onlyIssues: false, page: 1 };
        let projectWeeklyState = { weekKey: getWeekKey(), status: 'all', className: '', taskId: '', mentorId: '', search: '', page: 1 };
        let projectChecklistState = { subconc: '', className: '', statusFilter: 'all', search: '' };
        let myHomeroomClass = '';
        let myPjSubconcs = [];
        let staffScopeMode = expectedRole === 'superadmin' ? 'all' : 'mentees'; // 'all' | 'mentees' | 'homeroom'

        global.setStaffScopeMode = function (mode) {
            if (mode === 'homeroom' && myHomeroomClass) staffScopeMode = 'homeroom';
            else if (mode === 'mentees') staffScopeMode = 'mentees';
            else if (mode === 'all' && expectedRole === 'superadmin') staffScopeMode = 'all';
            else staffScopeMode = expectedRole === 'superadmin' ? 'all' : 'mentees';
            loadProjectTracker();
            loadDailyTaskFeed();
        };

        function renderProjectTrackerBody() {
            const container = document.getElementById('projectTasksContainer');
            if (!container) return;

            const { allTasks, subMap, studentList, weeklyUpdates = [], mentorsList = [] } = projectDataCache;
            const stageF = document.getElementById('filterProjectStage')?.value || '';
            const subF = document.getElementById('filterProjectSubconc')?.value || '';
            const filteredTasks = allTasks.filter((t) => {
                if (stageF && t.pipeline_stage !== stageF) return false;
                if (subF && t.sub_concentration !== subF) return false;
                if (!globalSearchTerm) return true;
                return (t.title || '').toLowerCase().includes(globalSearchTerm) ||
                    (t.description || '').toLowerCase().includes(globalSearchTerm) ||
                    (t.pipeline_stage || '').toLowerCase().includes(globalSearchTerm);
            });

            if (!filteredTasks.length) {
                container.innerHTML = `<div class="bg-white border border-[#EDF1F7] rounded-2xl shadow-card p-10 text-center text-sm text-slate-400">Belum ada tugas project untuk filter ini. Tambahkan tugas project &amp; deadline di form atas atau Import Excel (.xlsx).</div>`;
                return;
            }

            const classes = [...new Set(studentList.map((s) => s.class_name).filter(Boolean))].sort();
            const currentWeekKey = getWeekKey();
            const weeklyByKey = {};
            weeklyUpdates.forEach((u) => {
                weeklyByKey[`${u.week_key}__${u.project_task_id}__${u.student_id}`] = u;
            });

            // Hitung siswa yang belum update minggu ini untuk badge tombol tab
            let missingWeeklyCount = 0;
            studentList.forEach((s) => {
                const activeTasks = allTasks.filter((t) => {
                    if (t.sub_concentration && s.sub_concentration !== t.sub_concentration) return false;
                    return (subMap[`${t.id}__${s.id}`]?.status || 'belum_mulai') !== 'selesai';
                });
                if (!activeTasks.length) return;
                const hasAnyThisWeek = activeTasks.some((t) => Boolean(weeklyByKey[`${currentWeekKey}__${t.id}__${s.id}`]));
                if (!hasAnyThisWeek) missingWeeklyCount++;
            });

            const modeSwitcherHtml = `
                <div class="flex flex-wrap items-center justify-between gap-2.5 bg-white border border-[#EDF1F7] rounded-2xl shadow-card px-4 py-2.5">
                    <div class="inline-flex flex-wrap p-1 bg-[#F3F6FB] rounded-xl gap-1">
                        <button type="button" onclick="setProjectViewMode('tasks')"
                            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${projectViewMode === 'tasks' ? 'bg-[#0095FF] text-white shadow-sm' : 'text-slate-500 hover:text-[#1E293B]'}">
                            📋 Daftar Tugas &amp; Review (${filteredTasks.length})
                        </button>
                        <button type="button" onclick="setProjectViewMode('checklist')"
                            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${projectViewMode === 'checklist' ? 'bg-[#0095FF] text-white shadow-sm' : 'text-slate-500 hover:text-[#1E293B]'}">
                            <span>✅ Checklist PJ Subkon</span>
                            ${myPjSubconcs.length ? `<span class="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${projectViewMode === 'checklist' ? 'bg-white/25 text-white' : 'bg-[#E7F9EE] text-[#15803D]'}">PJ</span>` : ''}
                        </button>
                        <button type="button" onclick="setProjectViewMode('weekly')"
                            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${projectViewMode === 'weekly' ? 'bg-[#0095FF] text-white shadow-sm' : 'text-slate-500 hover:text-[#1E293B]'}">
                            <span>📅 Update Mingguan</span>
                            ${missingWeeklyCount > 0 ? `<span class="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${projectViewMode === 'weekly' ? 'bg-white/25 text-white' : 'bg-[#FFF0F4] text-[#E11D48]'} num-tabular">${missingWeeklyCount} belum</span>` : ''}
                        </button>
                        <button type="button" onclick="setProjectViewMode('matrix')"
                            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${projectViewMode === 'matrix' ? 'bg-[#0095FF] text-white shadow-sm' : 'text-slate-500 hover:text-[#1E293B]'}">
                            📊 Matrix Semua Siswa (${studentList.length})
                        </button>
                    </div>
                    <span class="text-[11px] text-slate-400 hidden sm:inline">
                        ${projectViewMode === 'checklist'
                            ? 'Diisi oleh Guru PJ Sub-Konsentrasi (Done / Proses / Revisi + Notes) dan langsung terpantau Pembimbing masing-masing.'
                            : (projectViewMode === 'weekly'
                                ? 'Pantau progres mingguan tiap tugas &amp; siswa lintas sub-konsentrasi.'
                                : (projectViewMode === 'tasks' ? 'Klik "Review Siswa" pada tugas untuk memeriksa bukti &amp; memberi revisi.' : 'Klik kotak status pada tabel untuk langsung me-review siswa tersebut.'))}
                    </span>
                </div>`;

            // ==================== MODE 4: CHECKLIST PJ SUB-KONSENTRASI (DIISI PJ SUBKON -> DIBACA PEMBIMBING) ====================
            if (projectViewMode === 'checklist') {
                const { allStudentsList = [], checklistColsMap = {}, checklistRowMap = {}, pjMap = {} } = projectDataCache;
                const mentorMap = Object.fromEntries(mentorsList.map((m) => [m.id, m]));
                // Tentukan default subkon: jika PJ subkon -> pilih subkon PJ pertamanya; jika superadmin -> pilih subkon pertama; jika pembimbing biasa -> '' (semua siswa bimbingan)
                let activeSc = projectChecklistState.subconc;
                if (!activeSc && (expectedRole === 'superadmin' || myPjSubconcs.length > 0)) {
                    activeSc = myPjSubconcs[0] || SUBCONCS[0];
                    projectChecklistState.subconc = activeSc;
                }

                const canEditActiveSc = expectedRole === 'superadmin' || (activeSc && myPjSubconcs.includes(activeSc));
                // Daftar nama PJ untuk subkon aktif
                const pjNamesForActiveSc = activeSc
                    ? mentorsList.filter((m) => Array.isArray(pjMap[m.id]) && pjMap[m.id].includes(activeSc)).map((m) => m.full_name)
                    : [];

                // Sumber siswa:
                // - Jika Superadmin atau PJ untuk subkon aktif -> lihat SEMUA siswa di subkon tersebut (lintas kelas & lintas pembimbing!)
                // - Jika Pembimbing biasa / Walas (bukan PJ subkon aktif) -> lihat siswa bimbingan / kelas perwaliannya saja
                const baseStudents = (expectedRole === 'superadmin' || canEditActiveSc)
                    ? allStudentsList.filter((s) => !activeSc || s.sub_concentration === activeSc)
                    : studentList.filter((s) => !activeSc || s.sub_concentration === activeSc);

                const ckCls = projectChecklistState.className || '';
                const ckStFilter = projectChecklistState.statusFilter || 'all';
                const ckSearch = (projectChecklistState.search || '').trim().toLowerCase();
                const ckClasses = [...new Set(baseStudents.map((s) => s.class_name).filter(Boolean))].sort();

                const activeCols = activeSc
                    ? (checklistColsMap[activeSc] || DEFAULT_CHECKLIST_COLS)
                    : [...new Set(SUBCONCS.flatMap((sc) => checklistColsMap[sc] || DEFAULT_CHECKLIST_COLS))];

                const filteredRows = baseStudents.filter((s) => {
                    if (ckCls && s.class_name !== ckCls) return false;
                    if (ckSearch) {
                        const hit = (s.full_name || '').toLowerCase().includes(ckSearch) ||
                            (s.username || '').toLowerCase().includes(ckSearch) ||
                            (s.class_name || '').toLowerCase().includes(ckSearch) ||
                            (s.sub_concentration || '').toLowerCase().includes(ckSearch);
                        if (!hit) return false;
                    }
                    const rowData = checklistRowMap[s.id] || { items: {} };
                    const colsForStu = s.sub_concentration ? (checklistColsMap[s.sub_concentration] || DEFAULT_CHECKLIST_COLS) : activeCols;
                    const doneCnt = colsForStu.filter((c) => rowData.items?.[c] === 'done').length;
                    const revCnt = colsForStu.filter((c) => rowData.items?.[c] === 'revisi').length;
                    if (ckStFilter === 'all_done') return colsForStu.length > 0 && doneCnt === colsForStu.length;
                    if (ckStFilter === 'not_done') return doneCnt < colsForStu.length;
                    if (ckStFilter === 'revisi') return revCnt > 0;
                    return true;
                });

                const totalDoneAll = baseStudents.filter((s) => {
                    const cols = s.sub_concentration ? (checklistColsMap[s.sub_concentration] || DEFAULT_CHECKLIST_COLS) : activeCols;
                    const rowData = checklistRowMap[s.id] || { items: {} };
                    return cols.length > 0 && cols.every((c) => rowData.items?.[c] === 'done');
                }).length;
                const totalRevisiAll = baseStudents.filter((s) => {
                    const cols = s.sub_concentration ? (checklistColsMap[s.sub_concentration] || DEFAULT_CHECKLIST_COLS) : activeCols;
                    const rowData = checklistRowMap[s.id] || { items: {} };
                    return cols.some((c) => rowData.items?.[c] === 'revisi');
                }).length;
                const totalNotDoneAll = baseStudents.length - totalDoneAll;

                const subconcTabs = [
                    ...(expectedRole === 'mentor' ? [{ val: '', label: `Semua Siswa ${staffScopeMode === 'homeroom' && myHomeroomClass ? myHomeroomClass : 'Bimbingan'}` }] : []),
                    ...SUBCONCS.map((sc) => ({
                        val: sc,
                        label: `${sc}${myPjSubconcs.includes(sc) ? ' ★PJ' : ''}`
                    }))
                ];

                container.innerHTML = `
                    ${modeSwitcherHtml}
                    <div class="bg-white border border-[#EDF1F7] rounded-2xl shadow-card overflow-hidden">
                        <div class="p-4 sm:p-5 border-b border-[#EDF1F7] bg-[#F7FAFF] space-y-4">
                            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                <div class="space-y-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${canEditActiveSc ? 'bg-[#E7F9EE] text-[#15803D]' : 'bg-[#EAF4FF] text-[#0082E6]'}">
                                            ${canEditActiveSc ? '✏️ Mode Edit PJ Sub-Konsentrasi / Admin' : '👁️ Mode Pantau Pembimbing (Diisi oleh PJ Subkon)'}
                                        </span>
                                        ${activeSc ? `<span class="text-[11px] font-bold text-slate-500">PJ ${esc(activeSc)}: <strong class="text-[#1E293B]">${pjNamesForActiveSc.length ? esc(pjNamesForActiveSc.join(', ')) : 'Belum ditetapkan (atur di Akun & Plotting)'}</strong></span>` : ''}
                                    </div>
                                    <h3 class="text-base font-extrabold text-[#1E293B]">✅ Checklist Project Update PJ Sub-Konsentrasi</h3>
                                    <p class="text-xs text-slate-500">
                                        ${canEditActiveSc
                                            ? 'Klik status tiap kolom tahapan untuk langsung menyimpan (Belum / Proses / Revisi / Done) dan tulis Notes — otomatis langsung terlihat oleh Guru Pembimbing masing-masing siswa.'
                                            : 'Menampilkan hasil pengecekan & catatan (Notes) terbaru dari Guru PJ Sub-Konsentrasi untuk siswa bimbingan Anda.'}
                                    </p>
                                </div>
                                <div class="flex flex-wrap items-center gap-2 shrink-0">
                                    <button type="button" onclick="exportChecklistXlsx()"
                                        class="px-3.5 py-2 rounded-xl bg-[#E2F5F2] hover:bg-[#4CB6A7] text-[#1D5E55] hover:text-white text-xs font-bold transition cursor-pointer">
                                        📥 Export Checklist (.xlsx)
                                    </button>
                                </div>
                            </div>

                            <!-- Tab Pilih Sub-Konsentrasi (Seperti Tab 2D / 3D di Spreadsheet) -->
                            <div class="flex flex-wrap items-center gap-1.5">
                                ${subconcTabs.map((tab) => `
                                    <button type="button" onclick="setChecklistSubconc('${esc(tab.val)}')"
                                        class="px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${activeSc === tab.val
                                            ? 'bg-[#0095FF] text-white border-[#0095FF] shadow-sm'
                                            : 'bg-white text-slate-600 border-[#E2E8F0] hover:border-[#0095FF]'}">
                                        ${esc(tab.label)}
                                    </button>`).join('')}
                            </div>

                            <!-- Kelola Kolom Tahapan (Khusus PJ Subkon aktif / Superadmin) -->
                            ${canEditActiveSc && activeSc ? `
                            <div class="rounded-xl bg-white border border-[#DCEBFF] p-3.5 space-y-2.5">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#0082E6]">Kolom Tahapan Checklist — ${esc(activeSc)}</span>
                                    <button type="button" onclick="syncChecklistColsFromTasks('${esc(activeSc)}')"
                                        class="px-2.5 py-1 rounded-lg bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white text-[11px] font-bold transition cursor-pointer">
                                        ↻ Tarik dari Daftar Tugas Project
                                    </button>
                                </div>
                                <div class="flex flex-wrap items-center gap-1.5">
                                    ${activeCols.map((col, ci) => `
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7FAFF] border border-[#DCEBFF] text-xs font-bold text-[#1E293B]">
                                            <span>${ci + 1}. ${esc(col)}</span>
                                            ${activeCols.length > 1 ? `<button type="button" onclick="removeChecklistColumn('${esc(activeSc)}', ${ci})" title="Hapus kolom tahapan ini" class="text-slate-400 hover:text-[#E11D48] font-extrabold cursor-pointer">✕</button>` : ''}
                                        </span>`).join('')}
                                </div>
                                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                    <input id="newChecklistColInput" type="text" placeholder="Tambah kolom tahapan baru... (mis: Blocking, Lighting, Grading, Final Film + Credit Title)"
                                        class="flex-1 px-3 py-2 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#0095FF]" />
                                    <button type="button" onclick="addChecklistColumn('${esc(activeSc)}')"
                                        class="px-4 py-2 rounded-xl bg-[#0095FF] hover:bg-[#0082E6] text-white text-xs font-bold transition cursor-pointer shrink-0">
                                        + Tambah Kolom
                                    </button>
                                </div>
                            </div>` : ''}

                            <!-- KPI + Filter Bar -->
                            <div class="grid grid-cols-3 gap-2.5 num-tabular">
                                <div class="bg-[#E7F9EE] border border-[#BBF7D0] rounded-xl px-3.5 py-2">
                                    <div class="text-[11px] font-semibold text-[#15803D]">✓ Semua Done</div>
                                    <div class="text-lg font-extrabold text-[#15803D]">${totalDoneAll} / ${baseStudents.length}</div>
                                </div>
                                <div class="bg-[#FFF6D6] border border-[#FDE68A] rounded-xl px-3.5 py-2">
                                    <div class="text-[11px] font-semibold text-[#B88600]">⏳ Belum Tuntas Semua</div>
                                    <div class="text-lg font-extrabold text-[#B88600]">${totalNotDoneAll} siswa</div>
                                </div>
                                <div class="bg-[#FFF0F4] border border-[#FECDD6] rounded-xl px-3.5 py-2">
                                    <div class="text-[11px] font-semibold text-[#E11D48]">! Ada Revisi</div>
                                    <div class="text-lg font-extrabold text-[#E11D48]">${totalRevisiAll} siswa</div>
                                </div>
                            </div>

                            <div class="flex flex-wrap items-center gap-2">
                                <select onchange="setChecklistClass(this.value)" class="px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0095FF]">
                                    <option value="">Semua Kelas</option>
                                    ${ckClasses.map((c) => `<option value="${esc(c)}" ${ckCls === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                                </select>
                                <select onchange="setChecklistStatusFilter(this.value)" class="px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0095FF]">
                                    <option value="all" ${ckStFilter === 'all' ? 'selected' : ''}>Semua Status (${baseStudents.length})</option>
                                    <option value="not_done" ${ckStFilter === 'not_done' ? 'selected' : ''}>Belum Tuntas (${totalNotDoneAll})</option>
                                    <option value="revisi" ${ckStFilter === 'revisi' ? 'selected' : ''}>Ada Revisi (${totalRevisiAll})</option>
                                    <option value="all_done" ${ckStFilter === 'all_done' ? 'selected' : ''}>Semua Done (${totalDoneAll})</option>
                                </select>
                                <input id="checklistSearchInp" type="text" value="${esc(projectChecklistState.search)}" oninput="setChecklistSearch(this.value)"
                                    placeholder="Cari nama siswa / kelas..."
                                    class="flex-1 min-w-[180px] max-w-xs px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs focus:outline-none focus:border-[#0095FF]" />
                                <span class="ml-auto text-[11px] font-semibold text-slate-400 num-tabular">${filteredRows.length} siswa ditampilkan</span>
                            </div>
                        </div>

                        <!-- Tabel Checklist Persis Spreadsheet 2D/3D -->
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr class="border-b border-[#EDF1F7] bg-[#F7FAFF] text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                                        <th class="py-3 px-3 w-10 text-center">No</th>
                                        <th class="py-3 px-3 sticky left-0 bg-[#F7FAFF] z-10 min-w-[220px] border-r border-[#EDF1F7]">Nama Siswa &amp; Drive</th>
                                        <th class="py-3 px-2.5 min-w-[115px]">Pembimbing</th>
                                        ${activeCols.map((col) => `<th class="py-3 px-2.5 text-center min-w-[125px]">${esc(col)}</th>`).join('')}
                                        <th class="py-3 px-3 min-w-[230px]">Notes (Catatan PJ Subkon)</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-[#F1F5F9]">
                                    ${filteredRows.length ? filteredRows.map((s, idx) => {
                                        const rowData = checklistRowMap[s.id] || { items: {}, notes: '', updated_by: '', updated_at: null };
                                        const stuSubconc = s.sub_concentration || '';
                                        const stuCanEdit = expectedRole === 'superadmin' || (stuSubconc && myPjSubconcs.includes(stuSubconc));
                                        const stuColsSet = new Set(stuSubconc ? (checklistColsMap[stuSubconc] || DEFAULT_CHECKLIST_COLS) : activeCols);
                                        const mentorObj = s.mentor_id ? mentorMap[s.mentor_id] : null;
                                        const notDoneList = activeCols.filter((c) => stuColsSet.has(c) && rowData.items?.[c] !== 'done');
                                        const waText = notDoneList.length
                                            ? `Halo ${s.full_name}, update checklist project (${stuSubconc || 'Animasi'}) dari PJ Subkon — tahapan yang belum Done: ${notDoneList.join(', ')}.${rowData.notes ? ` Catatan PJ: ${rowData.notes}` : ''} Mohon segera ditindaklanjuti ya.`
                                            : `Halo ${s.full_name}, selamat! Semua tahapan checklist project kamu sudah Done ✓`;

                                        return `
                                            <tr class="hover:bg-[#F8FBFF] align-middle">
                                                <td class="py-2.5 px-3 text-center font-mono text-slate-400">${idx + 1}</td>
                                                <td class="py-2.5 px-3 sticky left-0 bg-white z-10 border-r border-[#EDF1F7]">
                                                    <div class="font-bold text-[#1E293B] truncate max-w-[205px]">${esc(s.full_name)}</div>
                                                    <div class="text-[10.5px] text-slate-400 truncate">
                                                        ${esc(s.class_name || '-')} • <span class="font-semibold text-[#0082E6]">${esc(stuSubconc || 'Belum pilih subkon')}</span>
                                                    </div>
                                                    <div class="flex flex-wrap items-center gap-1 mt-1">
                                                        ${renderWhatsappLink(s.whatsapp_number, true, waText)}
                                                        ${s.project_drive_url
                                                            ? `<a href="${esc(s.project_drive_url)}" target="_blank" rel="noopener noreferrer" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white transition">📁 Drive ↗</a>`
                                                            : `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">Drive -</span>`}
                                                    </div>
                                                </td>
                                                <td class="py-2.5 px-2.5 text-[11px] text-slate-600">
                                                    ${mentorObj ? `<span class="font-semibold">${esc(mentorObj.full_name)}</span>` : `<span class="text-slate-300">Belum di-plot</span>`}
                                                </td>
                                                ${activeCols.map((col) => {
                                                    if (!stuColsSet.has(col)) return `<td class="py-2.5 px-2 text-center text-slate-200">·</td>`;
                                                    const stVal = rowData.items?.[col] || 'belum';
                                                    const stOpt = CHECKLIST_STATUS_OPTIONS.find((o) => o.value === stVal) || CHECKLIST_STATUS_OPTIONS[0];
                                                    if (stuCanEdit) {
                                                        return `
                                                            <td class="py-2.5 px-2 text-center">
                                                                <select onchange="updateChecklistCell('${s.id}', '${encodeURIComponent(col)}', this.value, this)"
                                                                    class="w-full px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer focus:outline-none ${stOpt.cls}">
                                                                    ${CHECKLIST_STATUS_OPTIONS.map((o) => `<option value="${o.value}" ${stVal === o.value ? 'selected' : ''}>${o.short}</option>`).join('')}
                                                                </select>
                                                            </td>`;
                                                    }
                                                    return `
                                                        <td class="py-2.5 px-2 text-center">
                                                            <span class="inline-block px-2.5 py-1 rounded-lg border text-[11px] font-bold ${stOpt.cls}">${stOpt.short}</span>
                                                        </td>`;
                                                }).join('')}
                                                <td class="py-2.5 px-3">
                                                    ${stuCanEdit ? `
                                                        <div class="flex items-center gap-1.5">
                                                            <input id="ckNote_${s.id}" type="text" value="${esc(rowData.notes || '')}" placeholder="Tulis catatan PJ untuk siswa &amp; pembimbing..."
                                                                onkeydown="if(event.key==='Enter'){saveChecklistNote('${s.id}');}"
                                                                class="flex-1 px-2.5 py-1.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-xs focus:bg-white focus:outline-none focus:border-[#0095FF]" />
                                                            <button type="button" onclick="saveChecklistNote('${s.id}', this)"
                                                                class="px-2.5 py-1.5 rounded-lg bg-[#0095FF] hover:bg-[#0082E6] text-white text-[10.5px] font-bold transition cursor-pointer shrink-0">
                                                                Simpan
                                                            </button>
                                                        </div>` : `
                                                        <div class="text-xs ${rowData.notes ? 'text-slate-700' : 'text-slate-300 italic'}">${esc(rowData.notes || 'Belum ada catatan PJ')}</div>`}
                                                    ${rowData.updated_at ? `<div class="text-[9.5px] text-slate-400 mt-1">Update: ${esc(rowData.updated_by || 'PJ')} • ${esc(formatDateTime(rowData.updated_at))}</div>` : ''}
                                                </td>
                                            </tr>`;
                                    }).join('') : `<tr><td colspan="${activeCols.length + 4}" class="p-8 text-center text-slate-400">Belum ada siswa pada Sub-Konsentrasi / filter ini. Pastikan siswa sudah memilih / di-plot Sub-Konsentrasi di tab Akun &amp; Plotting.</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>`;
                return;
            }

            // ==================== MODE 3: PROJECT UPDATE MINGGUAN (PER MINGGU × TUGAS × SISWA) ====================
            if (projectViewMode === 'weekly') {
                const selectedWeek = projectWeeklyState.weekKey || currentWeekKey;
                const weekInfo = getWeekRangeInfo(selectedWeek);
                const weekOptions = getRecentWeekKeys(8, weeklyUpdates.map((u) => u.week_key));
                const mentorMap = Object.fromEntries(mentorsList.map((m) => [m.id, m]));
                const wStatus = projectWeeklyState.status || 'all';
                const wCls = projectWeeklyState.className || '';
                const wTask = projectWeeklyState.taskId || '';
                const wMentor = projectWeeklyState.mentorId || '';
                const wSearch = (projectWeeklyState.search || '').trim().toLowerCase();

                const scopedTasksForWeekly = wTask ? filteredTasks.filter((t) => t.id === wTask) : filteredTasks;

                const studentWeeklyRows = studentList
                    .filter((s) => {
                        if (wCls && s.class_name !== wCls) return false;
                        if (subF && s.sub_concentration !== subF) return false;
                        if (expectedRole === 'superadmin' && wMentor && s.mentor_id !== wMentor) return false;
                        if (!wSearch) return true;
                        return (s.full_name || '').toLowerCase().includes(wSearch) ||
                            (s.username || '').toLowerCase().includes(wSearch) ||
                            (s.sub_concentration || '').toLowerCase().includes(wSearch) ||
                            (s.class_name || '').toLowerCase().includes(wSearch);
                    })
                    .map((s) => {
                        const relevantTasks = scopedTasksForWeekly.filter((t) => !t.sub_concentration || s.sub_concentration === t.sub_concentration);
                        const taskEntries = relevantTasks.map((t) => {
                            const ps = subMap[`${t.id}__${s.id}`] || {};
                            const stVal = ps.status || 'belum_mulai';
                            const upd = weeklyByKey[`${selectedWeek}__${t.id}__${s.id}`] || null;
                            return { task: t, submission: ps, status: stVal, isAcc: stVal === 'selesai', update: upd };
                        });
                        const activeEntries = taskEntries.filter((e) => !e.isAcc);
                        const updatedCount = taskEntries.filter((e) => Boolean(e.update)).length;
                        const activeUpdatedCount = activeEntries.filter((e) => Boolean(e.update)).length;
                        const uncheckedCount = taskEntries.filter((e) => e.update && !e.update.checked_at).length;

                        let overallState = 'belum'; // 'sudah' | 'sebagian' | 'belum' | 'all_acc' | 'no_task'
                        if (!taskEntries.length) overallState = 'no_task';
                        else if (!activeEntries.length) overallState = 'all_acc';
                        else if (activeUpdatedCount === activeEntries.length) overallState = 'sudah';
                        else if (activeUpdatedCount > 0) overallState = 'sebagian';
                        else overallState = 'belum';

                        return {
                            student: s,
                            mentor: s.mentor_id ? mentorMap[s.mentor_id] : null,
                            taskEntries,
                            activeCount: activeEntries.length,
                            updatedCount,
                            activeUpdatedCount,
                            uncheckedCount,
                            overallState
                        };
                    });

                const kpiTotal = studentWeeklyRows.filter((r) => r.overallState !== 'no_task').length;
                const kpiSudah = studentWeeklyRows.filter((r) => r.overallState === 'sudah' || r.overallState === 'all_acc').length;
                const kpiSebagian = studentWeeklyRows.filter((r) => r.overallState === 'sebagian').length;
                const kpiBelum = studentWeeklyRows.filter((r) => r.overallState === 'belum').length;
                const kpiUnchecked = studentWeeklyRows.reduce((sum, r) => sum + r.uncheckedCount, 0);

                const displayRows = studentWeeklyRows.filter((r) => {
                    if (r.overallState === 'no_task') return false;
                    if (wStatus === 'belum') return r.overallState === 'belum' || r.overallState === 'sebagian';
                    if (wStatus === 'sudah') return r.overallState === 'sudah' || r.overallState === 'all_acc';
                    if (wStatus === 'unchecked') return r.uncheckedCount > 0;
                    return true;
                });

                const perPage = 15;
                const totalPages = Math.max(1, Math.ceil(displayRows.length / perPage));
                if (projectWeeklyState.page > totalPages) projectWeeklyState.page = totalPages;
                const startIdx = (projectWeeklyState.page - 1) * perPage;
                const pageRows = displayRows.slice(startIdx, startIdx + perPage);

                container.innerHTML = `
                    ${modeSwitcherHtml}
                    <div class="bg-white border border-[#EDF1F7] rounded-2xl shadow-card overflow-hidden">
                        <div class="p-4 sm:p-5 border-b border-[#EDF1F7] bg-[#F7FAFF] space-y-4">
                            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                <div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#EAF4FF] text-[#0082E6]">Pantauan Mingguan Pembimbing &amp; Admin</span>
                                        <span class="text-[11px] font-bold text-slate-500">${esc(weekInfo.label)}</span>
                                    </div>
                                    <h3 class="text-base font-extrabold text-[#1E293B] mt-1">📅 Project Update Mingguan Siswa (Lintas Sub-Konsentrasi)</h3>
                                    <p class="text-xs text-slate-500 mt-0.5">Memudahkan pembimbing memantau apakah tiap siswa bimbingan sudah memberi update progres minggu ini pada masing-masing tugas, walau pembimbing bukan PJ sub-konsentrasi.</p>
                                </div>
                                <div class="shrink-0">
                                    <select onchange="setProjectWeeklyWeek(this.value)"
                                        class="w-full sm:w-auto px-3.5 py-2.5 bg-white border-2 border-[#0095FF] rounded-xl text-xs font-bold text-[#1E293B] focus:outline-none">
                                        ${weekOptions.map((wk) => `<option value="${esc(wk)}" ${wk === selectedWeek ? 'selected' : ''}>${esc(getWeekRangeInfo(wk).label)}</option>`).join('')}
                                    </select>
                                </div>
                            </div>

                            <!-- 4 KPI Ringkasan Mingguan -->
                            <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 num-tabular">
                                <div class="bg-white border border-[#EDF1F7] rounded-xl px-3.5 py-2.5">
                                    <div class="text-[11px] font-semibold text-slate-400">Siswa Dipantau</div>
                                    <div class="text-lg font-extrabold text-[#1E293B]">${kpiTotal}</div>
                                </div>
                                <div class="bg-[#E7F9EE] border border-[#BBF7D0] rounded-xl px-3.5 py-2.5">
                                    <div class="text-[11px] font-semibold text-[#15803D]">Sudah Update Lengkap</div>
                                    <div class="text-lg font-extrabold text-[#15803D]">${kpiSudah}${kpiSebagian ? ` <span class="text-xs font-bold text-[#B88600]">(+${kpiSebagian} sebagian)</span>` : ''}</div>
                                </div>
                                <div class="bg-[#FFF0F4] border border-[#FECDD6] rounded-xl px-3.5 py-2.5">
                                    <div class="text-[11px] font-semibold text-[#E11D48]">Belum Update Minggu Ini</div>
                                    <div class="text-lg font-extrabold text-[#E11D48]">${kpiBelum}</div>
                                </div>
                                <div class="bg-[#FFFDF5] border border-[#FDE68A] rounded-xl px-3.5 py-2.5">
                                    <div class="text-[11px] font-semibold text-[#B88600]">Update Belum Dicek Guru</div>
                                    <div class="text-lg font-extrabold text-[#B88600]">${kpiUnchecked}</div>
                                </div>
                            </div>

                            <!-- Toolbar Filter -->
                            <div class="flex flex-wrap items-center gap-2">
                                <div class="inline-flex p-1 bg-white border border-[#E2E8F0] rounded-xl gap-1">
                                    ${[
                                        { k: 'all', l: `Semua (${kpiTotal})` },
                                        { k: 'belum', l: `Belum / Sebagian (${kpiBelum + kpiSebagian})` },
                                        { k: 'sudah', l: `Sudah Update (${kpiSudah})` },
                                        { k: 'unchecked', l: `Perlu Dicek (${kpiUnchecked})` }
                                    ].map((t) => `
                                        <button type="button" onclick="setProjectWeeklyStatus('${t.k}')"
                                            class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${wStatus === t.k ? 'bg-[#0095FF] text-white' : 'text-slate-600 hover:bg-[#F4F8FF]'}">
                                            ${t.l}
                                        </button>`).join('')}
                                </div>
                                <select onchange="setProjectWeeklyClass(this.value)" class="px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0095FF]">
                                    <option value="">Semua Kelas</option>
                                    ${classes.map((c) => `<option value="${esc(c)}" ${wCls === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                                </select>
                                <select onchange="setProjectWeeklyTask(this.value)" class="px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-700 max-w-[220px] focus:outline-none focus:border-[#0095FF]">
                                    <option value="">Semua Tugas Project</option>
                                    ${filteredTasks.map((t) => `<option value="${esc(t.id)}" ${wTask === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
                                </select>
                                ${expectedRole === 'superadmin' ? `
                                <select onchange="setProjectWeeklyMentor(this.value)" class="px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0095FF]">
                                    <option value="">Semua Pembimbing</option>
                                    ${mentorsList.map((m) => `<option value="${esc(m.id)}" ${wMentor === m.id ? 'selected' : ''}>${esc(m.full_name)}</option>`).join('')}
                                </select>` : ''}
                                <input id="projWeeklySearchInp" type="text" value="${esc(projectWeeklyState.search)}" oninput="setProjectWeeklySearch(this.value)"
                                    placeholder="Cari nama siswa / sub-konsentrasi..."
                                    class="flex-1 min-w-[180px] px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs focus:outline-none focus:border-[#0095FF]" />
                            </div>
                        </div>

                        <!-- Daftar Siswa & Detail Update Mingguan Tiap Tugas -->
                        <div class="divide-y divide-[#EDF1F7]">
                            ${pageRows.length ? pageRows.map((row) => {
                                const s = row.student;
                                const stateBadge = row.overallState === 'all_acc'
                                    ? `<span class="px-2.5 py-1 rounded-full bg-[#E3F6F3] text-[#1D5E55] text-[11px] font-extrabold">✓ Semua Tugas ACC</span>`
                                    : row.overallState === 'sudah'
                                        ? `<span class="px-2.5 py-1 rounded-full bg-[#E7F9EE] text-[#15803D] text-[11px] font-extrabold">✓ Sudah Update (${row.activeUpdatedCount}/${row.activeCount})</span>`
                                        : row.overallState === 'sebagian'
                                            ? `<span class="px-2.5 py-1 rounded-full bg-[#FFF6D6] text-[#B88600] text-[11px] font-extrabold">⚠️ Update Sebagian (${row.activeUpdatedCount}/${row.activeCount})</span>`
                                            : `<span class="px-2.5 py-1 rounded-full bg-[#FFF0F4] text-[#E11D48] text-[11px] font-extrabold">✕ Belum Update Minggu Ini</span>`;

                                const missingTaskTitles = row.taskEntries.filter((e) => !e.isAcc && !e.update).map((e) => e.task.title);
                                const waReminderText = missingTaskTitles.length
                                    ? `Halo ${s.full_name}, tolong segera isi Project Update Mingguan (${weekInfo.label}) di AniTrack untuk tugas: ${missingTaskTitles.join(', ')}. Terima kasih.`
                                    : `Halo ${s.full_name}, terima kasih sudah mengisi Project Update Mingguan di AniTrack.`;

                                return `
                                    <div class="p-4 sm:p-5 space-y-3 hover:bg-[#FAFBFD]/70 transition">
                                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                            <div class="flex items-center gap-3 min-w-0">
                                                <div class="w-10 h-10 rounded-full bg-[#EAF4FF] text-[#0095FF] font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                                                    ${renderAvatarMarkup(s.avatar_url, s.full_name)}
                                                </div>
                                                <div class="min-w-0">
                                                    <div class="flex flex-wrap items-center gap-1.5">
                                                        <span class="font-extrabold text-sm text-[#1E293B] truncate">${esc(s.full_name)}</span>
                                                        <span class="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-[#F1F5F9] text-slate-600">${esc(s.class_name || '-')}</span>
                                                        <span class="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-[#EAF4FF] text-[#0082E6]">${esc(s.sub_concentration || 'Umum')}</span>
                                                        ${(() => {
                                                            const st = computeStudentIssueStats(s, allTasks, subMap);
                                                            const logsCnt = (projectDataCache.fbLogMap?.[s.id] || []).length;
                                                            return `${st.goldCount > 0 ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#FFF6D6] text-[#9A6F00]">🌟 ${st.goldCount} Emas</span>` : ''}${st.totalIssues > 0 ? `<span title="${esc(st.detailText)}" class="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#FFF0F4] text-[#E11D48]">⚠️ ${st.totalIssues} Masalah</span>` : ''}${logsCnt > 0 ? `<button type="button" onclick="openStudentFeedbackHistory('${s.id}')" class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-[#E2E8F0] hover:border-[#0095FF] text-slate-600 hover:text-[#0082E6] cursor-pointer">📜 Catatan (${logsCnt})</button>` : ''}`;
                                                        })()}
                                                    </div>
                                                    <div class="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                                                        <span class="font-mono">@${esc(s.username)}</span>
                                                        ${row.mentor ? `<span>• Pembimbing: <strong class="text-slate-600">${esc(row.mentor.full_name)}</strong></span>` : ''}
                                                        ${renderWhatsappLink(s.whatsapp_number, false, waReminderText)}
                                                        ${s.project_drive_url ? `<a href="${esc(s.project_drive_url)}" target="_blank" rel="noopener noreferrer" class="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white transition">📁 Drive ↗</a>` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="self-start sm:self-center shrink-0">${stateBadge}</div>
                                        </div>

                                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-2.5 pl-0 sm:pl-13">
                                            ${row.taskEntries.map((entry) => {
                                                const t = entry.task;
                                                const u = entry.update;
                                                const stObj = STATUS_OPTIONS.find((o) => o.value === entry.status) || STATUS_OPTIONS[0];
                                                if (entry.isAcc && !u) {
                                                    return `
                                                        <div class="rounded-xl border border-[#BBE9E2] bg-[#F2FBF9] p-3 flex items-center justify-between gap-2 text-xs">
                                                            <div class="min-w-0">
                                                                <div class="font-bold text-[#1D5E55] truncate">${esc(t.title)}</div>
                                                                <div class="text-[10.5px] text-[#2F8F81]">${esc(t.pipeline_stage)} • Sudah Selesai (ACC)</div>
                                                            </div>
                                                            <span class="px-2 py-0.5 rounded-md bg-[#E3F6F3] text-[#1D5E55] text-[10.5px] font-bold shrink-0">✓ ACC</span>
                                                        </div>`;
                                                }
                                                if (!u) {
                                                    return `
                                                        <div class="rounded-xl border border-[#FECDD6] bg-[#FFF8FA] p-3 flex items-center justify-between gap-2 text-xs">
                                                            <div class="min-w-0">
                                                                <div class="font-bold text-[#1E293B] truncate">${esc(t.title)}</div>
                                                                <div class="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10.5px] text-slate-500">
                                                                    <span>${esc(t.pipeline_stage)}</span>
                                                                    <span>•</span>
                                                                    <span class="px-1.5 py-0.5 rounded border ${stObj.badge} font-semibold">${esc(stObj.label)}</span>
                                                                    ${t.due_date ? `<span>• DL ${esc(formatDateOnly(t.due_date))}</span>` : ''}
                                                                </div>
                                                                <div class="text-[11px] font-bold text-[#E11D48] mt-1">✕ Belum mengisi update minggu ini</div>
                                                            </div>
                                                            <button type="button" onclick="jumpToStudentProjectReview('${t.id}', '${esc(s.username || s.full_name)}')"
                                                                class="shrink-0 px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0095FF] text-[#0082E6] text-[10.5px] font-bold cursor-pointer">
                                                                Detail
                                                            </button>
                                                        </div>`;
                                                }
                                                const checkKey = encodeURIComponent(u.key);
                                                return `
                                                    <div data-weekly-key="${esc(u.key)}" class="rounded-xl border ${u.checked_at ? 'border-[#BBE9E2] bg-white' : 'border-[#CBE5FF] bg-[#F8FBFF]'} p-3.5 space-y-2.5 text-xs">
                                                        <div class="flex items-start justify-between gap-2">
                                                            <div class="min-w-0">
                                                                <div class="font-extrabold text-[#1E293B] truncate">${esc(t.title)}</div>
                                                                <div class="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10.5px] text-slate-400">
                                                                    <span>${esc(t.pipeline_stage)}</span>
                                                                    <span>•</span>
                                                                    <span class="px-1.5 py-0.5 rounded border ${stObj.badge} font-semibold">${esc(stObj.label)}</span>
                                                                    <span>• Update ${esc(formatDateTime(u.updated_at))}</span>
                                                                </div>
                                                            </div>
                                                            <span class="px-2 py-0.5 rounded-lg bg-[#EAF4FF] text-[#0082E6] font-mono font-extrabold text-[11px] shrink-0">${u.progress_percent}%</span>
                                                        </div>
                                                        <div class="w-full h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                                                            <div class="h-full bg-[#0095FF] rounded-full" style="width:${u.progress_percent}%"></div>
                                                        </div>
                                                        <div class="flex items-start gap-2.5">
                                                            ${u.proof_image ? `
                                                                <img src="${esc(u.proof_image)}" alt="Bukti Mingguan" onclick="openProofLightbox(this.src, 'Update ${esc(weekInfo.weekKey)} — ${esc(t.title)} (${esc(s.full_name)})')"
                                                                    class="w-14 h-11 rounded-lg object-cover border border-[#CBD5E1] cursor-pointer hover:opacity-85 shrink-0" title="Klik perbesar bukti progres mingguan" />` : ''}
                                                            <div class="min-w-0 space-y-1 flex-1">
                                                                <div class="text-slate-700 leading-relaxed"><strong>Progres:</strong> ${esc(u.summary || '-')}</div>
                                                                ${u.blockers ? `<div class="text-[#BE123C] bg-[#FFF0F4] border border-[#FECDD6] rounded-lg px-2 py-1 text-[11px]"><strong>Kendala:</strong> ${esc(u.blockers)}</div>` : ''}
                                                            </div>
                                                        </div>
                                                        <div class="pt-2 border-t border-[#EDF1F7] flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                                                            <input type="text" value="${esc(u.mentor_note || '')}" placeholder="Tulis catatan pembimbing / tindak lanjut..."
                                                                class="weekly-mentor-note flex-1 px-2.5 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[11px] focus:outline-none focus:border-[#0095FF]" />
                                                            <button type="button" onclick="saveWeeklyUpdateCheck('${checkKey}', this)"
                                                                class="px-3 py-1.5 rounded-lg ${u.checked_at ? 'bg-[#E3F6F3] hover:bg-[#4CB6A7] text-[#1D5E55] hover:text-white' : 'bg-[#16A34A] hover:bg-[#15803D] text-white'} text-[11px] font-bold transition cursor-pointer shrink-0">
                                                                ${u.checked_at ? '✓ Sudah Dicek (Simpan)' : '✓ Tandai Dicek'}
                                                            </button>
                                                        </div>
                                                        ${u.checked_at ? `<div class="text-[10px] text-[#2F8F81] font-semibold">Dicek oleh ${esc(u.checked_by_name || 'Pembimbing')} • ${esc(formatDateTime(u.checked_at))}</div>` : ''}
                                                    </div>`;
                                            }).join('')}
                                        </div>
                                    </div>`;
                            }).join('') : `<div class="p-10 text-center text-xs text-slate-400">Tidak ada data siswa untuk filter minggu ini.</div>`}
                        </div>

                        ${displayRows.length > perPage ? `
                        <div class="px-4 py-3 bg-[#FAFBFD] border-t border-[#EDF1F7] flex items-center justify-between gap-2 text-xs">
                            <span class="text-slate-500 num-tabular">Menampilkan ${startIdx + 1}–${Math.min(startIdx + perPage, displayRows.length)} dari ${displayRows.length} siswa</span>
                            <div class="flex items-center gap-1.5">
                                <button type="button" onclick="setProjectWeeklyPage(${projectWeeklyState.page - 1})" ${projectWeeklyState.page <= 1 ? 'disabled' : ''}
                                    class="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0095FF] disabled:opacity-40 font-semibold cursor-pointer">← Prev</button>
                                <span class="px-2 font-bold text-[#1E293B] num-tabular">${projectWeeklyState.page} / ${totalPages}</span>
                                <button type="button" onclick="setProjectWeeklyPage(${projectWeeklyState.page + 1})" ${projectWeeklyState.page >= totalPages ? 'disabled' : ''}
                                    class="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0095FF] disabled:opacity-40 font-semibold cursor-pointer">Next →</button>
                            </div>
                        </div>` : ''}
                    </div>`;
                return;
            }

            // ==================== MODE 2: MATRIX SISWA × TUGAS ====================
            if (projectViewMode === 'matrix') {
                const mCls = projectMatrixState.className;
                const mSearch = (projectMatrixState.search || '').trim().toLowerCase();
                const mOnlyIssues = Boolean(projectMatrixState.onlyIssues);
                const fbLogMap = projectDataCache.fbLogMap || {};
                const studentStatsMap = {};
                studentList.forEach((s) => {
                    studentStatsMap[s.id] = computeStudentIssueStats(s, allTasks, subMap);
                });

                const filteredStudents = studentList.filter((s) => {
                    if (mCls && s.class_name !== mCls) return false;
                    if (subF && s.sub_concentration !== subF) return false;
                    if (mOnlyIssues && (studentStatsMap[s.id]?.totalIssues || 0) === 0) return false;
                    if (!mSearch) return true;
                    return (s.full_name || '').toLowerCase().includes(mSearch) ||
                        (s.username || '').toLowerCase().includes(mSearch) ||
                        (s.sub_concentration || '').toLowerCase().includes(mSearch);
                });
                if (mOnlyIssues) {
                    filteredStudents.sort((a, b) => (studentStatsMap[b.id]?.totalIssues || 0) - (studentStatsMap[a.id]?.totalIssues || 0));
                }

                const perPage = 20;
                const totalPages = Math.max(1, Math.ceil(filteredStudents.length / perPage));
                if (projectMatrixState.page > totalPages) projectMatrixState.page = totalPages;
                const startIdx = (projectMatrixState.page - 1) * perPage;
                const pageStudents = filteredStudents.slice(startIdx, startIdx + perPage);

                const statusPillMap = {
                    gold: { icon: '🌟', cls: 'bg-[#FFF6D6] text-[#9A6F00] border-[#F7C200]', title: 'Tuntas (Lencana Emas — Lebih Cepat dari Deadline)' },
                    selesai: { icon: '✓', cls: 'bg-[#E3F6F3] text-[#228B7D] border-[#BBE9E2]', title: 'Tuntas Tepat Waktu (ACC)' },
                    selesai_late: { icon: '⏱', cls: 'bg-[#FFF1EB] text-[#C2410C] border-[#FDBA74]', title: 'Tuntas (Terlambat)' },
                    menunggu_review: { icon: '●', cls: 'bg-[#FFF6D6] text-[#B88600] border-[#FDE68A]', title: 'Menunggu Review' },
                    revisi: { icon: '!', cls: 'bg-[#FFF0F4] text-[#E11D48] border-[#FECDD6]', title: 'Revisi' },
                    sedang_dikerjakan: { icon: '⋯', cls: 'bg-[#EAF4FF] text-[#0082E6] border-[#CBE5FF]', title: 'Sedang Dikerjakan' },
                    belum_mulai: { icon: '–', cls: 'bg-slate-50 text-slate-300 border-slate-200', title: 'Belum Mulai' }
                };

                container.innerHTML = `
                    ${modeSwitcherHtml}
                    <div class="bg-white border border-[#EDF1F7] rounded-2xl shadow-card overflow-hidden">
                        <div class="p-4 border-b border-[#EDF1F7] bg-[#FAFBFD] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <select onchange="setProjectMatrixClass(this.value)" class="px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0095FF]">
                                    <option value="">Semua Kelas</option>
                                    ${classes.map((c) => `<option value="${esc(c)}" ${mCls === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                                </select>
                                <input type="text" value="${esc(projectMatrixState.search)}" oninput="setProjectMatrixSearch(this.value)"
                                    placeholder="Cari nama / username siswa..."
                                    class="px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs w-52 focus:outline-none focus:border-[#0095FF]" />
                                <button type="button" onclick="toggleProjectMatrixOnlyIssues()"
                                    class="px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${mOnlyIssues ? 'bg-[#F13B6E] text-white border-[#F13B6E]' : 'bg-white text-[#E11D48] border-[#FECDD6] hover:bg-[#FFF0F4]'}">
                                    ⚠️ ${mOnlyIssues ? 'Tampilkan Semua' : 'Bermasalah Saja'}
                                </button>
                            </div>
                            <div class="flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold">
                                <span class="px-2 py-0.5 rounded bg-[#FFF6D6] text-[#9A6F00]">🌟 Emas</span>
                                <span class="px-2 py-0.5 rounded bg-[#E3F6F3] text-[#228B7D]">✓ Tuntas</span>
                                <span class="px-2 py-0.5 rounded bg-[#FFF1EB] text-[#C2410C]">⏱ Telat</span>
                                <span class="px-2 py-0.5 rounded bg-[#FFF6D6] text-[#B88600]">● Review</span>
                                <span class="px-2 py-0.5 rounded bg-[#FFF0F4] text-[#E11D48]">! Revisi</span>
                                <span class="px-2 py-0.5 rounded bg-[#EAF4FF] text-[#0082E6]">⋯ Proses</span>
                            </div>
                        </div>

                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr class="border-b border-[#EDF1F7] bg-[#F7FAFF] text-[10.5px] font-bold text-slate-500">
                                        <th class="py-3 px-4 sticky left-0 bg-[#F7FAFF] z-10 min-w-[220px] border-r border-[#EDF1F7]">Siswa</th>
                                        <th class="py-3 px-2.5 text-center w-16">Tuntas</th>
                                        <th class="py-3 px-2 text-center w-14" title="Jumlah Lencana Emas (kumpul sebelum tenggat)">🌟</th>
                                        <th class="py-3 px-2 text-center w-16" title="Total Masalah (terlambat + revisi)">Masalah</th>
                                        ${filteredTasks.map((t, idx) => `
                                            <th class="py-2.5 px-2.5 text-center min-w-[110px] max-w-[140px]" title="${esc(t.title)} (${esc(t.pipeline_stage)})">
                                                <div class="truncate text-[#1E293B]">${idx + 1}. ${esc(t.title)}</div>
                                                <div class="text-[9.5px] font-mono text-slate-400 mt-0.5">${t.due_date ? formatDateOnly(t.due_date) : t.pipeline_stage}</div>
                                            </th>`).join('')}
                                        <th class="py-3 px-3 text-center min-w-[100px]">Catatan Guru</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-[#F1F5F9]">
                                    ${pageStudents.length ? pageStudents.map((s) => {
                                        let eligibleCount = 0;
                                        let doneCount = 0;
                                        const stInfo = studentStatsMap[s.id] || { totalIssues: 0, goldCount: 0, detailText: '' };
                                        const logsCnt = (fbLogMap[s.id] || []).length;
                                        const cells = filteredTasks.map((t) => {
                                            const isEligible = !t.sub_concentration || s.sub_concentration === t.sub_concentration;
                                            if (!isEligible) return `<td class="py-2 px-2 text-center text-slate-200">·</td>`;
                                            eligibleCount++;
                                            const ps = subMap[`${t.id}__${s.id}`];
                                            const stVal = ps?.status || 'belum_mulai';
                                            if (stVal === 'selesai') doneCount++;
                                            const tm = evaluateSubmissionTimeliness(t.due_date, ps?.updated_at, stVal);
                                            const pillKey = stVal === 'selesai'
                                                ? (tm.tier === 'gold' ? 'gold' : (tm.tier === 'late' ? 'selesai_late' : 'selesai'))
                                                : stVal;
                                            const pill = statusPillMap[pillKey] || statusPillMap.belum_mulai;
                                            const tip = `${s.full_name} — ${t.title}: ${stVal === 'selesai' ? tm.label : pill.title}${ps?.updated_at ? ` (${formatDateTime(ps.updated_at)})` : ''}`;
                                            return `
                                                <td class="py-2 px-2 text-center">
                                                    <button type="button" onclick="jumpToStudentProjectReview('${t.id}', '${esc(s.username || s.full_name)}')"
                                                        title="${esc(tip)}"
                                                        class="w-7 h-7 rounded-lg border ${pill.cls} font-extrabold text-xs inline-flex items-center justify-center hover:scale-110 transition cursor-pointer">
                                                        ${pill.icon}
                                                    </button>
                                                </td>`;
                                        }).join('');
                                        return `
                                            <tr class="hover:bg-[#F8FBFF]">
                                                <td class="py-2.5 px-4 sticky left-0 bg-white z-10 border-r border-[#EDF1F7]">
                                                    <div class="font-bold text-[#1E293B] truncate max-w-[200px]">${esc(s.full_name)}</div>
                                                    <div class="text-[10.5px] text-slate-400 truncate">${esc(s.class_name || '-')} • ${esc(s.sub_concentration || 'Umum')}</div>
                                                    <div class="flex flex-wrap items-center gap-1 mt-1">
                                                        ${renderWhatsappLink(s.whatsapp_number, true)}
                                                        ${s.project_drive_url ? `<a href="${esc(s.project_drive_url)}" target="_blank" rel="noopener noreferrer" title="Buka Folder Google Drive Project Siswa" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white transition">📁 Drive ↗</a>` : `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">Drive -</span>`}
                                                    </div>
                                                </td>
                                                <td class="py-2.5 px-2.5 text-center font-mono font-bold text-[#0082E6] num-tabular">${doneCount}/${eligibleCount}</td>
                                                <td class="py-2.5 px-2 text-center font-mono font-extrabold num-tabular ${stInfo.goldCount > 0 ? 'text-[#B88600]' : 'text-slate-300'}">${stInfo.goldCount}</td>
                                                <td class="py-2.5 px-2 text-center num-tabular" title="${esc(stInfo.detailText)}">
                                                    ${stInfo.totalIssues > 0
                                                        ? `<span class="inline-block px-2 py-0.5 rounded-md bg-[#FFF0F4] text-[#E11D48] font-mono font-extrabold">${stInfo.totalIssues}</span>`
                                                        : `<span class="text-slate-300 font-mono">0</span>`}
                                                </td>
                                                ${cells}
                                                <td class="py-2.5 px-3 text-center">
                                                    ${logsCnt > 0
                                                        ? `<button type="button" onclick="openStudentFeedbackHistory('${s.id}')" class="px-2.5 py-1 rounded-lg bg-[#F7FAFF] hover:bg-[#EAF4FF] border border-[#DCEBFF] text-[#0082E6] text-[10.5px] font-bold cursor-pointer">📜 ${logsCnt} Log</button>`
                                                        : `<span class="text-slate-300">-</span>`}
                                                </td>
                                            </tr>`;
                                    }).join('') : `<tr><td colspan="${filteredTasks.length + 5}" class="p-8 text-center text-slate-400">Tidak ada siswa ditemukan.</td></tr>`}
                                </tbody>
                            </table>
                        </div>

                        <div class="px-4 py-3 bg-[#FAFBFD] border-t border-[#EDF1F7] flex items-center justify-between gap-2 text-xs">
                            <span class="text-slate-500 num-tabular">Menampilkan ${filteredStudents.length ? startIdx + 1 : 0}–${Math.min(startIdx + perPage, filteredStudents.length)} dari ${filteredStudents.length} siswa</span>
                            <div class="flex items-center gap-1.5">
                                <button type="button" onclick="setProjectMatrixPage(${projectMatrixState.page - 1})" ${projectMatrixState.page <= 1 ? 'disabled' : ''}
                                    class="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0095FF] disabled:opacity-40 font-semibold cursor-pointer">← Prev</button>
                                <span class="px-2 font-bold text-[#1E293B] num-tabular">${projectMatrixState.page} / ${totalPages}</span>
                                <button type="button" onclick="setProjectMatrixPage(${projectMatrixState.page + 1})" ${projectMatrixState.page >= totalPages ? 'disabled' : ''}
                                    class="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0095FF] disabled:opacity-40 font-semibold cursor-pointer">Next →</button>
                            </div>
                        </div>
                    </div>`;
                return;
            }

            // ==================== MODE 1: DAFTAR TUGAS RINGKAS + PANEL REVIEW TERFOKUS ====================
            container.innerHTML = modeSwitcherHtml + filteredTasks.map((t) => {
                const eligible = studentList.filter((s) => !t.sub_concentration || s.sub_concentration === t.sub_concentration);
                const accCount = eligible.filter((s) => subMap[`${t.id}__${s.id}`]?.status === 'selesai').length;
                const waitCount = eligible.filter((s) => subMap[`${t.id}__${s.id}`]?.status === 'menunggu_review').length;
                const revCount = eligible.filter((s) => subMap[`${t.id}__${s.id}`]?.status === 'revisi').length;
                const activeCount = eligible.filter((s) => (subMap[`${t.id}__${s.id}`]?.status || 'belum_mulai') !== 'belum_mulai').length;
                const belumCount = eligible.length - activeCount;
                const weeklyThisTaskCount = eligible.filter((s) => Boolean(weeklyByKey[`${currentWeekKey}__${t.id}__${s.id}`])).length;
                const pct = eligible.length ? Math.round((accCount / eligible.length) * 100) : 0;
                const allAcc = eligible.length > 0 && accCount === eligible.length;
                const dl = getDeadlineMeta(t.due_date, allAcc);
                const isOpen = expandedProjectIds.has(t.id);

                let reviewPanelHtml = '';
                if (isOpen) {
                    const stFilter = projectReviewState.status;
                    const clsFilter = projectReviewState.className;
                    const searchQ = (projectReviewState.search || '').trim().toLowerCase();

                    const filteredRows = eligible.filter((s) => {
                        const st = subMap[`${t.id}__${s.id}`]?.status || 'belum_mulai';
                        if (stFilter === 'active' && st === 'belum_mulai') return false;
                        if (stFilter !== 'all' && stFilter !== 'active' && st !== stFilter) return false;
                        if (clsFilter && s.class_name !== clsFilter) return false;
                        if (searchQ && !((s.full_name || '').toLowerCase().includes(searchQ) || (s.username || '').toLowerCase().includes(searchQ))) return false;
                        return true;
                    });

                    const perPage = 15;
                    const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
                    if (projectReviewState.page > totalPages) projectReviewState.page = totalPages;
                    const startIdx = (projectReviewState.page - 1) * perPage;
                    const pageRows = filteredRows.slice(startIdx, startIdx + perPage);

                    const statusTabs = [
                        { key: 'active', label: `Sudah Kumpul / Aktif (${activeCount})` },
                        { key: 'menunggu_review', label: `Perlu Review (${waitCount})` },
                        { key: 'revisi', label: `Revisi (${revCount})` },
                        { key: 'selesai', label: `ACC (${accCount})` },
                        { key: 'belum_mulai', label: `Belum Mulai (${belumCount})` },
                        { key: 'all', label: `Semua (${eligible.length})` }
                    ];

                    reviewPanelHtml = `
                        <div class="border-t border-[#EDF1F7] bg-white">
                            <!-- Toolbar Filter Cepat di Dalam Tugas -->
                            <div class="p-3.5 sm:px-5 bg-[#F7FAFF] border-b border-[#EDF1F7] space-y-2.5">
                                <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                                    ${statusTabs.map((tab) => `
                                        <button type="button" onclick="setProjectReviewStatus('${tab.key}')"
                                            class="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${stFilter === tab.key
                                                ? 'bg-[#0095FF] text-white shadow-sm'
                                                : 'bg-white border border-[#E2E8F0] text-slate-600 hover:border-[#0095FF]'}">
                                            ${tab.label}
                                        </button>`).join('')}
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <select onchange="setProjectReviewClass(this.value)" class="px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0095FF]">
                                        <option value="">Semua Kelas</option>
                                        ${classes.map((c) => `<option value="${esc(c)}" ${clsFilter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                                    </select>
                                    <input id="projReviewSearchInp" type="text" value="${esc(projectReviewState.search)}" oninput="setProjectReviewSearch(this.value)"
                                        placeholder="Cari nama / username siswa..."
                                        class="flex-1 min-w-[180px] max-w-xs px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-xs focus:outline-none focus:border-[#0095FF]" />
                                    <span class="ml-auto text-[11px] font-semibold text-slate-400 num-tabular">
                                        ${filteredRows.length} siswa ditemukan
                                    </span>
                                </div>
                            </div>

                            <!-- Tabel Padat 1 Baris per Siswa -->
                            <div class="overflow-x-auto">
                                ${pageRows.length ? `
                                <table class="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr class="border-b border-[#EDF1F7] bg-[#FAFBFD] text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                                            <th class="py-2.5 px-4 min-w-[190px]">Siswa</th>
                                            <th class="py-2.5 px-3 min-w-[170px]">Bukti &amp; Catatan</th>
                                            <th class="py-2.5 px-3 min-w-[150px]">Keputusan Review</th>
                                            <th class="py-2.5 px-3 min-w-[200px]">Catatan Revisi / Feedback</th>
                                            <th class="py-2.5 px-4 text-right w-36">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-[#F1F5F9]">
                                        ${pageRows.map((s) => {
                                            const ps = subMap[`${t.id}__${s.id}`] || {};
                                            const stVal = ps.status || 'belum_mulai';
                                            const stObj = STATUS_OPTIONS.find((x) => x.value === stVal) || STATUS_OPTIONS[0];
                                            const revNum = Number(ps.revision_count || 0);
                                            return `
                                                <tr data-proj-task="${t.id}" data-proj-student="${s.id}" data-rev-count="${revNum}" class="hover:bg-[#F8FBFF] align-middle">
                                                    <td class="py-2.5 px-4">
                                                        <div class="flex items-center gap-2.5 min-w-0">
                                                            <div class="w-8 h-8 rounded-full bg-[#EAF4FF] text-[#0095FF] font-bold text-[10.5px] flex items-center justify-center shrink-0 overflow-hidden">
                                                                ${renderAvatarMarkup(s.avatar_url, s.full_name)}
                                                            </div>
                                                            <div class="min-w-0">
                                                                <div class="font-bold text-[#1E293B] truncate max-w-[170px]">${esc(s.full_name)}</div>
                                                                <div class="text-[10.5px] text-slate-400 truncate">
                                                                    ${esc(s.class_name || '-')} • <span class="font-mono">@${esc(s.username)}</span>
                                                                </div>
                                                                <div class="flex flex-wrap items-center gap-1 mt-1">
                                                                    ${renderWhatsappLink(s.whatsapp_number, true, `Halo ${s.full_name}, terkait tugas project "${t.title}" di AniTrack...`)}
                                                                    ${(s.project_drive_url || ps.proof_url) ? `<a href="${esc(s.project_drive_url || ps.proof_url)}" target="_blank" rel="noopener noreferrer" title="Buka Folder Google Drive Project Siswa" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white transition">📁 Drive ↗</a>` : `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">Drive -</span>`}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td class="py-2.5 px-3">
                                                        ${(ps.proof_image || ps.proof_url || ps.student_notes) ? `
                                                            <div class="flex items-center gap-2">
                                                                ${ps.proof_image ? `
                                                                    <img src="${esc(ps.proof_image)}" alt="Bukti" onclick="openProofLightbox(this.src, '${esc(t.title)} — ${esc(s.full_name)}')"
                                                                        class="w-11 h-8 rounded-md object-cover border border-[#CBD5E1] cursor-pointer hover:opacity-85 shrink-0" title="Klik untuk perbesar bukti" />
                                                                ` : ''}
                                                                <div class="min-w-0 space-y-0.5">
                                                                    ${ps.student_notes ? `<div class="text-[11px] text-slate-600 truncate max-w-[180px]" title="${esc(ps.student_notes)}">${esc(ps.student_notes)}</div>` : ''}
                                                                    <div class="flex items-center gap-2">
                                                                        ${ps.proof_image ? `<button type="button" onclick="openProofLightbox('${esc(ps.proof_image)}', '${esc(t.title)} — ${esc(s.full_name)}')" class="text-[10.5px] font-bold text-[#0082E6] hover:underline cursor-pointer">Lihat Bukti</button>` : ''}
                                                                        ${ps.proof_url ? `<a href="${esc(ps.proof_url)}" target="_blank" rel="noopener noreferrer" class="text-[10.5px] font-bold text-[#329889] hover:underline">Link ↗</a>` : ''}
                                                                    </div>
                                                                </div>
                                                            </div>` : `<span class="text-[11px] text-slate-400 italic">Belum ada bukti</span>`}
                                                    </td>
                                                    <td class="py-2.5 px-3">
                                                        <div class="space-y-1">
                                                            <select class="proj-status w-full px-2.5 py-1.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-[11px] font-semibold focus:bg-white focus:outline-none focus:border-[#0095FF]">
                                                                ${STATUS_OPTIONS.map((o) => `<option value="${o.value}" ${stVal === o.value ? 'selected' : ''}>${o.value === 'selesai' ? 'Selesai (ACC)' : o.label}</option>`).join('')}
                                                            </select>
                                                            <div class="flex flex-wrap items-center gap-1">
                                                                ${(() => {
                                                                    const tm = evaluateSubmissionTimeliness(t.due_date, ps.updated_at, stVal);
                                                                    if (stVal === 'selesai' && (tm.tier === 'gold' || tm.tier === 'late')) {
                                                                        return `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${tm.badgeClass}">${esc(tm.shortLabel)}</span>`;
                                                                    }
                                                                    return '';
                                                                })()}
                                                                ${revNum > 0 ? `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-[#FFF0F4] text-[#E11D48]">Revisi ke-${revNum}</span>` : ''}
                                                                ${(projectDataCache.fbLogMap?.[s.id] || []).length > 0 ? `<button type="button" onclick="openStudentFeedbackHistory('${s.id}')" class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F7FAFF] border border-[#DCEBFF] text-[#0082E6] hover:bg-[#EAF4FF] cursor-pointer">📜 Log (${(projectDataCache.fbLogMap[s.id] || []).length})</button>` : ''}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td class="py-2.5 px-3">
                                                        <input type="text" value="${esc(ps.mentor_feedback || '')}" placeholder="Catatan revisi / ACC..."
                                                            class="proj-fb w-full px-2.5 py-1.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-xs focus:bg-white focus:outline-none focus:border-[#0095FF]" />
                                                    </td>
                                                    <td class="py-2.5 px-4 text-right">
                                                        <div class="inline-flex items-center gap-1.5">
                                                            <button type="button" onclick="saveProjectReview('${t.id}', '${s.id}', this)"
                                                                class="px-3 py-1.5 bg-[#0095FF] hover:bg-[#0082E6] text-white text-[11px] font-bold rounded-lg transition cursor-pointer">
                                                                Simpan
                                                            </button>
                                                            ${ps.id ? `
                                                            <button type="button" onclick="resetProjectSubmission('${t.id}', '${s.id}', this)" title="Batalkan & reset pengumpulan siswa ini"
                                                                class="px-2 py-1.5 bg-[#FFF1F5] hover:bg-[#F13B6E] text-[#F13B6E] hover:text-white text-[11px] font-bold rounded-lg transition cursor-pointer">
                                                                Reset
                                                            </button>` : ''}
                                                        </div>
                                                    </td>
                                                </tr>`;
                                        }).join('')}
                                    </tbody>
                                </table>` : `
                                <div class="p-8 text-center text-xs text-slate-400 space-y-2">
                                    <div>${stFilter === 'active' ? 'Belum ada siswa yang mengumpulkan bukti / mulai mengerjakan pada filter ini.' : 'Tidak ada siswa yang sesuai filter.'}</div>
                                    ${stFilter === 'active' && eligible.length ? `<button type="button" onclick="setProjectReviewStatus('all')" class="px-3 py-1.5 rounded-lg bg-[#EAF4FF] text-[#0082E6] font-bold cursor-pointer">Tampilkan Semua (${eligible.length} siswa)</button>` : ''}
                                </div>`}
                            </div>

                            <!-- Pagination -->
                            ${filteredRows.length > perPage ? `
                            <div class="px-4 py-2.5 bg-[#FAFBFD] border-t border-[#EDF1F7] flex items-center justify-between gap-2 text-xs">
                                <span class="text-slate-500 num-tabular">Menampilkan ${startIdx + 1}–${Math.min(startIdx + perPage, filteredRows.length)} dari ${filteredRows.length} siswa</span>
                                <div class="flex items-center gap-1.5">
                                    <button type="button" onclick="setProjectReviewPage(${projectReviewState.page - 1})" ${projectReviewState.page <= 1 ? 'disabled' : ''}
                                        class="px-3 py-1 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0095FF] disabled:opacity-40 font-semibold cursor-pointer">← Prev</button>
                                    <span class="px-2 font-bold text-[#1E293B] num-tabular">${projectReviewState.page} / ${totalPages}</span>
                                    <button type="button" onclick="setProjectReviewPage(${projectReviewState.page + 1})" ${projectReviewState.page >= totalPages ? 'disabled' : ''}
                                        class="px-3 py-1 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0095FF] disabled:opacity-40 font-semibold cursor-pointer">Next →</button>
                                </div>
                            </div>` : ''}
                        </div>`;
                }

                return `
                    <div class="bg-white border ${isOpen ? 'border-[#0095FF] ring-2 ring-[#EAF4FF]' : 'border-[#EDF1F7]'} rounded-2xl shadow-card overflow-hidden transition">
                        <div class="p-4 sm:p-5 bg-[#FAFBFD] space-y-3">
                            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                <div class="space-y-1.5 min-w-0 flex-1">
                                    <div class="flex flex-wrap items-center gap-1.5">
                                        <span class="font-mono text-[10.5px] font-bold px-2.5 py-0.5 rounded-md bg-[#EAF4FF] text-[#0082E6]">${esc(t.pipeline_stage)}</span>
                                        <span class="font-mono text-[10.5px] font-semibold px-2.5 py-0.5 rounded-md bg-[#F1F5F9] text-slate-600">${esc(t.sub_concentration || 'Semua Sub-Konsentrasi')}</span>
                                        <span class="text-[10.5px] font-bold px-2.5 py-0.5 rounded-md border ${dl.badgeClass}">📅 ${esc(dl.label)}</span>
                                    </div>
                                    <h3 class="text-base font-extrabold text-[#1E293B]">${esc(t.title)}</h3>
                                    ${t.description ? `<p class="text-xs text-slate-500 leading-relaxed">${esc(t.description)}</p>` : ''}
                                    <div class="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F4F8FF] border border-[#DCEBFF] text-[11px] text-slate-600">
                                        <span class="font-bold text-[#0082E6]">📝 Format File:</span>
                                        <code class="font-mono text-[10.5px] font-semibold text-[#1E293B]">${esc(buildProjectFileNaming(t).pattern)}</code>
                                    </div>
                                    <!-- Ringkasan Status & Mini Progress Bar -->
                                    <div class="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold num-tabular">
                                        <div class="w-28 h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                                            <div class="h-full bg-[#4CB6A7] rounded-full" style="width:${pct}%"></div>
                                        </div>
                                        <span class="text-[#228B7D]">${accCount}/${eligible.length} ACC (${pct}%)</span>
                                        <button type="button" onclick="setProjectWeeklyTask('${t.id}'); setProjectViewMode('weekly');"
                                            class="px-2 py-0.5 rounded-md bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white transition cursor-pointer"
                                            title="Lihat rekap Update Mingguan khusus tugas ini">
                                            📅 Update Minggu Ini: ${weeklyThisTaskCount}/${eligible.length}
                                        </button>
                                        ${waitCount > 0 ? `<span class="px-2 py-0.5 rounded-md bg-[#FFF6D6] text-[#B88600]">🔔 ${waitCount} Review</span>` : ''}
                                        ${revCount > 0 ? `<span class="px-2 py-0.5 rounded-md bg-[#FFF0F4] text-[#E11D48]">⚠️ ${revCount} Revisi</span>` : ''}
                                        <span class="text-slate-400 font-medium">${belumCount} belum</span>
                                    </div>
                                </div>

                                <div class="flex flex-wrap items-center gap-2 shrink-0">
                                    <div class="flex items-center gap-1.5 bg-white border border-[#E2E8F0] rounded-xl px-2.5 py-1.5">
                                        <label class="text-[10.5px] font-bold text-slate-400">Deadline:</label>
                                        <input type="date" value="${esc(t.due_date || '')}" onchange="updateProjectDeadline('${t.id}', this.value)"
                                            class="text-xs font-mono font-semibold text-[#1E293B] focus:outline-none cursor-pointer" />
                                    </div>
                                    <button type="button" onclick="toggleProjectSubmissions('${t.id}')"
                                        class="px-3.5 py-2 rounded-xl ${isOpen ? 'bg-[#1E293B] text-white' : 'bg-[#0095FF] hover:bg-[#0082E6] text-white shadow-blueGlow'} text-xs font-bold transition cursor-pointer">
                                        ${isOpen ? 'Tutup Panel' : (waitCount > 0 ? `Review (${waitCount})` : 'Review Siswa')}
                                    </button>
                                    <button type="button" onclick="deleteProjectTask('${t.id}')"
                                        class="px-3 py-2 rounded-xl bg-[#FFF1F5] hover:bg-[#F13B6E] text-[#F13B6E] hover:text-white text-xs font-bold transition cursor-pointer">
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        </div>
                        ${reviewPanelHtml}
                    </div>`;
            }).join('');
        }

        async function loadProjectTracker() {
            const container = document.getElementById('projectTasksContainer');
            if (!container) return;

            const [homeroomMap, pjMap, checklistColsMap] = await Promise.all([
                loadHomeroomMap(),
                loadSubconcPjMap(),
                loadChecklistColsMap()
            ]);
            myHomeroomClass = homeroomMap[currentUser.id] ? String(homeroomMap[currentUser.id]) : '';
            myPjSubconcs = Array.isArray(pjMap[currentUser.id]) ? pjMap[currentUser.id] : [];
            if (!myHomeroomClass && staffScopeMode === 'homeroom') {
                staffScopeMode = expectedRole === 'superadmin' ? 'all' : 'mentees';
            }

            const [{ data: projTasks }, { data: projSubs }, { data: allStudents }, { data: weeklyRaw }, { data: mentors }, { data: fbLogRaw }, { data: archivesRaw }, { data: checklistRowsRaw }] = await Promise.all([
                supabase.from('project_tasks').select('*').order('due_date', { ascending: true }),
                supabase.from('project_submissions').select('*'),
                supabase.from('profiles').select('id, full_name, username, class_name, sub_concentration, mentor_id, avatar_url, whatsapp_number, project_drive_url').eq('role', 'student').order('class_name').order('full_name'),
                supabase.from('app_settings').select('key, value, updated_at').like('key', `${PROJECT_WEEKLY_PREFIX}%`),
                supabase.from('profiles').select('id, full_name, username, whatsapp_number').in('role', ['mentor', 'superadmin']).order('full_name'),
                supabase.from('app_settings').select('key, value, updated_at').like('key', `${PROJECT_FB_LOG_PREFIX}%`),
                supabase.from('app_settings').select('key, value, updated_at').like('key', `${PROJECT_ARCHIVE_PREFIX}%`),
                supabase.from('app_settings').select('key, value, updated_at').like('key', `${CHECKLIST_ROW_PREFIX}%`)
            ]);

            const allStudentsList = allStudents || [];
            const studentList = allStudentsList.filter((s) => {
                if (expectedRole === 'mentor') {
                    if (staffScopeMode === 'homeroom' && myHomeroomClass) return s.class_name === myHomeroomClass;
                    return s.mentor_id === currentUser.id;
                }
                if (expectedRole === 'superadmin') {
                    if (staffScopeMode === 'mentees') return s.mentor_id === currentUser.id;
                    if (staffScopeMode === 'homeroom' && myHomeroomClass) return s.class_name === myHomeroomClass;
                }
                return true;
            });
            const studentIds = new Set(studentList.map((s) => s.id));
            const allTasks = sortMaterialsByPipeline(projTasks || []);
            const subMap = {};
            (projSubs || []).forEach((ps) => {
                if (!studentIds.has(ps.student_id)) return;
                subMap[`${ps.project_task_id}__${ps.student_id}`] = ps;
            });
            const weeklyUpdates = parseWeeklyUpdateRows(weeklyRaw || []).filter((u) => studentIds.has(u.student_id));
            const fbLogMap = parseFeedbackLogMap(fbLogRaw || []);
            const checklistRowMap = parseChecklistRowMap(checklistRowsRaw || []);
            const archives = (archivesRaw || []).map((r) => {
                try {
                    const parsed = JSON.parse(r.value || '{}');
                    return { key: r.key, updated_at: r.updated_at, ...parsed };
                } catch {
                    return null;
                }
            }).filter(Boolean).sort((a, b) => String(b.created_at || b.updated_at || '').localeCompare(String(a.created_at || a.updated_at || '')));

            projectDataCache = { allTasks, subMap, studentList, allStudentsList, weeklyUpdates, mentorsList: mentors || [], fbLogMap, archives, homeroomMap, pjMap, checklistColsMap, checklistRowMap };

            // Overall Project Progress Summary + Lencana Emas & Total Masalah
            let totalAssignments = 0;
            let doneAssignments = 0;
            let goldAssignments = 0;
            let reviewAssignments = 0;
            let revisionAssignments = 0;
            let overdueTasksCount = 0;
            let problemStudentsCount = 0;

            studentList.forEach((s) => {
                const st = computeStudentIssueStats(s, allTasks, subMap);
                if (st.totalIssues > 0) problemStudentsCount++;
            });

            const stageStats = ['Pre-Production', 'Production', 'Post-Production'].map((st) => {
                let sTotal = 0;
                let sDone = 0;
                allTasks.filter((t) => t.pipeline_stage === st).forEach((t) => {
                    const eligible = studentList.filter((s) => !t.sub_concentration || s.sub_concentration === t.sub_concentration);
                    let anyIncomplete = false;
                    eligible.forEach((s) => {
                        sTotal++;
                        totalAssignments++;
                        const ps = subMap[`${t.id}__${s.id}`];
                        const status = ps?.status || 'belum_mulai';
                        if (status === 'selesai') {
                            sDone++;
                            doneAssignments++;
                            if (evaluateSubmissionTimeliness(t.due_date, ps?.updated_at, status).tier === 'gold') goldAssignments++;
                        } else {
                            anyIncomplete = true;
                            if (status === 'menunggu_review') reviewAssignments++;
                            if (status === 'revisi') revisionAssignments++;
                        }
                    });
                    if (t.due_date && anyIncomplete && getDeadlineMeta(t.due_date, false).overdue) {
                        overdueTasksCount++;
                    }
                });
                return { stage: st, total: sTotal, done: sDone, pct: sTotal ? Math.round((sDone / sTotal) * 100) : 0 };
            });

            const overallPct = totalAssignments ? Math.round((doneAssignments / totalAssignments) * 100) : 0;
            const summaryEl = document.getElementById('staffProjectSummary');
            if (summaryEl) {
                const showScopeSwitcher = expectedRole === 'superadmin' || Boolean(myHomeroomClass);
                const homeroomSwitcherHtml = showScopeSwitcher ? `
                    <div class="flex flex-wrap items-center gap-2 pt-1">
                        <span class="text-[11px] font-bold text-white/90">Cakupan Tampilan:</span>
                        <div class="inline-flex flex-wrap p-0.5 rounded-xl bg-white/15 border border-white/25 gap-1">
                            ${expectedRole === 'superadmin' ? `
                            <button type="button" onclick="setStaffScopeMode('all')"
                                class="px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${staffScopeMode === 'all' ? 'bg-white text-[#1D5E55] shadow-sm' : 'text-white/90 hover:bg-white/10'}">
                                🌐 Semua Siswa
                            </button>` : ''}
                            <button type="button" onclick="setStaffScopeMode('mentees')"
                                class="px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${staffScopeMode === 'mentees' ? 'bg-white text-[#1D5E55] shadow-sm' : 'text-white/90 hover:bg-white/10'}">
                                👥 Siswa Bimbingan Saya
                            </button>
                            ${myHomeroomClass ? `
                            <button type="button" onclick="setStaffScopeMode('homeroom')"
                                class="px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${staffScopeMode === 'homeroom' ? 'bg-white text-[#1D5E55] shadow-sm' : 'text-white/90 hover:bg-white/10'}">
                                🏫 Wali Kelas ${esc(myHomeroomClass)}
                            </button>` : ''}
                        </div>
                    </div>` : '';

                summaryEl.innerHTML = `
                    <div class="rounded-2xl bg-gradient-to-r from-[#45B1A2] via-[#4FB8AA] to-[#58C2B4] text-white p-5 sm:p-6 shadow-card space-y-4">
                        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div class="space-y-1.5">
                                <div class="flex flex-wrap items-center gap-1.5">
                                    <span class="inline-block text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20">Project Tracker Keseluruhan</span>
                                    ${myHomeroomClass ? `<span class="inline-block text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#FFF6D6] text-[#9A6F00]">🏫 Wali Kelas ${esc(myHomeroomClass)}</span>` : ''}
                                </div>
                                <h3 class="text-lg sm:text-xl font-extrabold">Progres Total Project Animasi</h3>
                                <p class="text-xs text-white/90">Pantau deadline, Lencana Emas, update mingguan, audit log catatan guru, hingga arsip snapshot.</p>
                                ${homeroomSwitcherHtml}
                            </div>
                            <div class="w-full lg:w-80 space-y-2.5 shrink-0">
                                <div class="bg-white/15 border border-white/20 rounded-2xl p-4 space-y-2 num-tabular">
                                    <div class="flex items-center justify-between text-xs font-bold">
                                        <span>Ketuntasan Project (ACC)</span>
                                        <span class="text-lg font-extrabold text-[#FFF6D6]">${overallPct}%</span>
                                    </div>
                                    <div class="w-full h-2.5 rounded-full bg-white/25 overflow-hidden">
                                        <div class="h-full bg-[#F7C200] rounded-full transition-all duration-500" style="width:${overallPct}%"></div>
                                    </div>
                                    <div class="text-[11px] text-white/90">${doneAssignments} / ${totalAssignments} penugasan ACC • 🌟 ${goldAssignments} Lencana Emas</div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button type="button" onclick="saveProjectArchiveSnapshot(this)"
                                        class="flex-1 px-3 py-2 rounded-xl bg-white/20 hover:bg-white text-white hover:text-[#1D5E55] text-[11px] font-extrabold border border-white/30 transition cursor-pointer">
                                        📦 Simpan Arsip Snapshot
                                    </button>
                                    <button type="button" onclick="openProjectArchivesModal()"
                                        class="px-3 py-2 rounded-xl bg-white/15 hover:bg-white text-white hover:text-[#1D5E55] text-[11px] font-extrabold border border-white/25 transition cursor-pointer shrink-0">
                                        🗂️ Arsip (${archives.length})
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 num-tabular">
                            <div class="bg-white/15 rounded-xl px-3.5 py-2.5">
                                <div class="text-[11px] text-white/85">Total Tugas</div>
                                <div class="text-lg font-extrabold">${allTasks.length}</div>
                            </div>
                            <div class="bg-white/15 rounded-xl px-3.5 py-2.5">
                                <div class="text-[11px] text-white/85">🌟 Lencana Emas</div>
                                <div class="text-lg font-extrabold text-[#FFF6D6]">${goldAssignments}</div>
                            </div>
                            <div class="bg-white/15 rounded-xl px-3.5 py-2.5">
                                <div class="text-[11px] text-white/85">Menunggu Review</div>
                                <div class="text-lg font-extrabold text-[#FFF6D6]">${reviewAssignments}</div>
                            </div>
                            <div class="bg-white/15 rounded-xl px-3.5 py-2.5">
                                <div class="text-[11px] text-white/85">Sedang Revisi</div>
                                <div class="text-lg font-extrabold text-[#FFE4EC]">${revisionAssignments}</div>
                            </div>
                            <div class="bg-white/15 rounded-xl px-3.5 py-2.5">
                                <div class="text-[11px] text-white/85">Lewat Deadline</div>
                                <div class="text-lg font-extrabold text-[#FFE4EC]">${overdueTasksCount}</div>
                            </div>
                            <div class="bg-white/15 rounded-xl px-3.5 py-2.5">
                                <div class="text-[11px] text-white/85">⚠️ Siswa Bermasalah</div>
                                <div class="text-lg font-extrabold text-[#FFE4EC]">${problemStudentsCount}</div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 num-tabular">
                            ${stageStats.map((st) => `
                                <div class="bg-white/12 rounded-xl px-3.5 py-2.5 space-y-1.5">
                                    <div class="flex items-center justify-between text-[11px] font-bold">
                                        <span>${st.stage}</span>
                                        <span>${st.pct}% (${st.done}/${st.total})</span>
                                    </div>
                                    <div class="w-full h-1.5 rounded-full bg-white/25 overflow-hidden">
                                        <div class="h-full bg-white rounded-full" style="width:${st.pct}%"></div>
                                    </div>
                                </div>`).join('')}
                        </div>
                    </div>`;
            }

            renderProjectTrackerBody();
        }
        global.loadProjectTracker = loadProjectTracker;

        global.setProjectViewMode = function (mode) {
            projectViewMode = mode;
            renderProjectTrackerBody();
        };

        global.setProjectReviewStatus = function (st) {
            projectReviewState.status = st;
            projectReviewState.page = 1;
            renderProjectTrackerBody();
        };

        global.setProjectReviewClass = function (cls) {
            projectReviewState.className = cls;
            projectReviewState.page = 1;
            renderProjectTrackerBody();
        };

        global.setProjectReviewSearch = function (q) {
            projectReviewState.search = q;
            projectReviewState.page = 1;
            renderProjectTrackerBody();
            const inp = document.getElementById('projReviewSearchInp');
            if (inp) { inp.focus(); inp.setSelectionRange(q.length, q.length); }
        };

        global.setProjectReviewPage = function (p) {
            projectReviewState.page = Math.max(1, p);
            renderProjectTrackerBody();
        };

        global.setProjectMatrixClass = function (cls) {
            projectMatrixState.className = cls;
            projectMatrixState.page = 1;
            renderProjectTrackerBody();
        };

        global.setProjectMatrixSearch = function (q) {
            projectMatrixState.search = q;
            projectMatrixState.page = 1;
            renderProjectTrackerBody();
        };

        global.setProjectMatrixPage = function (p) {
            projectMatrixState.page = Math.max(1, p);
            renderProjectTrackerBody();
        };

        global.toggleProjectMatrixOnlyIssues = function () {
            projectMatrixState.onlyIssues = !projectMatrixState.onlyIssues;
            projectMatrixState.page = 1;
            renderProjectTrackerBody();
        };

        global.openStudentFeedbackHistory = function (studentId) {
            const stu = (projectDataCache.studentList || []).find((s) => s.id === studentId);
            const logs = (projectDataCache.fbLogMap || {})[studentId] || [];
            openFeedbackHistoryModal(stu ? `${stu.full_name} (${stu.class_name || '-'})` : 'Siswa', logs);
        };

        global.saveProjectArchiveSnapshot = async function (btn) {
            const { allTasks, subMap, studentList, fbLogMap } = projectDataCache;
            if (!studentList.length) { showToast('Belum ada data siswa untuk diarsipkan.'); return; }
            const todayYmd = getJakartaYmd(new Date());
            const stampLabel = formatDateTime(new Date().toISOString());
            if (!confirm(`Simpan Arsip Snapshot Project Tracker saat ini (${stampLabel})?\n\nKondisi seluruh siswa (${studentList.length} siswa × ${allTasks.length} tugas) akan disimpan permanen dan dapat dibuka / diunduh ke Excel kapan saja.`)) return;

            if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan arsip...'; }
            const rows = studentList.map((s) => {
                const st = computeStudentIssueStats(s, allTasks, subMap);
                const statuses = {};
                allTasks.forEach((t) => {
                    if (t.sub_concentration && s.sub_concentration !== t.sub_concentration) return;
                    const ps = subMap[`${t.id}__${s.id}`];
                    const stVal = ps?.status || 'belum_mulai';
                    const tm = evaluateSubmissionTimeliness(t.due_date, ps?.updated_at, stVal);
                    statuses[t.id] = stVal === 'selesai' ? tm.label : (STATUS_OPTIONS.find((o) => o.value === stVal)?.label || stVal);
                });
                return {
                    id: s.id,
                    name: s.full_name,
                    class_name: s.class_name || '-',
                    sub_concentration: s.sub_concentration || 'Umum',
                    acc: st.accCount,
                    eligible: st.eligibleCount,
                    gold: st.goldCount,
                    issues: st.totalIssues,
                    logsCount: (fbLogMap[s.id] || []).length,
                    statuses
                };
            });

            const archiveObj = {
                title: `Arsip_${todayYmd.split('-').reverse().join('-')}`,
                created_at: new Date().toISOString(),
                created_by: currentUser.full_name || currentUser.username || 'Staff',
                scope: staffScopeMode === 'homeroom' && myHomeroomClass ? `Wali Kelas ${myHomeroomClass}` : (expectedRole === 'superadmin' ? 'Semua Siswa' : 'Siswa Bimbingan'),
                totalStudents: rows.length,
                totalTasks: allTasks.length,
                totalGold: rows.reduce((a, r) => a + r.gold, 0),
                totalProblemStudents: rows.filter((r) => r.issues > 0).length,
                tasks: allTasks.map((t) => ({ id: t.id, title: t.title, due_date: t.due_date || '' })),
                rows
            };
            const archiveKey = `${PROJECT_ARCHIVE_PREFIX}${todayYmd}_${Date.now().toString().slice(-4)}`;
            const { error } = await supabase
                .from('app_settings')
                .upsert({ key: archiveKey, value: JSON.stringify(archiveObj), updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (btn) { btn.disabled = false; btn.textContent = '📦 Simpan Arsip Snapshot'; }
            if (error) { showToast(`Gagal menyimpan arsip: ${error.message}`); return; }
            showToast(`Arsip "${archiveObj.title}" berhasil disimpan ✓`);
            loadProjectTracker();
        };

        global.exportArchiveSnapshotXlsx = function (encodedKey) {
            const key = decodeURIComponent(encodedKey || '');
            const arc = (projectDataCache.archives || []).find((a) => a.key === key);
            if (!arc) { showToast('Arsip tidak ditemukan.'); return; }
            if (typeof global.XLSX === 'undefined') { showToast('Library Excel belum termuat.'); return; }
            const excelRows = (arc.rows || []).map((r, idx) => {
                const obj = {
                    No: idx + 1,
                    'Nama Siswa': r.name,
                    Kelas: r.class_name,
                    'Sub-Konsentrasi': r.sub_concentration,
                    Tuntas: `${r.acc}/${r.eligible}`,
                    'Lencana Emas': r.gold,
                    'Total Masalah': r.issues
                };
                (arc.tasks || []).forEach((t, ti) => {
                    obj[`T${ti + 1}. ${t.title}`] = r.statuses?.[t.id] || '-';
                });
                return obj;
            });
            const wb = global.XLSX.utils.book_new();
            global.XLSX.utils.book_append_sheet(wb, makeWorksheet(excelRows), (arc.title || 'Arsip').slice(0, 31));
            global.XLSX.writeFile(wb, `${arc.title || 'Arsip-AniTrack'}.xlsx`);
            showToast(`Arsip ${arc.title}.xlsx diunduh ✓`);
        };

        global.deleteProjectArchive = async function (encodedKey) {
            const key = decodeURIComponent(encodedKey || '');
            if (!confirm('Hapus arsip snapshot ini secara permanen?')) return;
            await supabase.from('app_settings').delete().eq('key', key);
            showToast('Arsip snapshot dihapus.');
            await loadProjectTracker();
            global.openProjectArchivesModal();
        };

        global.openProjectArchivesModal = function () {
            const archives = projectDataCache.archives || [];
            let modal = document.getElementById('anitrackArchivesModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'anitrackArchivesModal';
                modal.className = 'fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4';
                modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
                modal.innerHTML = `
                    <div class="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#EDF1F7]">
                        <div class="px-5 py-3.5 border-b border-[#EDF1F7] bg-[#F7FAFF] flex items-center justify-between gap-3">
                            <div>
                                <div class="text-[10.5px] font-extrabold uppercase tracking-wider text-[#0082E6]">Snapshot Mingguan Permanen</div>
                                <div class="text-sm font-extrabold text-[#1E293B]">🗂️ Daftar Arsip Project Tracker</div>
                            </div>
                            <button type="button" onclick="document.getElementById('anitrackArchivesModal').classList.add('hidden')"
                                class="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#FFF1F5] text-slate-600 hover:text-[#F13B6E] font-bold text-sm cursor-pointer">✕</button>
                        </div>
                        <div id="archivesModalBody" class="p-4 max-h-[72vh] overflow-y-auto space-y-2.5 text-xs"></div>
                    </div>`;
                document.body.appendChild(modal);
            }
            const body = document.getElementById('archivesModalBody');
            if (!archives.length) {
                body.innerHTML = `<div class="p-8 text-center text-slate-400">Belum ada Arsip Snapshot tersimpan. Klik <strong>📦 Simpan Arsip Snapshot</strong> untuk merekam kondisi progres mingguan saat ini.</div>`;
            } else {
                body.innerHTML = archives.map((a) => `
                    <div class="rounded-xl border border-[#EDF1F7] bg-[#FAFBFD] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="space-y-1 min-w-0">
                            <div class="flex flex-wrap items-center gap-1.5">
                                <span class="font-extrabold text-[#1E293B]">${esc(a.title || 'Arsip')}</span>
                                <span class="px-2 py-0.5 rounded bg-[#EAF4FF] text-[#0082E6] font-bold text-[10.5px]">${esc(a.scope || 'Semua')}</span>
                            </div>
                            <div class="text-[11px] text-slate-500">
                                Disimpan ${esc(formatDateTime(a.created_at))} oleh <strong>${esc(a.created_by || 'Staff')}</strong>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 text-[10.5px] font-bold">
                                <span class="text-slate-600">${a.totalStudents || 0} siswa • ${a.totalTasks || 0} tugas</span>
                                <span class="text-[#B88600]">🌟 ${a.totalGold || 0} Emas</span>
                                <span class="text-[#E11D48]">⚠️ ${a.totalProblemStudents || 0} siswa bermasalah</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button type="button" onclick="exportArchiveSnapshotXlsx('${encodeURIComponent(a.key)}')"
                                class="px-3 py-1.5 rounded-lg bg-[#E2F5F2] hover:bg-[#4CB6A7] text-[#1D5E55] hover:text-white text-[11px] font-bold transition cursor-pointer">
                                📥 Export .xlsx
                            </button>
                            <button type="button" onclick="deleteProjectArchive('${encodeURIComponent(a.key)}')"
                                class="px-2.5 py-1.5 rounded-lg bg-[#FFF1F5] hover:bg-[#F13B6E] text-[#F13B6E] hover:text-white text-[11px] font-bold transition cursor-pointer">
                                Hapus
                            </button>
                        </div>
                    </div>`).join('');
            }
            modal.classList.remove('hidden');
        };

        global.setProjectWeeklyWeek = function (wk) {
            projectWeeklyState.weekKey = wk || getWeekKey();
            projectWeeklyState.page = 1;
            renderProjectTrackerBody();
        };

        global.setProjectWeeklyStatus = function (st) {
            projectWeeklyState.status = st || 'all';
            projectWeeklyState.page = 1;
            renderProjectTrackerBody();
        };

        global.setProjectWeeklyClass = function (cls) {
            projectWeeklyState.className = cls || '';
            projectWeeklyState.page = 1;
            renderProjectTrackerBody();
        };

        global.setProjectWeeklyTask = function (taskId) {
            projectWeeklyState.taskId = taskId || '';
            projectWeeklyState.page = 1;
            renderProjectTrackerBody();
        };

        global.setProjectWeeklyMentor = function (mentorId) {
            projectWeeklyState.mentorId = mentorId || '';
            projectWeeklyState.page = 1;
            renderProjectTrackerBody();
        };

        global.setProjectWeeklySearch = function (q) {
            projectWeeklyState.search = q || '';
            projectWeeklyState.page = 1;
            renderProjectTrackerBody();
            const inp = document.getElementById('projWeeklySearchInp');
            if (inp) { inp.focus(); inp.setSelectionRange(q.length, q.length); }
        };

        global.setProjectWeeklyPage = function (p) {
            projectWeeklyState.page = Math.max(1, p);
            renderProjectTrackerBody();
        };

        // ==================== CHECKLIST PJ SUB-KONSENTRASI HANDLERS ====================
        global.setChecklistSubconc = function (sc) {
            projectChecklistState.subconc = sc || '';
            projectChecklistState.className = '';
            renderProjectTrackerBody();
        };

        global.setChecklistClass = function (cls) {
            projectChecklistState.className = cls || '';
            renderProjectTrackerBody();
        };

        global.setChecklistStatusFilter = function (st) {
            projectChecklistState.statusFilter = st || 'all';
            renderProjectTrackerBody();
        };

        global.setChecklistSearch = function (q) {
            projectChecklistState.search = q || '';
            renderProjectTrackerBody();
            const inp = document.getElementById('checklistSearchInp');
            if (inp) { inp.focus(); inp.setSelectionRange(q.length, q.length); }
        };

        global.addChecklistColumn = async function (subconc) {
            const inp = document.getElementById('newChecklistColInput');
            const name = (inp?.value || '').trim();
            if (!name || !subconc) { showToast('Tuliskan nama kolom tahapan terlebih dahulu.'); return; }
            const colsMap = { ...(projectDataCache.checklistColsMap || {}) };
            const cur = Array.isArray(colsMap[subconc]) ? [...colsMap[subconc]] : [...DEFAULT_CHECKLIST_COLS];
            if (cur.some((c) => c.toLowerCase() === name.toLowerCase())) {
                showToast(`Kolom "${name}" sudah ada.`);
                return;
            }
            cur.push(name);
            colsMap[subconc] = cur;
            const { error } = await saveChecklistColsMap(colsMap);
            if (error) { showToast(`Gagal menambah kolom: ${error.message}`); return; }
            projectDataCache.checklistColsMap = colsMap;
            showToast(`Kolom "${name}" ditambahkan ke ${subconc} ✓`);
            renderProjectTrackerBody();
        };

        global.removeChecklistColumn = async function (subconc, idx) {
            const colsMap = { ...(projectDataCache.checklistColsMap || {}) };
            const cur = Array.isArray(colsMap[subconc]) ? [...colsMap[subconc]] : [...DEFAULT_CHECKLIST_COLS];
            const colName = cur[idx];
            if (!colName || cur.length <= 1) return;
            if (!confirm(`Hapus kolom tahapan "${colName}" dari checklist ${subconc}?`)) return;
            cur.splice(idx, 1);
            colsMap[subconc] = cur;
            const { error } = await saveChecklistColsMap(colsMap);
            if (error) { showToast(`Gagal menghapus kolom: ${error.message}`); return; }
            projectDataCache.checklistColsMap = colsMap;
            showToast(`Kolom "${colName}" dihapus.`);
            renderProjectTrackerBody();
        };

        global.syncChecklistColsFromTasks = async function (subconc) {
            if (!subconc) return;
            const matchedTitles = (projectDataCache.allTasks || [])
                .filter((t) => !t.sub_concentration || t.sub_concentration === subconc)
                .map((t) => String(t.title || '').trim())
                .filter(Boolean);
            if (!matchedTitles.length) {
                showToast(`Belum ada tugas project untuk ${subconc}.`);
                return;
            }
            if (!confirm(`Gunakan ${matchedTitles.length} judul tugas dari Project Tracker sebagai kolom tahapan checklist ${subconc}?`)) return;
            const colsMap = { ...(projectDataCache.checklistColsMap || {}) };
            colsMap[subconc] = [...new Set(matchedTitles)];
            const { error } = await saveChecklistColsMap(colsMap);
            if (error) { showToast(`Gagal menyinkronkan kolom: ${error.message}`); return; }
            projectDataCache.checklistColsMap = colsMap;
            showToast(`Kolom tahapan ${subconc} disinkronkan dari Daftar Tugas ✓`);
            renderProjectTrackerBody();
        };

        global.updateChecklistCell = async function (studentId, encodedCol, newVal, selectEl) {
            const colName = decodeURIComponent(encodedCol || '');
            if (!studentId || !colName) return;
            const rowMap = projectDataCache.checklistRowMap || {};
            const existing = rowMap[studentId] || { student_id: studentId, items: {}, notes: '' };
            const nextItems = { ...(existing.items || {}), [colName]: newVal };
            const nowIso = new Date().toISOString();
            const nextRow = {
                student_id: studentId,
                items: nextItems,
                notes: existing.notes || '',
                updated_by: currentUser.full_name || currentUser.username || 'PJ Subkon',
                updated_at: nowIso
            };

            if (selectEl) {
                const stOpt = CHECKLIST_STATUS_OPTIONS.find((o) => o.value === newVal) || CHECKLIST_STATUS_OPTIONS[0];
                selectEl.className = `w-full px-2 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer focus:outline-none ${stOpt.cls}`;
            }

            const { error } = await supabase.from('app_settings').upsert({
                key: `${CHECKLIST_ROW_PREFIX}${studentId}`,
                value: JSON.stringify(nextRow),
                updated_at: nowIso
            }, { onConflict: 'key' });

            if (error) {
                showToast(`Gagal menyimpan status: ${error.message}`);
                return;
            }
            rowMap[studentId] = nextRow;
            projectDataCache.checklistRowMap = rowMap;
            showToast(`Checklist "${colName}" → ${newVal.toUpperCase()} ✓`);
            renderProjectTrackerBody();
        };

        global.saveChecklistNote = async function (studentId, btn) {
            const inp = document.getElementById(`ckNote_${studentId}`);
            if (!inp) return;
            const noteText = inp.value.trim();
            const rowMap = projectDataCache.checklistRowMap || {};
            const existing = rowMap[studentId] || { student_id: studentId, items: {}, notes: '' };
            const nowIso = new Date().toISOString();
            const nextRow = {
                student_id: studentId,
                items: { ...(existing.items || {}) },
                notes: noteText,
                updated_by: currentUser.full_name || currentUser.username || 'PJ Subkon',
                updated_at: nowIso
            };
            if (btn) { btn.disabled = true; btn.textContent = '...'; }
            const { error } = await supabase.from('app_settings').upsert({
                key: `${CHECKLIST_ROW_PREFIX}${studentId}`,
                value: JSON.stringify(nextRow),
                updated_at: nowIso
            }, { onConflict: 'key' });
            if (btn) { btn.disabled = false; btn.textContent = 'Simpan'; }
            if (error) { showToast(`Gagal menyimpan Notes: ${error.message}`); return; }
            rowMap[studentId] = nextRow;
            projectDataCache.checklistRowMap = rowMap;
            showToast('Catatan PJ Subkon tersimpan ✓');
            renderProjectTrackerBody();
        };

        global.exportChecklistXlsx = function () {
            if (typeof global.XLSX === 'undefined') { showToast('Library Excel belum termuat.'); return; }
            const { allStudentsList = [], checklistColsMap = {}, checklistRowMap = {}, mentorsList = [] } = projectDataCache;
            const mentorMap = Object.fromEntries(mentorsList.map((m) => [m.id, m.full_name]));
            const statusText = Object.fromEntries(CHECKLIST_STATUS_OPTIONS.map((o) => [o.value, o.label]));
            const wb = global.XLSX.utils.book_new();
            const subconcsToExport = projectChecklistState.subconc ? [projectChecklistState.subconc] : SUBCONCS;

            subconcsToExport.forEach((sc) => {
                const cols = checklistColsMap[sc] || DEFAULT_CHECKLIST_COLS;
                const scStudents = allStudentsList.filter((s) => s.sub_concentration === sc);
                const rows = scStudents.map((s, i) => {
                    const rd = checklistRowMap[s.id] || { items: {}, notes: '' };
                    const obj = {
                        No: i + 1,
                        'Nama Siswa': s.full_name,
                        Username: `@${s.username}`,
                        Kelas: s.class_name || '-',
                        'No. HP': formatWhatsappDisplay(s.whatsapp_number) || '-',
                        Pembimbing: (s.mentor_id && mentorMap[s.mentor_id]) || '-',
                        'Link Google Drive': s.project_drive_url || '-'
                    };
                    cols.forEach((c) => {
                        obj[c] = statusText[rd.items?.[c] || 'belum'] || 'Belum';
                    });
                    obj.Notes = rd.notes || '';
                    obj['Diupdate Oleh'] = rd.updated_by || '';
                    return obj;
                });
                global.XLSX.utils.book_append_sheet(wb, makeWorksheet(rows), sc.slice(0, 31));
            });

            const stamp = getJakartaYmd(new Date());
            global.XLSX.writeFile(wb, `Checklist-PJ-Subkon-AniTrack-${stamp}.xlsx`);
            showToast('File Excel Checklist PJ Subkon diunduh ✓');
        };

        global.saveWeeklyUpdateCheck = async function (encodedKey, btn) {
            const key = decodeURIComponent(encodedKey || '');
            const existing = (projectDataCache.weeklyUpdates || []).find((u) => u.key === key);
            if (!existing) { showToast('Data update mingguan tidak ditemukan.'); return; }
            const card = btn.closest('[data-weekly-key]');
            const note = card?.querySelector('.weekly-mentor-note')?.value.trim() || '';

            const nextObj = {
                week_key: existing.week_key,
                project_task_id: existing.project_task_id,
                student_id: existing.student_id,
                progress_percent: existing.progress_percent,
                summary: existing.summary,
                blockers: existing.blockers,
                proof_image: existing.proof_image,
                proof_url: existing.proof_url,
                mentor_note: note,
                checked_by: currentUser.id,
                checked_by_name: currentUser.full_name || currentUser.username || 'Pembimbing',
                checked_at: new Date().toISOString(),
                updated_at: existing.updated_at || new Date().toISOString()
            };

            btn.disabled = true;
            btn.textContent = 'Menyimpan...';
            const { error } = await supabase
                .from('app_settings')
                .upsert({ key, value: JSON.stringify(nextObj), updated_at: new Date().toISOString() }, { onConflict: 'key' });
            btn.disabled = false;

            if (error) {
                btn.textContent = 'Gagal';
                showToast(`Gagal menyimpan catatan mingguan: ${error.message}`);
                return;
            }
            showToast('Update mingguan siswa ditandai sudah dicek ✓');
            loadProjectTracker();
        };

        global.jumpToStudentProjectReview = function (taskId, studentQuery) {
            projectViewMode = 'tasks';
            expandedProjectIds.clear();
            expandedProjectIds.add(taskId);
            projectReviewState = { status: 'all', className: '', search: studentQuery || '', page: 1 };
            renderProjectTrackerBody();
        };

        global.toggleProjectSubmissions = function (taskId) {
            if (expandedProjectIds.has(taskId)) {
                expandedProjectIds.delete(taskId);
            } else {
                expandedProjectIds.clear();
                expandedProjectIds.add(taskId);
                const { subMap, studentList, allTasks } = projectDataCache;
                const task = allTasks.find((t) => t.id === taskId);
                const eligible = studentList.filter((s) => !task?.sub_concentration || s.sub_concentration === task.sub_concentration);
                const hasActive = eligible.some((s) => (subMap[`${taskId}__${s.id}`]?.status || 'belum_mulai') !== 'belum_mulai');
                projectReviewState = { status: hasActive ? 'active' : 'all', className: '', search: '', page: 1 };
            }
            renderProjectTrackerBody();
        };

        global.updateProjectDeadline = async function (taskId, newDate) {
            const { error } = await supabase
                .from('project_tasks')
                .update({ due_date: newDate || null })
                .eq('id', taskId);
            if (error) { showToast(`Gagal ubah deadline: ${error.message}`); return; }
            showToast('Deadline tugas project diperbarui ✓');
            loadProjectTracker();
        };

        global.deleteProjectTask = async function (taskId) {
            if (!confirm('Hapus tugas project ini beserta seluruh data pengumpulannya?')) return;
            const { error } = await supabase.from('project_tasks').delete().eq('id', taskId);
            if (error) { showToast(`Gagal menghapus tugas: ${error.message}`); return; }
            expandedProjectIds.delete(taskId);
            showToast('Tugas project dihapus.');
            loadProjectTracker();
        };

        global.resetProjectSubmission = async function (projectTaskId, studentId, btn) {
            if (!confirm('Batalkan / hapus pengumpulan, bukti foto, dan status revisi siswa pada tugas project ini?')) return;
            if (btn) { btn.disabled = true; btn.textContent = '...'; }
            const { error } = await supabase
                .from('project_submissions')
                .delete()
                .eq('project_task_id', projectTaskId)
                .eq('student_id', studentId);
            if (error) {
                if (btn) { btn.disabled = false; btn.textContent = 'Reset'; }
                showToast(`Gagal mereset pengumpulan: ${error.message}`);
                return;
            }
            showToast('Pengumpulan project siswa berhasil dibatalkan & direset ✓');
            loadProjectTracker();
        };

        global.saveProjectReview = async function (taskId, studentId, btn) {
            const row = btn.closest('[data-proj-task]');
            const stVal = row.querySelector('.proj-status').value;
            const fbVal = row.querySelector('.proj-fb').value.trim();
            const prevRev = Number(row.dataset.revCount || 0);
            const nextRev = stVal === 'revisi' ? prevRev + 1 : prevRev;
            const nowIso = new Date().toISOString();

            btn.disabled = true;
            btn.textContent = 'Menyimpan...';
            const { error } = await supabase.from('project_submissions').upsert({
                project_task_id: taskId,
                student_id: studentId,
                status: stVal,
                mentor_feedback: fbVal || null,
                revision_count: nextRev,
                reviewed_by: currentUser.id,
                updated_at: nowIso
            }, { onConflict: 'project_task_id,student_id' });

            if (!error && (fbVal || stVal === 'revisi' || stVal === 'selesai')) {
                const taskObj = (projectDataCache.allTasks || []).find((t) => t.id === taskId);
                await appendFeedbackLogEntry(studentId, {
                    at: nowIso,
                    task_id: taskId,
                    task_title: taskObj?.title || 'Tugas Project',
                    status: stVal,
                    revision_no: nextRev,
                    feedback: fbVal || (stVal === 'selesai' ? 'Tugas disetujui (ACC Selesai).' : 'Diminta revisi oleh pembimbing.'),
                    reviewer_name: currentUser.full_name || currentUser.username || 'Guru'
                });
            }

            btn.disabled = false;
            btn.textContent = error ? 'Gagal' : 'Tersimpan ✓';
            if (!error) {
                showToast(stVal === 'revisi' ? `Status Revisi ke-${nextRev} dicatat di Riwayat & dikirim ke siswa.` : 'Review project & log catatan tersimpan ✓');
                loadProjectTracker();
            } else {
                showToast(`Gagal menyimpan review: ${error.message}`);
            }
        };

        document.getElementById('addProjectTaskForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fb = document.getElementById('projectTaskFeedback');
            const btn = document.getElementById('saveProjectTaskBtn');
            const title = document.getElementById('projTitle').value.trim();
            const stage = document.getElementById('projStage').value;
            const subconc = document.getElementById('projSubconc').value || null;
            const dueDate = document.getElementById('projDueDate').value || null;
            const desc = document.getElementById('projDesc').value.trim();

            if (!title) return;
            btn.disabled = true;
            btn.textContent = 'Menyimpan...';

            const { data: created, error } = await supabase.from('project_tasks').insert({
                title, pipeline_stage: stage, sub_concentration: subconc,
                due_date: dueDate, description: desc || null, created_by: currentUser.id
            }).select().single();

            btn.disabled = false;
            btn.textContent = '+ Tambah Tugas Project';

            if (error) {
                fb.className = 'text-xs font-semibold text-[#E11D48]';
                fb.textContent = error.message;
                return;
            }
            e.target.reset();
            if (created?.id) expandedProjectIds.add(created.id);
            fb.className = 'text-xs font-semibold text-[#3FA496]';
            fb.textContent = 'Tugas project & deadline tersimpan ✓';
            showToast('Tugas project baru berhasil ditambahkan!');
            setTimeout(() => { fb.textContent = ''; }, 2400);
            loadProjectTracker();
        });

        // ==================== IMPORT & DOWNLOAD FORMAT EXCEL PROJECT TRACKER ====================
        let pendingImportProjectRows = [];

        function normalizePipelineStage(raw) {
            const v = String(raw || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!v) return 'Pre-Production';
            if (v.includes('pre') || v.includes('pra')) return 'Pre-Production';
            if (v.includes('post') || v.includes('pasca')) return 'Post-Production';
            if (v.includes('prod')) return 'Production';
            return 'Pre-Production';
        }

        function normalizeSubConcentration(raw) {
            const v = String(raw || '').trim();
            if (!v) return null;
            const low = v.toLowerCase();
            if (low === 'semua' || low === 'semua sub-konsentrasi' || low === 'umum' || low === 'all' || low === '-') return null;
            const exact = SUBCONCS.find((sc) => sc.toLowerCase() === low);
            if (exact) return exact;
            const partial = SUBCONCS.find((sc) => sc.toLowerCase().includes(low) || low.includes(sc.toLowerCase()));
            return partial || null;
        }

        function normalizeExcelDate(val) {
            if (val === null || val === undefined || val === '') return null;
            if (val instanceof Date && !isNaN(val.getTime())) {
                const y = val.getFullYear();
                const m = String(val.getMonth() + 1).padStart(2, '0');
                const d = String(val.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            if (typeof val === 'number' && val > 20000 && val < 90000) {
                const utcDays = Math.floor(val - 25569);
                const dt = new Date(utcDays * 86400 * 1000);
                if (!isNaN(dt.getTime())) {
                    return dt.toISOString().slice(0, 10);
                }
            }
            const str = String(val).trim();
            const isoM = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
            if (isoM) return `${isoM[1]}-${isoM[2].padStart(2, '0')}-${isoM[3].padStart(2, '0')}`;
            const dmyM = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
            if (dmyM) return `${dmyM[3]}-${dmyM[2].padStart(2, '0')}-${dmyM[1].padStart(2, '0')}`;
            return null;
        }

        function pickRowField(row, keys) {
            const entries = Object.entries(row || {});
            for (const wanted of keys) {
                const found = entries.find(([k]) => k.trim().toLowerCase() === wanted);
                if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
                    return found[1];
                }
            }
            for (const wanted of keys) {
                const found = entries.find(([k]) => k.trim().toLowerCase().includes(wanted));
                if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
                    return found[1];
                }
            }
            return '';
        }

        global.downloadProjectTemplateXlsx = function () {
            if (typeof global.XLSX === 'undefined') {
                showToast('Library Excel (.xlsx) belum termuat.');
                return;
            }
            const sampleRows = [
                {
                    'Judul Tugas': 'Storyline, Treatment & Storyboard',
                    'Tahap Pipeline': 'Pre-Production',
                    'Sub-Konsentrasi': 'Semua',
                    'Deadline (YYYY-MM-DD)': '2026-11-28',
                    Deskripsi: 'Kumpulkan file PDF storyboard lengkap dengan durasi tiap scene.'
                },
                {
                    'Judul Tugas': 'Character Turnaround & Model Sheet',
                    'Tahap Pipeline': 'Pre-Production',
                    'Sub-Konsentrasi': '3D Modeller',
                    'Deadline (YYYY-MM-DD)': '2026-12-03',
                    Deskripsi: 'Tampak depan, samping, belakang karakter utama (PNG/JPG).'
                },
                {
                    'Judul Tugas': 'Blocking & Splining Animasi Scene 01-03',
                    'Tahap Pipeline': 'Production',
                    'Sub-Konsentrasi': '3D Animator',
                    'Deadline (YYYY-MM-DD)': '2026-12-12',
                    Deskripsi: 'Unggah screenshot viewport & tautan playblast video.'
                },
                {
                    'Judul Tugas': 'Final Compositing, Sound & Render Master',
                    'Tahap Pipeline': 'Post-Production',
                    'Sub-Konsentrasi': 'Semua',
                    'Deadline (YYYY-MM-DD)': '2026-12-20',
                    Deskripsi: 'Pastikan color grading dan audio sinkron, upload bukti hasil render.'
                }
            ];

            const guideRows = [
                { Kolom: 'Judul Tugas', Wajib: 'YA', Keterangan: 'Nama tugas/milestone project yang harus dikerjakan siswa.' },
                { Kolom: 'Tahap Pipeline', Wajib: 'YA', Keterangan: 'Isi salah satu: Pre-Production, Production, atau Post-Production.' },
                { Kolom: 'Sub-Konsentrasi', Wajib: 'Opsional', Keterangan: 'Kosongkan atau isi "Semua" untuk seluruh siswa; atau pilih: 2D Animator, 2D Motion Graphic, 3D Animator, 3D Modeller, 3D Motion Graphic.' },
                { Kolom: 'Deadline (YYYY-MM-DD)', Wajib: 'Opsional', Keterangan: 'Format tanggal YYYY-MM-DD (misal 2026-12-15) atau DD/MM/YYYY, bisa juga langsung format Tanggal Excel.' },
                { Kolom: 'Deskripsi', Wajib: 'Opsional', Keterangan: 'Instruksi pengerjaan, kriteria ACC, atau format bukti yang diminta.' }
            ];

            const wb = global.XLSX.utils.book_new();
            global.XLSX.utils.book_append_sheet(wb, makeWorksheet(sampleRows, [36, 18, 22, 22, 52]), 'Tugas Project');
            global.XLSX.utils.book_append_sheet(wb, makeWorksheet(guideRows, [24, 12, 72]), 'Panduan Pengisian');
            global.XLSX.writeFile(wb, 'Template-ProjectTracker-AniTrack.xlsx');
            showToast('Template Excel (.xlsx) berhasil diunduh ✓');
        };

        global.handleProjectImportFile = function (inp) {
            const file = inp.files?.[0];
            if (!file) return;
            if (typeof global.XLSX === 'undefined') {
                showToast('Library Excel (.xlsx) belum termuat.');
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = new Uint8Array(ev.target.result);
                    const wb = global.XLSX.read(data, { type: 'array', cellDates: true });
                    const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes('tugas') || n.toLowerCase().includes('project')) || wb.SheetNames[0];
                    const rawRows = global.XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });

                    const parsed = [];
                    let skippedCount = 0;

                    rawRows.forEach((row) => {
                        const title = String(pickRowField(row, ['judul tugas', 'judul', 'title', 'nama tugas', 'tugas project']) || '').trim();
                        if (!title) { skippedCount++; return; }
                        const stageRaw = pickRowField(row, ['tahap pipeline', 'tahap', 'stage', 'pipeline']);
                        const subRaw = pickRowField(row, ['sub-konsentrasi', 'sub konsentrasi', 'konsentrasi', 'subconc']);
                        const dueRaw = pickRowField(row, ['deadline (yyyy-mm-dd)', 'deadline', 'due date', 'due_date', 'tanggal']);
                        const descRaw = pickRowField(row, ['deskripsi', 'instruksi', 'keterangan', 'description', 'catatan']);

                        parsed.push({
                            title,
                            pipeline_stage: normalizePipelineStage(stageRaw),
                            sub_concentration: normalizeSubConcentration(subRaw),
                            due_date: normalizeExcelDate(dueRaw),
                            description: String(descRaw || '').trim() || null,
                            created_by: currentUser.id
                        });
                    });

                    if (!parsed.length) {
                        showToast('Tidak ada baris tugas valid ditemukan. Pastikan kolom "Judul Tugas" terisi.');
                        inp.value = '';
                        return;
                    }

                    pendingImportProjectRows = parsed;
                    const box = document.getElementById('projectImportPreviewBox');
                    const meta = document.getElementById('projectImportMeta');
                    const tbody = document.getElementById('projectImportTableBody');
                    const confirmBtn = document.getElementById('confirmProjectImportBtn');

                    meta.textContent = `File "${file.name}" • ${parsed.length} tugas siap diimpor` +
                        (skippedCount ? ` (${skippedCount} baris kosong dilewati)` : '');
                    confirmBtn.textContent = `✓ Import ${parsed.length} Tugas ke Project Tracker`;
                    tbody.innerHTML = parsed.map((r, i) => `
                        <tr class="border-t border-[#EDF1F7]">
                            <td class="py-2 px-3 text-slate-400 font-mono">${i + 1}</td>
                            <td class="py-2 px-3 font-bold text-[#1E293B]">${esc(r.title)}</td>
                            <td class="py-2 px-3"><span class="font-mono text-[10.5px] font-bold px-2 py-0.5 rounded bg-[#EAF4FF] text-[#0082E6]">${esc(r.pipeline_stage)}</span></td>
                            <td class="py-2 px-3 text-slate-600">${esc(r.sub_concentration || 'Semua')}</td>
                            <td class="py-2 px-3 font-mono text-slate-600">${esc(r.due_date || '-')}</td>
                            <td class="py-2 px-3 text-slate-500 max-w-[220px] truncate">${esc(r.description || '-')}</td>
                        </tr>`).join('');

                    box.classList.remove('hidden');
                    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } catch (err) {
                    showToast(`Gagal membaca file Excel: ${err.message}`);
                } finally {
                    inp.value = '';
                }
            };
            reader.readAsArrayBuffer(file);
        };

        global.cancelProjectImport = function () {
            pendingImportProjectRows = [];
            document.getElementById('projectImportPreviewBox')?.classList.add('hidden');
            const inp = document.getElementById('importProjectFile');
            if (inp) inp.value = '';
        };

        global.confirmProjectImport = async function () {
            if (!pendingImportProjectRows.length) return;
            const btn = document.getElementById('confirmProjectImportBtn');
            btn.disabled = true;
            btn.textContent = 'Mengimpor ke database...';

            const { data: inserted, error } = await supabase
                .from('project_tasks')
                .insert(pendingImportProjectRows)
                .select('id');

            btn.disabled = false;
            if (error) {
                btn.textContent = `✓ Import ${pendingImportProjectRows.length} Tugas ke Project Tracker`;
                showToast(`Gagal import: ${error.message}`);
                return;
            }

            const count = inserted?.length || pendingImportProjectRows.length;
            (inserted || []).slice(0, 1).forEach((row) => expandedProjectIds.add(row.id));
            global.cancelProjectImport();
            showToast(`${count} tugas project berhasil diimpor ✓`);
            loadProjectTracker();
        };

        global.refreshAllData = async function () {
            const icon = document.getElementById('refreshIcon');
            icon?.classList.add('animate-spin');
            await Promise.all([refreshMetrics(), loadMaterials(), loadDailyTaskFeed(), loadProjectTracker(), extraRefresh()]);
            setTimeout(() => icon?.classList.remove('animate-spin'), 400);
        };

        // Boot
        paintProfile();
        updateMentorWaBanner();
        paintTabs();
        syncFreshProfile(currentUser.id, (fresh) => {
            currentUser = fresh;
            paintProfile();
            updateMentorWaBanner();
        });
        Promise.all([refreshMetrics(), loadMaterials(), loadDailyTaskFeed(), loadProjectTracker(), extraRefresh()]);

        return { refreshMetrics, loadMaterials, loadDailyTaskFeed, loadProjectTracker };
    }

    global.AniTrack = {
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        GOOGLE_DRIVE_FOLDER_URL,
        ROLE_PAGES,
        SUBCONCS,
        STATUS_OPTIONS,
        TYPE_LABELS,
        COURSE_PALETTE,
        AVATAR_PALETTE,
        STAGE_ORDER,
        supabase,
        getUser,
        setUser,
        clearUser,
        getRolePage,
        redirectToRole,
        requireRole,
        logout,
        syncFreshProfile,
        esc,
        initials,
        roleLabel,
        getStartOfTodayIso,
        isTodayIso,
        formatDateTime,
        showToast,
        normalizeWhatsapp,
        formatWhatsappDisplay,
        getWhatsappUrl,
        renderWhatsappLink,
        buildProjectFileNaming,
        copyTextToClipboard,
        DEFAULT_WA_TEMPLATE,
        renderWaReminderMessage,
        PROJECT_WEEKLY_PREFIX,
        PROJECT_FB_LOG_PREFIX,
        PROJECT_ARCHIVE_PREFIX,
        HOMEROOM_MAP_KEY,
        SUBCONC_PJ_MAP_KEY,
        CHECKLIST_COLS_KEY,
        CHECKLIST_ROW_PREFIX,
        DEFAULT_CHECKLIST_COLS,
        CHECKLIST_STATUS_OPTIONS,
        getJakartaYmd,
        evaluateSubmissionTimeliness,
        computeStudentIssueStats,
        parseFeedbackLogMap,
        appendFeedbackLogEntry,
        loadHomeroomMap,
        saveHomeroomMap,
        loadSubconcPjMap,
        saveSubconcPjMap,
        loadChecklistColsMap,
        saveChecklistColsMap,
        parseChecklistRowMap,
        openFeedbackHistoryModal,
        getWeekKey,
        getWeekRangeInfo,
        getRecentWeekKeys,
        makeWeeklyUpdateKey,
        parseWeeklyUpdateRows,
        computeDeadlineReminderQueue,
        renderAvatarMarkup,
        setAvatarEl,
        formatDateOnly,
        getDeadlineMeta,
        compressProofImage,
        openImageLightbox,
        getMaterialMedia,
        renderMediaBadges,
        toEmbedVideoUrl,
        toEmbedPdfUrl,
        getYoutubeThumbUrl,
        sortMaterialsByPipeline,
        renderMaterialCoverHtml,
        buildSplineChart,
        renderDashboardMentors,
        renderBottomAnalytics,
        initLayoutControls,
        initProfileController,
        getGasUrl,
        setGasUrl,
        loadSharedGasUrl,
        readFileAsBase64,
        postToGas,
        syncDailyTaskToDrive,
        updateDriveConnUI,
        buildExportWorkbooks,
        bindDriveAndExportGlobals,
        initStaffPortal
    };
})(window);
