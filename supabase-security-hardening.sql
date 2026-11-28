-- ============================================================================
-- ANITRACK SMKN 4 MALANG — SECURITY HARDENING (BCRYPT + SESSION TOKEN + RLS)
-- Jalankan 1x di Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Aman dijalankan ulang (idempotent).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==================== 1. AUTO-HASH PASSWORD (BCRYPT) ====================
CREATE OR REPLACE FUNCTION public.anitrack_hash_password_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NEW.pin_or_password IS NOT NULL
       AND length(trim(NEW.pin_or_password)) > 0
       AND NEW.pin_or_password !~ '^\$2[aby]\$' THEN
        NEW.pin_or_password := extensions.crypt(NEW.pin_or_password, extensions.gen_salt('bf', 10));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anitrack_hash_password ON public.profiles;
CREATE TRIGGER trg_anitrack_hash_password
BEFORE INSERT OR UPDATE OF pin_or_password ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.anitrack_hash_password_trigger();

-- Migrasi satu kali seluruh password lama (teks biasa) ke hash bcrypt
UPDATE public.profiles
SET pin_or_password = extensions.crypt(pin_or_password, extensions.gen_salt('bf', 10))
WHERE pin_or_password IS NOT NULL
  AND length(trim(pin_or_password)) > 0
  AND pin_or_password !~ '^\$2[aby]\$';

-- ==================== 2. LARANG PEMBACAAN KOLOM PASSWORD DARI API PUBLIK ====================
DO $$
DECLARE
    safe_cols TEXT;
BEGIN
    SELECT string_agg(quote_ident(column_name), ', ')
    INTO safe_cols
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name <> 'pin_or_password';

    IF safe_cols IS NOT NULL THEN
        EXECUTE 'REVOKE SELECT ON public.profiles FROM anon, authenticated';
        EXECUTE 'GRANT SELECT (' || safe_cols || ') ON public.profiles TO anon, authenticated';
    END IF;
END $$;

-- ==================== 3. TABEL SESI SERVER (PRIVATE) ====================
CREATE TABLE IF NOT EXISTS public.app_sessions (
    token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON public.app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON public.app_sessions(expires_at);

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_sessions FROM anon, authenticated;

-- ==================== 4. HELPER IDENTITAS DARI HEADER x-anitrack-session ====================
CREATE OR REPLACE FUNCTION public.anitrack_request_token()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    hdrs JSON;
    tok TEXT;
BEGIN
    hdrs := current_setting('request.headers', true)::json;
    tok := trim(coalesce(hdrs->>'x-anitrack-session', ''));
    IF tok = '' THEN RETURN NULL; END IF;
    RETURN tok;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.anitrack_current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT s.user_id
    FROM public.app_sessions s
    WHERE s.token = public.anitrack_request_token()
      AND s.expires_at > now()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.anitrack_current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.role
    FROM public.profiles p
    WHERE p.id = public.anitrack_current_user_id()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.anitrack_is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(public.anitrack_current_role() = 'superadmin', false);
$$;

CREATE OR REPLACE FUNCTION public.anitrack_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID;
    r TEXT;
    ids_raw TEXT;
    ids_json JSONB;
BEGIN
    uid := public.anitrack_current_user_id();
    IF uid IS NULL THEN RETURN false; END IF;
    SELECT role INTO r FROM public.profiles WHERE id = uid;
    IF r = 'superadmin' THEN RETURN true; END IF;
    SELECT value INTO ids_raw FROM public.app_settings WHERE key = 'admin_role_ids' LIMIT 1;
    IF ids_raw IS NULL OR trim(ids_raw) = '' THEN RETURN false; END IF;
    ids_json := ids_raw::jsonb;
    IF jsonb_typeof(ids_json) = 'array' THEN
        RETURN EXISTS (SELECT 1 FROM jsonb_array_elements_text(ids_json) AS elem WHERE elem = uid::text);
    END IF;
    RETURN false;
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.anitrack_is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(public.anitrack_current_role() IN ('superadmin', 'mentor'), false)
        OR public.anitrack_is_admin();
$$;

-- ==================== 5. RPC AUTENTIKASI & PORTAL ORANG TUA ====================
CREATE OR REPLACE FUNCTION public.anitrack_login(p_username TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    u RECORD;
    matched BOOLEAN := false;
    new_token TEXT;
    is_op_admin BOOLEAN := false;
    ids_raw TEXT;
BEGIN
    IF p_username IS NULL OR p_password IS NULL OR trim(p_username) = '' OR p_password = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Username dan password wajib diisi.');
    END IF;

    SELECT id, full_name, username, class_name, sub_concentration, role, mentor_id,
           avatar_url, whatsapp_number, project_drive_url, pin_or_password
    INTO u
    FROM public.profiles
    WHERE lower(trim(username)) = lower(trim(p_username))
    LIMIT 1;

    IF NOT FOUND OR u.pin_or_password IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Username atau password tidak sesuai.');
    END IF;

    IF u.pin_or_password ~ '^\$2[aby]\$' THEN
        matched := (u.pin_or_password = extensions.crypt(p_password, u.pin_or_password));
    ELSE
        matched := (u.pin_or_password = p_password);
        IF matched THEN
            UPDATE public.profiles
            SET pin_or_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10))
            WHERE id = u.id;
        END IF;
    END IF;

    IF NOT matched THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Username atau password tidak sesuai.');
    END IF;

    -- Bersihkan sesi kedaluwarsa secara berkala
    DELETE FROM public.app_sessions WHERE expires_at < now();

    new_token := encode(extensions.gen_random_bytes(32), 'hex');
    INSERT INTO public.app_sessions (token, user_id, role, expires_at)
    VALUES (new_token, u.id, u.role, now() + interval '90 days');

    IF u.role <> 'superadmin' THEN
        SELECT value INTO ids_raw FROM public.app_settings WHERE key = 'admin_role_ids' LIMIT 1;
        IF ids_raw IS NOT NULL THEN
            BEGIN
                SELECT EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(ids_raw::jsonb) AS elem WHERE elem = u.id::text
                ) INTO is_op_admin;
            EXCEPTION WHEN OTHERS THEN
                is_op_admin := false;
            END;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'token', new_token,
        'user', jsonb_build_object(
            'id', u.id,
            'full_name', u.full_name,
            'username', u.username,
            'class_name', u.class_name,
            'sub_concentration', u.sub_concentration,
            'role', u.role,
            'mentor_id', u.mentor_id,
            'avatar_url', u.avatar_url,
            'whatsapp_number', u.whatsapp_number,
            'project_drive_url', u.project_drive_url,
            'is_operational_admin', is_op_admin
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.anitrack_verify_session()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID;
    u RECORD;
    is_op_admin BOOLEAN := false;
    ids_raw TEXT;
BEGIN
    uid := public.anitrack_current_user_id();
    IF uid IS NULL THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    SELECT id, full_name, username, class_name, sub_concentration, role, mentor_id,
           avatar_url, whatsapp_number, project_drive_url
    INTO u
    FROM public.profiles
    WHERE id = uid
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false);
    END IF;

    IF u.role <> 'superadmin' THEN
        SELECT value INTO ids_raw FROM public.app_settings WHERE key = 'admin_role_ids' LIMIT 1;
        IF ids_raw IS NOT NULL THEN
            BEGIN
                SELECT EXISTS (
                    SELECT 1 FROM jsonb_array_elements_text(ids_raw::jsonb) AS elem WHERE elem = u.id::text
                ) INTO is_op_admin;
            EXCEPTION WHEN OTHERS THEN
                is_op_admin := false;
            END;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'user', jsonb_build_object(
            'id', u.id,
            'full_name', u.full_name,
            'username', u.username,
            'class_name', u.class_name,
            'sub_concentration', u.sub_concentration,
            'role', u.role,
            'mentor_id', u.mentor_id,
            'avatar_url', u.avatar_url,
            'whatsapp_number', u.whatsapp_number,
            'project_drive_url', u.project_drive_url,
            'is_operational_admin', is_op_admin
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.anitrack_logout()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tok TEXT;
BEGIN
    tok := public.anitrack_request_token();
    IF tok IS NOT NULL THEN
        DELETE FROM public.app_sessions WHERE token = tok;
    END IF;
    RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.anitrack_parent_watch(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tok_raw TEXT;
    tok_json JSONB;
    stu_id UUID;
    stu_json JSONB;
    mentor_json JSONB;
    proj_tasks_json JSONB;
    proj_subs_json JSONB;
    daily_prog_json JSONB;
    daily_defs_json JSONB;
    fb_log_val TEXT;
    ck_cols_val TEXT;
    ck_row_val TEXT;
    ann_val TEXT;
BEGIN
    IF p_token IS NULL OR trim(p_token) = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Token pantau kosong.');
    END IF;

    SELECT value INTO tok_raw
    FROM public.app_settings
    WHERE key = 'parent_token::' || trim(p_token)
    LIMIT 1;

    IF tok_raw IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Kode tautan tidak ditemukan atau sudah dicabut oleh Guru Pembimbing.');
    END IF;

    tok_json := tok_raw::jsonb;
    IF coalesce((tok_json->>'active')::boolean, true) = false OR coalesce(tok_json->>'student_id', '') = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Tautan pantau ini sudah tidak aktif.');
    END IF;

    stu_id := (tok_json->>'student_id')::uuid;

    SELECT jsonb_build_object(
        'id', id,
        'full_name', full_name,
        'username', username,
        'class_name', class_name,
        'sub_concentration', sub_concentration,
        'avatar_url', avatar_url,
        'mentor_id', mentor_id,
        'project_drive_url', project_drive_url
    ) INTO stu_json
    FROM public.profiles
    WHERE id = stu_id
    LIMIT 1;

    IF stu_json IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Data siswa tidak ditemukan di sistem.');
    END IF;

    IF stu_json->>'mentor_id' IS NOT NULL THEN
        SELECT jsonb_build_object('id', id, 'full_name', full_name, 'whatsapp_number', whatsapp_number)
        INTO mentor_json
        FROM public.profiles
        WHERE id = (stu_json->>'mentor_id')::uuid
        LIMIT 1;
    END IF;

    SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.due_date ASC NULLS LAST), '[]'::jsonb)
    INTO proj_tasks_json
    FROM public.project_tasks t;

    SELECT coalesce(jsonb_agg(to_jsonb(ps)), '[]'::jsonb)
    INTO proj_subs_json
    FROM public.project_submissions ps
    WHERE ps.student_id = stu_id;

    SELECT coalesce(jsonb_agg(sub_row), '[]'::jsonb)
    INTO daily_prog_json
    FROM (
        SELECT task_id, status, progress_percent, student_notes, updated_at
        FROM public.student_progress
        WHERE student_id = stu_id
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 14
    ) sub_row;

    SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title)), '[]'::jsonb)
    INTO daily_defs_json
    FROM public.daily_tasks;

    SELECT value INTO fb_log_val FROM public.app_settings WHERE key = 'proj_fb_log::' || stu_id::text LIMIT 1;
    SELECT value INTO ck_cols_val FROM public.app_settings WHERE key = 'proj_checklist_cols' LIMIT 1;
    SELECT value INTO ck_row_val FROM public.app_settings WHERE key = 'proj_checklist_row::' || stu_id::text LIMIT 1;
    SELECT value INTO ann_val FROM public.app_settings WHERE key = 'global_announcement' LIMIT 1;

    RETURN jsonb_build_object(
        'ok', true,
        'student', stu_json,
        'mentor', mentor_json,
        'proj_tasks', proj_tasks_json,
        'proj_subs', proj_subs_json,
        'daily_prog', daily_prog_json,
        'daily_defs', daily_defs_json,
        'fb_log_raw', fb_log_val,
        'checklist_cols_raw', ck_cols_val,
        'checklist_row_raw', ck_row_val,
        'announcement_raw', ann_val
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Gagal memverifikasi tautan pantau.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.anitrack_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anitrack_verify_session() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anitrack_logout() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anitrack_parent_watch(TEXT) TO anon, authenticated;

-- ==================== 6. ROW LEVEL SECURITY (RLS) KETAT DI SEMUA TABEL ====================
-- Hapus policy lama yang terlalu longgar (jika ada)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('profiles', 'learning_materials', 'daily_tasks', 'student_progress', 'project_tasks', 'project_submissions', 'app_settings', 'wa_notification_logs')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- 6A. profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_logged_in" ON public.profiles
    FOR SELECT TO anon, authenticated
    USING (public.anitrack_current_user_id() IS NOT NULL);

CREATE POLICY "profiles_insert_superadmin" ON public.profiles
    FOR INSERT TO anon, authenticated
    WITH CHECK (public.anitrack_is_superadmin());

CREATE POLICY "profiles_delete_superadmin" ON public.profiles
    FOR DELETE TO anon, authenticated
    USING (public.anitrack_is_superadmin());

CREATE POLICY "profiles_update_superadmin" ON public.profiles
    FOR UPDATE TO anon, authenticated
    USING (public.anitrack_is_superadmin())
    WITH CHECK (public.anitrack_is_superadmin());

CREATE POLICY "profiles_update_staff_or_self" ON public.profiles
    FOR UPDATE TO anon, authenticated
    USING (
        public.anitrack_is_staff()
        OR id = public.anitrack_current_user_id()
    )
    WITH CHECK (
        (public.anitrack_is_admin() AND role <> 'superadmin')
        OR (public.anitrack_current_role() = 'mentor' AND (id = public.anitrack_current_user_id() AND role = 'mentor' OR role = 'student'))
        OR (id = public.anitrack_current_user_id() AND role = public.anitrack_current_role())
    );

-- 6B. learning_materials
ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materials_select_logged_in" ON public.learning_materials
    FOR SELECT TO anon, authenticated
    USING (public.anitrack_current_user_id() IS NOT NULL);

CREATE POLICY "materials_write_staff" ON public.learning_materials
    FOR ALL TO anon, authenticated
    USING (public.anitrack_is_staff())
    WITH CHECK (public.anitrack_is_staff());

-- 6C. daily_tasks
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_tasks_select_logged_in" ON public.daily_tasks
    FOR SELECT TO anon, authenticated
    USING (public.anitrack_current_user_id() IS NOT NULL);

CREATE POLICY "daily_tasks_insert_logged_in" ON public.daily_tasks
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        public.anitrack_is_staff()
        OR (public.anitrack_current_user_id() IS NOT NULL AND created_by = public.anitrack_current_user_id())
    );

CREATE POLICY "daily_tasks_update_staff_or_owner" ON public.daily_tasks
    FOR UPDATE TO anon, authenticated
    USING (public.anitrack_is_staff() OR created_by = public.anitrack_current_user_id())
    WITH CHECK (public.anitrack_is_staff() OR created_by = public.anitrack_current_user_id());

CREATE POLICY "daily_tasks_delete_staff_or_owner" ON public.daily_tasks
    FOR DELETE TO anon, authenticated
    USING (public.anitrack_is_staff() OR created_by = public.anitrack_current_user_id());

-- 6D. student_progress
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_progress_select_logged_in" ON public.student_progress
    FOR SELECT TO anon, authenticated
    USING (public.anitrack_current_user_id() IS NOT NULL);

CREATE POLICY "student_progress_write_staff_or_self" ON public.student_progress
    FOR ALL TO anon, authenticated
    USING (public.anitrack_is_staff() OR student_id = public.anitrack_current_user_id())
    WITH CHECK (public.anitrack_is_staff() OR student_id = public.anitrack_current_user_id());

-- 6E. project_tasks
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_tasks_select_logged_in" ON public.project_tasks
    FOR SELECT TO anon, authenticated
    USING (public.anitrack_current_user_id() IS NOT NULL);

CREATE POLICY "project_tasks_write_staff" ON public.project_tasks
    FOR ALL TO anon, authenticated
    USING (public.anitrack_is_staff())
    WITH CHECK (public.anitrack_is_staff());

-- 6F. project_submissions (Siswa DILARANG mengubah status dirinya menjadi selesai/ACC!)
ALTER TABLE public.project_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_submissions_select_logged_in" ON public.project_submissions
    FOR SELECT TO anon, authenticated
    USING (
        public.anitrack_is_staff()
        OR student_id = public.anitrack_current_user_id()
        OR (public.anitrack_current_user_id() IS NOT NULL AND status = 'selesai')
    );

CREATE POLICY "project_submissions_write_staff" ON public.project_submissions
    FOR ALL TO anon, authenticated
    USING (public.anitrack_is_staff())
    WITH CHECK (public.anitrack_is_staff());

CREATE POLICY "project_submissions_student_insert" ON public.project_submissions
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        student_id = public.anitrack_current_user_id()
        AND status IN ('belum_mulai', 'sedang_dikerjakan', 'menunggu_review')
    );

CREATE POLICY "project_submissions_student_update" ON public.project_submissions
    FOR UPDATE TO anon, authenticated
    USING (student_id = public.anitrack_current_user_id())
    WITH CHECK (
        student_id = public.anitrack_current_user_id()
        AND status IN ('belum_mulai', 'sedang_dikerjakan', 'menunggu_review')
    );

-- 6G. app_settings (Kunci pengaturan rahasia & Project Update agar tidak bisa diubah siswa!)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select_scoped" ON public.app_settings
    FOR SELECT TO anon, authenticated
    USING (
        public.anitrack_is_admin()
        OR (
            public.anitrack_is_staff()
            AND key <> 'wa_gateway_config'
        )
        OR (
            public.anitrack_current_user_id() IS NOT NULL
            AND key NOT IN ('wa_gateway_config')
            AND key NOT LIKE 'parent_token::%'
            AND key NOT LIKE 'parent_watch::%'
            AND (
                key NOT LIKE 'proj_checklist_row::%'
                OR key = 'proj_checklist_row::' || public.anitrack_current_user_id()::text
            )
        )
    );

CREATE POLICY "app_settings_write_superadmin" ON public.app_settings
    FOR ALL TO anon, authenticated
    USING (public.anitrack_is_superadmin())
    WITH CHECK (public.anitrack_is_superadmin());

CREATE POLICY "app_settings_write_admin" ON public.app_settings
    FOR ALL TO anon, authenticated
    USING (
        public.anitrack_is_admin()
        AND key NOT IN ('admin_role_ids', 'gas_web_app_url')
    )
    WITH CHECK (
        public.anitrack_is_admin()
        AND key NOT IN ('admin_role_ids', 'gas_web_app_url')
    );

CREATE POLICY "app_settings_write_mentor" ON public.app_settings
    FOR ALL TO anon, authenticated
    USING (
        public.anitrack_is_staff()
        AND (
            key = 'proj_checklist_cols'
            OR key LIKE 'proj_checklist_row::%'
            OR key LIKE 'proj_fb_log::%'
            OR key LIKE 'proj_task_files::%'
            OR key LIKE 'parent_watch::%'
            OR key LIKE 'parent_token::%'
            OR key LIKE 'proj_archive::%'
        )
    )
    WITH CHECK (
        public.anitrack_is_staff()
        AND (
            key = 'proj_checklist_cols'
            OR key LIKE 'proj_checklist_row::%'
            OR key LIKE 'proj_fb_log::%'
            OR key LIKE 'proj_task_files::%'
            OR key LIKE 'parent_watch::%'
            OR key LIKE 'parent_token::%'
            OR key LIKE 'proj_archive::%'
        )
    );

-- 6H. wa_notification_logs (Jika tabel ada: khusus Admin)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wa_notification_logs') THEN
        EXECUTE 'ALTER TABLE public.wa_notification_logs ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "wa_logs_admin_only" ON public.wa_notification_logs FOR ALL TO anon, authenticated USING (public.anitrack_is_admin()) WITH CHECK (public.anitrack_is_admin())';
    END IF;
END $$;
