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

    const ADMIN_ROLE_IDS_KEY = 'admin_role_ids';

    async function loadAdminRoleIds() {
        if (!supabase) return [];
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', ADMIN_ROLE_IDS_KEY).maybeSingle();
            if (data?.value) {
                const parsed = JSON.parse(data.value);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch { /* silent */ }
        return [];
    }

    async function saveAdminRoleIds(ids = []) {
        if (!supabase) return { error: null };
        const unique = [...new Set((ids || []).filter(Boolean))];
        return supabase.from('app_settings').upsert({
            key: ADMIN_ROLE_IDS_KEY,
            value: JSON.stringify(unique),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    }

    function isTrueSuperadmin(user) {
        return Boolean(user && user.role === 'superadmin');
    }

    function isOperationalAdmin(user) {
        return Boolean(user && user.role !== 'superadmin' && user.is_operational_admin);
    }

    function isAnyAdmin(user) {
        return isTrueSuperadmin(user) || isOperationalAdmin(user);
    }

    function getRolePage(roleOrUser) {
        if (roleOrUser && typeof roleOrUser === 'object') {
            if (roleOrUser.role === 'superadmin' || roleOrUser.is_operational_admin) return './admin.html';
            return ROLE_PAGES[roleOrUser.role] || './index.html';
        }
        if (roleOrUser === 'admin') return './admin.html';
        return ROLE_PAGES[roleOrUser] || './index.html';
    }

    function redirectToRole(roleOrUser) {
        global.location.replace(getRolePage(roleOrUser));
    }

    function requireRole(expectedRole) {
        const user = getUser();
        if (!user || !user.id) {
            global.location.replace('./index.html');
            return null;
        }
        if (expectedRole === 'superadmin') {
            if (user.role !== 'superadmin' && !user.is_operational_admin) {
                global.location.replace(getRolePage(user));
                return null;
            }
            return user;
        }
        if (expectedRole === 'mentor') {
            if (user.role !== 'mentor' || user.is_operational_admin) {
                global.location.replace(getRolePage(user));
                return null;
            }
            return user;
        }
        if (expectedRole && user.role !== expectedRole) {
            global.location.replace(getRolePage(user));
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
        const [{ data: fresh }, adminIds] = await Promise.all([
            supabase
                .from('profiles')
                .select('id, full_name, username, class_name, sub_concentration, role, mentor_id, avatar_url, whatsapp_number, project_drive_url')
                .eq('id', userId)
                .maybeSingle(),
            loadAdminRoleIds()
        ]);
        if (fresh) {
            fresh.is_operational_admin = fresh.role !== 'superadmin' && adminIds.includes(fresh.id);
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

    function roleLabel(roleOrUser = '') {
        if (roleOrUser && typeof roleOrUser === 'object') {
            if (roleOrUser.role === 'superadmin') return 'SUPERADMIN';
            if (roleOrUser.is_operational_admin) return 'ADMIN';
            if (roleOrUser.role === 'mentor') return 'PEMBIMBING';
            return 'SISWA';
        }
        if (roleOrUser === 'superadmin') return 'SUPERADMIN';
        if (roleOrUser === 'admin') return 'ADMIN';
        if (roleOrUser === 'mentor') return 'PEMBIMBING';
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
        if (/\b(wav|mp3|audio|sound|dubbing|sfx|musik|scoring|voice\s*over|vo)\b/.test(blob)) return '.wav';
        if (/\b(mp4|mov|video|animasi|animation|blocking|splining|playblast|render|compositing|grading|film|motion|turntable)\b/.test(blob)) return '.mp4';
        if (/\b(aep|after\s*effects)\b/.test(blob)) return '.aep';
        if (/\b(psd|photoshop)\b/.test(blob)) return '.psd';
        if (/\b(zip|rar|texture|asset|aset|pack)\b/.test(blob)) return '.zip';
        if (/\b(blend|fbx|obj|maya|rigging|rig|3d\s*model|modelling|modeling|sculpt|retopo|uv|texturing)\b/.test(blob)) return '.blend';
        if (/\b(pdf|storyboard|script|naskah|treatment|sinopsis|storyline|dokumen|laporan|proposal|concept\s*doc)\b/.test(blob)) return '.pdf';
        if (/\b(png|jpg|jpeg|turnaround|model\s*sheet|character|poster|desain|ilustrasi|background|color\s*script|key\s*art|sheet)\b/.test(blob)) return '.png';
        return '.pdf';
    }

    const PROJECT_FILES_PREFIX = 'proj_task_files::';

    function parseFileSpecsInput(rawInput) {
        if (!rawInput) return [];
        const list = Array.isArray(rawInput)
            ? rawInput
            : String(rawInput).split(/[,;\n]+/);
        const out = [];
        list.forEach((entry) => {
            if (!entry) return;
            if (typeof entry === 'object' && entry.label) {
                const lbl = String(entry.label).trim();
                let ext = String(entry.ext || '').trim().toLowerCase();
                if (ext && !ext.startsWith('.')) ext = `.${ext}`;
                if (lbl) out.push({ label: lbl, ext });
                return;
            }
            const raw = String(entry).trim();
            if (!raw) return;
            const extMatch = raw.match(/(\.[a-z0-9]{2,6})$/i);
            const ext = extMatch ? extMatch[1].toLowerCase() : '';
            const label = (extMatch ? raw.slice(0, -extMatch[1].length) : raw).replace(/[_\-\s]+$/g, '').trim();
            if (label) out.push({ label, ext });
        });
        return out;
    }

    function parseTaskFilesMap(rows) {
        const map = {};
        (rows || []).forEach((r) => {
            if (!r?.key || !r.key.startsWith(PROJECT_FILES_PREFIX)) return;
            const taskId = r.key.slice(PROJECT_FILES_PREFIX.length);
            if (!taskId) return;
            try {
                const parsed = JSON.parse(r.value || '[]');
                const normalized = parseFileSpecsInput(parsed);
                if (normalized.length) map[taskId] = normalized;
            } catch { /* ignore */ }
        });
        return map;
    }

    function autoSplitMultiFileSpecs(task) {
        const rawTitle = String(task?.title || '').trim();
        if (!rawTitle) return [];
        const parts = rawTitle
            .split(/\s*(?:,|&|\+|\/|\bdan\b)\s*/i)
            .map((p) => p.replace(/^[\d.)\s-]+/, '').trim())
            .filter((p) => p.replace(/[^a-zA-Z0-9]/g, '').length >= 3);
        if (parts.length >= 2 && parts.length <= 6) {
            return parts.map((p) => ({ label: p, ext: '' }));
        }
        return [];
    }

    function buildProjectFileNaming(task, student = null, customFiles = null) {
        const stageShortMap = {
            'Pre-Production': 'PreProd',
            'Production': 'Prod',
            'Post-Production': 'PostProd'
        };
        const stageTag = stageShortMap[task?.pipeline_stage] || 'Project';
        const classTag = student?.class_name
            ? String(student.class_name).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
            : 'XANIA';
        const studentTag = student?.full_name
            ? toSlugPascal(student.full_name, 2, 22)
            : 'NamaSiswa';

        const customSpecs = parseFileSpecsInput(customFiles);
        const isCustom = customSpecs.length > 0;
        const autoSpecs = isCustom ? [] : autoSplitMultiFileSpecs(task);
        const specs = isCustom
            ? customSpecs
            : (autoSpecs.length ? autoSpecs : [{ label: task?.title || 'Tugas', ext: '' }]);

        const files = specs.map((sp) => {
            const slug = toSlugPascal(sp.label || 'File', 4, 30);
            const ext = sp.ext || detectSuggestedFileExt({
                title: sp.label,
                pipeline_stage: task?.pipeline_stage,
                description: isCustom || autoSpecs.length ? sp.label : (task?.description || '')
            });
            const pattern = `[Kelas]_[NamaSiswa]_${stageTag}_${slug}${ext}`;
            const exampleBase = `${classTag}_${studentTag}_${stageTag}_${slug}`;
            const exampleFull = `${exampleBase}${ext}`;
            return { label: sp.label, slug, ext, pattern, exampleBase, exampleFull };
        });

        const primary = files[0];
        const multiHintExamples = [
            `${primary.exampleBase}_01${primary.ext}`,
            `${primary.exampleBase}_02${primary.ext}`
        ];
        return {
            stageTag,
            taskTag: primary.slug,
            ext: primary.ext,
            pattern: primary.pattern,
            exampleBase: primary.exampleBase,
            exampleFull: primary.exampleFull,
            isCustom,
            isMulti: files.length > 1,
            files,
            multiHintExamples
        };
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
        '{project_update}',
        '📌 Segera upload file ke Folder Google Drive Project kamu, lalu lapor selesai di AniTrack.',
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
            project_update: vars.project_update || '',
            pembimbing: vars.pembimbing || '',
            link_anitrack: vars.link_anitrack || ''
        };
        const hasTaskToken = /\{(daftar_tugas|tugas_terlambat|tugas_mendekati)\}/i.test(raw);
        const hasProjectUpdateToken = /\{project_update\}/i.test(raw);
        const hasMentorToken = /\{pembimbing\}/i.test(raw);
        const hasLinkToken = /\{link_anitrack\}/i.test(raw);
        let rendered = raw.replace(/\{(nama|kelas|subkonsentrasi|daftar_tugas|tugas_terlambat|tugas_mendekati|project_update|pembimbing|link_anitrack)\}/gi, (_, k) => {
            return map[String(k).toLowerCase()] ?? '';
        });
        // Jika admin hanya menulis kalimat pembuka/salam tanpa placeholder tugas/project_update, sistem otomatis melampirkan rinciannya
        const autoExtra = [];
        if (!hasTaskToken && map.daftar_tugas && map.daftar_tugas !== '-') autoExtra.push(map.daftar_tugas);
        if (!hasProjectUpdateToken && map.project_update) autoExtra.push(map.project_update);
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
    const GLOBAL_ANNOUNCEMENT_KEY = 'global_announcement';

    const DEFAULT_CHECKLIST_COLS = ['Compose & Audio Video', 'Grading', 'Final Film + Credit Title'];
    const CHECKLIST_STATUS_OPTIONS = [
        { value: 'none', label: 'None', short: 'None', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
        { value: 'wip', label: 'WIP', short: 'WIP', cls: 'bg-[#FFF6D6] text-[#B45309] border-[#FDE68A]' },
        { value: 'revisi', label: 'Revisi', short: 'Revisi', cls: 'bg-[#FFF0F4] text-[#E11D48] border-[#FECDD6]' },
        { value: 'done', label: 'Done', short: 'Done', cls: 'bg-[#DCFCE7] text-[#15803D] border-[#86EFAC]' }
    ];

    function normalizeChecklistStatus(raw) {
        const v = String(raw || '').trim().toLowerCase();
        if (v === 'done' || v === 'selesai' || v === 'acc') return 'done';
        if (v === 'revisi' || v === 'revision') return 'revisi';
        if (v === 'wip' || v === 'proses' || v === 'in progress' || v === 'sedang_dikerjakan') return 'wip';
        return 'none';
    }

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
                const rawItems = (parsed.items && typeof parsed.items === 'object') ? parsed.items : {};
                const normItems = {};
                Object.keys(rawItems).forEach((k) => { normItems[k] = normalizeChecklistStatus(rawItems[k]); });
                map[sid] = {
                    student_id: sid,
                    items: normItems,
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
                        <div class="text-slate-700 leading-relaxed space-y-2">${formatFeedbackWithImages(e.feedback || '(Tanpa catatan tambahan)')}</div>
                        <div class="text-[10.5px] text-slate-400">Oleh: <strong class="text-slate-600">${esc(e.reviewer_name || 'Guru')}</strong></div>
                    </div>`;
            }).join('');
        }
        modal.classList.remove('hidden');
    }

    // ==================== GAMBAR CATATAN REVISI, PENGUMUMAN GLOBAL, FLOWCHART & CETAK PDF RAPOR ====================
    function formatFeedbackWithImages(rawText, forPrint = false) {
        if (!rawText) return '';
        const imgTokens = [];
        const withPlaceholders = String(rawText).replace(/\[IMG:([^\]]+)\]/g, (_m, rawUrl) => {
            const url = String(rawUrl || '').trim();
            if (!url) return '';
            const idx = imgTokens.length;
            imgTokens.push(url);
            return `@@ANITRACK_IMG_${idx}@@`;
        });
        let html = esc(withPlaceholders).replace(/\r?\n/g, '<br>');
        imgTokens.forEach((url, idx) => {
            const safeUrl = esc(url);
            const imgMarkup = forPrint
                ? `<div style="margin-top:6px;"><img src="${safeUrl}" alt="Lampiran Revisi" style="max-width:240px;max-height:160px;border:1px solid #cbd5e1;border-radius:6px;display:block;" /></div>`
                : `<div class="mt-2"><img src="${safeUrl}" alt="Lampiran Coretan Revisi" onclick="openProofLightbox(this.src, 'Lampiran Gambar Revisi Guru')" class="max-w-xs max-h-48 rounded-xl border border-[#CBD5E1] shadow-sm cursor-zoom-in hover:opacity-90 transition object-contain bg-white" title="Klik untuk perbesar gambar revisi" /></div>`;
            html = html.replace(`@@ANITRACK_IMG_${idx}@@`, imgMarkup);
        });
        return html;
    }

    function stripFeedbackImageTags(rawText) {
        return String(rawText || '').replace(/\[IMG:[^\]]+\]/g, '[Gambar Revisi]').replace(/\s+/g, ' ').trim();
    }

    function renderGlobalAnnouncementBanner(text) {
        const clean = String(text || '').trim();
        const inp = document.getElementById('globalAnnouncementInput');
        if (inp && document.activeElement !== inp) inp.value = clean;
        const dot = document.getElementById('broadcastActiveDot');
        if (dot) dot.classList.toggle('hidden', !clean);

        let bar = document.getElementById('anitrackGlobalAnnouncementBar');
        if (!clean) {
            if (bar) bar.classList.add('hidden');
            return;
        }
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'anitrackGlobalAnnouncementBar';
            bar.className = 'bg-gradient-to-r from-[#0082E6] via-[#2563EB] to-[#4F46E5] text-white text-xs sm:text-[13px] font-semibold py-2 px-4 shadow-sm border-b border-white/15';
            bar.innerHTML = `
                <div class="max-w-[1400px] mx-auto flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                        <span class="px-2 py-0.5 rounded-md bg-[#F7C200] text-[#1E293B] text-[10px] font-extrabold uppercase tracking-wider shrink-0">📢 Info</span>
                        <div id="anitrackGlobalAnnouncementText" class="truncate sm:whitespace-normal leading-snug"></div>
                    </div>
                    <button type="button" onclick="document.getElementById('anitrackGlobalAnnouncementBar').classList.add('hidden')" title="Tutup sementara"
                        class="text-white/80 hover:text-white font-bold px-1.5 py-0.5 rounded cursor-pointer shrink-0">✕</button>
                </div>`;
            const header = document.querySelector('header');
            if (header && header.parentNode) {
                header.parentNode.insertBefore(bar, header.nextSibling);
            } else {
                document.body.prepend(bar);
            }
        }
        const txtEl = document.getElementById('anitrackGlobalAnnouncementText');
        if (txtEl) txtEl.textContent = clean;
        bar.classList.remove('hidden');
    }

    async function loadGlobalAnnouncement() {
        if (!supabase) return '';
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', GLOBAL_ANNOUNCEMENT_KEY).maybeSingle();
            const txt = data?.value ? String(data.value) : '';
            renderGlobalAnnouncementBanner(txt);
            return txt;
        } catch {
            return '';
        }
    }

    async function saveGlobalAnnouncement(text) {
        if (!supabase) return { error: new Error('Supabase tidak siap') };
        const clean = String(text || '').trim();
        const res = await supabase.from('app_settings').upsert({
            key: GLOBAL_ANNOUNCEMENT_KEY,
            value: clean,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
        if (!res.error) renderGlobalAnnouncementBanner(clean);
        return res;
    }

    function openStudentFlowchartModal(student, tasks = [], subMap = {}, mentorObj = null, fbLogs = []) {
        if (!student) return;
        let modal = document.getElementById('anitrackFlowchartModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'anitrackFlowchartModal';
            modal.className = 'fixed inset-0 z-[82] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4';
            modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
            modal.innerHTML = `
                <div class="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#EDF1F7]">
                    <div class="px-5 py-4 border-b border-[#EDF1F7] bg-[#F7FAFF] flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-[10.5px] font-extrabold uppercase tracking-wider text-[#0082E6]">🗺️ Timeline Flowchart Progres Siswa</div>
                            <div id="flowModalTitle" class="text-base font-extrabold text-[#1E293B] truncate mt-0.5"></div>
                            <div id="flowModalMeta" class="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs"></div>
                        </div>
                        <button type="button" onclick="document.getElementById('anitrackFlowchartModal').classList.add('hidden')"
                            class="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#FFF1F5] text-slate-600 hover:text-[#F13B6E] font-bold text-sm cursor-pointer shrink-0">✕</button>
                    </div>
                    <div id="flowModalBody" class="p-5 max-h-[72vh] overflow-y-auto bg-[#FAFBFD]"></div>
                </div>`;
            document.body.appendChild(modal);
        }

        const eligible = (tasks || []).filter((t) => !t.sub_concentration || student.sub_concentration === t.sub_concentration);
        const doneCount = eligible.filter((t) => subMap[`${t.id}__${student.id}`]?.status === 'selesai').length;
        const pct = eligible.length ? Math.round((doneCount / eligible.length) * 100) : 0;

        document.getElementById('flowModalTitle').textContent = `${student.full_name} (${student.class_name || '-'})`;
        document.getElementById('flowModalMeta').innerHTML = `
            <span class="px-2 py-0.5 rounded-md bg-[#EAF4FF] text-[#0082E6] font-bold">${esc(student.sub_concentration || 'Belum ada subkon')}</span>
            <span class="px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#15803D] font-bold">${doneCount}/${eligible.length} Tuntas (${pct}%)</span>
            ${mentorObj ? `<span class="px-2 py-0.5 rounded-md bg-white border border-[#E2E8F0] text-slate-600 font-semibold">👨‍🏫 ${esc(mentorObj.full_name)}</span>` : ''}
            ${renderWhatsappLink(student.whatsapp_number, true)}
            ${student.project_drive_url ? `<a href="${esc(student.project_drive_url)}" target="_blank" rel="noopener noreferrer" class="px-2 py-0.5 rounded-md bg-white border border-[#CBE5FF] text-[#0082E6] hover:bg-[#0095FF] hover:text-white font-bold transition">📁 Drive ↗</a>` : ''}
            <button type="button" onclick="printStudentReportPdf('${student.id}')" class="px-2 py-0.5 rounded-md bg-[#E2F5F2] hover:bg-[#4CB6A7] text-[#1D5E55] hover:text-white font-bold transition cursor-pointer">🖨️ Cetak PDF</button>
        `;

        const body = document.getElementById('flowModalBody');
        if (!eligible.length) {
            body.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Belum ada tugas project untuk sub-konsentrasi siswa ini.</div>`;
        } else {
            body.innerHTML = `
                <div class="relative pl-6 space-y-3.5 before:content-[''] before:absolute before:left-[9px] before:top-3 before:bottom-3 before:w-0.5 before:bg-[#CBD5E1]">
                    ${eligible.map((t, idx) => {
                        const ps = subMap[`${t.id}__${student.id}`] || {};
                        const stVal = ps.status || 'belum_mulai';
                        const isDone = stVal === 'selesai';
                        const isOrange = stVal === 'revisi' || stVal === 'menunggu_review' || stVal === 'sedang_dikerjakan';
                        const dotCls = isDone ? 'bg-[#22C55E] ring-[#DCFCE7]' : (isOrange ? 'bg-[#F97316] ring-[#FFEDD5]' : 'bg-[#CBD5E1] ring-slate-100');
                        const cardCls = isDone ? 'bg-[#F0FDF4] border-[#BBF7D0]' : (stVal === 'revisi' ? 'bg-[#FFF5F7] border-[#FECDD6]' : (isOrange ? 'bg-[#FFFBEB] border-[#FDE68A]' : 'bg-white border-[#E2E8F0]'));
                        const stObj = STATUS_OPTIONS.find((x) => x.value === stVal) || STATUS_OPTIONS[0];
                        const tm = evaluateSubmissionTimeliness(t.due_date, ps.updated_at, stVal);
                        const revNum = Number(ps.revision_count || 0);
                        return `
                            <div class="relative">
                                <span class="absolute -left-6 top-3.5 w-4 h-4 rounded-full border-2 border-white ring-4 ${dotCls}"></span>
                                <div class="rounded-xl border p-3.5 shadow-xs space-y-1.5 ${cardCls}">
                                    <div class="flex flex-wrap items-start justify-between gap-2">
                                        <div class="min-w-0">
                                            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">${idx + 1}. ${esc(t.pipeline_stage)} ${t.due_date ? `• Deadline ${esc(formatDateOnly(t.due_date))}` : ''}</div>
                                            <div class="text-xs sm:text-sm font-extrabold text-[#1E293B] mt-0.5">${esc(t.title)}</div>
                                        </div>
                                        <span class="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${isDone ? tm.badgeClass : stObj.badge}">
                                            ${isDone ? esc(tm.label) : esc(stObj.label)}
                                        </span>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2 text-[10.5px] text-slate-500">
                                        ${ps.updated_at ? `<span>⏱ Update: ${esc(formatDateTime(ps.updated_at))}</span>` : `<span>Belum dikumpulkan</span>`}
                                        ${revNum > 0 ? `<span class="px-1.5 py-0.5 rounded bg-[#FFF0F4] text-[#E11D48] font-bold">Revisi ke-${revNum}</span>` : ''}
                                        ${ps.proof_image ? `<button type="button" onclick="openProofLightbox('${esc(ps.proof_image)}', '${esc(t.title)} — ${esc(student.full_name)}')" class="font-bold text-[#0082E6] hover:underline cursor-pointer">📷 Lihat Bukti Siswa</button>` : ''}
                                    </div>
                                    ${ps.mentor_feedback ? `
                                        <div class="mt-2 p-2.5 rounded-lg bg-white/90 border border-[#E2E8F0] text-xs text-slate-700">
                                            <div class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Catatan Pembimbing:</div>
                                            ${formatFeedbackWithImages(ps.mentor_feedback)}
                                        </div>` : ''}
                                </div>
                            </div>`;
                    }).join('')}
                </div>`;
        }
        modal.classList.remove('hidden');
    }

    function buildStudentReportPrintHtml(student, ctx = {}) {
        const { tasks = [], subMap = {}, mentorMap = {}, fbLogMap = {}, checklistColsMap = {}, checklistRowMap = {} } = ctx;
        const eligible = tasks.filter((t) => !t.sub_concentration || student.sub_concentration === t.sub_concentration);
        const stats = computeStudentIssueStats(student, tasks, subMap);
        const pct = stats.eligibleCount ? Math.round((stats.accCount / stats.eligibleCount) * 100) : 0;
        const mentor = student.mentor_id ? mentorMap[student.mentor_id] : null;
        const logs = fbLogMap[student.id] || [];
        const ckCols = (student.sub_concentration && checklistColsMap[student.sub_concentration]) || DEFAULT_CHECKLIST_COLS;
        const ckRow = checklistRowMap[student.id] || { items: {}, notes: '' };
        const ckDone = ckCols.filter((c) => normalizeChecklistStatus(ckRow.items?.[c]) === 'done').length;
        const ckPct = ckCols.length ? Math.round((ckDone / ckCols.length) * 100) : 0;
        const statusTextMap = Object.fromEntries(CHECKLIST_STATUS_OPTIONS.map((o) => [o.value, o.label]));
        const todayId = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

        const taskRowsHtml = eligible.length ? eligible.map((t, i) => {
            const ps = subMap[`${t.id}__${student.id}`] || {};
            const stVal = ps.status || 'belum_mulai';
            const stObj = STATUS_OPTIONS.find((x) => x.value === stVal) || STATUS_OPTIONS[0];
            const tm = evaluateSubmissionTimeliness(t.due_date, ps.updated_at, stVal);
            const taskLogs = logs.filter((l) => l.task_id === t.id || (l.task_title && l.task_title === t.title));
            const statusDisplay = stVal === 'selesai' ? tm.label : stObj.label;
            const timeLine = ps.updated_at ? `<div style="font-size:9px;color:#475569;margin-top:2px;">(${esc(formatDateTime(ps.updated_at))})</div>` : '';
            const histHtml = taskLogs.length
                ? taskLogs.slice(0, 4).map((l) => `<div style="margin-bottom:4px;border-bottom:1px dashed #e2e8f0;padding-bottom:3px;"><strong>[${esc(formatDateTime(l.at))}]</strong> ${formatFeedbackWithImages(l.feedback, true)}</div>`).join('')
                : (ps.mentor_feedback ? formatFeedbackWithImages(ps.mentor_feedback, true) : '-');
            return `
                <tr>
                    <td style="border:1px solid #94a3b8;padding:6px;text-align:center;">${i + 1}</td>
                    <td style="border:1px solid #94a3b8;padding:6px;">
                        <div style="font-weight:700;">${esc(t.title)}</div>
                        <div style="font-size:9px;color:#64748b;">${esc(t.pipeline_stage)}${t.due_date ? ` • Deadline: ${esc(formatDateOnly(t.due_date))}` : ''}</div>
                    </td>
                    <td style="border:1px solid #94a3b8;padding:6px;text-align:center;font-weight:700;">${esc(statusDisplay)}${timeLine}</td>
                    <td style="border:1px solid #94a3b8;padding:6px;font-size:10px;line-height:1.4;">${histHtml}</td>
                </tr>`;
        }).join('') : `<tr><td colspan="4" style="border:1px solid #94a3b8;padding:10px;text-align:center;color:#64748b;">Belum ada tugas project untuk sub-konsentrasi ini.</td></tr>`;

        const ckSummaryHtml = ckCols.map((c) => {
            const st = statusTextMap[normalizeChecklistStatus(ckRow.items?.[c])] || 'None';
            const bg = st === 'Done' ? '#dcfce7' : (st === 'Revisi' ? '#ffe4e6' : (st === 'WIP' ? '#fef3c7' : '#f1f5f9'));
            return `<span style="display:inline-block;padding:3px 8px;border-radius:6px;background:${bg};border:1px solid #cbd5e1;font-size:10px;font-weight:700;margin:2px 4px 2px 0;">${esc(c)}: ${esc(st)}</span>`;
        }).join('');

        return `
            <div class="report-page">
                <div style="text-align:center;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:14px;">
                    <div style="font-size:16px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">LAPORAN JURNAL &amp; PROGRES PROJECT SISWA</div>
                    <div style="font-size:11px;color:#334155;margin-top:2px;">Jurusan Animasi — SMKN 4 Malang • Sistem Monitoring AniTrack</div>
                </div>

                <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:14px;font-size:11px;">
                    <div style="line-height:1.6;">
                        <div><strong>Nama Siswa:</strong> ${esc(student.full_name)}</div>
                        <div><strong>Kelas / Username:</strong> ${esc(student.class_name || '-')} / @${esc(student.username || '-')}</div>
                        <div><strong>Sub-Konsentrasi:</strong> ${esc(student.sub_concentration || 'Belum diatur')}</div>
                        <div><strong>No. WhatsApp:</strong> ${esc(formatWhatsappDisplay(student.whatsapp_number) || '-')}</div>
                        <div><strong>Guru Pembimbing:</strong> ${esc(mentor?.full_name || 'Belum di-plot')}</div>
                    </div>
                    <div style="border:1px solid #94a3b8;border-radius:8px;padding:10px 14px;background:#f8fafc;min-width:190px;line-height:1.7;">
                        <div style="font-weight:700;color:#15803d;">Tugas Tuntas: ${stats.accCount}/${stats.eligibleCount} (${pct}%)</div>
                        <div style="font-weight:700;color:#a16207;">Lencana Emas: ${stats.goldCount}</div>
                        <div style="font-weight:700;color:#be123c;">Poin Masalah: ${stats.totalIssues}</div>
                        <div style="font-weight:700;color:#0369a1;">Project Update: ${ckDone}/${ckCols.length} Done (${ckPct}%)</div>
                    </div>
                </div>

                <div style="margin-bottom:12px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;background:#fafbfd;">
                    <div style="font-size:11px;font-weight:800;margin-bottom:5px;">Status Project Update (${esc(student.sub_concentration || 'Sub-Konsentrasi')}):</div>
                    <div>${ckSummaryHtml}</div>
                    ${ckRow.notes ? `<div style="font-size:10px;margin-top:6px;color:#334155;"><strong>Notes PJ Subkon:</strong> ${esc(ckRow.notes)}</div>` : ''}
                </div>

                <div style="font-size:12px;font-weight:800;margin-bottom:6px;">Rincian Tugas Project &amp; Histori Revisi:</div>
                <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-bottom:24px;">
                    <thead>
                        <tr style="background:#e2e8f0;">
                            <th style="border:1px solid #94a3b8;padding:6px;width:30px;">No</th>
                            <th style="border:1px solid #94a3b8;padding:6px;text-align:left;">Nama Tugas &amp; Deadline</th>
                            <th style="border:1px solid #94a3b8;padding:6px;width:130px;">Status</th>
                            <th style="border:1px solid #94a3b8;padding:6px;text-align:left;width:230px;">Catatan / Histori Revisi</th>
                        </tr>
                    </thead>
                    <tbody>${taskRowsHtml}</tbody>
                </table>

                <div style="display:flex;justify-content:space-between;margin-top:26px;padding:0 24px;font-size:11px;text-align:center;">
                    <div>
                        <div>Mengetahui,</div>
                        <div>Orang Tua / Wali Siswa</div>
                        <div style="height:56px;"></div>
                        <div style="border-bottom:1px solid #0f172a;width:160px;margin:0 auto;"></div>
                    </div>
                    <div>
                        <div>Malang, ${esc(todayId)}</div>
                        <div>Guru Pembimbing</div>
                        <div style="height:56px;"></div>
                        <div style="font-weight:700;text-decoration:underline;">${esc(mentor?.full_name || '________________________')}</div>
                    </div>
                </div>
            </div>`;
    }

    function printStudentsReportPdf(studentsArray = [], ctx = {}, titleLabel = 'Laporan Rapor Jurnal Siswa — AniTrack') {
        if (!studentsArray || !studentsArray.length) {
            showToast('Tidak ada data siswa untuk dicetak.');
            return;
        }
        const pagesHtml = studentsArray.map((s) => buildStudentReportPrintHtml(s, ctx)).join('');
        const fullDoc = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>${esc(titleLabel)}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; background: #fff; }
                .report-page { page-break-after: always; padding: 8px 4px; }
                .report-page:last-child { page-break-after: auto; }
                @media print {
                    body { padding: 0; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            </style>
        </head><body>${pagesHtml}<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };<\/script></body></html>`;

        const win = window.open('', '_blank');
        if (!win) {
            showToast('Popup cetak diblokir browser. Izinkan popup untuk situs ini lalu klik Cetak PDF lagi.');
            return;
        }
        win.document.open();
        win.document.write(fullDoc);
        win.document.close();
    }

    // ==================== 1. MODE GELAP (DARK MODE ENGINE) ====================
    const DARK_THEME_STORAGE_KEY = 'anitrack_theme';

    function injectDarkModeStyles() {
        if (document.getElementById('anitrackDarkStyle')) return;
        const st = document.createElement('style');
        st.id = 'anitrackDarkStyle';
        st.textContent = `
            .anitrack-xscroll { scrollbar-width: thin; scrollbar-color: #94A3B8 #EEF2F7; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
            .anitrack-xscroll::-webkit-scrollbar { height: 11px; width: 11px; }
            .anitrack-xscroll::-webkit-scrollbar-track { background: #EEF2F7; border-radius: 999px; }
            .anitrack-xscroll::-webkit-scrollbar-thumb { background: #94A3B8; border-radius: 999px; border: 2px solid #EEF2F7; }
            .anitrack-xscroll::-webkit-scrollbar-thumb:hover { background: #0095FF; }
            html.dark .anitrack-xscroll { scrollbar-color: #475569 #1E293B; }
            html.dark .anitrack-xscroll::-webkit-scrollbar-track { background: #1E293B; }
            html.dark .anitrack-xscroll::-webkit-scrollbar-thumb { background: #475569; border-color: #1E293B; }
            html.dark .anitrack-xscroll::-webkit-scrollbar-thumb:hover { background: #38BDF8; }
            #checklistTableScroll.is-scrolled .ck-sticky-col { box-shadow: 6px 0 12px -4px rgba(15, 23, 42, 0.14); }
            html.dark #checklistTableScroll.is-scrolled .ck-sticky-col { box-shadow: 6px 0 14px -4px rgba(0, 0, 0, 0.55); }
            html.dark, html.dark body { background-color: #0B1120 !important; color: #E2E8F0 !important; }
            html.dark section.bg-\\[\\#F3F6FB\\], html.dark div.bg-\\[\\#F3F6FB\\], html.dark .bg-\\[\\#F3F6FB\\] { background-color: #0B1120 !important; }
            html.dark aside#sidebar, html.dark header, html.dark nav.fixed, html.dark .bg-white { background-color: #111827 !important; }
            html.dark header.bg-white\\/95, html.dark nav.bg-white\\/95 { background-color: rgba(17, 24, 39, 0.94) !important; }
            html.dark .bg-\\[\\#FAFBFD\\], html.dark .bg-\\[\\#F7F9FC\\], html.dark .bg-\\[\\#F7FAFF\\], html.dark .bg-\\[\\#F8FBFF\\], html.dark .bg-\\[\\#F4F8FF\\], html.dark .bg-slate-50 { background-color: #1A2438 !important; }
            html.dark .bg-\\[\\#F1F5F9\\], html.dark .bg-slate-100, html.dark .bg-slate-100\\/80 { background-color: #1E293B !important; }
            html.dark .bg-\\[\\#EAF4FF\\], html.dark .bg-\\[\\#F0F9FF\\], html.dark .bg-\\[\\#E0F2FE\\] { background-color: rgba(0, 149, 255, 0.16) !important; }
            html.dark .bg-\\[\\#E3F6F3\\], html.dark .bg-\\[\\#E2F5F2\\], html.dark .bg-\\[\\#F2FBF9\\], html.dark .bg-\\[\\#F0FDF4\\], html.dark .bg-\\[\\#F5FBF7\\], html.dark .bg-\\[\\#E7F9EE\\], html.dark .bg-\\[\\#DCFCE7\\] { background-color: rgba(16, 185, 129, 0.16) !important; }
            html.dark .bg-\\[\\#FFF0F4\\], html.dark .bg-\\[\\#FFF1F5\\], html.dark .bg-\\[\\#FFF5F7\\], html.dark .bg-\\[\\#FFF8FA\\], html.dark .bg-\\[\\#FFE4EC\\] { background-color: rgba(244, 63, 94, 0.16) !important; }
            html.dark .bg-\\[\\#FFF6D6\\], html.dark .bg-\\[\\#FFFDF5\\], html.dark .bg-\\[\\#FFFBEB\\] { background-color: rgba(245, 158, 11, 0.16) !important; }
            html.dark .bg-\\[\\#EEF2FF\\] { background-color: rgba(99, 102, 241, 0.2) !important; }
            html.dark .border-\\[\\#EDF1F7\\], html.dark .border-\\[\\#E2E8F0\\], html.dark .border-\\[\\#E8EEF6\\], html.dark .border-\\[\\#F1F5F9\\], html.dark .border-\\[\\#DCEBFF\\], html.dark .border-\\[\\#CBE5FF\\], html.dark .border-\\[\\#DCE5F2\\], html.dark .border-\\[\\#DCEEEB\\], html.dark .border-\\[\\#BBE9E2\\], html.dark .border-\\[\\#BAE6FD\\], html.dark .border-slate-200 { border-color: #253349 !important; }
            html.dark .border-\\[\\#86EFAC\\], html.dark .border-\\[\\#BBF7D0\\] { border-color: rgba(16, 185, 129, 0.4) !important; }
            html.dark .border-\\[\\#FDE68A\\] { border-color: rgba(245, 158, 11, 0.4) !important; }
            html.dark .border-\\[\\#FECDD6\\] { border-color: rgba(244, 63, 94, 0.4) !important; }
            html.dark .divide-\\[\\#EDF1F7\\] > :not([hidden]) ~ :not([hidden]), html.dark .divide-\\[\\#F1F5F9\\] > :not([hidden]) ~ :not([hidden]) { border-color: #253349 !important; }
            html.dark .text-\\[\\#1E293B\\], html.dark .text-slate-800, html.dark .text-slate-700 { color: #F1F5F9 !important; }
            html.dark .text-slate-600, html.dark .text-slate-500 { color: #94A3B8 !important; }
            html.dark .text-slate-400 { color: #64748B !important; }
            html.dark .text-\\[\\#1D5E55\\], html.dark .text-\\[\\#15803D\\], html.dark .text-\\[\\#166534\\] { color: #6EE7B7 !important; }
            html.dark .text-\\[\\#78350F\\], html.dark .text-\\[\\#92400E\\], html.dark .text-\\[\\#B45309\\], html.dark .text-\\[\\#9A6F00\\] { color: #FCD34D !important; }
            html.dark .text-\\[\\#0369A1\\], html.dark .text-\\[\\#0082E6\\] { color: #38BDF8 !important; }
            html.dark .text-\\[\\#BE123C\\], html.dark .text-\\[\\#9F1239\\] { color: #FDA4AF !important; }
            html.dark #checklistMainTable thead th { background-color: #162033 !important; }
            html.dark #checklistMainTable thead tr:nth-child(2) th { background-color: #132A2E !important; color: #6EE7B7 !important; }
            html.dark input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), html.dark select, html.dark textarea { background-color: #0F172A !important; color: #F1F5F9 !important; border-color: #334155 !important; }
            html.dark input::placeholder, html.dark textarea::placeholder { color: #64748B !important; }
            html.dark .hover\\:bg-\\[\\#F8FBFF\\]:hover, html.dark .hover\\:bg-\\[\\#F7F9FC\\]:hover, html.dark .hover\\:bg-\\[\\#F4F8FF\\]:hover, html.dark .hover\\:bg-slate-50:hover { background-color: #1E293B !important; }
            html.dark tr:hover > td.sticky { background-color: #1E293B !important; }
            html.dark td.sticky, html.dark th.sticky { background-color: #111827 !important; }
            html.dark .shadow-card { box-shadow: 0 2px 14px rgba(0, 0, 0, 0.35) !important; }
            html.dark #anitrackNotifPopover { background-color: #111827 !important; border-color: #253349 !important; }
        `;
        document.head.appendChild(st);
    }

    function updateDarkModeButtons(isDark) {
        document.querySelectorAll('[data-dark-toggle]').forEach((btn) => {
            btn.title = isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap';
            const icon = btn.querySelector('[data-dark-icon]');
            if (icon) icon.textContent = isDark ? '☀️' : '🌙';
        });
    }

    function applyDarkMode(isDark) {
        injectDarkModeStyles();
        document.documentElement.classList.toggle('dark', Boolean(isDark));
        try { localStorage.setItem(DARK_THEME_STORAGE_KEY, isDark ? 'dark' : 'light'); } catch { /* ignore */ }
        updateDarkModeButtons(Boolean(isDark));
    }

    function initDarkMode() {
        let saved = 'light';
        try { saved = localStorage.getItem(DARK_THEME_STORAGE_KEY) || 'light'; } catch { /* ignore */ }
        applyDarkMode(saved === 'dark');
    }

    function toggleDarkMode() {
        const next = !document.documentElement.classList.contains('dark');
        applyDarkMode(next);
        showToast(next ? 'Mode Gelap aktif 🌙' : 'Mode Terang aktif ☀️');
    }
    global.toggleDarkMode = toggleDarkMode;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDarkMode);
    } else {
        initDarkMode();
    }

    // ==================== 2. IN-APP DRAW-OVER IMAGE ANNOTATOR ====================
    let annotatorCtxState = {
        baseImg: null,
        shapes: [],
        tool: 'pen',
        color: '#EF4444',
        width: 4,
        drawing: false,
        currentShape: null,
        onSave: null
    };

    function redrawAnnotatorCanvas() {
        const canvas = document.getElementById('anitrackAnnotatorCanvas');
        if (!canvas || !annotatorCtxState.baseImg) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(annotatorCtxState.baseImg, 0, 0, canvas.width, canvas.height);

        const drawShape = (sh) => {
            if (!sh) return;
            ctx.save();
            ctx.strokeStyle = sh.color || '#EF4444';
            ctx.fillStyle = sh.color || '#EF4444';
            ctx.lineWidth = sh.width || 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (sh.tool === 'pen' && sh.points?.length) {
                ctx.beginPath();
                ctx.moveTo(sh.points[0].x, sh.points[0].y);
                for (let i = 1; i < sh.points.length; i++) ctx.lineTo(sh.points[i].x, sh.points[i].y);
                ctx.stroke();
            } else if (sh.tool === 'arrow') {
                const dx = sh.x2 - sh.x1;
                const dy = sh.y2 - sh.y1;
                const angle = Math.atan2(dy, dx);
                const headLen = Math.max(14, (sh.width || 4) * 3.5);
                ctx.beginPath();
                ctx.moveTo(sh.x1, sh.y1);
                ctx.lineTo(sh.x2, sh.y2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(sh.x2, sh.y2);
                ctx.lineTo(sh.x2 - headLen * Math.cos(angle - Math.PI / 6), sh.y2 - headLen * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(sh.x2 - headLen * Math.cos(angle + Math.PI / 6), sh.y2 - headLen * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
            } else if (sh.tool === 'circle') {
                const cx = (sh.x1 + sh.x2) / 2;
                const cy = (sh.y1 + sh.y2) / 2;
                const rx = Math.abs(sh.x2 - sh.x1) / 2;
                const ry = Math.abs(sh.y2 - sh.y1) / 2;
                ctx.beginPath();
                ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (sh.tool === 'text' && sh.text) {
                const fontSize = Math.max(18, (sh.width || 4) * 5);
                ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", Arial, sans-serif`;
                const metrics = ctx.measureText(sh.text);
                const padX = 8;
                const padY = 5;
                ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
                ctx.fillRect(sh.x1 - padX, sh.y1 - fontSize - padY + 4, metrics.width + padX * 2, fontSize + padY * 2);
                ctx.fillStyle = sh.color || '#EF4444';
                ctx.fillText(sh.text, sh.x1, sh.y1);
            }
            ctx.restore();
        };

        annotatorCtxState.shapes.forEach(drawShape);
        if (annotatorCtxState.currentShape) drawShape(annotatorCtxState.currentShape);
    }

    function openImageAnnotatorModal(imgSrc, title = 'Coret Bukti Siswa', onSaveCallback = null) {
        if (!imgSrc) { showToast('Belum ada gambar bukti untuk dicoret.'); return; }
        let modal = document.getElementById('anitrackAnnotatorModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'anitrackAnnotatorModal';
            modal.className = 'fixed inset-0 z-[85] bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4';
            modal.innerHTML = `
                <div class="relative max-w-5xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#EDF1F7] flex flex-col max-h-[94vh]">
                    <div class="px-4 py-3 border-b border-[#EDF1F7] bg-[#F7FAFF] flex flex-wrap items-center justify-between gap-2">
                        <div class="min-w-0">
                            <div class="text-[10px] font-extrabold uppercase tracking-wider text-[#E11D48]">✏️ Coret Langsung Bukti Siswa (In-App Annotator)</div>
                            <div id="annotatorModalTitle" class="text-sm font-extrabold text-[#1E293B] truncate"></div>
                        </div>
                        <button type="button" onclick="document.getElementById('anitrackAnnotatorModal').classList.add('hidden')"
                            class="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#FFF1F5] text-slate-600 hover:text-[#F13B6E] font-bold text-sm cursor-pointer shrink-0">✕</button>
                    </div>
                    <div class="px-4 py-2.5 border-b border-[#EDF1F7] bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div class="flex flex-wrap items-center gap-1.5">
                            <button type="button" data-ann-tool="pen" onclick="setAnnotatorTool('pen')" class="px-2.5 py-1.5 rounded-lg font-bold border cursor-pointer bg-[#1E293B] text-white border-[#1E293B]">✏️ Pena</button>
                            <button type="button" data-ann-tool="arrow" onclick="setAnnotatorTool('arrow')" class="px-2.5 py-1.5 rounded-lg font-bold border cursor-pointer bg-white text-slate-600 border-[#E2E8F0]">➡️ Panah</button>
                            <button type="button" data-ann-tool="circle" onclick="setAnnotatorTool('circle')" class="px-2.5 py-1.5 rounded-lg font-bold border cursor-pointer bg-white text-slate-600 border-[#E2E8F0]">⭕ Lingkaran</button>
                            <button type="button" data-ann-tool="text" onclick="setAnnotatorTool('text')" class="px-2.5 py-1.5 rounded-lg font-bold border cursor-pointer bg-white text-slate-600 border-[#E2E8F0]">🔤 Teks</button>
                            <span class="mx-1 text-slate-300">|</span>
                            ${['#EF4444', '#FACC15', '#22C55E', '#38BDF8', '#FFFFFF'].map((c) => `
                                <button type="button" data-ann-color="${c}" onclick="setAnnotatorColor('${c}')"
                                    class="w-6 h-6 rounded-full border-2 ${c === '#EF4444' ? 'border-[#1E293B] scale-110' : 'border-slate-300'} cursor-pointer transition" style="background:${c};"></button>`).join('')}
                            <span class="mx-1 text-slate-300">|</span>
                            <select id="annotatorWidthSel" onchange="setAnnotatorWidth(this.value)" class="px-2 py-1 rounded-lg border border-[#E2E8F0] text-xs font-bold">
                                <option value="3">Tipis</option>
                                <option value="5" selected>Sedang</option>
                                <option value="9">Tebal</option>
                            </select>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <button type="button" onclick="undoAnnotatorShape()" class="px-2.5 py-1.5 rounded-lg bg-[#F3F6FB] hover:bg-[#EAF4FF] text-slate-700 font-bold cursor-pointer">↩️ Undo</button>
                            <button type="button" onclick="clearAnnotatorShapes()" class="px-2.5 py-1.5 rounded-lg bg-[#FFF0F4] hover:bg-[#F13B6E] text-[#E11D48] hover:text-white font-bold cursor-pointer">🗑️ Reset</button>
                            <button type="button" onclick="saveAnnotatorResult()" class="px-3.5 py-1.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white font-extrabold shadow-sm cursor-pointer">💾 Pakai ke Catatan Revisi</button>
                        </div>
                    </div>
                    <div class="flex-1 bg-slate-900 overflow-auto p-3 flex items-center justify-center min-h-[300px]">
                        <canvas id="anitrackAnnotatorCanvas" class="max-w-full max-h-[68vh] rounded-lg shadow-xl cursor-crosshair bg-white" style="touch-action:none;"></canvas>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            const canvas = modal.querySelector('#anitrackAnnotatorCanvas');
            const getPos = (e) => {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
            };
            canvas.addEventListener('pointerdown', (e) => {
                const pos = getPos(e);
                if (annotatorCtxState.tool === 'text') {
                    const txt = prompt('Tulis catatan singkat pada titik ini:');
                    if (txt && txt.trim()) {
                        annotatorCtxState.shapes.push({ tool: 'text', x1: pos.x, y1: pos.y, text: txt.trim(), color: annotatorCtxState.color, width: annotatorCtxState.width });
                        redrawAnnotatorCanvas();
                    }
                    return;
                }
                canvas.setPointerCapture?.(e.pointerId);
                annotatorCtxState.drawing = true;
                if (annotatorCtxState.tool === 'pen') {
                    annotatorCtxState.currentShape = { tool: 'pen', points: [pos], color: annotatorCtxState.color, width: annotatorCtxState.width };
                } else {
                    annotatorCtxState.currentShape = { tool: annotatorCtxState.tool, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, color: annotatorCtxState.color, width: annotatorCtxState.width };
                }
                redrawAnnotatorCanvas();
            });
            canvas.addEventListener('pointermove', (e) => {
                if (!annotatorCtxState.drawing || !annotatorCtxState.currentShape) return;
                const pos = getPos(e);
                if (annotatorCtxState.currentShape.tool === 'pen') {
                    annotatorCtxState.currentShape.points.push(pos);
                } else {
                    annotatorCtxState.currentShape.x2 = pos.x;
                    annotatorCtxState.currentShape.y2 = pos.y;
                }
                redrawAnnotatorCanvas();
            });
            const endDraw = () => {
                if (!annotatorCtxState.drawing) return;
                annotatorCtxState.drawing = false;
                if (annotatorCtxState.currentShape) {
                    annotatorCtxState.shapes.push(annotatorCtxState.currentShape);
                    annotatorCtxState.currentShape = null;
                    redrawAnnotatorCanvas();
                }
            };
            canvas.addEventListener('pointerup', endDraw);
            canvas.addEventListener('pointercancel', endDraw);
        }

        annotatorCtxState.shapes = [];
        annotatorCtxState.currentShape = null;
        annotatorCtxState.drawing = false;
        annotatorCtxState.onSave = onSaveCallback;
        document.getElementById('annotatorModalTitle').textContent = title || 'Coret Bukti Siswa';

        const img = new Image();
        if (!/^data:/i.test(imgSrc)) img.crossOrigin = 'anonymous';
        img.onload = () => {
            const maxDim = 1200;
            let w = img.naturalWidth || img.width || 800;
            let h = img.naturalHeight || img.height || 600;
            if (w > maxDim || h > maxDim) {
                if (w >= h) { h = Math.round((h * maxDim) / w); w = maxDim; }
                else { w = Math.round((w * maxDim) / h); h = maxDim; }
            }
            const canvas = document.getElementById('anitrackAnnotatorCanvas');
            canvas.width = w;
            canvas.height = h;
            annotatorCtxState.baseImg = img;
            redrawAnnotatorCanvas();
            modal.classList.remove('hidden');
        };
        img.onerror = () => showToast('Gagal memuat gambar ke kanvas coretan.');
        img.src = imgSrc;
    }

    global.setAnnotatorTool = function (tool) {
        annotatorCtxState.tool = tool || 'pen';
        document.querySelectorAll('[data-ann-tool]').forEach((b) => {
            const active = b.dataset.annTool === annotatorCtxState.tool;
            b.className = `px-2.5 py-1.5 rounded-lg font-bold border cursor-pointer ${active ? 'bg-[#1E293B] text-white border-[#1E293B]' : 'bg-white text-slate-600 border-[#E2E8F0]'}`;
        });
    };
    global.setAnnotatorColor = function (c) {
        annotatorCtxState.color = c || '#EF4444';
        document.querySelectorAll('[data-ann-color]').forEach((b) => {
            const active = b.dataset.annColor === annotatorCtxState.color;
            b.className = `w-6 h-6 rounded-full border-2 ${active ? 'border-[#1E293B] scale-110' : 'border-slate-300'} cursor-pointer transition`;
        });
    };
    global.setAnnotatorWidth = function (w) { annotatorCtxState.width = Number(w || 5); };
    global.undoAnnotatorShape = function () { annotatorCtxState.shapes.pop(); redrawAnnotatorCanvas(); };
    global.clearAnnotatorShapes = function () { annotatorCtxState.shapes = []; redrawAnnotatorCanvas(); };
    global.saveAnnotatorResult = function () {
        const canvas = document.getElementById('anitrackAnnotatorCanvas');
        if (!canvas) return;
        try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
            document.getElementById('anitrackAnnotatorModal')?.classList.add('hidden');
            if (typeof annotatorCtxState.onSave === 'function') annotatorCtxState.onSave(dataUrl);
        } catch {
            showToast('Gambar tidak dapat diekspor dari kanvas (CORS). Gunakan screenshot Ctrl+V di modal revisi.');
        }
    };

    // ==================== 3. LINK PANTAU ORANG TUA (READ-ONLY TOKEN) ====================
    const PARENT_WATCH_PREFIX = 'parent_watch_v1::';
    const PARENT_TOKEN_PREFIX = 'parent_token::';

    function generateWatchToken() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let out = '';
        for (let i = 0; i < 18; i++) out += chars[Math.floor(Math.random() * chars.length)];
        return out;
    }

    async function getOrCreateParentWatchToken(student, forceRegenerate = false) {
        if (!supabase || !student?.id) return null;
        const watchKey = `${PARENT_WATCH_PREFIX}${student.id}`;
        let existing = null;
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', watchKey).maybeSingle();
            if (data?.value) existing = JSON.parse(data.value);
        } catch { /* ignore */ }

        if (existing?.token && existing.active !== false && !forceRegenerate) {
            return existing.token;
        }
        if (existing?.token && forceRegenerate) {
            await supabase.from('app_settings').delete().eq('key', `${PARENT_TOKEN_PREFIX}${existing.token}`);
        }
        const token = generateWatchToken();
        const nowIso = new Date().toISOString();
        const payload = { token, student_id: student.id, student_name: student.full_name || '', class_name: student.class_name || '', active: true, updated_at: nowIso };
        const [r1, r2] = await Promise.all([
            supabase.from('app_settings').upsert({ key: watchKey, value: JSON.stringify(payload), updated_at: nowIso }, { onConflict: 'key' }),
            supabase.from('app_settings').upsert({ key: `${PARENT_TOKEN_PREFIX}${token}`, value: JSON.stringify({ student_id: student.id, active: true, updated_at: nowIso }), updated_at: nowIso }, { onConflict: 'key' })
        ]);
        if (r1.error || r2.error) return null;
        return token;
    }

    function getTelegramShareUrl(url = '', text = '') {
        const base = 'https://t.me/share/url';
        const q = [];
        if (url) q.push(`url=${encodeURIComponent(url)}`);
        if (text) q.push(`text=${encodeURIComponent(text)}`);
        return q.length ? `${base}?${q.join('&')}` : base;
    }

    function buildParentWatchUrl(token) {
        try {
            const u = new URL('./pantau.html', global.location.href);
            u.searchParams.set('token', token);
            return u.toString();
        } catch {
            return `https://anitrack.republikanimasi.my.id/pantau.html?token=${encodeURIComponent(token)}`;
        }
    }

    async function openParentWatchLinkModal(student, forceRegenerate = false) {
        if (!student?.id) return;
        showToast(forceRegenerate ? 'Membuat ulang token link orang tua...' : 'Menyiapkan link pantau orang tua...');
        const token = await getOrCreateParentWatchToken(student, forceRegenerate);
        if (!token) { showToast('Gagal membuat link pantau orang tua.'); return; }
        const watchUrl = buildParentWatchUrl(token);
        const waText = `Yth. Orang Tua/Wali dari *${student.full_name}* (${student.class_name || 'Animasi SMKN 4 Malang'}),\n\nBerikut tautan resmi untuk memantau progres Project, Timeline, dan Daily Task putra/putri Bapak/Ibu secara real-time di AniTrack (tanpa perlu login):\n${watchUrl}\n\nTerima kasih atas kerja samanya.\n— Jurusan Animasi SMKN 4 Malang`;
        const waShareUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;
        const tgShareUrl = getTelegramShareUrl(watchUrl, `Yth. Orang Tua/Wali dari ${student.full_name} (${student.class_name || 'Animasi SMKN 4 Malang'}), berikut link pantau progres Project & Daily Task putra/putri Bapak/Ibu secara real-time di AniTrack:`);

        let modal = document.getElementById('anitrackParentLinkModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'anitrackParentLinkModal';
            modal.className = 'fixed inset-0 z-[84] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4';
            modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
            modal.innerHTML = `
                <div class="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#EDF1F7]">
                    <div class="px-5 py-4 border-b border-[#EDF1F7] bg-[#F0FDF4] flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-[10.5px] font-extrabold uppercase tracking-wider text-[#15803D]">👨‍👩‍👧 Portal Pantau Orang Tua / Wali (Read-Only)</div>
                            <div id="parentLinkTitle" class="text-sm sm:text-base font-extrabold text-[#1E293B] truncate mt-0.5"></div>
                        </div>
                        <button type="button" onclick="document.getElementById('anitrackParentLinkModal').classList.add('hidden')"
                            class="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#FFF1F5] text-slate-600 hover:text-[#F13B6E] font-bold text-sm cursor-pointer shrink-0">✕</button>
                    </div>
                    <div id="parentLinkBody" class="p-5 space-y-4 text-xs"></div>
                </div>`;
            document.body.appendChild(modal);
        }
        document.getElementById('parentLinkTitle').textContent = `${student.full_name} (${student.class_name || '-'})`;
        document.getElementById('parentLinkBody').innerHTML = `
            <p class="text-slate-600 leading-relaxed">Orang tua / wali dapat membuka link ini kapan saja untuk memantau progres project, status Project Update, Timeline Flowchart, dan catatan pembimbing secara <strong>hanya baca (tanpa login)</strong>.</p>
            <div class="space-y-1.5">
                <label class="block text-[11px] font-bold text-slate-500">Tautan Khusus Siswa</label>
                <input id="parentWatchUrlInput" type="text" readonly value="${esc(watchUrl)}" onclick="this.select()"
                    class="w-full px-3 py-2.5 rounded-xl bg-[#F7F9FC] border border-[#E2E8F0] font-mono text-[11px] text-[#1E293B]" />
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <button type="button" onclick="copyTextToClipboard('${esc(watchUrl)}', 'Link pantau orang tua disalin ✓')"
                    class="px-3.5 py-2 rounded-xl bg-[#0095FF] hover:bg-[#0082E6] text-white font-bold transition cursor-pointer">📋 Salin Link</button>
                <a href="${esc(waShareUrl)}" target="_blank" rel="noopener noreferrer"
                    class="px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold transition">💬 Kirim via WhatsApp</a>
                <a href="${esc(tgShareUrl)}" target="_blank" rel="noopener noreferrer"
                    class="px-3.5 py-2 rounded-xl bg-[#229ED9] hover:bg-[#1B8BC0] text-white font-bold transition">✈️ Kirim via Telegram</a>
                <a href="${esc(watchUrl)}" target="_blank" rel="noopener noreferrer"
                    class="px-3.5 py-2 rounded-xl bg-[#F3F6FB] hover:bg-[#EAF4FF] text-[#1E293B] border border-[#E2E8F0] font-bold transition">👁️ Buka Pratinjau</a>
            </div>
            <div class="pt-3 border-t border-[#EDF1F7] flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>Token aman &amp; dapat diganti kapan saja.</span>
                <button type="button" id="regenParentTokenBtn" class="font-bold text-[#E11D48] hover:underline cursor-pointer">🔄 Buat Ulang Token</button>
            </div>`;
        document.getElementById('regenParentTokenBtn').onclick = () => {
            if (confirm('Buat ulang token link? Link lama tidak akan bisa diakses lagi.')) {
                openParentWatchLinkModal(student, true);
            }
        };
        modal.classList.remove('hidden');
    }

    // ==================== 4. PUSAT NOTIFIKASI AKTIVITAS (BELL DROPDOWN) ====================
    let notifCenterState = { roleKey: 'staff', items: [] };

    function getNotifSeenTime(roleKey) {
        try { return Number(localStorage.getItem(`anitrack_notif_seen_${roleKey}`) || 0); } catch { return 0; }
    }
    function setNotifSeenTime(roleKey, ts) {
        try { localStorage.setItem(`anitrack_notif_seen_${roleKey}`, String(ts)); } catch { /* ignore */ }
    }

    function updateNotificationCenter(items = [], roleKey = 'staff') {
        notifCenterState = { roleKey, items: (items || []).slice(0, 25) };
        const seenAt = getNotifSeenTime(roleKey);
        const unread = notifCenterState.items.filter((it) => (it.ts || 0) > seenAt || it.urgent).length;
        const dot = document.getElementById('notifDot');
        if (dot) dot.classList.toggle('hidden', unread === 0);
        const pop = document.getElementById('anitrackNotifPopover');
        if (pop && !pop.classList.contains('hidden')) renderNotificationPopoverBody();
    }

    function renderNotificationPopoverBody() {
        const body = document.getElementById('anitrackNotifBody');
        const cntEl = document.getElementById('anitrackNotifCount');
        if (!body) return;
        const items = notifCenterState.items || [];
        if (cntEl) cntEl.textContent = `${items.length} aktivitas`;
        if (!items.length) {
            body.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Belum ada notifikasi aktivitas terbaru.</div>`;
            return;
        }
        body.innerHTML = items.map((it, idx) => `
            <button type="button" onclick="handleNotifItemClick(${idx})"
                class="w-full text-left px-4 py-3 hover:bg-[#F7FAFF] border-b border-[#EDF1F7] last:border-b-0 flex items-start gap-3 transition cursor-pointer">
                <span class="w-8 h-8 rounded-xl ${esc(it.iconBg || 'bg-[#EAF4FF] text-[#0082E6]')} flex items-center justify-center text-sm shrink-0">${it.icon || '🔔'}</span>
                <div class="min-w-0 flex-1 space-y-0.5">
                    <div class="text-xs font-extrabold text-[#1E293B] leading-snug">${esc(it.title)}</div>
                    ${it.desc ? `<div class="text-[11px] text-slate-500 leading-snug line-clamp-2">${esc(it.desc)}</div>` : ''}
                    ${it.timeLabel ? `<div class="text-[10px] font-mono text-slate-400">${esc(it.timeLabel)}</div>` : ''}
                </div>
            </button>`).join('');
    }

    global.handleNotifItemClick = function (idx) {
        const it = (notifCenterState.items || [])[idx];
        document.getElementById('anitrackNotifPopover')?.classList.add('hidden');
        if (it && typeof it.onClick === 'function') it.onClick();
    };

    global.markAllNotifsRead = function () {
        setNotifSeenTime(notifCenterState.roleKey, Date.now());
        notifCenterState.items = notifCenterState.items.map((it) => ({ ...it, urgent: false }));
        document.getElementById('notifDot')?.classList.add('hidden');
        showToast('Semua notifikasi ditandai sudah dibaca ✓');
    };

    global.toggleNotificationCenter = function () {
        let pop = document.getElementById('anitrackNotifPopover');
        if (!pop) {
            pop = document.createElement('div');
            pop.id = 'anitrackNotifPopover';
            pop.className = 'fixed top-[68px] right-4 z-[76] hidden w-[360px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-[#EDF1F7] overflow-hidden';
            pop.innerHTML = `
                <div class="px-4 py-3 border-b border-[#EDF1F7] bg-[#F7FAFF] flex items-center justify-between gap-2">
                    <div>
                        <div class="text-xs font-extrabold text-[#1E293B]">🔔 Pusat Notifikasi Aktivitas</div>
                        <div id="anitrackNotifCount" class="text-[10.5px] text-slate-500">0 aktivitas</div>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button type="button" onclick="markAllNotifsRead()" class="text-[10.5px] font-bold text-[#0082E6] hover:underline cursor-pointer">Tandai dibaca</button>
                        <button type="button" onclick="document.getElementById('anitrackNotifPopover').classList.add('hidden')" class="w-6 h-6 rounded-md bg-white border border-[#E2E8F0] text-slate-500 font-bold text-xs cursor-pointer">✕</button>
                    </div>
                </div>
                <div id="anitrackNotifBody" class="max-h-[65vh] overflow-y-auto"></div>`;
            document.body.appendChild(pop);
            document.addEventListener('click', (e) => {
                if (pop.classList.contains('hidden')) return;
                if (pop.contains(e.target) || e.target.closest('[data-notif-trigger]')) return;
                pop.classList.add('hidden');
            });
        }
        const willOpen = pop.classList.contains('hidden');
        if (willOpen) {
            renderNotificationPopoverBody();
            pop.classList.remove('hidden');
            setNotifSeenTime(notifCenterState.roleKey, Date.now());
            document.getElementById('notifDot')?.classList.add('hidden');
        } else {
            pop.classList.add('hidden');
        }
    };

    // ==================== 5. LEADERBOARD APRESIASI & SERTIFIKAT DIGITAL ====================
    function printStudentCertificatePdf(student, stats = {}) {
        if (!student) return;
        const todayId = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
        const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Sertifikat Apresiasi — ${esc(student.full_name)}</title>
            <style>
                @page { size: A4 landscape; margin: 12mm; }
                body { font-family: 'Segoe UI', Georgia, serif; margin: 0; background: #fff; color: #0f172a; }
                .cert { border: 10px double #0f172a; padding: 36px 48px; text-align: center; min-height: 170mm; box-sizing: border-box; position: relative; background: linear-gradient(135deg, #fffdf5 0%, #ffffff 55%, #f0f9ff 100%); }
                .badge { display: inline-block; padding: 6px 18px; border-radius: 999px; background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
                h1 { font-size: 34px; letter-spacing: 2px; margin: 16px 0 6px; color: #0f172a; }
                .name { font-size: 30px; font-weight: 800; color: #0369a1; margin: 18px 0 6px; border-bottom: 2px solid #cbd5e1; display: inline-block; padding: 0 28px 6px; }
                .meta { font-size: 14px; color: #475569; margin-bottom: 18px; }
                .desc { font-size: 14px; line-height: 1.7; max-width: 680px; margin: 0 auto 28px; color: #334155; }
                .signs { display: flex; justify-content: space-between; padding: 0 56px; margin-top: 32px; font-size: 13px; }
                @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
            </style></head><body>
            <div class="cert">
                <div class="badge">🌟 Sertifikat Apresiasi Prestasi Project Animasi</div>
                <h1>PIAGAM PENGHARGAAN</h1>
                <div style="font-size:13px;color:#64748b;letter-spacing:1px;">JURUSAN ANIMASI • SMKN 4 MALANG • ANITRACK</div>
                <div style="margin-top:24px;font-size:14px;">Diberikan dengan bangga kepada:</div>
                <div class="name">${esc(student.full_name)}</div>
                <div class="meta">Kelas ${esc(student.class_name || '-')} • Sub-Konsentrasi ${esc(student.sub_concentration || 'Animasi')}</div>
                <div class="desc">
                    Atas dedikasi, kedisiplinan, dan pencapaian luar biasa dalam menyelesaikan proyek produksi animasi dengan capaian
                    <strong>${stats.accCount || 0}/${stats.eligibleCount || 0} Tugas Tuntas (${stats.pct || 0}%)</strong> serta meraih
                    <strong>${stats.goldCount || 0} Lencana Emas</strong> ketepatan waktu di sistem monitoring AniTrack.
                </div>
                <div class="signs">
                    <div><div>Mengetahui,</div><div>Ketua Kompetensi Keahlian Animasi</div><div style="height:56px;"></div><div style="border-bottom:1px solid #0f172a;width:180px;margin:0 auto;"></div></div>
                    <div><div>Malang, ${esc(todayId)}</div><div>Guru Pembimbing Project</div><div style="height:56px;"></div><div style="border-bottom:1px solid #0f172a;width:180px;margin:0 auto;"></div></div>
                </div>
            </div>
            <script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script></body></html>`;
        const win = window.open('', '_blank');
        if (!win) { showToast('Popup cetak diblokir browser. Izinkan popup terlebih dahulu.'); return; }
        win.document.open();
        win.document.write(html);
        win.document.close();
    }

    let leaderboardCacheRows = [];
    global.printCertFromLeaderboard = function (idx) {
        const row = leaderboardCacheRows[idx];
        if (row) printStudentCertificatePdf(row.s, row);
    };

    function openLeaderboardModal(students = [], tasks = [], subMap = {}) {
        const rows = (students || []).map((s) => {
            const st = computeStudentIssueStats(s, tasks, subMap);
            const pct = st.eligibleCount ? Math.round((st.accCount / st.eligibleCount) * 100) : 0;
            const score = (st.goldCount * 30) + (pct * 1) + (st.accCount * 5) - (st.totalIssues * 10);
            return { s, ...st, pct, score };
        }).sort((a, b) => (b.goldCount - a.goldCount) || (b.pct - a.pct) || (b.accCount - a.accCount) || (a.totalIssues - b.totalIssues));
        leaderboardCacheRows = rows;

        const clsMap = {};
        rows.forEach((r) => {
            const c = r.s.class_name || 'Tanpa Kelas';
            if (!clsMap[c]) clsMap[c] = { cls: c, count: 0, sumPct: 0, gold: 0 };
            clsMap[c].count++;
            clsMap[c].sumPct += r.pct;
            clsMap[c].gold += r.goldCount;
        });
        const topClasses = Object.values(clsMap)
            .map((c) => ({ ...c, avgPct: c.count ? Math.round(c.sumPct / c.count) : 0 }))
            .sort((a, b) => (b.avgPct - a.avgPct) || (b.gold - a.gold));

        let modal = document.getElementById('anitrackLeaderboardModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'anitrackLeaderboardModal';
            modal.className = 'fixed inset-0 z-[82] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4';
            modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
            modal.innerHTML = `
                <div class="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#EDF1F7]">
                    <div class="px-5 py-4 border-b border-[#EDF1F7] bg-gradient-to-r from-[#FFF6D6] via-[#FFFDF5] to-[#EAF4FF] flex items-center justify-between gap-3">
                        <div>
                            <div class="text-[10.5px] font-extrabold uppercase tracking-wider text-[#B88600]">🏆 Papan Peringkat &amp; Apresiasi Siswa</div>
                            <div class="text-base font-extrabold text-[#1E293B]">Leaderboard Lencana Emas &amp; Ketuntasan Project</div>
                        </div>
                        <button type="button" onclick="document.getElementById('anitrackLeaderboardModal').classList.add('hidden')"
                            class="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#FFF1F5] text-slate-600 hover:text-[#F13B6E] font-bold text-sm cursor-pointer">✕</button>
                    </div>
                    <div id="leaderboardModalBody" class="p-5 max-h-[75vh] overflow-y-auto space-y-5 text-xs bg-[#FAFBFD]"></div>
                </div>`;
            document.body.appendChild(modal);
        }

        const top3 = rows.slice(0, 3);
        const podiumStyles = [
            { medal: '🥇 #1', cls: 'bg-[#FFFBEB] border-[#F7C200]' },
            { medal: '🥈 #2', cls: 'bg-slate-50 border-slate-300' },
            { medal: '🥉 #3', cls: 'bg-[#FFF7ED] border-[#FDBA74]' }
        ];
        document.getElementById('leaderboardModalBody').innerHTML = `
            ${top3.length ? `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                ${top3.map((r, i) => `
                    <div class="rounded-2xl border-2 ${podiumStyles[i].cls} p-4 text-center space-y-1.5 shadow-xs">
                        <div class="text-sm font-extrabold">${podiumStyles[i].medal}</div>
                        <div class="w-12 h-12 mx-auto rounded-full bg-[#EAF4FF] text-[#0095FF] font-extrabold text-sm flex items-center justify-center overflow-hidden border-2 border-white shadow">
                            ${renderAvatarMarkup(r.s.avatar_url, r.s.full_name)}
                        </div>
                        <div class="font-extrabold text-[#1E293B] truncate">${esc(r.s.full_name)}</div>
                        <div class="text-[11px] text-slate-500">${esc(r.s.class_name || '-')} • ${esc(r.s.sub_concentration || 'Umum')}</div>
                        <div class="flex items-center justify-center gap-1.5 pt-1">
                            <span class="px-2 py-0.5 rounded-full bg-[#FFF6D6] text-[#9A6F00] font-extrabold">🌟 ${r.goldCount} Emas</span>
                            <span class="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] font-extrabold">${r.pct}% ACC</span>
                        </div>
                        ${(r.pct === 100 || r.goldCount > 0) ? `
                        <button type="button" onclick="printCertFromLeaderboard(${i})"
                            class="mt-1 px-3 py-1 rounded-lg bg-[#1E293B] hover:bg-[#0095FF] text-white text-[10.5px] font-bold transition cursor-pointer">
                            🏅 Cetak Sertifikat
                        </button>` : ''}
                    </div>`).join('')}
            </div>` : ''}

            ${topClasses.length ? `
            <div class="bg-white border border-[#EDF1F7] rounded-xl p-4 space-y-2.5">
                <div class="text-xs font-extrabold text-[#1E293B]">🏫 Peringkat Ketuntasan Kelas</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    ${topClasses.map((c, idx) => `
                        <div class="rounded-xl border border-[#EDF1F7] bg-[#FAFBFD] px-3 py-2 space-y-1">
                            <div class="flex items-center justify-between text-[11px] font-bold">
                                <span>#${idx + 1} ${esc(c.cls)} (${c.count} siswa)</span>
                                <span class="text-[#15803D]">${c.avgPct}% • 🌟 ${c.gold}</span>
                            </div>
                            <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                                <div class="h-full rounded-full" style="width:${c.avgPct}%;background:#4CAF50;"></div>
                            </div>
                        </div>`).join('')}
                </div>
            </div>` : ''}

            <div class="bg-white border border-[#EDF1F7] rounded-xl overflow-hidden">
                <div class="px-4 py-2.5 bg-[#F7FAFF] border-b border-[#EDF1F7] font-extrabold text-[#1E293B]">Top 15 Siswa Terbaik</div>
                <div class="divide-y divide-[#F1F5F9]">
                    ${rows.slice(0, 15).map((r, i) => `
                        <div class="px-4 py-2.5 flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <span class="w-6 text-center font-mono font-extrabold text-slate-400">#${i + 1}</span>
                                <div class="min-w-0">
                                    <div class="font-bold text-[#1E293B] truncate">${esc(r.s.full_name)}</div>
                                    <div class="text-[10.5px] text-slate-400">${esc(r.s.class_name || '-')} • ${esc(r.s.sub_concentration || 'Umum')}</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <span class="px-2 py-0.5 rounded bg-[#FFF6D6] text-[#9A6F00] font-extrabold">🌟 ${r.goldCount}</span>
                                <span class="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] font-extrabold">${r.accCount}/${r.eligibleCount} (${r.pct}%)</span>
                                ${(r.pct === 100 || r.goldCount > 0) ? `
                                <button type="button" onclick="printCertFromLeaderboard(${i})" class="px-2 py-0.5 rounded bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white font-bold cursor-pointer">🏅</button>` : ''}
                            </div>
                        </div>`).join('') || `<div class="p-6 text-center text-slate-400">Belum ada data progres siswa.</div>`}
                </div>
            </div>`;
        modal.classList.remove('hidden');
    }

    // ==================== 6. GALERI KARYA FINAL (SHOWCASE) ====================
    const SHOWCASE_GALLERY_KEY = 'showcase_gallery_v1';
    let showcaseCache = [];
    let showcaseFilterSubconc = '';
    let showcaseCoverDraft = '';

    async function loadShowcaseItems() {
        if (!supabase) return [];
        try {
            const { data } = await supabase.from('app_settings').select('value').eq('key', SHOWCASE_GALLERY_KEY).maybeSingle();
            if (data?.value) {
                const parsed = JSON.parse(data.value);
                if (Array.isArray(parsed)) { showcaseCache = parsed; return parsed; }
            }
        } catch { /* ignore */ }
        showcaseCache = [];
        return [];
    }

    async function saveShowcaseItems(items = []) {
        if (!supabase) return { error: new Error('Supabase tidak siap') };
        showcaseCache = items;
        return supabase.from('app_settings').upsert({
            key: SHOWCASE_GALLERY_KEY,
            value: JSON.stringify(items),
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
    }

    function renderShowcaseGrid(currentUserObj) {
        const grid = document.getElementById('showcaseGalleryGrid');
        if (!grid) return;
        const filtered = showcaseCache.filter((it) => {
            if (!showcaseFilterSubconc) return true;
            if (showcaseFilterSubconc === '2D') return (it.sub_concentration || '').startsWith('2D');
            if (showcaseFilterSubconc === '3D') return (it.sub_concentration || '').startsWith('3D');
            return it.sub_concentration === showcaseFilterSubconc;
        });
        const isStaff = isAnyAdmin(currentUserObj) || currentUserObj?.role === 'mentor';
        if (!filtered.length) {
            grid.innerHTML = `<div class="col-span-full p-10 text-center text-xs text-slate-400">Belum ada karya final di galeri untuk filter ini. Klik <strong>+ Tambah Karya</strong> untuk mulai memamerkan karya terbaik!</div>`;
            return;
        }
        grid.innerHTML = filtered.map((it) => {
            const thumb = it.cover_image || getYoutubeThumbUrl(it.work_url) || '';
            const canDel = isStaff || (currentUserObj?.id && it.created_by_id === currentUserObj.id);
            return `
                <div class="bg-white border border-[#EDF1F7] rounded-2xl overflow-hidden shadow-card flex flex-col">
                    <div class="relative h-40 bg-slate-900 overflow-hidden">
                        ${thumb
                            ? `<img src="${esc(thumb)}" alt="${esc(it.title)}" onclick="openProofLightbox(this.src, '${esc(it.title)} — ${esc(it.student_name)}')" class="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition duration-300" />`
                            : `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0082E6] to-[#4F46E5] text-white text-3xl">🎬</div>`}
                        <span class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-slate-900/75 text-white text-[10px] font-bold">${esc(it.sub_concentration || 'Animasi')}</span>
                    </div>
                    <div class="p-3.5 flex-1 flex flex-col justify-between space-y-2.5 text-xs">
                        <div class="space-y-1">
                            <div class="font-extrabold text-[#1E293B] text-sm leading-snug">${esc(it.title)}</div>
                            <div class="text-[11px] font-semibold text-[#0082E6]">${esc(it.student_name)} • ${esc(it.class_name || '-')}</div>
                            ${it.description ? `<p class="text-[11px] text-slate-500 line-clamp-2">${esc(it.description)}</p>` : ''}
                        </div>
                        <div class="flex items-center justify-between gap-2 pt-2 border-t border-[#F1F5F9]">
                            ${it.work_url
                                ? `<a href="${esc(it.work_url)}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-[#0095FF] hover:bg-[#0082E6] text-white text-[11px] font-bold transition">▶ Tonton / Buka Karya ↗</a>`
                                : `<span class="text-[10.5px] text-slate-400">${esc(formatDateOnly(it.created_at))}</span>`}
                            ${canDel ? `<button type="button" onclick="deleteShowcaseItem('${esc(it.id)}')" class="px-2 py-1 rounded-lg bg-[#FFF0F4] hover:bg-[#F13B6E] text-[#E11D48] hover:text-white text-[10.5px] font-bold cursor-pointer">Hapus</button>` : ''}
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    async function openShowcaseGalleryModal(currentUserObj = null) {
        const user = currentUserObj || getUser() || {};
        await loadShowcaseItems();
        showcaseCoverDraft = '';

        let modal = document.getElementById('anitrackShowcaseModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'anitrackShowcaseModal';
            modal.className = 'fixed inset-0 z-[82] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4';
            modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
            modal.innerHTML = `
                <div class="relative max-w-5xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#EDF1F7] flex flex-col max-h-[90vh]">
                    <div class="px-5 py-4 border-b border-[#EDF1F7] bg-gradient-to-r from-[#0F172A] to-[#1E3A8A] text-white flex items-center justify-between gap-3">
                        <div>
                            <div class="text-[10px] font-extrabold uppercase tracking-wider text-[#F7C200]">🎬 Showcase Karya Final SMKN 4 Malang</div>
                            <div class="text-base font-extrabold">Galeri Portofolio &amp; Film Animasi Siswa</div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="document.getElementById('showcaseAddForm').classList.toggle('hidden')"
                                class="px-3.5 py-1.5 rounded-xl bg-[#F7C200] hover:bg-[#E6AE00] text-[#1E293B] text-xs font-extrabold cursor-pointer">+ Tambah Karya</button>
                            <button type="button" onclick="document.getElementById('anitrackShowcaseModal').classList.add('hidden')"
                                class="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold text-sm cursor-pointer">✕</button>
                        </div>
                    </div>
                    <div class="p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#FAFBFD] flex-1">
                        <form id="showcaseAddForm" class="hidden bg-white border border-[#DCEBFF] rounded-2xl p-4 space-y-3 text-xs">
                            <div class="font-extrabold text-[#1E293B]">Tambahkan Karya Final ke Galeri Showcase</div>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <input id="scTitle" type="text" required placeholder="Judul Karya / Film *" class="px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F7F9FC]" />
                                <input id="scStudent" type="text" required placeholder="Nama Siswa / Tim *" class="px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F7F9FC]" />
                                <input id="scClass" type="text" placeholder="Kelas (mis: XII ANI A)" class="px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F7F9FC]" />
                                <select id="scSubconc" class="px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F7F9FC]">
                                    ${SUBCONCS.map((sc) => `<option value="${esc(sc)}">${esc(sc)}</option>`).join('')}
                                </select>
                                <input id="scUrl" type="url" placeholder="Link YouTube / Google Drive Karya" class="sm:col-span-2 px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F7F9FC]" />
                            </div>
                            <textarea id="scDesc" rows="2" placeholder="Sinopsis singkat / software yang digunakan (Blender, After Effects, dll)..." class="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F7F9FC]"></textarea>
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <label class="px-3 py-1.5 rounded-lg bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white font-bold cursor-pointer transition">
                                    🖼️ Upload Poster / Thumbnail (Opsional)
                                    <input id="scCoverFile" type="file" accept="image/*" class="hidden" onchange="handleShowcaseCoverPick(this)" />
                                </label>
                                <span id="scCoverHint" class="text-[11px] text-slate-400">Otomatis pakai thumbnail YouTube jika kosong.</span>
                                <button type="submit" class="px-4 py-2 rounded-xl bg-[#0095FF] hover:bg-[#0082E6] text-white font-bold cursor-pointer">💾 Publikasikan</button>
                            </div>
                        </form>

                        <div class="flex flex-wrap items-center gap-1.5 text-xs">
                            ${[{ v: '', l: 'Semua Karya' }, { v: '2D', l: 'Grup 2D' }, { v: '3D', l: 'Grup 3D' }, ...SUBCONCS.map((sc) => ({ v: sc, l: sc }))].map((f) => `
                                <button type="button" data-sc-filter="${esc(f.v)}" onclick="setShowcaseFilter('${esc(f.v)}')"
                                    class="px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer ${f.v === '' ? 'bg-[#0095FF] text-white border-[#0095FF]' : 'bg-white text-slate-600 border-[#E2E8F0]'}">${esc(f.l)}</button>`).join('')}
                        </div>
                        <div id="showcaseGalleryGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            modal.querySelector('#showcaseAddForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const u = getUser() || {};
                const item = {
                    id: `sc_${Date.now()}`,
                    title: document.getElementById('scTitle').value.trim(),
                    student_name: document.getElementById('scStudent').value.trim(),
                    class_name: document.getElementById('scClass').value.trim() || u.class_name || '',
                    sub_concentration: document.getElementById('scSubconc').value,
                    work_url: document.getElementById('scUrl').value.trim(),
                    description: document.getElementById('scDesc').value.trim(),
                    cover_image: showcaseCoverDraft || '',
                    created_by_id: u.id || '',
                    created_at: new Date().toISOString()
                };
                const next = [item, ...showcaseCache];
                const { error } = await saveShowcaseItems(next);
                if (error) { showToast(`Gagal menyimpan karya: ${error.message}`); return; }
                e.target.reset();
                showcaseCoverDraft = '';
                document.getElementById('scCoverHint').textContent = 'Otomatis pakai thumbnail YouTube jika kosong.';
                e.target.classList.add('hidden');
                showToast('Karya berhasil dipublikasikan ke Galeri Showcase 🎬');
                renderShowcaseGrid(u);
            });
        }

        if (user.role === 'student') {
            const stuInp = document.getElementById('scStudent');
            const clsInp = document.getElementById('scClass');
            const scInp = document.getElementById('scSubconc');
            if (stuInp && !stuInp.value) stuInp.value = user.full_name || '';
            if (clsInp && !clsInp.value) clsInp.value = user.class_name || '';
            if (scInp && user.sub_concentration) scInp.value = user.sub_concentration;
        }
        renderShowcaseGrid(user);
        modal.classList.remove('hidden');
    }

    global.handleShowcaseCoverPick = async function (inp) {
        const f = inp.files?.[0];
        if (!f) return;
        try {
            showcaseCoverDraft = await compressProofImage(f, 800, 0.78);
            const h = document.getElementById('scCoverHint');
            if (h) h.textContent = `Poster "${f.name}" siap diunggah ✓`;
        } catch (err) { showToast(err.message); }
    };
    global.setShowcaseFilter = function (v) {
        showcaseFilterSubconc = v || '';
        document.querySelectorAll('[data-sc-filter]').forEach((b) => {
            const active = b.dataset.scFilter === showcaseFilterSubconc;
            b.className = `px-3 py-1.5 rounded-xl font-bold border transition cursor-pointer ${active ? 'bg-[#0095FF] text-white border-[#0095FF]' : 'bg-white text-slate-600 border-[#E2E8F0]'}`;
        });
        renderShowcaseGrid(getUser() || {});
    };
    global.deleteShowcaseItem = async function (id) {
        if (!confirm('Hapus karya ini dari Galeri Showcase?')) return;
        const next = showcaseCache.filter((x) => x.id !== id);
        const { error } = await saveShowcaseItems(next);
        if (error) { showToast(`Gagal menghapus: ${error.message}`); return; }
        showToast('Karya dihapus dari Galeri.');
        renderShowcaseGrid(getUser() || {});
    };

    // ==================== 7. KALENDER DEADLINE & TIMELINE GANTT PRODUKSI ====================
    function buildCalendarAndGanttHtml(tasks = [], year, month, opts = {}) {
        const { getProgressFn = null, onTaskClickAttrFn = null, prevFn = 'shiftProjectCalendarMonth(-1)', todayFn = 'resetProjectCalendarMonth()', nextFn = 'shiftProjectCalendarMonth(1)' } = opts;
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const dayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startOffset = (firstDay.getDay() + 6) % 7; // Senin = 0
        const todayYmd = getJakartaYmd(new Date());

        const tasksByDate = {};
        (tasks || []).forEach((t) => {
            if (!t.due_date) return;
            const ymd = String(t.due_date).slice(0, 10);
            if (!tasksByDate[ymd]) tasksByDate[ymd] = [];
            tasksByDate[ymd].push(t);
        });

        const stageBadge = (stage) => stage === 'Pre-Production'
            ? 'bg-[#FFF6D6] text-[#9A6F00] border-[#FDE68A]'
            : (stage === 'Production' ? 'bg-[#EAF4FF] text-[#0082E6] border-[#CBE5FF]' : 'bg-[#FFF0F4] text-[#E11D48] border-[#FECDD6]');
        const stageBarColor = (stage) => stage === 'Pre-Production' ? '#F59E0B' : (stage === 'Production' ? '#0095FF' : '#F13B6E');

        const cells = [];
        for (let i = 0; i < startOffset; i++) cells.push(`<div class="min-h-[82px] bg-[#FAFBFD] border-r border-b border-[#EDF1F7]"></div>`);
        for (let d = 1; d <= daysInMonth; d++) {
            const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = ymd === todayYmd;
            const dayTasks = tasksByDate[ymd] || [];
            cells.push(`
                <div class="min-h-[82px] p-1.5 border-r border-b border-[#EDF1F7] ${isToday ? 'bg-[#EFF6FF] ring-1 ring-inset ring-[#0095FF]' : 'bg-white'} space-y-1">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-extrabold ${isToday ? 'px-1.5 py-0.5 rounded-md bg-[#0095FF] text-white' : 'text-slate-600'}">${d}</span>
                        ${dayTasks.length ? `<span class="text-[9.5px] font-bold text-slate-400">${dayTasks.length} DL</span>` : ''}
                    </div>
                    <div class="space-y-1">
                        ${dayTasks.map((t) => {
                            const clickAttr = onTaskClickAttrFn ? onTaskClickAttrFn(t) : '';
                            return `<button type="button" ${clickAttr} title="${esc(t.title)} (${esc(t.pipeline_stage)})"
                                class="w-full text-left px-1.5 py-0.5 rounded border ${stageBadge(t.pipeline_stage)} text-[10px] font-bold truncate block cursor-pointer hover:opacity-80 transition">
                                ${esc(t.title)}
                            </button>`;
                        }).join('')}
                    </div>
                </div>`);
        }

        // Mini Gantt Timeline Produksi
        const datedTasks = (tasks || []).filter((t) => t.due_date).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
        let ganttHtml = `<div class="p-6 text-center text-xs text-slate-400">Belum ada tugas yang memiliki tanggal deadline untuk ditampilkan di Timeline Gantt.</div>`;
        if (datedTasks.length) {
            const toMs = (s) => Date.parse(`${String(s).slice(0, 10)}T00:00:00Z`);
            const allMs = datedTasks.map((t) => toMs(t.due_date)).filter((n) => !isNaN(n));
            const todayMs = toMs(todayYmd);
            const minMs = Math.min(...allMs, todayMs) - (5 * 86400000);
            const maxMs = Math.max(...allMs, todayMs) + (5 * 86400000);
            const spanMs = Math.max(86400000 * 14, maxMs - minMs);
            const todayLeftPct = Math.max(0, Math.min(100, ((todayMs - minMs) / spanMs) * 100));

            ganttHtml = `
                <div class="relative space-y-2.5 pt-2">
                    <div class="flex items-center justify-between text-[10.5px] font-mono text-slate-400 px-1">
                        <span>${formatDateOnly(new Date(minMs).toISOString().slice(0, 10))}</span>
                        <span class="font-bold text-[#E11D48]">▲ Hari Ini (${formatDateOnly(todayYmd)})</span>
                        <span>${formatDateOnly(new Date(maxMs).toISOString().slice(0, 10))}</span>
                    </div>
                    <div class="relative border border-[#EDF1F7] rounded-xl bg-[#FAFBFD] p-3 space-y-2.5 overflow-hidden">
                        <div class="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-[#E11D48]/60 z-10" style="left:calc(28% + ${(todayLeftPct * 0.72).toFixed(1)}%);"></div>
                        ${datedTasks.map((t) => {
                            const dueMs = toMs(t.due_date);
                            const startMs = Math.max(minMs, (t.created_at ? toMs(t.created_at) : dueMs - (10 * 86400000)));
                            const safeStart = Math.min(startMs, dueMs - (3 * 86400000));
                            const leftPct = Math.max(0, ((safeStart - minMs) / spanMs) * 100);
                            const rightPct = Math.min(100, ((dueMs - minMs) / spanMs) * 100);
                            const widthPct = Math.max(6, rightPct - leftPct);
                            const prog = getProgressFn ? getProgressFn(t) : { pct: 0, label: formatDateOnly(t.due_date) };
                            const clickAttr = onTaskClickAttrFn ? onTaskClickAttrFn(t) : '';
                            return `
                                <div class="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                                    <button type="button" ${clickAttr} class="sm:w-[28%] text-left min-w-0 pr-2 cursor-pointer hover:text-[#0082E6]">
                                        <div class="font-bold text-[#1E293B] truncate">${esc(t.title)}</div>
                                        <div class="text-[10px] text-slate-400">${esc(t.pipeline_stage)} • DL ${esc(formatDateOnly(t.due_date))}</div>
                                    </button>
                                    <div class="sm:w-[72%] relative h-7 rounded-lg bg-white border border-[#EDF1F7] overflow-hidden">
                                        <div class="absolute top-1 bottom-1 rounded-md flex items-center px-2 text-[10px] font-extrabold text-white shadow-xs overflow-hidden"
                                            style="left:${leftPct.toFixed(1)}%;width:${widthPct.toFixed(1)}%;background:${stageBarColor(t.pipeline_stage)};">
                                            <span class="truncate">${esc(prog.label || `${prog.pct}%`)}</span>
                                        </div>
                                    </div>
                                </div>`;
                        }).join('')}
                    </div>
                </div>`;
        }

        return `
            <div class="space-y-4">
                <div class="bg-white border border-[#EDF1F7] rounded-2xl shadow-card overflow-hidden">
                    <div class="px-4 py-3 border-b border-[#EDF1F7] bg-[#F7FAFF] flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div class="text-sm font-extrabold text-[#1E293B]">📅 Kalender Deadline — ${monthNames[month]} ${year}</div>
                            <div class="text-[11px] text-slate-500">Klik nama tugas pada tanggal untuk langsung membuka detail / review.</div>
                        </div>
                        <div class="flex items-center gap-1.5 text-xs">
                            <button type="button" onclick="${prevFn}" class="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0095FF] font-bold cursor-pointer">◀</button>
                            <button type="button" onclick="${todayFn}" class="px-3 py-1.5 rounded-lg bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white font-bold cursor-pointer">Bulan Ini</button>
                            <button type="button" onclick="${nextFn}" class="px-2.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:border-[#0095FF] font-bold cursor-pointer">▶</button>
                        </div>
                    </div>
                    <div class="grid grid-cols-7 bg-[#FAFBFD] border-b border-[#EDF1F7] text-center text-[11px] font-extrabold text-slate-500">
                        ${dayNames.map((d) => `<div class="py-2 border-r border-[#EDF1F7] last:border-r-0">${d}</div>`).join('')}
                    </div>
                    <div class="grid grid-cols-7">${cells.join('')}</div>
                </div>
                <div class="bg-white border border-[#EDF1F7] rounded-2xl shadow-card p-4 sm:p-5 space-y-2">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div class="text-sm font-extrabold text-[#1E293B]">📊 Timeline Gantt Produksi Animasi</div>
                            <div class="text-[11px] text-slate-500">Visualisasi rentang waktu seluruh tugas lintas Pre-Production, Production, &amp; Post-Production.</div>
                        </div>
                        <div class="flex items-center gap-2 text-[10.5px] font-bold">
                            <span class="px-2 py-0.5 rounded bg-[#FFF6D6] text-[#9A6F00]">● Pre-Production</span>
                            <span class="px-2 py-0.5 rounded bg-[#EAF4FF] text-[#0082E6]">● Production</span>
                            <span class="px-2 py-0.5 rounded bg-[#FFF0F4] text-[#E11D48]">● Post-Production</span>
                        </div>
                    </div>
                    ${ganttHtml}
                </div>
            </div>`;
    }

    function openStudentCalendarModal(tasks = [], subMap = {}) {
        const now = new Date();
        global._stuCalYear = global._stuCalYear || now.getFullYear();
        global._stuCalMonth = typeof global._stuCalMonth === 'number' ? global._stuCalMonth : now.getMonth();
        global._stuCalData = { tasks, subMap };

        let modal = document.getElementById('anitrackStudentCalendarModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'anitrackStudentCalendarModal';
            modal.className = 'fixed inset-0 z-[82] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4';
            modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
            modal.innerHTML = `
                <div class="relative max-w-5xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#EDF1F7] flex flex-col max-h-[90vh]">
                    <div class="px-5 py-3.5 border-b border-[#EDF1F7] bg-[#F7FAFF] flex items-center justify-between gap-3">
                        <div class="text-sm sm:text-base font-extrabold text-[#1E293B]">📅 Kalender Deadline &amp; Timeline Gantt Saya</div>
                        <button type="button" onclick="document.getElementById('anitrackStudentCalendarModal').classList.add('hidden')"
                            class="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#FFF1F5] text-slate-600 hover:text-[#F13B6E] font-bold text-sm cursor-pointer">✕</button>
                    </div>
                    <div id="studentCalendarModalBody" class="p-4 overflow-y-auto bg-[#FAFBFD] flex-1"></div>
                </div>`;
            document.body.appendChild(modal);
        }
        const render = () => {
            const { tasks: tList, subMap: sMap } = global._stuCalData;
            document.getElementById('studentCalendarModalBody').innerHTML = buildCalendarAndGanttHtml(tList, global._stuCalYear, global._stuCalMonth, {
                prevFn: 'shiftStudentCalMonth(-1)',
                todayFn: 'resetStudentCalMonth()',
                nextFn: 'shiftStudentCalMonth(1)',
                getProgressFn: (t) => {
                    const st = sMap[t.id]?.status || 'belum_mulai';
                    const opt = STATUS_OPTIONS.find((o) => o.value === st) || STATUS_OPTIONS[0];
                    return { pct: st === 'selesai' ? 100 : 50, label: opt.label };
                }
            });
        };
        global.shiftStudentCalMonth = (delta) => {
            const dt = new Date(global._stuCalYear, global._stuCalMonth + delta, 1);
            global._stuCalYear = dt.getFullYear();
            global._stuCalMonth = dt.getMonth();
            render();
        };
        global.resetStudentCalMonth = () => {
            const n = new Date();
            global._stuCalYear = n.getFullYear();
            global._stuCalMonth = n.getMonth();
            render();
        };
        render();
        modal.classList.remove('hidden');
    }

    function formatStudentProjectUpdateText(student, checklistColsMap = {}, checklistRowMap = {}) {
        if (!student) return '';
        const sc = student.sub_concentration || '';
        const cols = (sc && Array.isArray(checklistColsMap[sc]) && checklistColsMap[sc].length)
            ? checklistColsMap[sc]
            : DEFAULT_CHECKLIST_COLS;
        const rd = checklistRowMap[student.id] || { items: {}, notes: '' };
        const statusLabelMap = Object.fromEntries(CHECKLIST_STATUS_OPTIONS.map((o) => [o.value, o.label]));
        const doneCnt = cols.filter((c) => normalizeChecklistStatus(rd.items?.[c]) === 'done').length;
        const pct = cols.length ? Math.round((doneCnt / cols.length) * 100) : 0;
        const lines = [`📊 *PROJECT UPDATE (${sc || 'Animasi'} — ${doneCnt}/${cols.length} Done • ${pct}%):*`];
        cols.forEach((c) => {
            const stVal = normalizeChecklistStatus(rd.items?.[c]);
            const lbl = statusLabelMap[stVal] || 'None';
            const icon = stVal === 'done' ? '✅' : (stVal === 'revisi' ? '🔴' : (stVal === 'wip' ? '🟡' : '⚪'));
            lines.push(`${icon} ${c}: *${lbl}*`);
        });
        if (rd.notes && String(rd.notes).trim()) {
            lines.push(`📝 Notes PJ Subkon: _${String(rd.notes).trim()}_`);
        }
        return lines.join('\n');
    }

    function computeDeadlineReminderQueue(students, mentors, tasks, submissions, waConfig = {}, checklistCtx = null) {
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

            const projectUpdateBlock = checklistCtx
                ? formatStudentProjectUpdateText(s, checklistCtx.checklistColsMap || {}, checklistCtx.checklistRowMap || {})
                : '';

            const message = renderWaReminderMessage(template, {
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
            if (rolePill) rolePill.textContent = roleLabel(user);
            const topName = document.getElementById('topUserName');
            if (topName) topName.textContent = user.full_name || '-';
            setAvatarEl('topUserAvatar', user.avatar_url || null, user.full_name);
            setAvatarEl('profileAvatarBig', effectiveAvatar, user.full_name);
            document.getElementById('removeAvatarBtn')?.classList.toggle('hidden', !effectiveAvatar);

            const pName = document.getElementById('profileName');
            if (pName) pName.textContent = user.full_name || '-';
            const pBadge = document.getElementById('profileBadge');
            if (pBadge) pBadge.textContent = roleLabel(user);
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
                if (user.role === 'student' && !rawWa) {
                    fb.className = 'text-xs font-semibold text-[#E11D48]';
                    fb.textContent = 'Nomor WhatsApp aktif wajib diisi oleh setiap siswa.';
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
                : 'Opsional: unggah file otomatis aktif bila koneksi Apps Script sudah diatur oleh Superadmin, atau tempel link manual.';
        }
    }

    function makeWorksheet(rows, colWidths) {
        const ws = global.XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Belum ada data' }]);
        if (colWidths?.length) ws['!cols'] = colWidths.map((wch) => ({ wch }));
        return ws;
    }

    async function buildExportWorkbooks() {
        if (typeof global.XLSX === 'undefined') throw new Error('Library Excel (.xlsx) belum termuat.');

        const [{ data: profiles }, { data: materials }, { data: tasks }, { data: progress }, { data: projTasks }, { data: projSubs }, checklistColsMap, { data: checklistRowsRaw }, { data: fbLogRaw }] = await Promise.all([
            supabase.from('profiles').select('id, full_name, username, class_name, sub_concentration, role, mentor_id, whatsapp_number, project_drive_url').order('role').order('full_name'),
            supabase.from('learning_materials').select('*').order('id', { ascending: false }),
            supabase.from('daily_tasks').select('*').order('id', { ascending: false }),
            supabase.from('student_progress').select('*').order('updated_at', { ascending: false }),
            supabase.from('project_tasks').select('*').order('due_date', { ascending: true }),
            supabase.from('project_submissions').select('*').order('updated_at', { ascending: false }),
            loadChecklistColsMap(),
            supabase.from('app_settings').select('key, value, updated_at').like('key', `${CHECKLIST_ROW_PREFIX}%`),
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

        const checklistRowMap = parseChecklistRowMap(checklistRowsRaw || []);
        const ckStatusText = Object.fromEntries(CHECKLIST_STATUS_OPTIONS.map((o) => [o.value, o.label]));
        const projectUpdateRows = pList.filter((p) => p.role === 'student').map((s, i) => {
            const cols = (s.sub_concentration && checklistColsMap[s.sub_concentration]) || DEFAULT_CHECKLIST_COLS;
            const rd = checklistRowMap[s.id] || { items: {}, notes: '' };
            const doneCnt = cols.filter((c) => normalizeChecklistStatus(rd.items?.[c]) === 'done').length;
            const pct = cols.length ? Math.round((doneCnt / cols.length) * 100) : 0;
            const mentor = s.mentor_id ? pMap[s.mentor_id] : null;
            const stageSummary = cols.map((c) => `${c}: ${ckStatusText[normalizeChecklistStatus(rd.items?.[c])] || 'None'}`).join(' | ');
            return {
                No: i + 1,
                'Nama Siswa': s.full_name || '-',
                Kelas: s.class_name || '-',
                'Sub-Konsentrasi': s.sub_concentration || '-',
                Pembimbing: mentor?.full_name || '-',
                'Progress (%)': `${pct}%`,
                'Selesai (Done)': `${doneCnt}/${cols.length}`,
                'Status Tahapan': stageSummary,
                'Notes PJ Subkon': rd.notes || '-',
                'Diperbarui': rd.updated_at ? formatDateTime(rd.updated_at) : '-'
            };
        });

        const taskCols = [5, 18, 24, 16, 10, 20, 22, 30, 18, 34, 34, 32];
        const matCols = [5, 32, 16, 20, 16, 40, 38, 38, 30, 22];
        const profCols = [5, 26, 18, 12, 10, 20, 24, 18, 38];
        const projCols = [5, 30, 16, 16, 24, 10, 20, 18, 12, 16, 30, 32, 34, 18];
        const projUpdCols = [5, 26, 10, 20, 22, 12, 14, 52, 34, 18];
        const sumCols = [28, 48];

        const tasksWb = global.XLSX.utils.book_new();
        global.XLSX.utils.book_append_sheet(tasksWb, makeWorksheet(taskRows, taskCols), 'Rekap Daily Task');

        const materialsWb = global.XLSX.utils.book_new();
        global.XLSX.utils.book_append_sheet(materialsWb, makeWorksheet(materialRows, matCols), 'Daftar Materi Ajar');

        const fullWb = global.XLSX.utils.book_new();
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(summaryRows, sumCols), 'Ringkasan');
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(taskRows, taskCols), 'Rekap Daily Task');
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(projectRows, projCols), 'Project Tracker');
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(projectUpdateRows, projUpdCols), 'Project Update');
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(materialRows, matCols), 'Daftar Materi Ajar');
        global.XLSX.utils.book_append_sheet(fullWb, makeWorksheet(profileRows, profCols), 'Siswa & Mentor');

        return { tasksWb, materialsWb, fullWb };
    }

    function bindDriveAndExportGlobals() {
        updateDriveConnUI();
        loadSharedGasUrl();

        global.saveAndTestGasUrl = async function () {
            if (!isTrueSuperadmin(getUser())) {
                showToast('Pengaturan Google Apps Script hanya dapat diubah oleh Superadmin.');
                return;
            }
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
            if (!isTrueSuperadmin(getUser())) {
                showToast('Pengaturan Google Apps Script hanya dapat direset oleh Superadmin.');
                return;
            }
            setGasUrl('');
            await supabase.from('app_settings').delete().eq('key', 'gas_web_app_url');
            updateDriveConnUI();
            const fb = document.getElementById('gasStatusFeedback');
            fb.className = 'text-xs font-semibold text-slate-400';
            fb.textContent = 'URL Apps Script dihapus. Kembali ke mode manual / export lokal.';
        };

        global.syncAllDataToDrive = async function () {
            if (!isAnyAdmin(getUser())) {
                showToast('Menu Drive & Backup hanya tersedia untuk Admin dan Superadmin.');
                return;
            }
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
            if (!isAnyAdmin(getUser())) {
                showToast('Menu Drive & Export hanya tersedia untuk Admin dan Superadmin.');
                return;
            }
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
            banner.classList.add('hidden');
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
            if (activeTab === 'project-update') {
                requestAnimationFrame(() => initChecklistScrollSync());
            }
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
            else if (activeTab === 'project-update') {
                projectChecklistState.search = val || '';
                renderProjectUpdateView();
            } else if (activeTab === 'materials') {
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
            if (!isAnyAdmin(currentUser)) {
                showToast('Fitur reset input siswa hanya dapat diakses oleh Admin / Superadmin.');
                return;
            }
            document.getElementById('resetInputsBox')?.classList.toggle('hidden');
        };

        global.executeResetStudentInputs = async function () {
            if (!isAnyAdmin(currentUser)) {
                showToast('Fitur reset input siswa hanya dapat diakses oleh Admin / Superadmin.');
                return;
            }
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
        let projectChecklistState = { subconc: '', className: '', statusFilter: 'all', search: '', compactCols: true };
        let projectChecklistScrollPos = { left: 0, top: 0 };
        let projectClassesState = { search: '', mentorId: '', openClasses: new Set() };
        let projectCalendarState = { year: new Date().getFullYear(), month: new Date().getMonth() };
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

            const { allTasks, subMap, studentList, mentorsList = [] } = projectDataCache;
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

            const classes = [...new Set(studentList.map((s) => s.class_name).filter(Boolean))].sort();

            const modeSwitcherHtml = `
                <div class="flex flex-wrap items-center justify-between gap-2.5 bg-white border border-[#EDF1F7] rounded-2xl shadow-card px-4 py-2.5">
                    <div class="inline-flex flex-wrap p-1 bg-[#F3F6FB] rounded-xl gap-1">
                        <button type="button" onclick="setProjectViewMode('tasks')"
                            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${projectViewMode === 'tasks' ? 'bg-[#0095FF] text-white shadow-sm' : 'text-slate-500 hover:text-[#1E293B]'}">
                            📋 Daftar Tugas &amp; Review (${filteredTasks.length})
                        </button>
                        <button type="button" onclick="setProjectViewMode('classes')"
                            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${projectViewMode === 'classes' ? 'bg-[#0095FF] text-white shadow-sm' : 'text-slate-500 hover:text-[#1E293B]'}">
                            🏫 Rekap Per Kelas (${classes.length})
                        </button>
                        <button type="button" onclick="setProjectViewMode('calendar')"
                            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${projectViewMode === 'calendar' ? 'bg-[#0095FF] text-white shadow-sm' : 'text-slate-500 hover:text-[#1E293B]'}">
                            🗓️ Kalender &amp; Gantt
                        </button>
                        <button type="button" onclick="setProjectViewMode('matrix')"
                            class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${projectViewMode === 'matrix' ? 'bg-[#0095FF] text-white shadow-sm' : 'text-slate-500 hover:text-[#1E293B]'}">
                            🧩 Matrix Semua Siswa (${studentList.length})
                        </button>
                    </div>
                    <span class="text-[11px] text-slate-400 hidden sm:inline">
                        ${projectViewMode === 'calendar'
                            ? 'Kalender bulanan deadline & Timeline Gantt lintas Pre-Production, Production, hingga Post-Production.'
                            : (projectViewMode === 'classes'
                                ? 'Akordion progres rata-rata tiap kelas, Link Pantau Ortu, Flowchart, & Cetak PDF Rapor.'
                                : (projectViewMode === 'tasks' ? 'Klik "Review Siswa" untuk periksa hasil di Drive, ACC, atau kirim catatan revisi.' : 'Klik kotak status pada tabel untuk langsung me-review siswa tersebut.'))}
                    </span>
                </div>`;

            // ==================== MODE 6: KALENDER DEADLINE & TIMELINE GANTT PRODUKSI ====================
            if (projectViewMode === 'calendar') {
                const calHtml = buildCalendarAndGanttHtml(filteredTasks, projectCalendarState.year, projectCalendarState.month, {
                    prevFn: 'shiftProjectCalendarMonth(-1)',
                    todayFn: 'resetProjectCalendarMonth()',
                    nextFn: 'shiftProjectCalendarMonth(1)',
                    onTaskClickAttrFn: (t) => `onclick="jumpToCalendarTask('${t.id}')"`,
                    getProgressFn: (t) => {
                        const elig = studentList.filter((s) => !t.sub_concentration || s.sub_concentration === t.sub_concentration);
                        const done = elig.filter((s) => subMap[`${t.id}__${s.id}`]?.status === 'selesai').length;
                        const pct = elig.length ? Math.round((done / elig.length) * 100) : 0;
                        return { pct, label: `${done}/${elig.length} ACC (${pct}%)` };
                    }
                });
                container.innerHTML = `${modeSwitcherHtml}${calHtml}`;
                return;
            }

            // ==================== MODE 5: REKAP AKORDION PER KELAS + FLOWCHART + CETAK PDF RAPOR ====================
            if (projectViewMode === 'classes') {
                const mentorMap = Object.fromEntries(mentorsList.map((m) => [m.id, m]));
                const cSearch = (projectClassesState.search || '').trim().toLowerCase();
                const cMentor = projectClassesState.mentorId || '';

                const scopedForClasses = studentList.filter((s) => {
                    if (subF && s.sub_concentration !== subF) return false;
                    if (expectedRole === 'superadmin' && cMentor && s.mentor_id !== cMentor) return false;
                    if (!cSearch) return true;
                    return (s.full_name || '').toLowerCase().includes(cSearch) ||
                        (s.username || '').toLowerCase().includes(cSearch) ||
                        (s.class_name || '').toLowerCase().includes(cSearch) ||
                        (s.sub_concentration || '').toLowerCase().includes(cSearch);
                });

                const grouped = {};
                scopedForClasses.forEach((s) => {
                    const clsName = s.class_name || 'Tanpa Kelas';
                    if (!grouped[clsName]) grouped[clsName] = [];
                    grouped[clsName].push(s);
                });
                const sortedClassNames = Object.keys(grouped).sort();
                if (!projectClassesState.openClasses.size && sortedClassNames.length) {
                    projectClassesState.openClasses.add(sortedClassNames[0]);
                }

                container.innerHTML = `
                    ${modeSwitcherHtml}
                    <div class="bg-white border border-[#EDF1F7] rounded-2xl shadow-card p-4 sm:p-5 space-y-4">
                        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div>
                                <h3 class="text-base font-extrabold text-[#1E293B]">🏫 Rekap Akordion Per Kelas &amp; Cetak PDF Rapor</h3>
                                <p class="text-xs text-slate-500 mt-0.5">Klik nama kelas untuk membuka daftar siswa, melihat <strong>Timeline Flowchart</strong>, atau <strong>Cetak PDF Rapor</strong> siap tanda tangan orang tua &amp; guru.</p>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 shrink-0">
                                ${expectedRole === 'superadmin' ? `
                                <select onchange="setProjectClassesMentor(this.value)" class="px-3 py-2 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-[#0095FF]">
                                    <option value="">Semua Pembimbing</option>
                                    ${mentorsList.map((m) => `<option value="${esc(m.id)}" ${cMentor === m.id ? 'selected' : ''}>${esc(m.full_name)}</option>`).join('')}
                                </select>` : ''}
                                <input id="projClassesSearchInp" type="text" value="${esc(projectClassesState.search)}" oninput="setProjectClassesSearch(this.value)"
                                    placeholder="Cari siswa / kelas / subkon..."
                                    class="px-3 py-2 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-xs w-52 focus:bg-white focus:outline-none focus:border-[#0095FF]" />
                                <button type="button" onclick="printAllStudentsReportPdf('')"
                                    class="px-3.5 py-2 rounded-xl bg-[#E2F5F2] hover:bg-[#4CB6A7] text-[#1D5E55] hover:text-white text-xs font-bold transition cursor-pointer">
                                    🖨️ Cetak PDF Semua (${scopedForClasses.length})
                                </button>
                            </div>
                        </div>

                        <div class="space-y-3">
                            ${sortedClassNames.length ? sortedClassNames.map((clsName) => {
                                const list = grouped[clsName];
                                const isOpen = projectClassesState.openClasses.has(clsName);
                                let sumPct = 0;
                                let clsGold = 0;
                                let clsIssues = 0;
                                const enriched = list.map((s) => {
                                    const st = computeStudentIssueStats(s, allTasks, subMap);
                                    const pct = st.eligibleCount ? Math.round((st.accCount / st.eligibleCount) * 100) : 0;
                                    const waitCnt = allTasks.filter((t) => (!t.sub_concentration || s.sub_concentration === t.sub_concentration) && subMap[`${t.id}__${s.id}`]?.status === 'menunggu_review').length;
                                    const revCnt = allTasks.filter((t) => (!t.sub_concentration || s.sub_concentration === t.sub_concentration) && subMap[`${t.id}__${s.id}`]?.status === 'revisi').length;
                                    sumPct += pct;
                                    clsGold += st.goldCount;
                                    clsIssues += st.totalIssues;
                                    return { s, st, pct, waitCnt, revCnt };
                                });
                                const avgClsPct = list.length ? Math.round(sumPct / list.length) : 0;
                                const avgBarColor = avgClsPct === 100 ? 'bg-[#4CAF50]' : (avgClsPct >= 50 ? 'bg-[#38BDF8]' : 'bg-[#F87171]');

                                return `
                                    <div class="rounded-2xl border border-[#DCE5F2] overflow-hidden shadow-xs">
                                        <div class="bg-[#1E293B] hover:bg-[#29374E] text-white px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition"
                                            onclick="toggleClassAccordion('${encodeURIComponent(clsName)}')">
                                            <div class="flex flex-wrap items-center gap-2.5">
                                                <span class="text-sm sm:text-base font-extrabold tracking-wide">🏫 ${esc(clsName)}</span>
                                                <span class="px-2 py-0.5 rounded-full bg-white/15 text-[10.5px] font-bold num-tabular">${list.length} Siswa</span>
                                                ${clsGold > 0 ? `<span class="px-2 py-0.5 rounded-full bg-[#F7C200]/25 text-[#FFF6D6] text-[10.5px] font-bold">🌟 ${clsGold}</span>` : ''}
                                                ${clsIssues > 0 ? `<span class="px-2 py-0.5 rounded-full bg-[#F13B6E]/30 text-[#FFE4EC] text-[10.5px] font-bold">⚠️ ${clsIssues}</span>` : ''}
                                                <span class="text-xs text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}">▼</span>
                                            </div>
                                            <div class="flex items-center gap-3 w-full sm:w-auto">
                                                <div class="flex items-center gap-2 flex-1 sm:flex-none num-tabular">
                                                    <span class="text-[11px] text-slate-300 whitespace-nowrap">Ketuntasan:</span>
                                                    <div class="w-full sm:w-32 h-2.5 rounded-full bg-white/20 overflow-hidden">
                                                        <div class="${avgBarColor} h-full rounded-full transition-all duration-500" style="width:${avgClsPct}%"></div>
                                                    </div>
                                                    <span class="text-xs font-extrabold w-9 text-right">${avgClsPct}%</span>
                                                </div>
                                                <button type="button" onclick="event.stopPropagation(); printAllStudentsReportPdf('${encodeURIComponent(clsName)}')"
                                                    class="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white text-white hover:text-[#1E293B] text-[11px] font-bold transition cursor-pointer shrink-0">
                                                    🖨️ PDF Kelas
                                                </button>
                                            </div>
                                        </div>

                                        <div class="${isOpen ? '' : 'hidden'} bg-white divide-y divide-[#F1F5F9]">
                                            ${enriched.map(({ s, st, pct, waitCnt, revCnt }) => {
                                                const mObj = s.mentor_id ? mentorMap[s.mentor_id] : null;
                                                const logsCnt = (projectDataCache.fbLogMap?.[s.id] || []).length;
                                                const barCls = pct === 100 ? 'bg-[#4CAF50]' : (pct >= 50 ? 'bg-[#0095FF]' : 'bg-[#F13B6E]');
                                                return `
                                                    <div class="p-3.5 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-[#F8FBFF] transition">
                                                        <div class="flex items-start gap-3 min-w-0 flex-1">
                                                            <div class="w-9 h-9 rounded-full bg-[#EAF4FF] text-[#0095FF] font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden mt-0.5">
                                                                ${renderAvatarMarkup(s.avatar_url, s.full_name)}
                                                            </div>
                                                            <div class="min-w-0 space-y-1 flex-1">
                                                                <div class="flex flex-wrap items-center gap-1.5">
                                                                    <span class="font-extrabold text-xs sm:text-sm text-[#1E293B]">${esc(s.full_name)}</span>
                                                                    <span class="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#EAF4FF] text-[#0082E6]">${esc(s.sub_concentration || 'Belum ada subkon')}</span>
                                                                    ${st.goldCount > 0 ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#FFF6D6] text-[#9A6F00]">🌟 ${st.goldCount} Emas</span>` : ''}
                                                                    ${st.totalIssues > 0 ? `<span title="${esc(st.detailText)}" class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#FFF0F4] text-[#E11D48]">⚠️ ${st.totalIssues} Masalah</span>` : ''}
                                                                    ${waitCnt > 0 ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FFFBEB] text-[#B45309]">🔔 ${waitCnt} Review</span>` : ''}
                                                                    ${revCnt > 0 ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FFF0F4] text-[#E11D48]">✏️ ${revCnt} Revisi</span>` : ''}
                                                                </div>
                                                                <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                                                    <span class="font-mono">@${esc(s.username)}</span>
                                                                    <span>• Pembimbing: <strong class="text-slate-600">${esc(mObj?.full_name || 'Belum di-plot')}</strong></span>
                                                                    ${renderWhatsappLink(s.whatsapp_number, true)}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div class="flex flex-wrap items-center gap-2 shrink-0">
                                                            <div class="w-28 num-tabular mr-1">
                                                                <div class="flex items-center justify-between text-[10px] font-bold mb-0.5">
                                                                    <span class="text-slate-500">${st.accCount}/${st.eligibleCount} ACC</span>
                                                                    <span class="${pct === 100 ? 'text-[#15803D]' : 'text-slate-600'}">${pct}%</span>
                                                                </div>
                                                                <div class="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                                                    <div class="${barCls} h-full rounded-full" style="width:${pct}%"></div>
                                                                </div>
                                                            </div>
                                                            ${s.project_drive_url
                                                                ? `<a href="${esc(s.project_drive_url)}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 rounded-lg bg-[#F0FDF4] hover:bg-[#16A34A] text-[#15803D] hover:text-white border border-[#BBF7D0] text-[11px] font-bold transition">📁 Drive</a>`
                                                                : `<span class="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-[11px] font-semibold">No Drive</span>`}
                                                            <button type="button" onclick="openStudentFlowchart('${s.id}')"
                                                                class="px-2.5 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#4F46E5] text-[#4F46E5] hover:text-white border border-[#C7D2FE] text-[11px] font-bold transition cursor-pointer">
                                                                🗺️ Flowchart
                                                            </button>
                                                            <button type="button" onclick="openStudentParentLink('${s.id}')" title="Buat / Salin Link Pantau Orang Tua (Read-Only)"
                                                                class="px-2.5 py-1.5 rounded-lg bg-[#FFF6D6] hover:bg-[#F7C200] text-[#9A6F00] hover:text-white border border-[#FDE68A] text-[11px] font-bold transition cursor-pointer">
                                                                👨‍👩‍👧 Ortu
                                                            </button>
                                                            <button type="button" onclick="openStudentFeedbackHistory('${s.id}')"
                                                                class="px-2.5 py-1.5 rounded-lg bg-[#F7FAFF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white border border-[#DCEBFF] text-[11px] font-bold transition cursor-pointer">
                                                                📜 Log${logsCnt ? ` (${logsCnt})` : ''}
                                                            </button>
                                                            <button type="button" onclick="printStudentReportPdf('${s.id}')"
                                                                class="px-2.5 py-1.5 rounded-lg bg-[#E2F5F2] hover:bg-[#4CB6A7] text-[#1D5E55] hover:text-white border border-[#BBE9E2] text-[11px] font-bold transition cursor-pointer">
                                                                🖨️ PDF
                                                            </button>
                                                        </div>
                                                    </div>`;
                                            }).join('')}
                                        </div>
                                    </div>`;
                            }).join('') : `<div class="p-8 text-center text-xs text-slate-400">Tidak ada siswa yang sesuai pencarian.</div>`}
                        </div>
                    </div>`;
                return;
            }

            if (!filteredTasks.length) {
                container.innerHTML = `${modeSwitcherHtml}<div class="bg-white border border-[#EDF1F7] rounded-2xl shadow-card p-10 text-center text-sm text-slate-400">Belum ada tugas project untuk filter ini. Tambahkan tugas project &amp; deadline di form atas atau Import Excel (.xlsx).</div>`;
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
                                                                    <div class="flex flex-wrap items-center gap-1.5">
                                                                        ${ps.proof_image ? `<button type="button" onclick="openProofLightbox('${esc(ps.proof_image)}', '${esc(t.title)} — ${esc(s.full_name)}')" class="text-[10.5px] font-bold text-[#0082E6] hover:underline cursor-pointer">Lihat</button>` : ''}
                                                                        ${ps.proof_image ? `<button type="button" onclick="openProofAnnotator('${t.id}', '${s.id}')" title="Coret langsung di atas bukti foto siswa lalu kirim sebagai revisi" class="px-1.5 py-0.5 rounded bg-[#FFF0F4] hover:bg-[#E11D48] text-[#E11D48] hover:text-white text-[10px] font-bold transition cursor-pointer">✏️ Coret</button>` : ''}
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
                                                        <div class="space-y-1.5">
                                                            <div class="flex items-center gap-1.5">
                                                                <input type="text" value="${esc(stripFeedbackImageTags(ps.mentor_feedback || ''))}" placeholder="Catatan revisi / ACC..."
                                                                    class="proj-fb flex-1 px-2.5 py-1.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-xs focus:bg-white focus:outline-none focus:border-[#0095FF]" />
                                                                <button type="button" onclick="openRevisionComposerModal('${t.id}', '${s.id}')" title="Kirim Revisi dengan Gambar Coretan (Ctrl+V / Drag & Drop)"
                                                                    class="px-2 py-1.5 rounded-lg bg-[#FFF6D6] hover:bg-[#F7C200] text-[#9A6F00] hover:text-white text-[11px] font-bold transition cursor-pointer shrink-0">
                                                                    🖼️
                                                                </button>
                                                            </div>
                                                            ${(ps.mentor_feedback && /\[IMG:/.test(ps.mentor_feedback)) ? `<div class="text-[10px] font-bold text-[#0082E6]">📎 Catatan ini memiliki gambar revisi — klik 🖼️ untuk lihat/edit</div>` : ''}
                                                        </div>
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
                                    ${(() => {
                                        const customFiles = projectDataCache.taskFilesMap?.[t.id] || null;
                                        const naming = buildProjectFileNaming(t, null, customFiles);
                                        return `
                                    <div class="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F4F8FF] border border-[#DCEBFF] text-[11px] text-slate-600">
                                        <span class="font-bold text-[#0082E6]">📝 Format File${naming.files.length > 1 ? ` (${naming.files.length} file)` : ''}:</span>
                                        ${naming.files.map((f, fi) => `<code class="font-mono text-[10.5px] font-semibold text-[#1E293B] bg-white border border-[#DCEBFF] px-1.5 py-0.5 rounded-md">${naming.files.length > 1 ? `${fi + 1}. ` : ''}${esc(f.pattern)}</code>`).join('')}
                                        <button type="button" onclick="openTaskFilesEditor('${t.id}')"
                                            class="ml-auto px-2 py-0.5 rounded-md bg-white hover:bg-[#0095FF] border border-[#CBE5FF] text-[#0082E6] hover:text-white text-[10.5px] font-bold transition cursor-pointer shrink-0">
                                            ✎ Atur File
                                        </button>
                                    </div>`;
                                    })()}
                                    <!-- Ringkasan Status & Mini Progress Bar -->
                                    <div class="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold num-tabular">
                                        <div class="w-28 h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                                            <div class="h-full bg-[#4CB6A7] rounded-full" style="width:${pct}%"></div>
                                        </div>
                                        <span class="text-[#228B7D]">${accCount}/${eligible.length} ACC (${pct}%)</span>
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
                                    ${isAnyAdmin(currentUser) ? `
                                    <button type="button" onclick="deleteProjectTask('${t.id}')"
                                        class="px-3 py-2 rounded-xl bg-[#FFF1F5] hover:bg-[#F13B6E] text-[#F13B6E] hover:text-white text-xs font-bold transition cursor-pointer">
                                        Hapus
                                    </button>` : ''}
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

            const [{ data: projTasks }, { data: projSubs }, { data: allStudents }, { data: mentors }, { data: fbLogRaw }, { data: archivesRaw }, { data: checklistRowsRaw }, { data: taskFilesRaw }] = await Promise.all([
                supabase.from('project_tasks').select('*').order('due_date', { ascending: true }),
                supabase.from('project_submissions').select('*'),
                supabase.from('profiles').select('id, full_name, username, class_name, sub_concentration, mentor_id, avatar_url, whatsapp_number, project_drive_url').eq('role', 'student').order('class_name').order('full_name'),
                supabase.from('profiles').select('id, full_name, username, whatsapp_number').in('role', ['mentor', 'superadmin']).order('full_name'),
                supabase.from('app_settings').select('key, value, updated_at').like('key', `${PROJECT_FB_LOG_PREFIX}%`),
                supabase.from('app_settings').select('key, value, updated_at').like('key', `${PROJECT_ARCHIVE_PREFIX}%`),
                supabase.from('app_settings').select('key, value, updated_at').like('key', `${CHECKLIST_ROW_PREFIX}%`),
                supabase.from('app_settings').select('key, value').like('key', `${PROJECT_FILES_PREFIX}%`)
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
            const fbLogMap = parseFeedbackLogMap(fbLogRaw || []);
            const checklistRowMap = parseChecklistRowMap(checklistRowsRaw || []);
            const taskFilesMap = parseTaskFilesMap(taskFilesRaw || []);
            const archives = (archivesRaw || []).map((r) => {
                try {
                    const parsed = JSON.parse(r.value || '{}');
                    return { key: r.key, updated_at: r.updated_at, ...parsed };
                } catch {
                    return null;
                }
            }).filter(Boolean).sort((a, b) => String(b.created_at || b.updated_at || '').localeCompare(String(a.created_at || a.updated_at || '')));

            projectDataCache = { allTasks, subMap, studentList, allStudentsList, mentorsList: mentors || [], fbLogMap, archives, homeroomMap, pjMap, checklistColsMap, checklistRowMap, taskFilesMap };

            // Overall Project Progress Summary + Lencana Emas & Total Masalah
            let totalAssignments = 0;
            let doneAssignments = 0;
            let goldAssignments = 0;
            let reviewAssignments = 0;
            let revisionAssignments = 0;
            let overdueTasksCount = 0;
            let problemStudentsCount = 0;
            let earlyWarningCount = 0;

            studentList.forEach((s) => {
                const st = computeStudentIssueStats(s, allTasks, subMap);
                if (st.totalIssues > 0) problemStudentsCount++;
                if (st.totalIssues >= 2) earlyWarningCount++;
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
                                <p class="text-xs text-white/90">Pantau deadline, Lencana Emas, status penyelesaian, audit log catatan guru, hingga arsip snapshot.</p>
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
                                <div class="flex flex-wrap items-center gap-2">
                                    <button type="button" onclick="openStaffLeaderboard()"
                                        class="px-3 py-2 rounded-xl bg-[#FFF6D6] text-[#9A6F00] hover:bg-[#F7C200] hover:text-white text-[11px] font-extrabold shadow-xs transition cursor-pointer shrink-0">
                                        🏆 Leaderboard
                                    </button>
                                    <button type="button" onclick="openShowcaseGallery()"
                                        class="px-3 py-2 rounded-xl bg-white/20 hover:bg-white text-white hover:text-[#1D5E55] text-[11px] font-extrabold border border-white/30 transition cursor-pointer shrink-0">
                                        🎬 Galeri Karya
                                    </button>
                                    <button type="button" onclick="printAllStudentsReportPdf('')"
                                        class="px-3 py-2 rounded-xl bg-white text-[#1D5E55] hover:bg-[#FFF6D6] text-[11px] font-extrabold shadow-xs transition cursor-pointer shrink-0">
                                        🖨️ PDF Rapor
                                    </button>
                                    <button type="button" onclick="saveProjectArchiveSnapshot(this)"
                                        class="flex-1 px-3 py-2 rounded-xl bg-white/20 hover:bg-white text-white hover:text-[#1D5E55] text-[11px] font-extrabold border border-white/30 transition cursor-pointer">
                                        📦 Arsip
                                    </button>
                                    <button type="button" onclick="openProjectArchivesModal()"
                                        class="px-3 py-2 rounded-xl bg-white/15 hover:bg-white text-white hover:text-[#1D5E55] text-[11px] font-extrabold border border-white/25 transition cursor-pointer shrink-0">
                                        🗂️ (${archives.length})
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 num-tabular">
                            <div class="bg-white/15 rounded-xl px-3.5 py-2.5">
                                <div class="text-[11px] text-white/85">Total Tugas</div>
                                <div class="text-lg font-extrabold">${allTasks.length}</div>
                            </div>
                            <button type="button" onclick="openProjectKpiModal('gold')"
                                class="text-left bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl px-3.5 py-2.5 transition cursor-pointer" title="Klik untuk melihat daftar peraih Lencana Emas">
                                <div class="text-[11px] text-white/90 flex items-center justify-between"><span>🌟 Lencana Emas</span><span class="text-[10px] opacity-80">↗</span></div>
                                <div class="text-lg font-extrabold text-[#FFF6D6]">${goldAssignments}</div>
                            </button>
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
                            <button type="button" onclick="openProjectKpiModal('issues')"
                                class="text-left bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl px-3.5 py-2.5 transition cursor-pointer" title="Klik untuk melihat daftar siswa bermasalah">
                                <div class="text-[11px] text-white/90 flex items-center justify-between"><span>⚠️ Bermasalah</span><span class="text-[10px] opacity-80">↗</span></div>
                                <div class="text-lg font-extrabold text-[#FFE4EC]">${problemStudentsCount}</div>
                            </button>
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
                    </div>
                    ${earlyWarningCount > 0 ? `
                    <div onclick="openProjectKpiModal('early_warning')"
                        class="mt-3 rounded-2xl bg-[#FFF0F4] hover:bg-[#FFE4EC] border-l-4 border-[#E11D48] border border-[#FECDD6] p-4 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition">
                        <div class="flex items-center gap-3">
                            <span class="w-10 h-10 rounded-xl bg-[#E11D48] text-white text-lg flex items-center justify-center shrink-0">🚨</span>
                            <div>
                                <div class="text-sm font-extrabold text-[#9F1239]">Peringatan Dini Aktif!</div>
                                <p class="text-xs text-[#BE123C] mt-0.5">Terdapat <strong>${earlyWarningCount} siswa</strong> dengan akumulasi <strong>≥ 2 poin masalah</strong> (keterlambatan / revisi berulang) yang membutuhkan pembinaan segera.</p>
                            </div>
                        </div>
                        <span class="self-start sm:self-center px-3.5 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold shrink-0">Cek Detail →</span>
                    </div>` : ''}`;
            }

            // Isi Pusat Notifikasi Aktivitas (Ikon Lonceng Header)
            const staffNotifs = [];
            if (earlyWarningCount > 0) {
                staffNotifs.push({
                    icon: '🚨',
                    iconBg: 'bg-[#FFF0F4] text-[#E11D48]',
                    title: `Peringatan Dini: ${earlyWarningCount} siswa butuh pembinaan`,
                    desc: 'Klik untuk melihat daftar siswa dengan ≥ 2 poin masalah.',
                    timeLabel: 'Prioritas Tinggi',
                    ts: Date.now(),
                    urgent: true,
                    onClick: () => { switchTab('projects'); global.openProjectKpiModal('early_warning'); }
                });
            }
            const taskById = Object.fromEntries(allTasks.map((t) => [t.id, t]));
            const stuById = Object.fromEntries(studentList.map((s) => [s.id, s]));
            Object.values(subMap)
                .filter((ps) => ps.status === 'menunggu_review')
                .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
                .slice(0, 10)
                .forEach((ps) => {
                    const s = stuById[ps.student_id];
                    const t = taskById[ps.project_task_id];
                    if (!s || !t) return;
                    staffNotifs.push({
                        icon: '📩',
                        iconBg: 'bg-[#FFF6D6] text-[#B88600]',
                        title: `${s.full_name} mengajukan review`,
                        desc: `Tugas: ${t.title} (${s.class_name || '-'})`,
                        timeLabel: ps.updated_at ? formatDateTime(ps.updated_at) : '',
                        ts: ps.updated_at ? Date.parse(ps.updated_at) || 0 : 0,
                        onClick: () => { switchTab('projects'); global.jumpToStudentProjectReview(t.id, s.username || s.full_name); }
                    });
                });
            updateNotificationCenter(staffNotifs, `staff_${currentUser.id}`);

            renderProjectTrackerBody();
            renderProjectUpdateView();
        }
        global.loadProjectTracker = loadProjectTracker;

        // ==================== HALAMAN MENU TERSENDIRI: PROJECT UPDATE (PJ SUB-KONSENTRASI) ====================
        function renderProjectUpdateView() {
            const container = document.getElementById('projectUpdateContainer');
            if (!container) return;

            const { allStudentsList = [], studentList = [], mentorsList = [], checklistColsMap = {}, checklistRowMap = {}, pjMap = {} } = projectDataCache;
            const mentorMap = Object.fromEntries(mentorsList.map((m) => [m.id, m]));
            const isAdminStaff = isAnyAdmin(currentUser);
            const poolStudents = (expectedRole === 'superadmin' || isAdminStaff) ? allStudentsList : studentList;

            // Tentukan default tab aktif
            let activeSc = projectChecklistState.subconc;
            if (!activeSc && (expectedRole === 'superadmin' || myPjSubconcs.length > 0)) {
                activeSc = myPjSubconcs[0] || SUBCONCS[0];
                projectChecklistState.subconc = activeSc;
            }

            const isSpecificSc = SUBCONCS.includes(activeSc);
            const isGroup2D = activeSc === '__group_2d';
            const isGroup3D = activeSc === '__group_3d';
            const isUnassignedTab = activeSc === '__unassigned';
            const canEditActiveSc = isAdminStaff || (isSpecificSc && myPjSubconcs.includes(activeSc));

            const pjNamesForActiveSc = isSpecificSc
                ? mentorsList.filter((m) => Array.isArray(pjMap[m.id]) && pjMap[m.id].includes(activeSc)).map((m) => m.full_name)
                : [];

            // Helper cek siswa masuk tab yang dipilih (otomatis dari sub_concentration masing-masing siswa)
            const matchSubconcTab = (s, tabVal) => {
                const sc = s.sub_concentration || '';
                if (!tabVal) return true;
                if (tabVal === '__group_2d') return sc.startsWith('2D');
                if (tabVal === '__group_3d') return sc.startsWith('3D');
                if (tabVal === '__unassigned') return !sc;
                return sc === tabVal;
            };

            // Sumber siswa: PJ Subkon / Admin melihat seluruh siswa di subkon yang dipegangnya; pembimbing biasa melihat siswa bimbingan/kelasnya
            const studentSourceForTab = (tabVal) => {
                if (expectedRole === 'superadmin' || isAdminStaff) return allStudentsList;
                if (SUBCONCS.includes(tabVal) && myPjSubconcs.includes(tabVal)) return allStudentsList;
                return studentList;
            };

            const baseStudents = studentSourceForTab(activeSc).filter((s) => matchSubconcTab(s, activeSc));

            const ckCls = projectChecklistState.className || '';
            const ckStFilter = projectChecklistState.statusFilter || 'all';
            const ckSearch = (projectChecklistState.search || '').trim().toLowerCase();
            const ckClasses = [...new Set(baseStudents.map((s) => s.class_name).filter(Boolean))].sort();

            const activeCols = isSpecificSc
                ? (checklistColsMap[activeSc] || DEFAULT_CHECKLIST_COLS)
                : (isGroup2D
                    ? [...new Set(SUBCONCS.filter((sc) => sc.startsWith('2D')).flatMap((sc) => checklistColsMap[sc] || DEFAULT_CHECKLIST_COLS))]
                    : (isGroup3D
                        ? [...new Set(SUBCONCS.filter((sc) => sc.startsWith('3D')).flatMap((sc) => checklistColsMap[sc] || DEFAULT_CHECKLIST_COLS))]
                        : [...new Set(SUBCONCS.flatMap((sc) => checklistColsMap[sc] || DEFAULT_CHECKLIST_COLS))]));

            const getStuCols = (s) => (s.sub_concentration && checklistColsMap[s.sub_concentration])
                ? checklistColsMap[s.sub_concentration]
                : (isSpecificSc ? activeCols : DEFAULT_CHECKLIST_COLS);

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
                const colsForStu = getStuCols(s);
                const doneCnt = colsForStu.filter((c) => normalizeChecklistStatus(rowData.items?.[c]) === 'done').length;
                const wipCnt = colsForStu.filter((c) => normalizeChecklistStatus(rowData.items?.[c]) === 'wip').length;
                const revCnt = colsForStu.filter((c) => normalizeChecklistStatus(rowData.items?.[c]) === 'revisi').length;
                if (ckStFilter === 'all_done') return colsForStu.length > 0 && doneCnt === colsForStu.length;
                if (ckStFilter === 'wip') return wipCnt > 0;
                if (ckStFilter === 'not_done') return doneCnt < colsForStu.length;
                if (ckStFilter === 'revisi') return revCnt > 0;
                return true;
            });

            let sumProgressPct = 0;
            const totalDoneAll = baseStudents.filter((s) => {
                const cols = getStuCols(s);
                const rowData = checklistRowMap[s.id] || { items: {} };
                const d = cols.filter((c) => normalizeChecklistStatus(rowData.items?.[c]) === 'done').length;
                sumProgressPct += cols.length ? Math.round((d / cols.length) * 100) : 0;
                return cols.length > 0 && d === cols.length;
            }).length;
            const avgProgressPct = baseStudents.length ? Math.round(sumProgressPct / baseStudents.length) : 0;
            const totalWipAll = baseStudents.filter((s) => {
                const cols = getStuCols(s);
                const rowData = checklistRowMap[s.id] || { items: {} };
                return cols.some((c) => normalizeChecklistStatus(rowData.items?.[c]) === 'wip');
            }).length;
            const totalRevisiAll = baseStudents.filter((s) => {
                const cols = getStuCols(s);
                const rowData = checklistRowMap[s.id] || { items: {} };
                return cols.some((c) => normalizeChecklistStatus(rowData.items?.[c]) === 'revisi');
            }).length;
            const totalNotDoneAll = baseStudents.length - totalDoneAll;

            const unassignedCount = poolStudents.filter((s) => !s.sub_concentration).length;
            const count2D = poolStudents.filter((s) => (s.sub_concentration || '').startsWith('2D')).length;
            const count3D = poolStudents.filter((s) => (s.sub_concentration || '').startsWith('3D')).length;

            const subconcTabs = [
                ...(expectedRole === 'mentor' ? [{ val: '', label: `Semua ${staffScopeMode === 'homeroom' && myHomeroomClass ? myHomeroomClass : 'Bimbingan'}`, count: studentList.length, group: 'scope' }] : []),
                ...SUBCONCS.map((sc) => ({
                    val: sc,
                    label: `${sc}${myPjSubconcs.includes(sc) ? ' ★PJ' : ''}`,
                    count: studentSourceForTab(sc).filter((s) => s.sub_concentration === sc).length,
                    group: 'subconc'
                })),
                { val: '__group_2d', label: 'Semua 2D', count: count2D, group: 'combo' },
                { val: '__group_3d', label: 'Semua 3D', count: count3D, group: 'combo' },
                ...(unassignedCount > 0 ? [{ val: '__unassigned', label: '⚠️ Belum Ada Subkon', count: unassignedCount, group: 'warn' }] : [])
            ];

            container.innerHTML = `
                <div class="bg-white border border-[#EDF1F7] rounded-2xl shadow-card overflow-x-clip">
                    <div class="p-4 sm:p-5 border-b border-[#EDF1F7] bg-[#F7FAFF] rounded-t-2xl space-y-4">
                        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div class="space-y-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${canEditActiveSc || isAdminStaff ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#EAF4FF] text-[#0082E6]'}">
                                        ${canEditActiveSc || isAdminStaff ? '✏️ Mode Edit PJ Sub-Konsentrasi / Admin' : '👁️ Mode Pantau Pembimbing (Diisi oleh PJ Subkon)'}
                                    </span>
                                    <span class="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-white border border-[#DCEBFF] text-[#0082E6]">Otomatis per Sub-Konsentrasi Siswa</span>
                                    ${isSpecificSc ? `<span class="text-[11px] font-bold text-slate-500">PJ ${esc(activeSc)}: <strong class="text-[#1E293B]">${pjNamesForActiveSc.length ? esc(pjNamesForActiveSc.join(', ')) : 'Belum ditetapkan (atur di Akun & Plotting)'}</strong></span>` : ''}
                                </div>
                                <h3 class="text-base sm:text-lg font-extrabold text-[#1E293B]">📊 Project Update — ${esc(isSpecificSc ? activeSc : (isGroup2D ? 'Semua Subkon 2D' : (isGroup3D ? 'Semua Subkon 3D' : (isUnassignedTab ? 'Siswa Belum Ada Sub-Konsentrasi' : 'Semua Siswa'))))}</h3>
                                <p class="text-xs text-slate-500">
                                    Siswa otomatis masuk ke tabel sesuai Sub-Konsentrasinya. Ubah status tahapan (<strong>None / WIP / Revisi / Done</strong>) untuk langsung menggerakkan <strong>Progress Bar hijau</strong> &amp; menyimpan <strong>Notes</strong> secara real-time.
                                </p>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 shrink-0">
                                ${(isAdminStaff || myPjSubconcs.length > 0) ? `
                                <button type="button" onclick="downloadChecklistTemplateXlsx()"
                                    class="px-3.5 py-2 rounded-xl bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white text-xs font-bold transition cursor-pointer">
                                    📄 Download Format (.xlsx)
                                </button>
                                <label for="importChecklistXlsxInput"
                                    class="px-3.5 py-2 rounded-xl bg-[#FFF6D6] hover:bg-[#F7C200] text-[#9A6F00] hover:text-white text-xs font-bold transition cursor-pointer">
                                    📤 Import Spreadsheet (.xlsx)
                                </label>
                                <input id="importChecklistXlsxInput" type="file" accept=".xlsx,.xls,.csv" class="hidden" onchange="handleChecklistImportFile(this)" />` : ''}
                                <button type="button" onclick="exportChecklistXlsx()"
                                    class="px-3.5 py-2 rounded-xl bg-[#E2F5F2] hover:bg-[#4CB6A7] text-[#1D5E55] hover:text-white text-xs font-bold transition cursor-pointer">
                                    📥 Export Project Update (.xlsx)
                                </button>
                            </div>
                        </div>

                        ${(isAdminStaff || myPjSubconcs.length > 0) ? `
                        <div class="rounded-xl bg-white/90 border border-[#DCEBFF] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                            <div class="flex flex-wrap items-center gap-1.5">
                                <span class="font-extrabold text-[#0082E6]">📋 Format Kolom Excel:</span>
                                <code class="px-1.5 py-0.5 rounded bg-[#F3F6FB] font-mono text-[10.5px]">Nama Siswa</code>
                                <code class="px-1.5 py-0.5 rounded bg-[#F3F6FB] font-mono text-[10.5px]">Username</code>
                                <code class="px-1.5 py-0.5 rounded bg-[#F3F6FB] font-mono text-[10.5px]">Kelas</code>
                                <code class="px-1.5 py-0.5 rounded bg-[#F3F6FB] font-mono text-[10.5px]">Link Google Drive</code>
                                <code class="px-1.5 py-0.5 rounded bg-[#E7F9EE] text-[#15803D] font-mono text-[10.5px]">[Tahapan: None / WIP / Revisi / Done]</code>
                                <code class="px-1.5 py-0.5 rounded bg-[#FFF6D6] text-[#9A6F00] font-mono text-[10.5px]">Notes</code>
                            </div>
                            <span class="text-[10.5px] text-slate-400">Klik <strong>📄 Download Format (.xlsx)</strong> untuk mengunduh template siap isi dengan daftar siswa.</span>
                        </div>` : ''}

                        <!-- Tab Otomatis per Sub-Konsentrasi + Grup 2D / 3D -->
                        <div class="flex flex-wrap items-center gap-1.5">
                            ${subconcTabs.map((tab) => {
                                const active = activeSc === tab.val;
                                const pillCls = active
                                    ? 'bg-[#0095FF] text-white border-[#0095FF] shadow-sm'
                                    : (tab.group === 'warn'
                                        ? 'bg-[#FFF0F4] text-[#E11D48] border-[#FECDD6] hover:bg-[#FFE4E6]'
                                        : (tab.group === 'combo'
                                            ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0] hover:border-[#4CAF50]'
                                            : 'bg-white text-slate-600 border-[#E2E8F0] hover:border-[#0095FF]'));
                                return `
                                    <button type="button" onclick="setChecklistSubconc('${esc(tab.val)}')"
                                        class="px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer inline-flex items-center gap-1.5 ${pillCls}">
                                        <span>${esc(tab.label)}</span>
                                        <span class="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold num-tabular ${active ? 'bg-white/20 text-white' : 'bg-black/5'}">${tab.count}</span>
                                    </button>`;
                            }).join('')}
                        </div>

                        <!-- Kelola Kolom Tahapan (Khusus PJ Subkon aktif / Admin) -->
                        ${canEditActiveSc && isSpecificSc ? `
                        <div class="rounded-xl bg-white border border-[#DCEBFF] p-3.5 space-y-2.5">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#0082E6]">✏️ Kelola Kolom Tahapan STATUS — ${esc(activeSc)}</span>
                                    <p class="text-[10.5px] text-slate-400">Guru PJ Subkon bebas menambah, mengubah nama (✎), mengurutkan (◀/▶), atau menghapus tahapan sesuai pipeline subkon ini.</p>
                                </div>
                                <button type="button" onclick="syncChecklistColsFromTasks('${esc(activeSc)}')"
                                    class="px-2.5 py-1 rounded-lg bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white text-[11px] font-bold transition cursor-pointer shrink-0">
                                    ↻ Tarik dari Daftar Tugas Project
                                </button>
                            </div>
                            <div class="flex flex-wrap items-center gap-1.5">
                                ${activeCols.map((col, ci) => `
                                    <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F7FAFF] border border-[#DCEBFF] text-xs font-bold text-[#1E293B]">
                                        ${ci > 0 ? `<button type="button" onclick="moveChecklistColumn('${esc(activeSc)}', ${ci}, -1)" title="Geser ke kiri" class="text-slate-400 hover:text-[#0082E6] text-[10px] px-0.5 cursor-pointer">◀</button>` : ''}
                                        <span>${ci + 1}. ${esc(col)}</span>
                                        <button type="button" onclick="renameChecklistColumn('${esc(activeSc)}', ${ci})" title="Ubah nama tahapan ini" class="text-slate-400 hover:text-[#0082E6] text-[11px] px-0.5 cursor-pointer">✎</button>
                                        ${ci < activeCols.length - 1 ? `<button type="button" onclick="moveChecklistColumn('${esc(activeSc)}', ${ci}, 1)" title="Geser ke kanan" class="text-slate-400 hover:text-[#0082E6] text-[10px] px-0.5 cursor-pointer">▶</button>` : ''}
                                        ${activeCols.length > 1 ? `<button type="button" onclick="removeChecklistColumn('${esc(activeSc)}', ${ci})" title="Hapus kolom tahapan ini" class="text-slate-400 hover:text-[#E11D48] font-extrabold px-0.5 cursor-pointer">✕</button>` : ''}
                                    </span>`).join('')}
                            </div>
                            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <input id="newChecklistColInput" type="text" placeholder="Tambah kolom tahapan baru... (mis: Storyline, Storyboard, Modeling, Rigging, Grading, Final Film)"
                                    onkeydown="if(event.key==='Enter'){event.preventDefault();addChecklistColumn('${esc(activeSc)}');}"
                                    class="flex-1 px-3 py-2 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#0095FF]" />
                                <button type="button" onclick="addChecklistColumn('${esc(activeSc)}')"
                                    class="px-4 py-2 rounded-xl bg-[#0095FF] hover:bg-[#0082E6] text-white text-xs font-bold transition cursor-pointer shrink-0">
                                    + Tambah Kolom
                                </button>
                            </div>
                        </div>` : ''}

                        <!-- 4 KPI Ringkasan -->
                        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 num-tabular">
                            <div class="bg-white border border-[#DCEBFF] rounded-xl px-3.5 py-2.5 space-y-1">
                                <div class="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                                    <span>Rata-rata Progres</span>
                                    <strong class="text-[#15803D]">${avgProgressPct}%</strong>
                                </div>
                                <div class="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <div class="h-full bg-[#4CAF50] rounded-full transition-all duration-300" style="width:${avgProgressPct}%"></div>
                                </div>
                            </div>
                            <div class="bg-[#DCFCE7] border border-[#86EFAC] rounded-xl px-3.5 py-2">
                                <div class="text-[11px] font-semibold text-[#15803D]">✓ Semua Done</div>
                                <div class="text-lg font-extrabold text-[#15803D]">${totalDoneAll} / ${baseStudents.length}</div>
                            </div>
                            <div class="bg-[#FFF6D6] border border-[#FDE68A] rounded-xl px-3.5 py-2">
                                <div class="text-[11px] font-semibold text-[#B45309]">⏳ Sedang WIP</div>
                                <div class="text-lg font-extrabold text-[#B45309]">${totalWipAll} siswa</div>
                            </div>
                            <div class="bg-[#FFF0F4] border border-[#FECDD6] rounded-xl px-3.5 py-2">
                                <div class="text-[11px] font-semibold text-[#E11D48]">! Ada Revisi</div>
                                <div class="text-lg font-extrabold text-[#E11D48]">${totalRevisiAll} siswa</div>
                            </div>
                        </div>

                        <!-- Toolbar Filter -->
                        <div class="flex flex-wrap items-center gap-2">
                            <select onchange="setChecklistClass(this.value)" class="px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0095FF]">
                                <option value="">Semua Kelas</option>
                                ${ckClasses.map((c) => `<option value="${esc(c)}" ${ckCls === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                            </select>
                            <select onchange="setChecklistStatusFilter(this.value)" class="px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0095FF]">
                                <option value="all" ${ckStFilter === 'all' ? 'selected' : ''}>Semua Status (${baseStudents.length})</option>
                                <option value="not_done" ${ckStFilter === 'not_done' ? 'selected' : ''}>Belum Tuntas (${totalNotDoneAll})</option>
                                <option value="wip" ${ckStFilter === 'wip' ? 'selected' : ''}>Sedang WIP (${totalWipAll})</option>
                                <option value="revisi" ${ckStFilter === 'revisi' ? 'selected' : ''}>Ada Revisi (${totalRevisiAll})</option>
                                <option value="all_done" ${ckStFilter === 'all_done' ? 'selected' : ''}>Semua Done (${totalDoneAll})</option>
                            </select>
                            <input id="checklistSearchInp" type="text" value="${esc(projectChecklistState.search)}" oninput="setChecklistSearch(this.value)"
                                placeholder="Cari nama siswa / kelas / subkon..."
                                class="flex-1 min-w-[180px] max-w-xs px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs focus:outline-none focus:border-[#0095FF]" />
                            <button type="button" onclick="toggleChecklistCompactCols()"
                                class="px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${projectChecklistState.compactCols ? 'bg-[#EAF4FF] border-[#CBE5FF] text-[#0082E6] hover:bg-[#0095FF] hover:text-white' : 'bg-white border-[#E2E8F0] text-slate-600 hover:border-[#0095FF]'}">
                                ${projectChecklistState.compactCols ? '📊 Tampilkan Kolom Detail (WA/Drive/Pembimbing)' : '⚡ Mode Ringkas (Fokus STATUS)'}
                            </button>
                            <span class="ml-auto text-[11px] font-semibold text-slate-400 num-tabular">${filteredRows.length} siswa ditampilkan</span>
                        </div>
                    </div>

                    <!-- Bar Navigasi Geser Kiri/Kanan + Scrollbar Atas Tersinkronisasi (Sticky saat Scroll Bawah) -->
                    <div id="checklistNavBar" class="sticky top-[64px] sm:top-[68px] z-20 px-4 py-2 bg-[#FAFBFD]/95 backdrop-blur border-b border-[#EDF1F7] space-y-1.5">
                        <div class="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div class="flex flex-wrap items-center gap-1.5">
                                <button type="button" onclick="scrollChecklistTable('start')"
                                    class="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EAF4FF] border border-[#E2E8F0] text-slate-600 hover:text-[#0082E6] font-bold transition cursor-pointer">⏮ Awal</button>
                                <button type="button" onclick="scrollChecklistTable(-320)"
                                    class="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EAF4FF] border border-[#E2E8F0] text-slate-600 hover:text-[#0082E6] font-bold transition cursor-pointer">◀ Kiri</button>
                                <button type="button" onclick="scrollChecklistTable('status')"
                                    class="px-3 py-1 rounded-lg bg-[#E3F6F3] hover:bg-[#4CB6A7] border border-[#BBE9E2] text-[#1D5E55] hover:text-white font-extrabold transition cursor-pointer">🎯 STATUS</button>
                                <button type="button" onclick="scrollChecklistTable(320)"
                                    class="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EAF4FF] border border-[#E2E8F0] text-slate-600 hover:text-[#0082E6] font-bold transition cursor-pointer">Kanan ▶</button>
                                <button type="button" onclick="scrollChecklistTable('end')"
                                    class="px-2.5 py-1 rounded-lg bg-white hover:bg-[#EAF4FF] border border-[#E2E8F0] text-slate-600 hover:text-[#0082E6] font-bold transition cursor-pointer">Notes ⏭</button>
                            </div>
                            <span class="text-[10.5px] text-slate-400 hidden md:inline">Geser scrollbar di bawah, tahan <kbd class="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">Shift</kbd> + scroll mouse, atau seret area tabel.</span>
                        </div>
                        <div id="checklistTopScroll" class="anitrack-xscroll overflow-x-auto overflow-y-hidden h-[16px]">
                            <div id="checklistTopScrollInner" class="h-[2px]"></div>
                        </div>
                    </div>

                    <!-- Tabel Project Update 2-Tingkat (Header & Kolom Siswa Terkunci Rapi Tanpa Menimpa) -->
                    <div id="checklistTableScroll" class="anitrack-xscroll overflow-auto max-h-[75vh] relative cursor-grab">
                        ${(() => {
                            const compact = projectChecklistState.compactCols !== false;
                            const totalColSpan = activeCols.length + (compact ? 3 : 7);
                            const baseFixedPx = 215 + 102 + (compact ? 0 : (74 + 112 + 112 + 115));
                            const stageColPx = 116;
                            const notesMinPx = 320;
                            const tableMinPx = baseFixedPx + (activeCols.length * stageColPx) + notesMinPx;

                            // Kelompokkan baris per Sub-Konsentrasi saat melihat tab gabungan (Semua 2D / Semua 3D / Semua) agar tidak selang-seling
                            const orderedGroups = [];
                            if (!isSpecificSc && !isUnassignedTab) {
                                const bySc = {};
                                filteredRows.forEach((s) => {
                                    const k = s.sub_concentration || 'Belum Ada Sub-Konsentrasi';
                                    if (!bySc[k]) bySc[k] = [];
                                    bySc[k].push(s);
                                });
                                const scOrder = [...SUBCONCS, ...Object.keys(bySc).filter((k) => !SUBCONCS.includes(k))];
                                scOrder.forEach((k) => {
                                    if (bySc[k]?.length) orderedGroups.push({ label: k, rows: bySc[k] });
                                });
                            } else if (filteredRows.length) {
                                orderedGroups.push({ label: '', rows: filteredRows });
                            }

                            let globalRowIdx = 0;
                            const renderStudentRow = (s) => {
                                globalRowIdx++;
                                const rowData = checklistRowMap[s.id] || { items: {}, notes: '', updated_by: '', updated_at: null };
                                const stuSubconc = s.sub_concentration || '';
                                const stuCanEdit = isAdminStaff || (stuSubconc && myPjSubconcs.includes(stuSubconc));
                                const stuCols = getStuCols(s);
                                const stuColsSet = new Set(stuCols);
                                const doneCount = stuCols.filter((c) => normalizeChecklistStatus(rowData.items?.[c]) === 'done').length;
                                const progPct = stuCols.length ? Math.round((doneCount / stuCols.length) * 100) : 0;
                                const mentorObj = s.mentor_id ? mentorMap[s.mentor_id] : null;
                                const notDoneList = stuCols.filter((c) => normalizeChecklistStatus(rowData.items?.[c]) !== 'done');
                                const waText = notDoneList.length
                                    ? `Halo ${s.full_name}, update Project Update (${stuSubconc || 'Animasi'}) — tahapan yang belum Done: ${notDoneList.join(', ')}.${rowData.notes ? ` Notes: ${rowData.notes}` : ''} Mohon segera dilengkapi di Folder Google Drive ya.`
                                    : `Halo ${s.full_name}, selamat! Semua tahapan Project Update kamu sudah Done (100%) ✓`;

                                return `
                                    <tr class="hover:bg-[#F8FBFF] align-middle">
                                        <td class="ck-sticky-col py-1.5 px-2.5 sticky left-0 bg-white z-10 border-r border-[#EDF1F7]">
                                            <div class="flex items-start gap-1.5">
                                                <span class="font-mono text-[10px] font-bold text-slate-400 mt-0.5 w-5 shrink-0">${globalRowIdx}.</span>
                                                <div class="min-w-0 flex-1">
                                                    <div class="font-bold text-[12px] text-[#1E293B] truncate leading-tight" title="${esc(s.full_name)}">${esc(s.full_name)}</div>
                                                    <div class="flex flex-wrap items-center gap-1 mt-1 text-[9.5px] text-slate-400">
                                                        <span class="font-mono font-bold px-1 py-0.5 rounded bg-[#F1F5F9] text-slate-600 leading-none">${esc(s.class_name || '-')}</span>
                                                        ${!isSpecificSc ? `<span class="font-semibold truncate max-w-[95px] ${stuSubconc ? 'text-[#0082E6]' : 'text-[#E11D48]'}">${esc(stuSubconc || 'Tanpa subkon')}</span>` : ''}
                                                        ${compact ? `
                                                        ${s.project_drive_url
                                                            ? `<a href="${esc(s.project_drive_url)}" target="_blank" rel="noopener noreferrer" title="Buka Folder Google Drive" class="inline-flex items-center px-1.5 py-0.5 rounded bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white font-bold leading-none transition">📁</a>`
                                                            : ''}
                                                        ${stuCanEdit ? `<button type="button" onclick="editStudentDriveQuick('${s.id}', '${esc(s.full_name)}')" title="Ubah / Isi Link Drive" class="px-1 py-0.5 rounded bg-[#F3F6FB] hover:bg-[#E2E8F0] text-slate-500 font-bold leading-none cursor-pointer">✎</button>` : ''}
                                                        ${renderWhatsappLink(s.whatsapp_number, true, waText)}` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        ${compact ? '' : `
                                        <td class="py-1.5 px-2 text-center border-r border-[#F1F5F9]">
                                            <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F1F5F9] text-slate-600 whitespace-nowrap">${esc(s.class_name || '-')}</span>
                                        </td>`}
                                        <td class="py-1.5 px-2 border-r border-[#F1F5F9] num-tabular">
                                            <div class="flex items-center justify-between text-[10px] font-bold mb-0.5">
                                                <span class="${progPct === 100 ? 'text-[#15803D]' : 'text-slate-600'}">${doneCount}/${stuCols.length}</span>
                                                <span class="font-mono ${progPct === 100 ? 'text-[#15803D]' : 'text-slate-400'}">${progPct}%</span>
                                            </div>
                                            <div class="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/70">
                                                <div class="h-full rounded-full transition-all duration-300" style="width:${progPct}%;background:#4CAF50;"></div>
                                            </div>
                                        </td>
                                        ${compact ? '' : `
                                        <td class="py-1.5 px-2 border-r border-[#F1F5F9] truncate">
                                            ${renderWhatsappLink(s.whatsapp_number, false, waText)}
                                        </td>
                                        <td class="py-1.5 px-2 border-r border-[#F1F5F9]">
                                            <div class="flex items-center gap-1">
                                                ${s.project_drive_url
                                                    ? `<a href="${esc(s.project_drive_url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.project_drive_url)}" class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#EAF4FF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white text-[10px] font-bold transition whitespace-nowrap">📁 Drive ↗</a>`
                                                    : `<span class="text-[10px] text-slate-400 italic">Belum</span>`}
                                                ${stuCanEdit ? `<button type="button" onclick="editStudentDriveQuick('${s.id}', '${esc(s.full_name)}')" title="Ubah / isi Link Google Drive siswa" class="px-1.5 py-0.5 rounded bg-[#F3F6FB] hover:bg-[#E2E8F0] text-slate-500 text-[10px] font-bold cursor-pointer">✎</button>` : ''}
                                            </div>
                                        </td>
                                        <td class="py-1.5 px-2 text-[10.5px] text-slate-600 border-r border-[#F1F5F9] truncate">
                                            ${mentorObj ? `<span class="font-semibold">${esc(mentorObj.full_name)}</span>` : `<span class="text-slate-300">-</span>`}
                                        </td>`}
                                        ${activeCols.map((col) => {
                                            if (!stuColsSet.has(col)) return `<td class="py-1.5 px-1 text-center text-slate-200 border-r border-[#F1F5F9]">·</td>`;
                                            const stVal = normalizeChecklistStatus(rowData.items?.[col]);
                                            const stOpt = CHECKLIST_STATUS_OPTIONS.find((o) => o.value === stVal) || CHECKLIST_STATUS_OPTIONS[0];
                                            if (stuCanEdit) {
                                                return `
                                                    <td class="py-1.5 px-1 text-center border-r border-[#F1F5F9]">
                                                        <select onchange="updateChecklistCell('${s.id}', '${encodeURIComponent(col)}', this.value, this)"
                                                            class="w-[92px] max-w-full mx-auto block px-1.5 py-1 rounded-md border text-[11px] font-extrabold text-center cursor-pointer focus:outline-none ${stOpt.cls}">
                                                            ${CHECKLIST_STATUS_OPTIONS.map((o) => `<option value="${o.value}" ${stVal === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                                                        </select>
                                                    </td>`;
                                            }
                                            return `
                                                <td class="py-1.5 px-1.5 text-center border-r border-[#F1F5F9]">
                                                    <span class="inline-block min-w-[64px] px-2 py-1 rounded-md border text-[10.5px] font-extrabold ${stOpt.cls}">${stOpt.label}</span>
                                                </td>`;
                                        }).join('')}
                                        <td class="py-1.5 px-2.5">
                                            ${stuCanEdit ? `
                                                <div class="flex items-center gap-1.5">
                                                    <input id="ckNote_${s.id}" type="text" value="${esc(rowData.notes || '')}" placeholder="Tulis catatan PJ Subkon..."
                                                        onkeydown="if(event.key==='Enter'){saveChecklistNote('${s.id}');}"
                                                        class="flex-1 min-w-0 px-2.5 py-1.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg text-xs focus:bg-white focus:outline-none focus:border-[#0095FF]" />
                                                    <button type="button" onclick="saveChecklistNote('${s.id}', this)"
                                                        class="px-2.5 py-1.5 rounded-lg bg-[#0095FF] hover:bg-[#0082E6] text-white text-[10.5px] font-bold transition cursor-pointer shrink-0">
                                                        Simpan
                                                    </button>
                                                </div>` : `
                                                <div class="text-xs leading-snug ${rowData.notes ? 'text-slate-700' : 'text-slate-300 italic'}">${esc(rowData.notes || 'Belum ada catatan')}</div>`}
                                            ${rowData.updated_at ? `<div class="text-[9.5px] text-slate-400 mt-0.5">Update: ${esc(rowData.updated_by || 'PJ')} • ${esc(formatDateTime(rowData.updated_at))}</div>` : ''}
                                        </td>
                                    </tr>`;
                            };

                            return `
                        <table id="checklistMainTable" class="table-fixed text-left border-collapse text-xs" style="width: max(100%, ${tableMinPx}px);">
                            <colgroup>
                                <col style="width: 215px;" />
                                ${compact ? '' : '<col style="width: 74px;" />'}
                                <col style="width: 102px;" />
                                ${compact ? '' : '<col style="width: 112px;" /><col style="width: 112px;" /><col style="width: 115px;" />'}
                                ${activeCols.map(() => `<col style="width: ${stageColPx}px;" />`).join('')}
                                <col />
                            </colgroup>
                            <thead class="sticky top-0 z-20 shadow-[0_1px_0_#E2E8F0]">
                                <tr class="border-b border-[#E2E8F0] bg-[#F7FAFF] text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                    <th rowspan="2" class="ck-sticky-col py-2 px-2.5 sticky left-0 bg-[#F7FAFF] z-30 border-r border-[#DCE5F2]">Siswa</th>
                                    ${compact ? '' : '<th rowspan="2" class="py-2 px-2 text-center bg-[#F7FAFF] border-r border-[#EDF1F7]">Kelas</th>'}
                                    <th rowspan="2" class="py-2 px-2 bg-[#F7FAFF] border-r border-[#EDF1F7]">Progress</th>
                                    ${compact ? '' : `
                                    <th rowspan="2" class="py-2 px-2 bg-[#F7FAFF] border-r border-[#EDF1F7]">No. HP / WA</th>
                                    <th rowspan="2" class="py-2 px-2 bg-[#F7FAFF] border-r border-[#EDF1F7]">Link Drive</th>
                                    <th rowspan="2" class="py-2 px-2 bg-[#F7FAFF] border-r border-[#EDF1F7]">Pembimbing</th>`}
                                    <th id="checklistStatusGroupTh" colspan="${activeCols.length}" class="py-1.5 px-2 text-center bg-[#E3F6F3] text-[#1D5E55] border-b border-r border-[#BBE9E2]">STATUS</th>
                                    <th rowspan="2" class="py-2 px-2.5 bg-[#F7FAFF]">Notes / Catatan PJ</th>
                                </tr>
                                <tr class="border-b border-[#E2E8F0] bg-[#F2FBF9] text-[10px] font-bold text-[#1D5E55]">
                                    ${activeCols.map((col, ci) => `
                                        <th class="py-1.5 px-1.5 text-center bg-[#F2FBF9] border-r border-[#DCEEEB] leading-tight">
                                            <div class="inline-flex items-center justify-center gap-1 max-w-full">
                                                <span class="line-clamp-2" title="${esc(col)}">${esc(col)}</span>
                                                ${canEditActiveSc && isSpecificSc ? `<button type="button" onclick="renameChecklistColumn('${esc(activeSc)}', ${ci})" title="Ubah nama tahapan ini" class="text-[#1D5E55]/60 hover:text-[#0082E6] text-[10px] cursor-pointer shrink-0">✎</button>` : ''}
                                            </div>
                                        </th>`).join('')}
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-[#F1F5F9]">
                                ${orderedGroups.length ? orderedGroups.map((grp) => `
                                    ${grp.label ? `
                                    <tr class="bg-[#F0F7FF] border-t border-b border-[#DCEBFF]">
                                        <td class="ck-sticky-col sticky left-0 z-10 bg-[#F0F7FF] py-1.5 px-2.5 font-extrabold text-[11px] text-[#0082E6] border-r border-[#DCEBFF]">
                                            📌 ${esc(grp.label)} (${grp.rows.length})
                                        </td>
                                        <td colspan="${totalColSpan - 1}" class="py-1.5 px-2.5 text-[10.5px] text-slate-500">
                                            ${SUBCONCS.includes(grp.label) ? `<button type="button" onclick="setChecklistSubconc('${esc(grp.label)}')" class="font-bold text-[#0082E6] hover:underline cursor-pointer">Buka tab khusus ${esc(grp.label)} →</button>` : ''}
                                        </td>
                                    </tr>` : ''}
                                    ${grp.rows.map(renderStudentRow).join('')}
                                `).join('') : `<tr><td colspan="${totalColSpan}" class="p-8 text-center text-slate-400">${isUnassignedTab ? 'Semua siswa sudah memiliki Sub-Konsentrasi ✓' : 'Belum ada siswa pada Sub-Konsentrasi ini. Begitu siswa memiliki Sub-Konsentrasi di menu Plotting, barisnya akan muncul otomatis di sini.'}</td></tr>`}
                            </tbody>
                        </table>`;
                        })()}
                    </div>
                </div>`;
            initChecklistScrollSync();
        }
        global.renderProjectUpdateView = renderProjectUpdateView;

        global.setProjectViewMode = function (mode) {
            if (mode === 'checklist') {
                global.switchTab('project-update');
                return;
            }
            if (mode === 'weekly') mode = 'tasks';
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

        global.toggleClassAccordion = function (encodedCls) {
            const cls = decodeURIComponent(encodedCls || '');
            if (!cls) return;
            if (projectClassesState.openClasses.has(cls)) projectClassesState.openClasses.delete(cls);
            else projectClassesState.openClasses.add(cls);
            renderProjectTrackerBody();
        };

        global.setProjectClassesSearch = function (q) {
            projectClassesState.search = q || '';
            renderProjectTrackerBody();
            const inp = document.getElementById('projClassesSearchInp');
            if (inp) { inp.focus(); inp.setSelectionRange(q.length, q.length); }
        };

        global.setProjectClassesMentor = function (mId) {
            projectClassesState.mentorId = mId || '';
            renderProjectTrackerBody();
        };

        global.shiftProjectCalendarMonth = function (delta) {
            const dt = new Date(projectCalendarState.year, projectCalendarState.month + delta, 1);
            projectCalendarState.year = dt.getFullYear();
            projectCalendarState.month = dt.getMonth();
            renderProjectTrackerBody();
        };

        global.resetProjectCalendarMonth = function () {
            const n = new Date();
            projectCalendarState.year = n.getFullYear();
            projectCalendarState.month = n.getMonth();
            renderProjectTrackerBody();
        };

        global.jumpToCalendarTask = function (taskId) {
            projectViewMode = 'tasks';
            expandedProjectIds.clear();
            expandedProjectIds.add(taskId);
            projectReviewState.status = 'all';
            projectReviewState.page = 1;
            renderProjectTrackerBody();
        };

        global.openProofAnnotator = function (taskId, studentId) {
            const { allTasks = [], subMap = {}, studentList = [], allStudentsList = [] } = projectDataCache;
            const ps = subMap[`${taskId}__${studentId}`];
            if (!ps?.proof_image) { showToast('Siswa belum melampirkan gambar bukti pada tugas ini.'); return; }
            const t = allTasks.find((x) => x.id === taskId);
            const s = studentList.find((x) => x.id === studentId) || allStudentsList.find((x) => x.id === studentId);
            openImageAnnotatorModal(ps.proof_image, `${t?.title || 'Bukti Tugas'} — ${s?.full_name || 'Siswa'}`, (annotatedDataUrl) => {
                global.openRevisionComposerModal(taskId, studentId, annotatedDataUrl);
            });
        };

        global.openStudentParentLink = function (studentId) {
            const { studentList = [], allStudentsList = [] } = projectDataCache;
            const stu = studentList.find((s) => s.id === studentId) || allStudentsList.find((s) => s.id === studentId);
            if (!stu) { showToast('Data siswa tidak ditemukan.'); return; }
            openParentWatchLinkModal(stu);
        };

        global.openStaffLeaderboard = function () {
            openLeaderboardModal(projectDataCache.studentList || [], projectDataCache.allTasks || [], projectDataCache.subMap || {});
        };

        global.openShowcaseGallery = function () {
            openShowcaseGalleryModal(currentUser);
        };

        global.openStudentFlowchart = function (studentId) {
            const { allTasks = [], subMap = {}, studentList = [], allStudentsList = [], mentorsList = [], fbLogMap = {} } = projectDataCache;
            const stu = studentList.find((s) => s.id === studentId) || allStudentsList.find((s) => s.id === studentId);
            if (!stu) { showToast('Data siswa tidak ditemukan.'); return; }
            const mentorObj = stu.mentor_id ? mentorsList.find((m) => m.id === stu.mentor_id) : null;
            openStudentFlowchartModal(stu, allTasks, subMap, mentorObj, fbLogMap[stu.id] || []);
        };

        function buildStaffReportCtx() {
            const { allTasks = [], subMap = {}, mentorsList = [], fbLogMap = {}, checklistColsMap = {}, checklistRowMap = {} } = projectDataCache;
            return {
                tasks: allTasks,
                subMap,
                mentorMap: Object.fromEntries(mentorsList.map((m) => [m.id, m])),
                fbLogMap,
                checklistColsMap,
                checklistRowMap
            };
        }

        global.printStudentReportPdf = function (studentId) {
            const { studentList = [], allStudentsList = [] } = projectDataCache;
            const stu = studentList.find((s) => s.id === studentId) || allStudentsList.find((s) => s.id === studentId);
            if (!stu) { showToast('Data siswa tidak ditemukan.'); return; }
            printStudentsReportPdf([stu], buildStaffReportCtx(), `Rapor Jurnal — ${stu.full_name} (${stu.class_name || '-'})`);
        };

        global.printAllStudentsReportPdf = function (encodedCls) {
            const clsName = decodeURIComponent(encodedCls || '').trim();
            const pool = (projectDataCache.studentList || []).filter((s) => {
                if (!clsName) return true;
                return (s.class_name || 'Tanpa Kelas') === clsName;
            });
            if (!pool.length) { showToast('Tidak ada siswa untuk dicetak.'); return; }
            if (pool.length > 25 && !confirm(`Cetak PDF Rapor sekaligus untuk ${pool.length} siswa${clsName ? ` (Kelas ${clsName})` : ''}?`)) return;
            const title = clsName ? `Rapor Jurnal Kelas ${clsName} — AniTrack` : `Rapor Jurnal Semua Siswa (${pool.length}) — AniTrack`;
            printStudentsReportPdf(pool, buildStaffReportCtx(), title);
        };

        global.openProjectKpiModal = function (type) {
            const { allTasks = [], subMap = {}, studentList = [], mentorsList = [], fbLogMap = {} } = projectDataCache;
            const mentorMap = Object.fromEntries(mentorsList.map((m) => [m.id, m]));
            const enriched = studentList.map((s) => ({
                s,
                st: computeStudentIssueStats(s, allTasks, subMap),
                mentor: s.mentor_id ? mentorMap[s.mentor_id] : null
            }));

            let title = 'Detail Siswa';
            let subtitle = '';
            let accentCls = 'text-[#0082E6]';
            let list = [];

            if (type === 'gold') {
                title = '🌟 Daftar Peraih Lencana Emas';
                subtitle = 'Siswa yang menuntaskan tugas project lebih cepat dari tenggat deadline.';
                accentCls = 'text-[#B88600]';
                list = enriched.filter((x) => x.st.goldCount > 0).sort((a, b) => b.st.goldCount - a.st.goldCount);
            } else if (type === 'early_warning') {
                title = '🚨 Peringatan Dini — Siswa Butuh Pembinaan Segera';
                subtitle = 'Siswa dengan akumulasi ≥ 2 poin masalah (terlambat deadline / revisi berulang).';
                accentCls = 'text-[#E11D48]';
                list = enriched.filter((x) => x.st.totalIssues >= 2).sort((a, b) => b.st.totalIssues - a.st.totalIssues);
            } else {
                title = '⚠️ Daftar Siswa Bermasalah';
                subtitle = 'Siswa yang memiliki catatan keterlambatan deadline atau revisi tugas project.';
                accentCls = 'text-[#E11D48]';
                list = enriched.filter((x) => x.st.totalIssues > 0).sort((a, b) => b.st.totalIssues - a.st.totalIssues);
            }

            let modal = document.getElementById('anitrackKpiDetailModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'anitrackKpiDetailModal';
                modal.className = 'fixed inset-0 z-[81] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4';
                modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
                modal.innerHTML = `
                    <div class="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#EDF1F7]">
                        <div class="px-5 py-4 border-b border-[#EDF1F7] bg-[#F7FAFF] flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <div id="kpiModalTitle" class="text-base font-extrabold"></div>
                                <div id="kpiModalSub" class="text-xs text-slate-500 mt-0.5"></div>
                            </div>
                            <button type="button" onclick="document.getElementById('anitrackKpiDetailModal').classList.add('hidden')"
                                class="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#FFF1F5] text-slate-600 hover:text-[#F13B6E] font-bold text-sm cursor-pointer shrink-0">✕</button>
                        </div>
                        <div id="kpiModalBody" class="p-4 max-h-[70vh] overflow-y-auto space-y-2.5 text-xs bg-[#FAFBFD]"></div>
                    </div>`;
                document.body.appendChild(modal);
            }

            const titleEl = document.getElementById('kpiModalTitle');
            titleEl.className = `text-base font-extrabold ${accentCls}`;
            titleEl.textContent = `${title} (${list.length} Siswa)`;
            document.getElementById('kpiModalSub').textContent = subtitle;

            const body = document.getElementById('kpiModalBody');
            if (!list.length) {
                body.innerHTML = `<div class="p-8 text-center text-slate-400">Tidak ada siswa pada kategori ini.</div>`;
            } else {
                body.innerHTML = list.map(({ s, st, mentor }) => {
                    const pct = st.eligibleCount ? Math.round((st.accCount / st.eligibleCount) * 100) : 0;
                    const logsCnt = (fbLogMap[s.id] || []).length;
                    const waMsg = type === 'gold'
                        ? `Selamat ${s.full_name}! Kamu meraih ${st.goldCount} Lencana Emas di AniTrack. Pertahankan prestasimu!`
                        : `Halo ${s.full_name}, terpantau di AniTrack ada ${st.totalIssues} catatan masalah (${st.detailText}). Yuk segera koordinasi dan selesaikan tugas project-mu ya.`;
                    return `
                        <div class="rounded-xl bg-white border ${type === 'gold' ? 'border-[#FDE68A]' : 'border-[#FECDD6]'} p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div class="space-y-1 min-w-0">
                                <div class="flex flex-wrap items-center gap-1.5">
                                    <span class="font-extrabold text-[#1E293B] text-xs sm:text-sm">${esc(s.full_name)}</span>
                                    <span class="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1F5F9] text-slate-600">${esc(s.class_name || '-')}</span>
                                    <span class="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#EAF4FF] text-[#0082E6]">${esc(s.sub_concentration || 'Umum')}</span>
                                    ${type === 'gold'
                                        ? `<span class="text-[10.5px] font-extrabold px-2 py-0.5 rounded bg-[#FFF6D6] text-[#9A6F00]">🌟 ${st.goldCount} Lencana Emas</span>`
                                        : `<span class="text-[10.5px] font-extrabold px-2 py-0.5 rounded bg-[#FFF0F4] text-[#E11D48]">⚠️ ${st.totalIssues} Poin Masalah</span>`}
                                </div>
                                <div class="text-[11px] text-slate-500">
                                    Ketuntasan: <strong>${st.accCount}/${st.eligibleCount} (${pct}%)</strong>
                                    ${mentor ? ` • Pembimbing: <strong>${esc(mentor.full_name)}</strong>` : ''}
                                    ${type !== 'gold' && st.detailText ? `<div class="text-[#BE123C] mt-0.5">${esc(st.detailText)}</div>` : ''}
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                                ${renderWhatsappLink(s.whatsapp_number, true, waMsg)}
                                <button type="button" onclick="openStudentFlowchart('${s.id}')"
                                    class="px-2.5 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#4F46E5] text-[#4F46E5] hover:text-white text-[11px] font-bold transition cursor-pointer">🗺️ Flowchart</button>
                                <button type="button" onclick="openStudentParentLink('${s.id}')"
                                    class="px-2.5 py-1.5 rounded-lg bg-[#FFF6D6] hover:bg-[#F7C200] text-[#9A6F00] hover:text-white text-[11px] font-bold transition cursor-pointer">👨‍👩‍👧 Ortu</button>
                                ${logsCnt ? `<button type="button" onclick="openStudentFeedbackHistory('${s.id}')" class="px-2.5 py-1.5 rounded-lg bg-[#F7FAFF] hover:bg-[#0095FF] text-[#0082E6] hover:text-white border border-[#DCEBFF] text-[11px] font-bold transition cursor-pointer">📜 (${logsCnt})</button>` : ''}
                                <button type="button" onclick="printStudentReportPdf('${s.id}')"
                                    class="px-2.5 py-1.5 rounded-lg bg-[#E2F5F2] hover:bg-[#4CB6A7] text-[#1D5E55] hover:text-white text-[11px] font-bold transition cursor-pointer">🖨️ PDF</button>
                            </div>
                        </div>`;
                }).join('');
            }
            modal.classList.remove('hidden');
        };

        // ==================== MODAL CATATAN REVISI BERGAMBAR (CTRL+V / DRAG & DROP / PICK) ====================
        let revComposerState = { taskId: null, studentId: null, prevRev: 0, images: [] };

        function renderRevisionComposerPreviews() {
            const box = document.getElementById('revComposerPreviews');
            if (!box) return;
            if (!revComposerState.images.length) {
                box.innerHTML = `<div class="text-[11px] text-slate-400 italic">Belum ada gambar coretan dilampirkan.</div>`;
                return;
            }
            box.innerHTML = revComposerState.images.map((img, idx) => `
                <div class="relative group w-24 h-20 rounded-xl overflow-hidden border border-[#CBD5E1] bg-white shadow-xs shrink-0">
                    <img src="${esc(img.previewSrc)}" alt="Coretan ${idx + 1}" onclick="openProofLightbox(this.src, 'Lampiran Revisi #${idx + 1}')"
                        class="w-full h-full object-cover cursor-zoom-in" />
                    <button type="button" onclick="removeRevisionComposerImage(${idx})" title="Hapus gambar ini"
                        class="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#E11D48] text-white text-[10px] font-extrabold flex items-center justify-center shadow cursor-pointer">✕</button>
                </div>`).join('');
        }

        async function addRevisionComposerFiles(fileList) {
            const files = Array.from(fileList || []).filter((f) => f && f.type && f.type.startsWith('image/'));
            if (!files.length) return;
            const hint = document.getElementById('revComposerStatusHint');
            if (hint) hint.textContent = `Memproses ${files.length} gambar...`;
            for (const f of files) {
                if (revComposerState.images.length >= 4) {
                    showToast('Maksimal 4 lampiran gambar per catatan revisi.');
                    break;
                }
                try {
                    const dataUrl = await compressProofImage(f, 1100, 0.78);
                    revComposerState.images.push({
                        previewSrc: dataUrl,
                        dataUrl,
                        existingUrl: null,
                        name: f.name || `revisi_${Date.now()}.jpg`
                    });
                } catch (err) {
                    showToast(err.message || 'Gagal membaca gambar.');
                }
            }
            if (hint) hint.textContent = revComposerState.images.length ? `${revComposerState.images.length} gambar siap dilampirkan (Ctrl+V untuk tambah lagi).` : '';
            renderRevisionComposerPreviews();
        }

        global.removeRevisionComposerImage = function (idx) {
            revComposerState.images.splice(idx, 1);
            renderRevisionComposerPreviews();
        };

        global.handleRevisionComposerFiles = function (inputEl) {
            addRevisionComposerFiles(inputEl?.files);
            if (inputEl) inputEl.value = '';
        };

        global.openRevisionComposerModal = function (taskId, studentId, preAttachedDataUrl = null) {
            const { allTasks = [], subMap = {}, studentList = [], allStudentsList = [] } = projectDataCache;
            const taskObj = allTasks.find((t) => t.id === taskId);
            const stuObj = studentList.find((s) => s.id === studentId) || allStudentsList.find((s) => s.id === studentId);
            const ps = subMap[`${taskId}__${studentId}`] || {};
            const rawFb = String(ps.mentor_feedback || '');

            const existingImgs = [];
            const cleanText = rawFb.replace(/\[IMG:([^\]]+)\]/g, (_, url) => {
                const u = String(url || '').trim();
                if (u) existingImgs.push({ previewSrc: u, dataUrl: null, existingUrl: u, name: 'existing' });
                return '';
            }).trim();
            if (preAttachedDataUrl) {
                existingImgs.push({
                    previewSrc: preAttachedDataUrl,
                    dataUrl: preAttachedDataUrl,
                    existingUrl: null,
                    name: `coretan_${Date.now()}.jpg`
                });
            }

            revComposerState = {
                taskId,
                studentId,
                prevRev: Number(ps.revision_count || 0),
                images: existingImgs
            };

            let modal = document.getElementById('anitrackRevisionComposerModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'anitrackRevisionComposerModal';
                modal.className = 'fixed inset-0 z-[83] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4';
                modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
                modal.innerHTML = `
                    <div class="relative max-w-xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#EDF1F7]">
                        <div class="px-5 py-4 border-b border-[#EDF1F7] bg-[#FFF5F7] flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <div class="text-[10.5px] font-extrabold uppercase tracking-wider text-[#E11D48]">🖼️ Catatan Revisi &amp; Lampiran Gambar Coretan</div>
                                <div id="revComposerTitle" class="text-sm sm:text-base font-extrabold text-[#1E293B] truncate mt-0.5"></div>
                                <div id="revComposerSub" class="text-xs text-slate-500 truncate"></div>
                            </div>
                            <button type="button" onclick="document.getElementById('anitrackRevisionComposerModal').classList.add('hidden')"
                                class="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#FFF1F5] text-slate-600 hover:text-[#F13B6E] font-bold text-sm cursor-pointer shrink-0">✕</button>
                        </div>
                        <div class="p-5 space-y-4 text-xs">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-[11px] font-bold text-slate-600 mb-1">Status Tugas</label>
                                    <select id="revComposerStatus" class="w-full px-3 py-2 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:border-[#0095FF]">
                                        <option value="revisi">Perlu Revisi (Kirim Coretan)</option>
                                        <option value="selesai">Selesai (ACC Guru)</option>
                                        <option value="menunggu_review">Menunggu Review</option>
                                        <option value="sedang_dikerjakan">Sedang Dikerjakan</option>
                                    </select>
                                </div>
                                <div class="flex items-end">
                                    <div id="revComposerRevInfo" class="w-full px-3 py-2 rounded-xl bg-[#FAFBFD] border border-[#EDF1F7] text-[11px] text-slate-500"></div>
                                </div>
                            </div>

                            <div>
                                <label class="block text-[11px] font-bold text-slate-600 mb-1">Catatan Revisi / Feedback Guru <span class="text-slate-400 font-normal">(Bisa langsung tekan Ctrl+V gambar screenshot di sini!)</span></label>
                                <textarea id="revComposerText" rows="4"
                                    placeholder="Tulis catatan perbaikan untuk siswa, lalu tekan Ctrl+V untuk menempel screenshot coretan..."
                                    class="w-full px-3.5 py-2.5 bg-[#F7F9FC] border border-[#E2E8F0] rounded-xl text-xs text-[#1E293B] focus:bg-white focus:outline-none focus:border-[#0095FF]"></textarea>
                            </div>

                            <div id="revComposerDropZone"
                                class="rounded-xl border-2 border-dashed border-[#CBD5E1] hover:border-[#0095FF] bg-[#F8FBFF] p-4 text-center space-y-2 transition">
                                <div class="text-xs font-bold text-[#1E293B]">📋 Tempel (<kbd class="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Ctrl+V</kbd>), Tarik &amp; Lepas Gambar, atau Pilih File</div>
                                <div class="flex flex-wrap items-center justify-center gap-2">
                                    <label class="px-3 py-1.5 rounded-lg bg-[#0095FF] hover:bg-[#0082E6] text-white text-[11px] font-bold cursor-pointer transition">
                                        📷 Pilih Gambar Coretan
                                        <input type="file" accept="image/*" multiple class="hidden" onchange="handleRevisionComposerFiles(this)" />
                                    </label>
                                    <span id="revComposerStatusHint" class="text-[11px] text-slate-500"></span>
                                </div>
                                <div id="revComposerPreviews" class="flex flex-wrap items-center justify-center gap-2.5 pt-2"></div>
                            </div>

                            <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#EDF1F7]">
                                <button type="button" onclick="document.getElementById('anitrackRevisionComposerModal').classList.add('hidden')"
                                    class="px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 text-xs font-bold cursor-pointer">Batal</button>
                                <button type="button" id="revComposerSaveBtn" onclick="submitRevisionComposer(this)"
                                    class="px-5 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-extrabold shadow-sm transition cursor-pointer">
                                    💾 Simpan Catatan &amp; Lampiran
                                </button>
                            </div>
                        </div>
                    </div>`;
                document.body.appendChild(modal);

                modal.addEventListener('paste', (e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    const imgs = [];
                    for (const it of items) {
                        if (it.kind === 'file' && it.type.startsWith('image/')) {
                            const f = it.getAsFile();
                            if (f) imgs.push(f);
                        }
                    }
                    if (imgs.length) {
                        e.preventDefault();
                        addRevisionComposerFiles(imgs);
                    }
                });

                const dz = modal.querySelector('#revComposerDropZone');
                dz.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dz.classList.add('border-[#0095FF]', 'bg-[#EAF4FF]');
                });
                dz.addEventListener('dragleave', () => {
                    dz.classList.remove('border-[#0095FF]', 'bg-[#EAF4FF]');
                });
                dz.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dz.classList.remove('border-[#0095FF]', 'bg-[#EAF4FF]');
                    addRevisionComposerFiles(e.dataTransfer?.files);
                });
            }

            document.getElementById('revComposerTitle').textContent = taskObj?.title || 'Tugas Project';
            document.getElementById('revComposerSub').textContent = stuObj ? `${stuObj.full_name} • ${stuObj.class_name || '-'} • ${stuObj.sub_concentration || 'Umum'}` : '';
            document.getElementById('revComposerStatus').value = ps.status === 'selesai' ? 'selesai' : 'revisi';
            document.getElementById('revComposerText').value = cleanText;
            document.getElementById('revComposerRevInfo').textContent = revComposerState.prevRev > 0
                ? `Riwayat revisi sebelumnya: ${revComposerState.prevRev}×`
                : 'Belum ada revisi sebelumnya';
            document.getElementById('revComposerStatusHint').textContent = existingImgs.length
                ? `${existingImgs.length} gambar tersimpan sebelumnya.`
                : 'Otomatis masuk Google Drive (jika terhubung) atau tersimpan aman di database.';
            renderRevisionComposerPreviews();
            modal.classList.remove('hidden');
            setTimeout(() => document.getElementById('revComposerText')?.focus(), 80);
        };

        global.submitRevisionComposer = async function (btn) {
            const { taskId, studentId, prevRev, images } = revComposerState;
            if (!taskId || !studentId) return;
            const stVal = document.getElementById('revComposerStatus')?.value || 'revisi';
            const textVal = (document.getElementById('revComposerText')?.value || '').trim();
            const nextRev = stVal === 'revisi' ? prevRev + 1 : prevRev;
            const nowIso = new Date().toISOString();

            if (btn) { btn.disabled = true; btn.textContent = 'Mengunggah & menyimpan...'; }

            const finalUrls = [];
            const hasGas = Boolean(getGasUrl());
            const taskObj = (projectDataCache.allTasks || []).find((t) => t.id === taskId);
            const stuObj = (projectDataCache.studentList || []).find((s) => s.id === studentId) || (projectDataCache.allStudentsList || []).find((s) => s.id === studentId);

            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (img.existingUrl) {
                    finalUrls.push(img.existingUrl);
                    continue;
                }
                let savedUrl = img.dataUrl;
                if (hasGas && img.dataUrl && img.dataUrl.includes(',')) {
                    try {
                        const base64Data = img.dataUrl.split(',')[1];
                        const safeName = `Revisi_${(stuObj?.full_name || 'Siswa').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}_${i + 1}.jpg`;
                        const res = await postToGas({
                            action: 'upload_revisi_image',
                            base64Data,
                            mimeType: 'image/jpeg',
                            fileName: safeName
                        });
                        if (res && res.ok && res.imageUrl) savedUrl = res.imageUrl;
                    } catch {
                        // Fallback otomatis ke Data URL terkompresi jika Drive belum di-redeploy
                    }
                }
                if (savedUrl) finalUrls.push(savedUrl);
            }

            const imgTags = finalUrls.map((u) => `[IMG:${u}]`).join('\n');
            const combinedFb = [textVal, imgTags].filter(Boolean).join('\n').trim();

            const { error } = await supabase.from('project_submissions').upsert({
                project_task_id: taskId,
                student_id: studentId,
                status: stVal,
                mentor_feedback: combinedFb || null,
                revision_count: nextRev,
                reviewed_by: currentUser.id,
                updated_at: nowIso
            }, { onConflict: 'project_task_id,student_id' });

            if (!error && (combinedFb || stVal === 'revisi' || stVal === 'selesai')) {
                await appendFeedbackLogEntry(studentId, {
                    at: nowIso,
                    task_id: taskId,
                    task_title: taskObj?.title || 'Tugas Project',
                    status: stVal,
                    revision_no: nextRev,
                    feedback: combinedFb || (stVal === 'selesai' ? 'Tugas disetujui (ACC Selesai).' : 'Diminta revisi oleh pembimbing.'),
                    reviewer_name: currentUser.full_name || currentUser.username || 'Guru'
                });
            }

            if (btn) { btn.disabled = false; btn.textContent = '💾 Simpan Catatan & Lampiran'; }
            if (error) {
                showToast(`Gagal menyimpan catatan revisi: ${error.message}`);
                return;
            }
            document.getElementById('anitrackRevisionComposerModal')?.classList.add('hidden');
            showToast(`Catatan revisi${finalUrls.length ? ` + ${finalUrls.length} gambar` : ''} tersimpan ✓`);
            loadProjectTracker();
        };

        // ==================== PAPAN PENGUMUMAN GLOBAL (ADMIN BROADCAST) ====================
        global.openGlobalAnnouncementModal = function () {
            const modal = document.getElementById('adminBroadcastModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            setTimeout(() => document.getElementById('globalAnnouncementInput')?.focus(), 60);
        };

        global.saveGlobalAnnouncementUi = async function (btn) {
            if (!isAnyAdmin(currentUser)) {
                showToast('Hanya Admin / Superadmin yang dapat mengatur pengumuman global.');
                return;
            }
            const inp = document.getElementById('globalAnnouncementInput');
            const fb = document.getElementById('globalAnnouncementFeedback');
            const text = (inp?.value || '').trim();
            if (btn) { btn.disabled = true; btn.textContent = 'Menyebarkan...'; }
            const { error } = await saveGlobalAnnouncement(text);
            if (btn) { btn.disabled = false; btn.textContent = '📢 Sebarkan'; }
            if (error) {
                showToast(`Gagal menyimpan pengumuman: ${error.message}`);
                return;
            }
            if (fb) {
                fb.textContent = text ? 'Pengumuman aktif disebarkan ✓' : 'Banner pengumuman dimatikan.';
                setTimeout(() => { if (fb) fb.textContent = ''; }, 3000);
            }
            document.getElementById('adminBroadcastModal')?.classList.add('hidden');
            showToast(text ? 'Pengumuman global aktif di semua portal ✓' : 'Banner pengumuman global dihapus.');
        };

        global.clearGlobalAnnouncementUi = async function (btn) {
            if (!isAnyAdmin(currentUser)) {
                showToast('Hanya Admin / Superadmin yang dapat menghapus pengumuman global.');
                return;
            }
            const inp = document.getElementById('globalAnnouncementInput');
            if (inp) inp.value = '';
            if (btn) btn.disabled = true;
            const { error } = await saveGlobalAnnouncement('');
            if (btn) btn.disabled = false;
            if (error) { showToast(`Gagal menghapus pengumuman: ${error.message}`); return; }
            document.getElementById('adminBroadcastModal')?.classList.add('hidden');
            showToast('Banner pengumuman global dihapus ✓');
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
            if (!isAnyAdmin(currentUser)) {
                showToast('Hanya Admin / Superadmin yang dapat menghapus arsip snapshot.');
                return;
            }
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
                            ${isAnyAdmin(currentUser) ? `
                            <button type="button" onclick="deleteProjectArchive('${encodeURIComponent(a.key)}')"
                                class="px-2.5 py-1.5 rounded-lg bg-[#FFF1F5] hover:bg-[#F13B6E] text-[#F13B6E] hover:text-white text-[11px] font-bold transition cursor-pointer">
                                Hapus
                            </button>` : ''}
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
            renderProjectUpdateView();
        };

        global.setChecklistClass = function (cls) {
            projectChecklistState.className = cls || '';
            renderProjectUpdateView();
        };

        global.setChecklistStatusFilter = function (st) {
            projectChecklistState.statusFilter = st || 'all';
            renderProjectUpdateView();
        };

        global.setChecklistSearch = function (q) {
            projectChecklistState.search = q || '';
            renderProjectUpdateView();
            const inp = document.getElementById('checklistSearchInp');
            if (inp) { inp.focus(); inp.setSelectionRange(q.length, q.length); }
        };

        global.toggleChecklistCompactCols = function () {
            projectChecklistState.compactCols = !projectChecklistState.compactCols;
            projectChecklistScrollPos.left = 0;
            renderProjectUpdateView();
        };

        function initChecklistScrollSync() {
            const topSc = document.getElementById('checklistTopScroll');
            const topInner = document.getElementById('checklistTopScrollInner');
            const navBar = document.getElementById('checklistNavBar');
            const mainSc = document.getElementById('checklistTableScroll');
            const tbl = document.getElementById('checklistMainTable');
            if (!mainSc || !tbl) return;

            const syncDimensions = () => {
                const needScroll = tbl.scrollWidth > mainSc.clientWidth + 4;
                if (topInner) topInner.style.width = `${tbl.scrollWidth}px`;
                if (navBar) navBar.classList.toggle('hidden', !needScroll);
                mainSc.classList.toggle('is-scrolled', mainSc.scrollLeft > 4);
                mainSc.classList.toggle('cursor-grab', needScroll);
            };

            syncDimensions();
            requestAnimationFrame(() => {
                syncDimensions();
                if (projectChecklistScrollPos.left) mainSc.scrollLeft = projectChecklistScrollPos.left;
                if (projectChecklistScrollPos.top) mainSc.scrollTop = projectChecklistScrollPos.top;
                if (topSc) topSc.scrollLeft = mainSc.scrollLeft;
                mainSc.classList.toggle('is-scrolled', mainSc.scrollLeft > 4);
            });

            // Jangan pasang listener ganda jika sudah terpasang pada elemen DOM yang sama
            if (mainSc.dataset.scrollBound === '1') return;
            mainSc.dataset.scrollBound = '1';

            let lockSync = false;
            if (topSc) {
                topSc.addEventListener('scroll', () => {
                    if (lockSync) return;
                    lockSync = true;
                    mainSc.scrollLeft = topSc.scrollLeft;
                    projectChecklistScrollPos.left = topSc.scrollLeft;
                    mainSc.classList.toggle('is-scrolled', mainSc.scrollLeft > 4);
                    lockSync = false;
                }, { passive: true });
            }
            mainSc.addEventListener('scroll', () => {
                projectChecklistScrollPos.left = mainSc.scrollLeft;
                projectChecklistScrollPos.top = mainSc.scrollTop;
                mainSc.classList.toggle('is-scrolled', mainSc.scrollLeft > 4);
                if (lockSync || !topSc) return;
                lockSync = true;
                topSc.scrollLeft = mainSc.scrollLeft;
                lockSync = false;
            }, { passive: true });

            if (typeof ResizeObserver !== 'undefined') {
                const ro = new ResizeObserver(() => syncDimensions());
                ro.observe(mainSc);
                ro.observe(tbl);
            }

            // Shift + Mouse Wheel untuk geser kanan/kiri mulus
            mainSc.addEventListener('wheel', (e) => {
                if (e.shiftKey && Math.abs(e.deltaY) > 0) {
                    e.preventDefault();
                    mainSc.scrollLeft += e.deltaY;
                }
            }, { passive: false });

            // Drag-to-pan yang tidak nyangkut (mouseup terikat ke window)
            let dragActive = false;
            let dragStartX = 0;
            let dragStartScroll = 0;
            const onMove = (e) => {
                if (!dragActive) return;
                mainSc.scrollLeft = dragStartScroll - (e.clientX - dragStartX);
            };
            const endDrag = () => {
                if (!dragActive) return;
                dragActive = false;
                mainSc.classList.remove('cursor-grabbing', 'select-none');
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', endDrag);
            };
            mainSc.addEventListener('mousedown', (e) => {
                if (e.button !== 0 || e.target.closest('select, input, button, a, label')) return;
                if (tbl.scrollWidth <= mainSc.clientWidth + 4) return;
                dragActive = true;
                dragStartX = e.clientX;
                dragStartScroll = mainSc.scrollLeft;
                mainSc.classList.add('cursor-grabbing', 'select-none');
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', endDrag);
            });
        }

        global.scrollChecklistTable = function (target) {
            const mainSc = document.getElementById('checklistTableScroll');
            if (!mainSc) return;
            if (target === 'start') {
                mainSc.scrollTo({ left: 0, behavior: 'smooth' });
            } else if (target === 'end') {
                mainSc.scrollTo({ left: mainSc.scrollWidth, behavior: 'smooth' });
            } else if (target === 'status') {
                const stTh = document.getElementById('checklistStatusGroupTh');
                const dest = stTh ? Math.max(0, stTh.offsetLeft - 240) : 360;
                mainSc.scrollTo({ left: dest, behavior: 'smooth' });
            } else if (typeof target === 'number') {
                mainSc.scrollBy({ left: target, behavior: 'smooth' });
            }
        };

        global.renameChecklistColumn = async function (subconc, idx) {
            const colsMap = { ...(projectDataCache.checklistColsMap || {}) };
            const cur = Array.isArray(colsMap[subconc]) ? [...colsMap[subconc]] : [...DEFAULT_CHECKLIST_COLS];
            const oldName = cur[idx];
            if (!oldName) return;
            const nextRaw = prompt(`Ubah nama tahapan "${oldName}" (${subconc}):`, oldName);
            if (nextRaw === null) return;
            const newName = nextRaw.trim();
            if (!newName || newName === oldName) return;
            if (cur.some((c, i) => i !== idx && c.toLowerCase() === newName.toLowerCase())) {
                showToast(`Tahapan "${newName}" sudah ada di ${subconc}.`);
                return;
            }
            cur[idx] = newName;
            colsMap[subconc] = cur;
            const { error } = await saveChecklistColsMap(colsMap);
            if (error) { showToast(`Gagal mengubah nama tahapan: ${error.message}`); return; }

            // Pindahkan status siswa dari nama kolom lama ke nama baru agar progres tidak hilang
            const rowMap = projectDataCache.checklistRowMap || {};
            const nowIso = new Date().toISOString();
            const affectedStudents = (projectDataCache.allStudentsList || []).filter((s) => s.sub_concentration === subconc && rowMap[s.id]?.items && rowMap[s.id].items[oldName] !== undefined);
            for (const s of affectedStudents) {
                const existing = rowMap[s.id];
                const nextItems = { ...(existing.items || {}) };
                nextItems[newName] = nextItems[oldName];
                delete nextItems[oldName];
                const nextRow = { ...existing, items: nextItems, updated_at: nowIso };
                rowMap[s.id] = nextRow;
                await supabase.from('app_settings').upsert({
                    key: `${CHECKLIST_ROW_PREFIX}${s.id}`,
                    value: JSON.stringify(nextRow),
                    updated_at: nowIso
                }, { onConflict: 'key' });
            }

            projectDataCache.checklistColsMap = colsMap;
            showToast(`Tahapan diubah: "${oldName}" → "${newName}" ✓`);
            renderProjectUpdateView();
        };

        global.moveChecklistColumn = async function (subconc, idx, delta) {
            const colsMap = { ...(projectDataCache.checklistColsMap || {}) };
            const cur = Array.isArray(colsMap[subconc]) ? [...colsMap[subconc]] : [...DEFAULT_CHECKLIST_COLS];
            const targetIdx = idx + delta;
            if (targetIdx < 0 || targetIdx >= cur.length) return;
            const [item] = cur.splice(idx, 1);
            cur.splice(targetIdx, 0, item);
            colsMap[subconc] = cur;
            const { error } = await saveChecklistColsMap(colsMap);
            if (error) { showToast(`Gagal mengurutkan kolom: ${error.message}`); return; }
            projectDataCache.checklistColsMap = colsMap;
            renderProjectUpdateView();
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
            renderProjectUpdateView();
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
            renderProjectUpdateView();
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
            renderProjectUpdateView();
        };

        global.updateChecklistCell = async function (studentId, encodedCol, newVal, selectEl) {
            const colName = decodeURIComponent(encodedCol || '');
            if (!studentId || !colName) return;
            const normVal = normalizeChecklistStatus(newVal);
            const stOpt = CHECKLIST_STATUS_OPTIONS.find((o) => o.value === normVal) || CHECKLIST_STATUS_OPTIONS[0];
            const rowMap = projectDataCache.checklistRowMap || {};
            const existing = rowMap[studentId] || { student_id: studentId, items: {}, notes: '' };
            const nextItems = { ...(existing.items || {}), [colName]: normVal };
            const nowIso = new Date().toISOString();
            const nextRow = {
                student_id: studentId,
                items: nextItems,
                notes: existing.notes || '',
                updated_by: currentUser.full_name || currentUser.username || 'PJ Subkon',
                updated_at: nowIso
            };

            if (selectEl) {
                selectEl.className = `w-full px-2 py-1.5 rounded-lg border text-[11px] font-extrabold text-center cursor-pointer focus:outline-none ${stOpt.cls}`;
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
            showToast(`Project Update "${colName}" → ${stOpt.label} ✓`);
            renderProjectUpdateView();
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
            renderProjectUpdateView();
        };

        global.editStudentDriveQuick = async function (studentId, studentName) {
            const stu = (projectDataCache.allStudentsList || []).find((s) => s.id === studentId);
            const cur = stu?.project_drive_url || '';
            const next = prompt(`Masukkan Link Folder Google Drive Project untuk ${studentName}:`, cur);
            if (next === null) return;
            const trimmed = next.trim();
            if (trimmed && !/^https?:\/\//i.test(trimmed)) {
                showToast('Link Google Drive harus diawali https://');
                return;
            }
            const { error } = await supabase.from('profiles').update({ project_drive_url: trimmed || null }).eq('id', studentId);
            if (error) { showToast(`Gagal menyimpan Link Drive: ${error.message}`); return; }
            if (stu) stu.project_drive_url = trimmed || null;
            const stuScoped = (projectDataCache.studentList || []).find((s) => s.id === studentId);
            if (stuScoped) stuScoped.project_drive_url = trimmed || null;
            showToast(`Link Google Drive ${studentName} diperbarui ✓`);
            renderProjectUpdateView();
            renderProjectTrackerBody();
        };

        global.downloadChecklistTemplateXlsx = function () {
            if (typeof global.XLSX === 'undefined') { showToast('Library Excel belum termuat.'); return; }
            const { allStudentsList = [], checklistColsMap = {}, checklistRowMap = {} } = projectDataCache;
            const statusText = Object.fromEntries(CHECKLIST_STATUS_OPTIONS.map((o) => [o.value, o.label]));
            const wb = global.XLSX.utils.book_new();
            const curTab = projectChecklistState.subconc;
            const subconcsToBuild = SUBCONCS.includes(curTab)
                ? [curTab]
                : (curTab === '__group_2d'
                    ? SUBCONCS.filter((sc) => sc.startsWith('2D'))
                    : (curTab === '__group_3d'
                        ? SUBCONCS.filter((sc) => sc.startsWith('3D'))
                        : SUBCONCS));

            subconcsToBuild.forEach((sc) => {
                const cols = checklistColsMap[sc] || DEFAULT_CHECKLIST_COLS;
                const scStudents = allStudentsList.filter((s) => s.sub_concentration === sc);
                let rows = [];
                if (scStudents.length) {
                    rows = scStudents.map((s, i) => {
                        const rd = checklistRowMap[s.id] || { items: {}, notes: '' };
                        const obj = {
                            No: i + 1,
                            'Nama Siswa': s.full_name,
                            Username: s.username || '',
                            Kelas: s.class_name || '',
                            'Link Google Drive': s.project_drive_url || ''
                        };
                        cols.forEach((c) => {
                            obj[c] = statusText[normalizeChecklistStatus(rd.items?.[c])] || 'None';
                        });
                        obj.Notes = rd.notes || '';
                        return obj;
                    });
                } else {
                    const sample = {
                        No: 1,
                        'Nama Siswa': 'CONTOH NAMA SISWA (Sesuaikan dengan database)',
                        Username: 'afido',
                        Kelas: 'X ANI A',
                        'Link Google Drive': 'https://drive.google.com/drive/folders/...'
                    };
                    cols.forEach((c, idx) => {
                        sample[c] = idx === 0 ? 'Done' : (idx === 1 ? 'WIP' : 'None');
                    });
                    sample.Notes = 'Catatan singkat PJ Sub-Konsentrasi (opsional)';
                    rows = [sample];
                }
                global.XLSX.utils.book_append_sheet(wb, makeWorksheet(rows), sc.slice(0, 31));
            });

            const guideRows = [
                { Kolom: 'Nama Siswa / Username', Wajib: 'YA', Keterangan: 'Dipakai sistem untuk mencocokkan akun siswa otomatis (jangan ubah Username).' },
                { Kolom: 'Kelas', Wajib: 'Info', Keterangan: 'Informasi kelas siswa (otomatis terisi).' },
                { Kolom: 'Link Google Drive', Wajib: 'Opsional', Keterangan: 'Jika diisi link https://..., otomatis memperbarui Link Folder Google Drive Project siswa.' },
                { Kolom: 'Kolom Tahapan (Idea & Konsep, Storyboard, dst.)', Wajib: 'YA', Keterangan: 'Isi status dengan salah satu: None, WIP, Revisi, atau Done.' },
                { Kolom: 'Notes', Wajib: 'Opsional', Keterangan: 'Catatan / masukan dari PJ Sub-Konsentrasi untuk siswa tersebut.' }
            ];
            global.XLSX.utils.book_append_sheet(wb, makeWorksheet(guideRows, [38, 12, 72]), 'Panduan Pengisian');

            const labelSlug = SUBCONCS.includes(curTab) ? curTab.replace(/\s+/g, '-') : 'Semua-Subkon';
            global.XLSX.writeFile(wb, `Format-ProjectUpdate-${labelSlug}-AniTrack.xlsx`);
            showToast('Template Format Excel Project Update berhasil diunduh ✓');
        };

        global.handleChecklistImportFile = async function (inp) {
            const file = inp?.files?.[0];
            if (!file) return;
            if (typeof global.XLSX === 'undefined') { showToast('Library Excel belum termuat.'); inp.value = ''; return; }
            try {
                const buf = await file.arrayBuffer();
                const wb = global.XLSX.read(buf, { type: 'array' });
                const { allStudentsList = [], checklistColsMap = {}, checklistRowMap = {} } = projectDataCache;
                const byName = Object.fromEntries(allStudentsList.map((s) => [(s.full_name || '').trim().toLowerCase(), s]));
                const byUser = Object.fromEntries(allStudentsList.map((s) => [(s.username || '').trim().toLowerCase(), s]));

                const normKey = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const updatesMap = new Map();

                wb.SheetNames.forEach((shName) => {
                    if (/panduan|guide/i.test(shName)) return;
                    const ws = wb.Sheets[shName];
                    const aoa = global.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                    if (!aoa.length) return;

                    // Deteksi header 1-baris (sheet 2D) atau 2-baris bertingkat (sheet 3D: R1 punya STATUS, R2 punya nama tahapan)
                    let headerRowIdx = 0;
                    for (let r = 0; r < Math.min(5, aoa.length); r++) {
                        const rowStr = (aoa[r] || []).map(normKey);
                        if (rowStr.some((c) => c === 'namasiswa' || c === 'nama')) { headerRowIdx = r; break; }
                    }
                    const h1 = aoa[headerRowIdx] || [];
                    const h2 = aoa[headerRowIdx + 1] || [];
                    const isTwoRowHeader = h1.some((c) => /status/i.test(String(c || ''))) && h2.some((c) => String(c || '').trim().length > 0 && !/^\d+(\.0)?$/.test(String(c || '').trim()));
                    const dataStart = isTwoRowHeader ? headerRowIdx + 2 : headerRowIdx + 1;
                    const maxCols = Math.max(h1.length, isTwoRowHeader ? h2.length : 0);
                    const headers = [];
                    for (let c = 0; c < maxCols; c++) {
                        const top = String(h1[c] || '').trim();
                        const sub = isTwoRowHeader ? String(h2[c] || '').trim() : '';
                        headers.push(sub || top);
                    }

                    const nameIdx = headers.findIndex((h) => ['namasiswa', 'nama', 'siswa'].includes(normKey(h)));
                    const userIdx = headers.findIndex((h) => ['username', 'user'].includes(normKey(h)));
                    const driveIdx = headers.findIndex((h) => normKey(h).includes('drive') || normKey(h).includes('linkgoogle'));
                    const notesIdx = headers.findIndex((h) => normKey(h).startsWith('note'));

                    if (nameIdx < 0 && userIdx < 0) return;

                    const ignoredCols = new Set([nameIdx, userIdx, driveIdx, notesIdx]);
                    const statusCols = [];
                    headers.forEach((h, idx) => {
                        if (ignoredCols.has(idx) || !h) return;
                        const nk = normKey(h);
                        if (['no', 'nis', 'nisn', 'kelas', 'nohp', 'nowa', 'hp', 'wa', 'whatsapp', 'progress', 'progres', 'pembimbing', 'subkonsentrasi', 'diupdateoleh'].includes(nk)) return;
                        statusCols.push({ idx, name: h });
                    });

                    for (let r = dataStart; r < aoa.length; r++) {
                        const row = aoa[r] || [];
                        const rawName = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
                        const rawUser = userIdx >= 0 ? String(row[userIdx] || '').replace(/^@/, '').trim().toLowerCase() : '';
                        if (!rawName && !rawUser) continue;
                        const stu = (rawUser && byUser[rawUser]) || (rawName && byName[rawName.toLowerCase()]);
                        if (!stu) continue;

                        const driveVal = driveIdx >= 0 ? String(row[driveIdx] || '').trim() : '';
                        const noteVal = notesIdx >= 0 ? String(row[notesIdx] || '').trim() : '';
                        const stuCols = (stu.sub_concentration && checklistColsMap[stu.sub_concentration]) || DEFAULT_CHECKLIST_COLS;
                        const colLookup = Object.fromEntries(stuCols.map((c) => [normKey(c), c]));

                        const items = {};
                        statusCols.forEach((sc) => {
                            const rawSt = String(row[sc.idx] || '').trim();
                            if (!rawSt) return;
                            const targetCol = colLookup[normKey(sc.name)] || sc.name;
                            items[targetCol] = normalizeChecklistStatus(rawSt);
                        });

                        const prev = updatesMap.get(stu.id) || { stu, driveUrl: '', items: {}, note: '' };
                        if (driveVal && /^https?:\/\//i.test(driveVal)) prev.driveUrl = driveVal;
                        if (noteVal) prev.note = noteVal;
                        Object.assign(prev.items, items);
                        updatesMap.set(stu.id, prev);
                    }
                });

                const matched = [...updatesMap.values()].filter((u) => u.driveUrl || u.note || Object.keys(u.items).length > 0);
                if (!matched.length) {
                    showToast('Tidak ada data siswa yang cocok dengan database pada file tersebut.');
                    inp.value = '';
                    return;
                }

                const driveCnt = matched.filter((m) => m.driveUrl).length;
                const statusCnt = matched.filter((m) => Object.keys(m.items).length > 0 || m.note).length;
                if (!confirm(`Ditemukan ${matched.length} siswa cocok dari "${file.name}":\n• ${driveCnt} Link Google Drive\n• ${statusCnt} data status / Notes\n\nImpor dan simpan ke Project Update sekarang?`)) {
                    inp.value = '';
                    return;
                }

                const nowIso = new Date().toISOString();
                const updaterName = currentUser.full_name || currentUser.username || 'Admin';
                showToast(`Mengimpor ${matched.length} data siswa...`);

                for (let i = 0; i < matched.length; i += 10) {
                    const chunk = matched.slice(i, i + 10);
                    await Promise.all(chunk.map(async (entry) => {
                        if (entry.driveUrl && entry.driveUrl !== entry.stu.project_drive_url) {
                            await supabase.from('profiles').update({ project_drive_url: entry.driveUrl }).eq('id', entry.stu.id);
                        }
                        if (Object.keys(entry.items).length > 0 || entry.note) {
                            const existing = checklistRowMap[entry.stu.id] || { items: {}, notes: '' };
                            const nextRow = {
                                student_id: entry.stu.id,
                                items: { ...(existing.items || {}), ...entry.items },
                                notes: entry.note || existing.notes || '',
                                updated_by: updaterName,
                                updated_at: nowIso
                            };
                            await supabase.from('app_settings').upsert({
                                key: `${CHECKLIST_ROW_PREFIX}${entry.stu.id}`,
                                value: JSON.stringify(nextRow),
                                updated_at: nowIso
                            }, { onConflict: 'key' });
                        }
                    }));
                }

                showToast(`${matched.length} data siswa berhasil diimpor ke Project Update ✓`);
                await loadProjectTracker();
            } catch (err) {
                showToast(`Gagal mengimpor spreadsheet: ${err.message || err}`);
            } finally {
                inp.value = '';
            }
        };

        global.exportChecklistXlsx = function () {
            if (typeof global.XLSX === 'undefined') { showToast('Library Excel belum termuat.'); return; }
            const { allStudentsList = [], checklistColsMap = {}, checklistRowMap = {}, mentorsList = [] } = projectDataCache;
            const mentorMap = Object.fromEntries(mentorsList.map((m) => [m.id, m.full_name]));
            const statusText = Object.fromEntries(CHECKLIST_STATUS_OPTIONS.map((o) => [o.value, o.label]));
            const wb = global.XLSX.utils.book_new();
            const curTab = projectChecklistState.subconc;
            const subconcsToExport = SUBCONCS.includes(curTab)
                ? [curTab]
                : (curTab === '__group_2d'
                    ? SUBCONCS.filter((sc) => sc.startsWith('2D'))
                    : (curTab === '__group_3d'
                        ? SUBCONCS.filter((sc) => sc.startsWith('3D'))
                        : SUBCONCS));

            subconcsToExport.forEach((sc) => {
                const cols = checklistColsMap[sc] || DEFAULT_CHECKLIST_COLS;
                const scStudents = allStudentsList.filter((s) => s.sub_concentration === sc);
                const rows = scStudents.map((s, i) => {
                    const rd = checklistRowMap[s.id] || { items: {}, notes: '' };
                    const doneCnt = cols.filter((c) => normalizeChecklistStatus(rd.items?.[c]) === 'done').length;
                    const pct = cols.length ? Math.round((doneCnt / cols.length) * 100) : 0;
                    const obj = {
                        No: i + 1,
                        'Nama Siswa': s.full_name,
                        Username: `@${s.username}`,
                        Kelas: s.class_name || '-',
                        'Sub-Konsentrasi': sc,
                        Progress: `${doneCnt}/${cols.length} (${pct}%)`,
                        'No. HP': formatWhatsappDisplay(s.whatsapp_number) || '-',
                        'Link Google Drive': s.project_drive_url || '-',
                        Pembimbing: (s.mentor_id && mentorMap[s.mentor_id]) || '-'
                    };
                    cols.forEach((c) => {
                        obj[c] = statusText[normalizeChecklistStatus(rd.items?.[c])] || 'None';
                    });
                    obj.Notes = rd.notes || '';
                    obj['Diupdate Oleh'] = rd.updated_by || '';
                    return obj;
                });
                global.XLSX.utils.book_append_sheet(wb, makeWorksheet(rows), sc.slice(0, 31));
            });

            const stamp = getJakartaYmd(new Date());
            global.XLSX.writeFile(wb, `Project-Update-AniTrack-${stamp}.xlsx`);
            showToast('File Excel Project Update diunduh ✓');
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
            if (!isAnyAdmin(currentUser)) {
                showToast('Hanya Admin / Superadmin yang dapat menghapus tugas project.');
                return;
            }
            if (!confirm('Hapus tugas project ini beserta seluruh data pengumpulannya?')) return;
            const { error } = await supabase.from('project_tasks').delete().eq('id', taskId);
            if (error) { showToast(`Gagal menghapus tugas: ${error.message}`); return; }
            await supabase.from('app_settings').delete().eq('key', `${PROJECT_FILES_PREFIX}${taskId}`);
            expandedProjectIds.delete(taskId);
            showToast('Tugas project dihapus.');
            loadProjectTracker();
        };

        // ==================== EDITOR MULTI-FILE PENAMAAN TUGAS PROJECT ====================
        const TASK_FILE_EXT_OPTIONS = ['.pdf', '.mp4', '.mov', '.png', '.jpg', '.blend', '.fbx', '.obj', '.aep', '.psd', '.ai', '.zip', '.wav', '.mp3', '.docx', '.pptx'];

        function renderTaskFilesEditorRows(task, items) {
            const rowsEl = document.getElementById('taskFilesEditorRows');
            if (!rowsEl) return;
            const stageTag = ({ 'Pre-Production': 'PreProd', 'Production': 'Prod', 'Post-Production': 'PostProd' })[task?.pipeline_stage] || 'Project';
            rowsEl.innerHTML = items.map((it, idx) => {
                const curExt = it.ext || '.pdf';
                const hasPreset = TASK_FILE_EXT_OPTIONS.includes(curExt);
                const slug = toSlugPascal(it.label || 'File', 4, 30);
                return `
                    <div class="tfe-row rounded-xl border border-[#E2E8F0] bg-[#FAFBFD] p-3 space-y-2">
                        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <span class="hidden sm:inline-flex w-6 h-6 rounded-md bg-[#EAF4FF] text-[#0082E6] font-mono text-[11px] font-extrabold items-center justify-center shrink-0">${idx + 1}</span>
                            <input type="text" value="${esc(it.label || '')}" placeholder="Nama / jenis file (mis: Storyline, Model3D, RenderScene01)"
                                oninput="updateTaskFilesEditorPreview()"
                                class="tfe-label flex-1 px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-semibold text-[#1E293B] focus:outline-none focus:border-[#0095FF]" />
                            <select onchange="updateTaskFilesEditorPreview()"
                                class="tfe-ext px-2.5 py-2 bg-white border border-[#E2E8F0] rounded-lg text-xs font-mono font-bold text-[#1E293B] focus:outline-none focus:border-[#0095FF]">
                                ${TASK_FILE_EXT_OPTIONS.map((ex) => `<option value="${ex}" ${curExt === ex ? 'selected' : ''}>${ex}</option>`).join('')}
                                ${!hasPreset ? `<option value="${esc(curExt)}" selected>${esc(curExt)}</option>` : ''}
                            </select>
                            <button type="button" onclick="removeTaskFilesEditorRow(this)" title="Hapus file ini"
                                class="px-2.5 py-2 rounded-lg bg-[#FFF0F4] hover:bg-[#F13B6E] text-[#E11D48] hover:text-white text-xs font-bold transition cursor-pointer shrink-0">✕</button>
                        </div>
                        <div class="text-[10.5px] font-mono text-slate-500 pl-0 sm:pl-8 truncate">
                            Preview: <strong class="tfe-preview text-[#0082E6]">[Kelas]_[NamaSiswa]_${stageTag}_${esc(slug)}${esc(curExt)}</strong>
                        </div>
                    </div>`;
            }).join('');
        }

        let activeTaskFilesEditorTask = null;

        global.updateTaskFilesEditorPreview = function () {
            if (!activeTaskFilesEditorTask) return;
            const stageTag = ({ 'Pre-Production': 'PreProd', 'Production': 'Prod', 'Post-Production': 'PostProd' })[activeTaskFilesEditorTask?.pipeline_stage] || 'Project';
            document.querySelectorAll('#taskFilesEditorRows .tfe-row').forEach((row) => {
                const lbl = row.querySelector('.tfe-label')?.value.trim() || 'File';
                const ext = row.querySelector('.tfe-ext')?.value || '.pdf';
                const prev = row.querySelector('.tfe-preview');
                if (prev) prev.textContent = `[Kelas]_[NamaSiswa]_${stageTag}_${toSlugPascal(lbl, 4, 30)}${ext}`;
            });
        };

        global.addTaskFilesEditorRow = function () {
            if (!activeTaskFilesEditorTask) return;
            const cur = Array.from(document.querySelectorAll('#taskFilesEditorRows .tfe-row')).map((row) => ({
                label: row.querySelector('.tfe-label')?.value || '',
                ext: row.querySelector('.tfe-ext')?.value || '.pdf'
            }));
            cur.push({ label: '', ext: detectSuggestedFileExt(activeTaskFilesEditorTask) });
            renderTaskFilesEditorRows(activeTaskFilesEditorTask, cur);
            const inputs = document.querySelectorAll('#taskFilesEditorRows .tfe-label');
            inputs[inputs.length - 1]?.focus();
        };

        global.removeTaskFilesEditorRow = function (btn) {
            const rows = document.querySelectorAll('#taskFilesEditorRows .tfe-row');
            if (rows.length <= 1) {
                showToast('Minimal harus ada 1 format file.');
                return;
            }
            btn.closest('.tfe-row')?.remove();
            const cur = Array.from(document.querySelectorAll('#taskFilesEditorRows .tfe-row')).map((row) => ({
                label: row.querySelector('.tfe-label')?.value || '',
                ext: row.querySelector('.tfe-ext')?.value || '.pdf'
            }));
            renderTaskFilesEditorRows(activeTaskFilesEditorTask, cur);
        };

        global.openTaskFilesEditor = function (taskId) {
            const task = (projectDataCache.allTasks || []).find((t) => t.id === taskId);
            if (!task) return;
            activeTaskFilesEditorTask = task;

            let modal = document.getElementById('taskFilesEditorModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'taskFilesEditorModal';
                modal.className = 'fixed inset-0 z-[82] hidden bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4';
                modal.onclick = (ev) => { if (ev.target === modal) modal.classList.add('hidden'); };
                document.body.appendChild(modal);
            }

            const existingCustom = projectDataCache.taskFilesMap?.[taskId] || null;
            const naming = buildProjectFileNaming(task, null, existingCustom);
            const initialItems = naming.files.map((f) => ({ label: f.label, ext: f.ext }));

            modal.innerHTML = `
                <div class="max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-[#EDF1F7] flex flex-col max-h-[88vh]">
                    <div class="px-5 py-4 border-b border-[#EDF1F7] bg-[#F7FAFF] flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-[10.5px] font-extrabold uppercase tracking-wider text-[#0082E6]">📝 Pengaturan Multi-File Penamaan Tugas</div>
                            <h3 class="text-sm sm:text-base font-extrabold text-[#1E293B] truncate">${esc(task.title)}</h3>
                            <p class="text-[11px] text-slate-500">Tambahkan semua file yang wajib dikumpulkan siswa untuk tugas ini (bisa 1, 2, 3, atau lebih).</p>
                        </div>
                        <button type="button" onclick="document.getElementById('taskFilesEditorModal').classList.add('hidden')"
                            class="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#FFF1F5] text-slate-600 hover:text-[#F13B6E] font-bold text-sm cursor-pointer shrink-0">✕</button>
                    </div>
                    <div class="p-5 overflow-y-auto space-y-3 flex-1">
                        <div id="taskFilesEditorRows" class="space-y-2.5"></div>
                        <button type="button" onclick="addTaskFilesEditorRow()"
                            class="w-full py-2.5 rounded-xl border-2 border-dashed border-[#CBE5FF] hover:border-[#0095FF] bg-[#F7FAFF] hover:bg-[#EAF4FF] text-[#0082E6] text-xs font-extrabold transition cursor-pointer">
                            + Tambah File Lain untuk Tugas Ini
                        </button>
                    </div>
                    <div class="px-5 py-3.5 border-t border-[#EDF1F7] bg-[#FAFBFD] flex flex-wrap items-center justify-between gap-2">
                        <button type="button" onclick="resetTaskFilesSpec('${task.id}')"
                            class="px-3 py-2 rounded-xl bg-white hover:bg-[#FFF0F4] border border-[#E2E8F0] text-slate-500 hover:text-[#E11D48] text-xs font-bold transition cursor-pointer">
                            ↻ Reset ke Otomatis
                        </button>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="document.getElementById('taskFilesEditorModal').classList.add('hidden')"
                                class="px-3.5 py-2 rounded-xl bg-[#F3F6FB] hover:bg-[#E2E8F0] text-slate-600 text-xs font-bold transition cursor-pointer">Batal</button>
                            <button type="button" onclick="saveTaskFilesEditor('${task.id}', this)"
                                class="px-4 py-2 rounded-xl bg-[#0095FF] hover:bg-[#0082E6] text-white text-xs font-bold shadow-blueGlow transition cursor-pointer">
                                💾 Simpan Format File
                            </button>
                        </div>
                    </div>
                </div>`;

            renderTaskFilesEditorRows(task, initialItems);
            modal.classList.remove('hidden');
        };

        global.saveTaskFilesEditor = async function (taskId, btn) {
            const items = Array.from(document.querySelectorAll('#taskFilesEditorRows .tfe-row')).map((row) => ({
                label: (row.querySelector('.tfe-label')?.value || '').trim(),
                ext: (row.querySelector('.tfe-ext')?.value || '.pdf').trim()
            })).filter((it) => it.label);

            if (!items.length) {
                showToast('Isi minimal 1 nama file terlebih dahulu.');
                return;
            }
            if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
            const nowIso = new Date().toISOString();
            const { error } = await supabase.from('app_settings').upsert({
                key: `${PROJECT_FILES_PREFIX}${taskId}`,
                value: JSON.stringify(items),
                updated_at: nowIso
            }, { onConflict: 'key' });
            if (btn) { btn.disabled = false; btn.textContent = '💾 Simpan Format File'; }
            if (error) { showToast(`Gagal menyimpan format file: ${error.message}`); return; }

            if (!projectDataCache.taskFilesMap) projectDataCache.taskFilesMap = {};
            projectDataCache.taskFilesMap[taskId] = items;
            document.getElementById('taskFilesEditorModal')?.classList.add('hidden');
            showToast(`Format penamaan (${items.length} file) berhasil disimpan ✓`);
            renderProjectTrackerBody();
        };

        global.resetTaskFilesSpec = async function (taskId) {
            const { error } = await supabase.from('app_settings').delete().eq('key', `${PROJECT_FILES_PREFIX}${taskId}`);
            if (error) { showToast(`Gagal mereset format file: ${error.message}`); return; }
            if (projectDataCache.taskFilesMap) delete projectDataCache.taskFilesMap[taskId];
            document.getElementById('taskFilesEditorModal')?.classList.add('hidden');
            showToast('Format penamaan dikembalikan ke otomatis ✓');
            renderProjectTrackerBody();
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
            const rawInlineVal = row.querySelector('.proj-fb').value.trim();
            const existingRawFb = String(projectDataCache.subMap?.[`${taskId}__${studentId}`]?.mentor_feedback || '');
            const existingImgTags = existingRawFb.match(/\[IMG:[^\]]+\]/g) || [];
            const cleanInlineText = rawInlineVal.replace(/\[Gambar Revisi\]/g, '').trim();
            const fbVal = (existingImgTags.length && !rawInlineVal.includes('[IMG:'))
                ? [cleanInlineText, ...existingImgTags].filter(Boolean).join('\n').trim()
                : rawInlineVal;
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
            const fileListRaw = (document.getElementById('projFileList')?.value || '').trim();

            if (!title) return;
            btn.disabled = true;
            btn.textContent = 'Menyimpan...';

            const { data: created, error } = await supabase.from('project_tasks').insert({
                title, pipeline_stage: stage, sub_concentration: subconc,
                due_date: dueDate, description: desc || null, created_by: currentUser.id
            }).select().single();

            if (!error && created?.id && fileListRaw) {
                const parsedFiles = parseFileSpecsInput(fileListRaw);
                if (parsedFiles.length) {
                    await supabase.from('app_settings').upsert({
                        key: `${PROJECT_FILES_PREFIX}${created.id}`,
                        value: JSON.stringify(parsedFiles),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });
                }
            }

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
                    'Daftar File (pisahkan koma)': 'Storyline.pdf, Treatment.pdf, Storyboard.pdf',
                    Deskripsi: 'Kumpulkan file PDF storyline, treatment, dan storyboard lengkap dengan durasi tiap scene.'
                },
                {
                    'Judul Tugas': 'Character Turnaround & Model Sheet',
                    'Tahap Pipeline': 'Pre-Production',
                    'Sub-Konsentrasi': '3D Modeller',
                    'Deadline (YYYY-MM-DD)': '2026-12-03',
                    'Daftar File (pisahkan koma)': 'ModelSheet.png, Turnaround.png',
                    Deskripsi: 'Tampak depan, samping, belakang karakter utama (PNG/JPG).'
                },
                {
                    'Judul Tugas': 'Blocking & Splining Animasi Scene 01-03',
                    'Tahap Pipeline': 'Production',
                    'Sub-Konsentrasi': '3D Animator',
                    'Deadline (YYYY-MM-DD)': '2026-12-12',
                    'Daftar File (pisahkan koma)': 'Scene01.mp4, Scene02.mp4, Scene03.mp4, ProjectFile.blend',
                    Deskripsi: 'Upload seluruh file playblast video dan file project animasi ke Drive.'
                },
                {
                    'Judul Tugas': 'Final Compositing, Sound & Render Master',
                    'Tahap Pipeline': 'Post-Production',
                    'Sub-Konsentrasi': 'Semua',
                    'Deadline (YYYY-MM-DD)': '2026-12-20',
                    'Daftar File (pisahkan koma)': 'FinalFilm.mp4, AudioMaster.wav, ProjectComp.aep',
                    Deskripsi: 'Pastikan color grading dan audio sinkron.'
                }
            ];

            const guideRows = [
                { Kolom: 'Judul Tugas', Wajib: 'YA', Keterangan: 'Nama tugas/milestone project yang harus dikerjakan siswa.' },
                { Kolom: 'Tahap Pipeline', Wajib: 'YA', Keterangan: 'Isi salah satu: Pre-Production, Production, atau Post-Production.' },
                { Kolom: 'Sub-Konsentrasi', Wajib: 'Opsional', Keterangan: 'Kosongkan atau isi "Semua" untuk seluruh siswa; atau pilih: 2D Animator, 2D Motion Graphic, 3D Animator, 3D Modeller, 3D Motion Graphic.' },
                { Kolom: 'Deadline (YYYY-MM-DD)', Wajib: 'Opsional', Keterangan: 'Format tanggal YYYY-MM-DD (misal 2026-12-15) atau DD/MM/YYYY, bisa juga langsung format Tanggal Excel.' },
                { Kolom: 'Daftar File (pisahkan koma)', Wajib: 'Opsional', Keterangan: 'Daftar nama & ekstensi file yang harus dikumpulkan (bisa lebih dari 1, pisahkan koma — misal: Storyline.pdf, Treatment.pdf, Storyboard.pdf).' },
                { Kolom: 'Deskripsi', Wajib: 'Opsional', Keterangan: 'Instruksi pengerjaan atau kriteria ACC.' }
            ];

            const wb = global.XLSX.utils.book_new();
            global.XLSX.utils.book_append_sheet(wb, makeWorksheet(sampleRows, [36, 18, 22, 22, 42, 48]), 'Tugas Project');
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
                        const filesRaw = pickRowField(row, ['daftar file (pisahkan koma)', 'daftar file', 'format file', 'files', 'nama file']);
                        const descRaw = pickRowField(row, ['deskripsi', 'instruksi', 'keterangan', 'description', 'catatan']);

                        parsed.push({
                            title,
                            pipeline_stage: normalizePipelineStage(stageRaw),
                            sub_concentration: normalizeSubConcentration(subRaw),
                            due_date: normalizeExcelDate(dueRaw),
                            description: String(descRaw || '').trim() || null,
                            created_by: currentUser.id,
                            _fileSpecs: parseFileSpecsInput(filesRaw)
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

            const insertPayload = pendingImportProjectRows.map(({ _fileSpecs, ...dbRow }) => dbRow);
            const { data: inserted, error } = await supabase
                .from('project_tasks')
                .insert(insertPayload)
                .select('id');

            if (!error && Array.isArray(inserted)) {
                const nowIso = new Date().toISOString();
                const fileUpserts = [];
                inserted.forEach((row, idx) => {
                    const specs = pendingImportProjectRows[idx]?._fileSpecs;
                    if (row?.id && Array.isArray(specs) && specs.length) {
                        fileUpserts.push({
                            key: `${PROJECT_FILES_PREFIX}${row.id}`,
                            value: JSON.stringify(specs),
                            updated_at: nowIso
                        });
                    }
                });
                if (fileUpserts.length) {
                    await supabase.from('app_settings').upsert(fileUpserts, { onConflict: 'key' });
                }
            }

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
            await Promise.all([loadGlobalAnnouncement(), refreshMetrics(), loadMaterials(), loadDailyTaskFeed(), loadProjectTracker(), extraRefresh()]);
            setTimeout(() => icon?.classList.remove('animate-spin'), 400);
        };

        function applyRoleRestrictionsUI() {
            const isSuper = isTrueSuperadmin(currentUser);
            document.querySelectorAll('[data-superadmin-only]').forEach((el) => {
                el.classList.toggle('hidden', !isSuper);
            });
            document.querySelectorAll('[data-non-superadmin-notice]').forEach((el) => {
                el.classList.toggle('hidden', isSuper);
            });
            const sbRoleLabel = document.getElementById('sidebarRoleSubLabel');
            if (sbRoleLabel) {
                sbRoleLabel.textContent = isSuper ? 'Superadmin' : (currentUser?.is_operational_admin ? 'Admin' : 'Pembimbing');
            }
        }

        // Boot
        paintProfile();
        applyRoleRestrictionsUI();
        updateMentorWaBanner();
        paintTabs();
        syncFreshProfile(currentUser.id, (fresh) => {
            currentUser = fresh;
            paintProfile();
            applyRoleRestrictionsUI();
            updateMentorWaBanner();
        });
        Promise.all([loadGlobalAnnouncement(), refreshMetrics(), loadMaterials(), loadDailyTaskFeed(), loadProjectTracker(), extraRefresh()]);

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
        ADMIN_ROLE_IDS_KEY,
        loadAdminRoleIds,
        saveAdminRoleIds,
        isTrueSuperadmin,
        isOperationalAdmin,
        isAnyAdmin,
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
        PROJECT_FILES_PREFIX,
        parseFileSpecsInput,
        parseTaskFilesMap,
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
        normalizeChecklistStatus,
        formatStudentProjectUpdateText,
        formatFeedbackWithImages,
        stripFeedbackImageTags,
        loadGlobalAnnouncement,
        saveGlobalAnnouncement,
        renderGlobalAnnouncementBanner,
        openStudentFlowchartModal,
        printStudentsReportPdf,
        initDarkMode,
        toggleDarkMode,
        openImageAnnotatorModal,
        PARENT_WATCH_PREFIX,
        PARENT_TOKEN_PREFIX,
        getTelegramShareUrl,
        openParentWatchLinkModal,
        updateNotificationCenter,
        openLeaderboardModal,
        printStudentCertificatePdf,
        openShowcaseGalleryModal,
        buildCalendarAndGanttHtml,
        openStudentCalendarModal,
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
