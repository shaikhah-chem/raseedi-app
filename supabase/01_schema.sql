-- =====================================================================
--  ✨ رصيدي الذهبي ✨  —  قاعدة البيانات الكاملة (Supabase / PostgreSQL)
--  «كل مبادرة... تصنع فرقًا»
--
--  طريقة الاستخدام: انسخي هذا الملف كاملًا والصقيه في
--  Supabase → SQL Editor → New query → ثم Run.
--  (يُشغَّل مرة واحدة فقط على مشروع جديد)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1) الجداول
-- ---------------------------------------------------------------------

-- المستخدمون (معلمات وطالبات) — مرتبط بحسابات الدخول auth.users
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('teacher','student')),
  full_name   text not null,
  username    text not null unique,
  created_at  timestamptz not null default now()
);

-- الفصول
create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  grade       text not null default 'ثالث ثانوي',      -- الصف
  name        text not null,                            -- الفصل مثل 1/1
  created_at  timestamptz not null default now(),
  unique (grade, name)
);

-- الطالبات
create table public.students (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.users(id) on delete cascade,
  class_id    uuid references public.classes(id) on delete set null,
  full_name   text not null,
  username    text not null unique,
  active      boolean not null default true,
  is_demo     boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);
create index on public.students(class_id);

-- الدروس (لتجميع مهام الصف المقلوب «مهمتي قبل الحصة»)
create table public.lessons (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  class_id    uuid references public.classes(id) on delete cascade,  -- null = كل الفصول
  is_flipped  boolean not null default true,
  lesson_date date,
  created_at  timestamptz not null default now()
);

-- المهام
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  task_type     text not null default 'مهمة',          -- اختبار قبلي / فيديو / ورقة عمل / نشاط / مشروع ...
  track         text not null default 'commitment'
                check (track in ('commitment','initiative','participation','excellence')),
  points        int  not null check (points between 0 and 50),
  start_at      timestamptz not null default now(),
  due_at        timestamptz not null,
  class_id      uuid references public.classes(id) on delete cascade, -- null = كل الفصول
  lesson_id     uuid references public.lessons(id) on delete set null,
  is_optional   boolean not null default false,
  verification  text not null default 'self'
                check (verification in ('self','code','proof','teacher')),
  -- self    = تأكيد الطالبة (يُحتسب تلقائيًا إن كان قبل الموعد)
  -- code    = إدخال رمز المهمة / مسح QR
  -- proof   = رفع إثبات ثم اعتماد المعلمة
  -- teacher = ترصدها المعلمة يدويًا
  external_url  text,                                   -- رابط النشاط (فيديو / ورقة ذكية / اختبار)
  sort_order    int not null default 0,
  status        text not null default 'active' check (status in ('active','archived')),
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  check (due_at > start_at)
);
create index on public.tasks(class_id);
create index on public.tasks(lesson_id);

-- رموز المهام (منفصلة حتى لا تراها الطالبات)
create table public.task_codes (
  task_id  uuid primary key references public.tasks(id) on delete cascade,
  code     text not null unique
);

-- إنجازات المهام
create table public.task_completions (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references public.tasks(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  method         text not null check (method in ('self','code','proof','teacher')),
  submitted_at   timestamptz not null default now(),
  on_time        boolean not null default true,
  proof_text     text,
  proof_url      text,
  proof_image    text check (proof_image is null or length(proof_image) < 600000),
  points_awarded int not null default 0,
  reviewed_by    uuid references public.users(id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text,
  unique (task_id, student_id)
);
create index on public.task_completions(student_id);

-- المكافآت
create table public.rewards (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  icon             text not null default '🎁',
  cost             int  not null check (cost > 0),
  max_per_student  int  check (max_per_student is null or max_per_student > 0), -- الحد الأعلى للاستفادة
  stock            int  check (stock is null or stock >= 0),                     -- الكمية المتاحة (اختياري)
  requires_approval boolean not null default true,
  active           boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

-- عمليات الاستبدال
create table public.redemptions (
  id           uuid primary key default gen_random_uuid(),
  reward_id    uuid not null references public.rewards(id) on delete restrict,
  student_id   uuid not null references public.students(id) on delete cascade,
  cost         int  not null,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  student_note text,
  decided_by   uuid references public.users(id) on delete set null,
  decided_at   timestamptz,
  decision_note text,
  created_at   timestamptz not null default now()
);
create index on public.redemptions(student_id);

-- سجل النقاط (كل إضافة/خصم/استبدال)
create table public.points_transactions (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  amount        int  not null check (amount <> 0),
  kind          text not null check (kind in ('task','manual_add','manual_deduct','redemption','refund','reversal')),
  track         text check (track in ('commitment','initiative','participation','excellence')),
  reason        text not null,
  task_id       uuid references public.tasks(id) on delete set null,
  redemption_id uuid references public.redemptions(id) on delete set null,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.points_transactions(student_id, created_at desc);

-- التنبيهات
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  title      text not null,
  body       text,
  icon       text not null default '🔔',
  link       text,
  dedupe_key text,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on public.notifications(user_id, created_at desc);

-- سجل العمليات (تدقيق)
create table public.activity_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.users(id) on delete set null,
  actor_name text,
  action     text not null,
  entity     text,
  entity_id  text,
  details    jsonb,
  created_at timestamptz not null default now()
);
create index on public.activity_logs(created_at desc);

-- الإعدادات (صف واحد)
create table public.settings (
  id             int primary key default 1 check (id = 1),
  site_name      text not null default 'رصيدي الذهبي',
  motto          text not null default 'كل مبادرة... تصنع فرقًا',
  teacher_credit text not null default 'تنفيذ المعلمة: أ. شيخه المطيري',
  school_name    text default 'الثانوية الثانية والثلاثون',
  reward_policy  text not null default 'النقاط وسيلة للاحتفاء بالمبادرة وليست لشراء الدرجات. الاستبدال وفق المكافآت التي تحددها المعلمة وبالحد الأعلى المحدد لكل مكافأة.',
  updated_at     timestamptz not null default now()
);
insert into public.settings (id) values (1);

-- ---------------------------------------------------------------------
-- 2) دوال مساعدة
-- ---------------------------------------------------------------------

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'teacher');
$$;

create or replace function public.my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.students where user_id = auth.uid() and active;
$$;

create or replace function public.my_class_id() returns uuid
language sql stable security definer set search_path = public as $$
  select class_id from public.students where user_id = auth.uid();
$$;

-- المستويات (مبنية على إجمالي النقاط المكتسبة — لا تنخفض عند الاستبدال)
create or replace function public.level_name(p_earned int) returns text
language sql immutable as $$
  select case
    when p_earned >= 30 then '🏆 صانعة أثر'
    when p_earned >= 20 then '🌟 نجمة المبادرة'
    when p_earned >= 10 then '⭐⭐⭐ مبادرة نشطة'
    when p_earned >= 5  then '⭐⭐ خطوة ذهبية'
    else '⭐ بداية ذهبية' end;
$$;

create or replace function public.student_balance(p_student uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount),0)::int from public.points_transactions where student_id = p_student;
$$;

create or replace function public.student_earned(p_student uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount),0)::int from public.points_transactions
  where student_id = p_student and kind not in ('redemption','refund');
$$;

create or replace function public._require_teacher() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_teacher() then
    raise exception 'غير مصرح: هذه العملية للمعلمة فقط' using errcode = '42501';
  end if;
end $$;

create or replace function public._log(p_action text, p_entity text, p_entity_id text, p_details jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_logs(actor_id, actor_name, action, entity, entity_id, details)
  values (auth.uid(), (select full_name from public.users where id = auth.uid()),
          p_action, p_entity, p_entity_id, p_details);
end $$;

create or replace function public._notify(p_user uuid, p_title text, p_body text, p_icon text,
                                          p_link text default null, p_dedupe text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(user_id, title, body, icon, link, dedupe_key)
  values (p_user, p_title, p_body, coalesce(p_icon,'🔔'), p_link, p_dedupe)
  on conflict (user_id, dedupe_key) do nothing;
end $$;

-- الدالة المركزية الوحيدة التي تكتب في سجل النقاط
create or replace function public._add_points(
  p_student uuid, p_amount int, p_kind text, p_track text, p_reason text,
  p_task uuid default null, p_redemption uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_before int; v_after int; v_uid uuid; v_bal int;
begin
  if p_amount = 0 then return null; end if;
  select user_id into v_uid from public.students where id = p_student;
  if v_uid is null then raise exception 'الطالبة غير موجودة'; end if;

  -- قفل صف الطالبة لمنع التعارض عند العمليات المتزامنة
  perform 1 from public.students where id = p_student for update;

  v_bal := public.student_balance(p_student);
  if v_bal + p_amount < 0 then
    raise exception 'الرصيد غير كافٍ (الرصيد الحالي % نقطة)', v_bal;
  end if;

  v_before := public.student_earned(p_student);
  insert into public.points_transactions(student_id, amount, kind, track, reason, task_id, redemption_id, created_by)
  values (p_student, p_amount, p_kind, p_track, p_reason, p_task, p_redemption, auth.uid())
  returning id into v_id;
  v_after := public.student_earned(p_student);

  perform public._log(case when p_amount > 0 then 'points_add' else 'points_deduct' end,
                      'student', p_student::text,
                      jsonb_build_object('amount', p_amount, 'kind', p_kind, 'track', p_track,
                                         'reason', p_reason, 'task_id', p_task));

  if p_kind in ('task','manual_add') and p_amount > 0 then
    perform public._notify(v_uid,
      case when p_amount = 1 then 'حصلتِ على نقطة ذهبية 🎉'
           when p_amount = 2 then 'حصلتِ على نقطتين ذهبيتين 🎉'
           else 'حصلتِ على ' || p_amount || ' نقاط ذهبية 🎉' end,
      p_reason, '⭐', '#/s/history');
  elsif p_kind = 'manual_deduct' then
    perform public._notify(v_uid, 'تم تعديل رصيدك (' || p_amount || ')', p_reason, 'ℹ️', '#/s/history');
  end if;

  if public.level_name(v_after) <> public.level_name(v_before) and v_after > v_before then
    perform public._notify(v_uid, 'مبروك! وصلتِ إلى مستوى ' || public.level_name(v_after),
      'استمري... كل مبادرة تصنع فرقًا', '🏅', '#/s/balance');
  end if;
  return v_id;
end $$;

-- إنشاء حساب دخول (يُستخدم داخليًا فقط)
create or replace function public._create_auth_user(p_username text, p_password text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := gen_random_uuid(); v_email text;
begin
  p_username := lower(trim(p_username));
  if p_username !~ '^[a-z0-9._-]{3,30}$' then
    raise exception 'اسم المستخدم يجب أن يكون بالأحرف الإنجليزية أو الأرقام (3 إلى 30 خانة) مثل: s0101';
  end if;
  if length(coalesce(p_password,'')) < 6 then
    raise exception 'كلمة المرور يجب ألا تقل عن 6 خانات';
  end if;
  if exists (select 1 from public.users where username = p_username) then
    raise exception 'اسم المستخدم "%" مستخدم مسبقًا', p_username;
  end if;
  v_email := p_username || '@raseedi.app';

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', p_full_name, 'username', p_username),
          now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_uid, v_uid::text,
          jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());
  return v_uid;
end $$;

-- ---------------------------------------------------------------------
-- 3) العمليات (RPC) — كل التحقق يتم هنا على الخادم
-- ---------------------------------------------------------------------

-- إعداد أول حساب معلمة (يعمل مرة واحدة فقط عندما لا توجد أي معلمة)
create or replace function public.bootstrap_teacher(p_username text, p_password text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  if exists (select 1 from public.users where role = 'teacher') then
    raise exception 'تم إعداد حساب المعلمة مسبقًا' using errcode = '42501';
  end if;
  v_uid := public._create_auth_user(p_username, p_password, p_full_name);
  insert into public.users(id, role, full_name, username) values (v_uid, 'teacher', p_full_name, lower(trim(p_username)));
  insert into public.activity_logs(actor_id, actor_name, action, entity, entity_id)
  values (v_uid, p_full_name, 'bootstrap_teacher', 'user', v_uid::text);
  return v_uid;
end $$;

create or replace function public.needs_setup() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.users where role = 'teacher');
$$;

-- إضافة معلمة أخرى (من حساب معلمة)
create or replace function public.admin_create_teacher(p_username text, p_password text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  perform public._require_teacher();
  v_uid := public._create_auth_user(p_username, p_password, p_full_name);
  insert into public.users(id, role, full_name, username) values (v_uid, 'teacher', p_full_name, lower(trim(p_username)));
  perform public._log('create_teacher', 'user', v_uid::text, jsonb_build_object('username', p_username));
  return v_uid;
end $$;

-- إضافة طالبة
create or replace function public.admin_create_student(p_full_name text, p_username text, p_password text,
                                                       p_class_id uuid, p_is_demo boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_sid uuid;
begin
  perform public._require_teacher();
  if coalesce(trim(p_full_name),'') = '' then raise exception 'اكتبي اسم الطالبة'; end if;
  v_uid := public._create_auth_user(p_username, p_password, p_full_name);
  insert into public.users(id, role, full_name, username) values (v_uid, 'student', trim(p_full_name), lower(trim(p_username)));
  insert into public.students(user_id, class_id, full_name, username, is_demo)
  values (v_uid, p_class_id, trim(p_full_name), lower(trim(p_username)), coalesce(p_is_demo,false))
  returning id into v_sid;
  perform public._log('create_student', 'student', v_sid::text,
                      jsonb_build_object('name', p_full_name, 'username', p_username, 'class_id', p_class_id));
  perform public._notify(v_uid, 'مرحبًا بكِ في رصيدي الذهبي ✨', 'كل مبادرة... تصنع فرقًا', '👋', '#/s/how');
  return v_sid;
end $$;

-- تعديل بيانات طالبة
create or replace function public.admin_update_student(p_student_id uuid, p_full_name text, p_class_id uuid,
                                                       p_active boolean, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  perform public._require_teacher();
  update public.students set full_name = trim(p_full_name), class_id = p_class_id,
         active = p_active, notes = p_notes
  where id = p_student_id returning user_id into v_uid;
  if v_uid is null then raise exception 'الطالبة غير موجودة'; end if;
  update public.users set full_name = trim(p_full_name) where id = v_uid;
  perform public._log('update_student', 'student', p_student_id::text,
                      jsonb_build_object('name', p_full_name, 'class_id', p_class_id, 'active', p_active));
end $$;

-- إعادة تعيين كلمة مرور (طالبة أو معلمة أخرى)
create or replace function public.admin_reset_password(p_user_id uuid, p_new_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._require_teacher();
  if length(coalesce(p_new_password,'')) < 6 then raise exception 'كلمة المرور يجب ألا تقل عن 6 خانات'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
                        updated_at = now()
  where id = p_user_id;
  if not found then raise exception 'المستخدم غير موجود'; end if;
  perform public._log('reset_password', 'user', p_user_id::text, null);
end $$;

-- حذف طالبة نهائيًا (مع كل سجلاتها)
create or replace function public.admin_delete_student(p_student_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_name text;
begin
  perform public._require_teacher();
  select user_id, full_name into v_uid, v_name from public.students where id = p_student_id;
  if v_uid is null then raise exception 'الطالبة غير موجودة'; end if;
  delete from auth.users where id = v_uid;   -- يحذف المستخدم والطالبة وسجلاتها (cascade)
  perform public._log('delete_student', 'student', p_student_id::text, jsonb_build_object('name', v_name));
end $$;

-- حذف الطالبات التجريبيات دفعة واحدة
create or replace function public.admin_delete_demo_students()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  perform public._require_teacher();
  with d as (delete from auth.users where id in (select user_id from public.students where is_demo) returning 1)
  select count(*) into v_n from d;
  perform public._log('delete_demo_students', 'student', null, jsonb_build_object('count', v_n));
  return v_n;
end $$;

-- إضافة / خصم نقاط يدويًا (لطالبة أو أكثر)
create or replace function public.admin_adjust_points(p_student_ids uuid[], p_amount int, p_track text, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare v_sid uuid; v_n int := 0;
begin
  perform public._require_teacher();
  if p_amount = 0 or abs(p_amount) > 50 then raise exception 'عدد النقاط يجب أن يكون بين 1 و 50'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'يجب كتابة سبب العملية'; end if;
  if p_track is not null and p_track not in ('commitment','initiative','participation','excellence') then
    raise exception 'مسار غير صحيح';
  end if;
  foreach v_sid in array p_student_ids loop
    perform public._add_points(v_sid, p_amount,
      case when p_amount > 0 then 'manual_add' else 'manual_deduct' end,
      p_track, trim(p_reason));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- منطق مشترك لتسجيل إنجاز مهمة واحتساب النقاط
create or replace function public._complete_task(p_task uuid, p_student uuid, p_method text,
   p_status text, p_on_time boolean, p_proof_text text default null, p_proof_url text default null,
   p_proof_image text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_task public.tasks; v_cid uuid; v_pts int := 0;
begin
  select * into v_task from public.tasks where id = p_task;
  insert into public.task_completions(task_id, student_id, status, method, on_time, proof_text, proof_url, proof_image,
                                      reviewed_by, reviewed_at)
  values (p_task, p_student, p_status, p_method, p_on_time, p_proof_text, p_proof_url, p_proof_image,
          case when p_method = 'teacher' then auth.uid() end,
          case when p_status <> 'pending' then now() end)
  returning id into v_cid;

  if p_status = 'approved' and p_on_time and v_task.points > 0 then
    v_pts := v_task.points;
    perform public._add_points(p_student, v_pts, 'task', v_task.track, 'إنجاز مهمة: ' || v_task.title, p_task);
    update public.task_completions set points_awarded = v_pts where id = v_cid;
  end if;
  perform public._log('task_completion', 'task', p_task::text,
     jsonb_build_object('student_id', p_student, 'method', p_method, 'status', p_status,
                        'on_time', p_on_time, 'points', v_pts));
  return v_cid;
end $$;

-- التحقق من أن المهمة متاحة للطالبة
create or replace function public._task_for_student(p_task uuid, p_student uuid)
returns public.tasks language plpgsql stable security definer set search_path = public as $$
declare v_task public.tasks; v_class uuid;
begin
  select class_id into v_class from public.students where id = p_student;
  select * into v_task from public.tasks where id = p_task;
  if v_task.id is null or v_task.status <> 'active'
     or (v_task.class_id is not null and v_task.class_id is distinct from v_class) then
    raise exception 'المهمة غير متاحة لكِ';
  end if;
  if now() < v_task.start_at then raise exception 'لم يبدأ وقت هذه المهمة بعد'; end if;
  if exists (select 1 from public.task_completions where task_id = p_task and student_id = p_student) then
    raise exception 'سجّلتِ هذه المهمة مسبقًا ✔️';
  end if;
  return v_task;
end $$;

-- الطالبة: تسجيل الإنجاز (تأكيد ذاتي أو رفع إثبات)
create or replace function public.student_submit_task(p_task_id uuid, p_proof_text text default null,
                                                      p_proof_url text default null, p_proof_image text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sid uuid := public.my_student_id(); v_task public.tasks; v_status text; v_on_time boolean; v_cid uuid;
begin
  if v_sid is null then raise exception 'هذه العملية للطالبات فقط' using errcode = '42501'; end if;
  v_task := public._task_for_student(p_task_id, v_sid);
  if v_task.verification = 'code' then raise exception 'هذه المهمة تُسجَّل برمز المهمة أو QR'; end if;
  if v_task.verification = 'teacher' then raise exception 'هذه المهمة ترصدها المعلمة'; end if;
  if v_task.verification = 'proof' and coalesce(p_proof_text,'') = '' and coalesce(p_proof_url,'') = ''
     and p_proof_image is null then
    raise exception 'أرفقي إثبات الإنجاز (صورة أو رابط أو وصف)';
  end if;
  v_on_time := now() <= v_task.due_at;
  v_status := case when v_task.verification = 'self' then 'approved' else 'pending' end;
  v_cid := public._complete_task(p_task_id, v_sid, v_task.verification, v_status, v_on_time,
                                 p_proof_text, p_proof_url, p_proof_image);
  return jsonb_build_object('completion_id', v_cid, 'status', v_status, 'on_time', v_on_time,
     'points', case when v_status = 'approved' and v_on_time then v_task.points else 0 end,
     'task_points', v_task.points);
end $$;

-- الطالبة: تسجيل الإنجاز برمز المهمة / QR
create or replace function public.student_claim_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sid uuid := public.my_student_id(); v_task_id uuid; v_task public.tasks; v_on_time boolean; v_cid uuid;
begin
  if v_sid is null then raise exception 'هذه العملية للطالبات فقط' using errcode = '42501'; end if;
  select task_id into v_task_id from public.task_codes where code = upper(trim(p_code));
  if v_task_id is null then raise exception 'رمز المهمة غير صحيح'; end if;
  v_task := public._task_for_student(v_task_id, v_sid);
  v_on_time := now() <= v_task.due_at;
  v_cid := public._complete_task(v_task_id, v_sid, 'code', 'approved', v_on_time);
  return jsonb_build_object('completion_id', v_cid, 'task_title', v_task.title, 'on_time', v_on_time,
                            'points', case when v_on_time then v_task.points else 0 end);
end $$;

-- الطالبة: معاينة مهمة من الرمز قبل التأكيد (لا تكشف الرمز)
create or replace function public.task_by_code(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_task public.tasks;
begin
  if auth.uid() is null then raise exception 'سجّلي الدخول أولًا'; end if;
  select t.* into v_task from public.tasks t join public.task_codes c on c.task_id = t.id
  where c.code = upper(trim(p_code));
  if v_task.id is null then raise exception 'رمز المهمة غير صحيح'; end if;
  return jsonb_build_object('id', v_task.id, 'title', v_task.title, 'description', v_task.description,
     'points', v_task.points, 'due_at', v_task.due_at, 'track', v_task.track,
     'done', exists (select 1 from public.task_completions where task_id = v_task.id and student_id = public.my_student_id()));
end $$;

-- المعلمة: رصد الإنجاز يدويًا لعدة طالبات
create or replace function public.teacher_mark_completed(p_task_id uuid, p_student_ids uuid[], p_count_on_time boolean default true)
returns int language plpgsql security definer set search_path = public as $$
declare v_sid uuid; v_n int := 0; v_task public.tasks;
begin
  perform public._require_teacher();
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null then raise exception 'المهمة غير موجودة'; end if;
  foreach v_sid in array p_student_ids loop
    if not exists (select 1 from public.task_completions where task_id = p_task_id and student_id = v_sid) then
      perform public._complete_task(p_task_id, v_sid, 'teacher', 'approved',
                                    coalesce(p_count_on_time, now() <= v_task.due_at));
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- المعلمة: اعتماد / رفض إثبات
create or replace function public.teacher_review_completion(p_completion_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.task_completions; v_task public.tasks; v_uid uuid;
begin
  perform public._require_teacher();
  select * into v_c from public.task_completions where id = p_completion_id for update;
  if v_c.id is null then raise exception 'السجل غير موجود'; end if;
  if v_c.status <> 'pending' then raise exception 'تمت مراجعة هذا الإنجاز مسبقًا'; end if;
  select * into v_task from public.tasks where id = v_c.task_id;
  select user_id into v_uid from public.students where id = v_c.student_id;

  update public.task_completions set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  where id = p_completion_id;

  if p_approve and v_c.on_time and v_task.points > 0 then
    perform public._add_points(v_c.student_id, v_task.points, 'task', v_task.track, 'إنجاز مهمة: ' || v_task.title, v_task.id);
    update public.task_completions set points_awarded = v_task.points where id = p_completion_id;
  elsif not p_approve then
    -- يسمح للطالبة بإعادة الإرسال: نحذف السجل المرفوض بعد إشعارها
    perform public._notify(v_uid, 'يحتاج إثباتك إلى مراجعة', 'مهمة: ' || v_task.title || coalesce(' — ' || p_note, ''), '📝', '#/s/tasks');
    delete from public.task_completions where id = p_completion_id;
  end if;
  perform public._log(case when p_approve then 'approve_completion' else 'reject_completion' end,
                      'task', v_task.id::text, jsonb_build_object('student_id', v_c.student_id, 'note', p_note));
end $$;

-- المعلمة: إلغاء إنجاز (مع عكس النقاط)
create or replace function public.teacher_undo_completion(p_completion_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_c public.task_completions; v_task public.tasks;
begin
  perform public._require_teacher();
  if coalesce(trim(p_reason),'') = '' then raise exception 'يجب كتابة سبب الإلغاء'; end if;
  select * into v_c from public.task_completions where id = p_completion_id;
  if v_c.id is null then raise exception 'السجل غير موجود'; end if;
  select * into v_task from public.tasks where id = v_c.task_id;
  if v_c.points_awarded > 0 then
    perform public._add_points(v_c.student_id, -v_c.points_awarded, 'reversal', v_task.track,
                               'إلغاء إنجاز: ' || v_task.title || ' — ' || p_reason, v_task.id);
  end if;
  delete from public.task_completions where id = p_completion_id;
  perform public._log('undo_completion', 'task', v_task.id::text,
                      jsonb_build_object('student_id', v_c.student_id, 'reason', p_reason));
end $$;

-- المعلمة: إرسال تذكير لمن لم تُكمل المهمة
create or replace function public.teacher_send_reminder(p_task_id uuid, p_message text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_task public.tasks; v_n int;
begin
  perform public._require_teacher();
  select * into v_task from public.tasks where id = p_task_id;
  with targets as (
    select s.user_id from public.students s
    where s.active and (v_task.class_id is null or s.class_id = v_task.class_id)
      and not exists (select 1 from public.task_completions c where c.task_id = p_task_id and c.student_id = s.id)
  ), ins as (
    insert into public.notifications(user_id, title, body, icon, link)
    select user_id, 'تذكير بمهمة: ' || v_task.title,
           coalesce(nullif(trim(p_message),''), 'لا تفوّتي نقاطك الذهبية — الموعد: ' ||
                    to_char(v_task.due_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI')),
           '⏰', '#/s/tasks'
    from targets returning 1)
  select count(*) into v_n from ins;
  perform public._log('send_reminder', 'task', p_task_id::text, jsonb_build_object('count', v_n));
  return v_n;
end $$;

-- الطالبة: استبدال مكافأة
create or replace function public.student_redeem(p_reward_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sid uuid := public.my_student_id(); v_r public.rewards; v_used int; v_bal int; v_rid uuid; v_status text;
begin
  if v_sid is null then raise exception 'هذه العملية للطالبات فقط' using errcode = '42501'; end if;
  perform 1 from public.students where id = v_sid for update;
  select * into v_r from public.rewards where id = p_reward_id for update;
  if v_r.id is null or not v_r.active then raise exception 'المكافأة غير متاحة حاليًا'; end if;
  v_bal := public.student_balance(v_sid);
  if v_bal < v_r.cost then
    raise exception 'رصيدك % نقطة، وتحتاجين % نقطة لهذه المكافأة', v_bal, v_r.cost;
  end if;
  select count(*) into v_used from public.redemptions where reward_id = p_reward_id and student_id = v_sid and status <> 'rejected';
  if v_r.max_per_student is not null and v_used >= v_r.max_per_student then
    raise exception 'وصلتِ إلى الحد الأعلى لهذه المكافأة (% مرات)', v_r.max_per_student;
  end if;
  if v_r.stock is not null then
    if v_r.stock <= 0 then raise exception 'نفدت الكمية المتاحة من هذه المكافأة'; end if;
    update public.rewards set stock = stock - 1 where id = p_reward_id;
  end if;
  v_status := case when v_r.requires_approval then 'pending' else 'approved' end;
  insert into public.redemptions(reward_id, student_id, cost, status, student_note, decided_at)
  values (p_reward_id, v_sid, v_r.cost, v_status, p_note, case when v_status = 'approved' then now() end)
  returning id into v_rid;
  perform public._add_points(v_sid, -v_r.cost, 'redemption', null, 'استبدال مكافأة: ' || v_r.title, null, v_rid);
  -- تنبيه المعلمات
  insert into public.notifications(user_id, title, body, icon, link)
  select u.id, 'طلب استبدال مكافأة', (select full_name from public.students where id = v_sid) || ' — ' || v_r.title, '🎁', '#/t/rewards'
  from public.users u where u.role = 'teacher';
  return jsonb_build_object('redemption_id', v_rid, 'status', v_status, 'balance', public.student_balance(v_sid));
end $$;

-- المعلمة: قبول / رفض طلب الاستبدال (الرفض يعيد النقاط)
create or replace function public.teacher_decide_redemption(p_redemption_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_r public.redemptions; v_title text; v_uid uuid;
begin
  perform public._require_teacher();
  select * into v_r from public.redemptions where id = p_redemption_id for update;
  if v_r.id is null then raise exception 'الطلب غير موجود'; end if;
  if v_r.status <> 'pending' then raise exception 'تمت معالجة هذا الطلب مسبقًا'; end if;
  select title into v_title from public.rewards where id = v_r.reward_id;
  select user_id into v_uid from public.students where id = v_r.student_id;
  update public.redemptions set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now(), decision_note = p_note
  where id = p_redemption_id;
  if not p_approve then
    perform public._add_points(v_r.student_id, v_r.cost, 'refund', null, 'استرجاع نقاط: ' || v_title || coalesce(' — ' || p_note, ''), null, v_r.id);
    update public.rewards set stock = stock + 1 where id = v_r.reward_id and stock is not null;
    perform public._notify(v_uid, 'لم يُعتمد طلب: ' || v_title, coalesce(p_note, 'أُعيدت النقاط إلى رصيدك'), '↩️', '#/s/rewards');
  else
    perform public._notify(v_uid, 'تم اعتماد مكافأتك 🎁', v_title || coalesce(' — ' || p_note, ''), '🎁', '#/s/rewards');
  end if;
  perform public._log(case when p_approve then 'approve_redemption' else 'reject_redemption' end,
                      'redemption', p_redemption_id::text, jsonb_build_object('note', p_note));
end $$;

-- التنبيهات: إنشاء تذكيرات "تبقى يوم واحد" للمستخدمة الحالية (يُستدعى عند فتح الموقع)
create or replace function public.generate_my_due_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare v_sid uuid := public.my_student_id(); v_n int;
begin
  if v_sid is null then return 0; end if;
  with due as (
    select t.* from public.tasks t
    where t.status = 'active' and t.start_at <= now()
      and t.due_at > now() and t.due_at <= now() + interval '24 hours'
      and (t.class_id is null or t.class_id = public.my_class_id())
      and not exists (select 1 from public.task_completions c where c.task_id = t.id and c.student_id = v_sid)
  ), ins as (
    insert into public.notifications(user_id, title, body, icon, link, dedupe_key)
    select auth.uid(), 'تبقى أقل من يوم على موعد المهمة', d.title || ' — ⭐ ' || d.points, '⏳', '#/s/tasks', 'due24:' || d.id
    from due d
    on conflict (user_id, dedupe_key) do nothing returning 1)
  select count(*) into v_n from ins;
  return v_n;
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
$$;

-- قالب جاهز: «درس المخاليط – الصف المقلوب»
create or replace function public.create_flipped_template(p_class_id uuid, p_due_at timestamptz,
                                                          p_title text default 'المخاليط')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_lid uuid;
begin
  perform public._require_teacher();
  insert into public.lessons(title, description, class_id, is_flipped)
  values (p_title, 'مهمتي قبل الحصة — الصف المقلوب', p_class_id, true) returning id into v_lid;
  insert into public.tasks(title, description, task_type, track, points, start_at, due_at, class_id, lesson_id,
                           is_optional, verification, sort_order, created_by) values
   ('الاختبار القبلي', 'أجيبي عن الاختبار القبلي قبل الحصة', 'اختبار قبلي', 'commitment', 1, now(), p_due_at, p_class_id, v_lid, false, 'self', 1, auth.uid()),
   ('مشاهدة فيديو الدرس', 'شاهدي فيديو الدرس كاملًا', 'فيديو', 'commitment', 1, now(), p_due_at, p_class_id, v_lid, false, 'self', 2, auth.uid()),
   ('الإجابة عن أسئلة الفيديو', 'أجيبي عن أسئلة الفيديو وأرفقي صورة الإجابة', 'أسئلة', 'commitment', 2, now(), p_due_at, p_class_id, v_lid, false, 'proof', 3, auth.uid()),
   ('الدخول إلى ورقة ذكية', 'ادخلي إلى الورقة الذكية وأكملي الأنشطة، ثم أدخلي الرمز الظاهر في نهايتها', 'ورقة عمل', 'commitment', 1, now(), p_due_at, p_class_id, v_lid, false, 'code', 4, auth.uid()),
   ('مهمة إثرائية اختيارية', 'ابحثي عن مخلوط من حياتك اليومية وصنّفيه مع التعليل', 'إثرائية', 'excellence', 2, now(), p_due_at, p_class_id, v_lid, true, 'proof', 5, auth.uid());
  perform public._log('create_flipped_template', 'lesson', v_lid::text, jsonb_build_object('class_id', p_class_id));
  return v_lid;
end $$;

-- ---------------------------------------------------------------------
-- 4) المشغلات (Triggers)
-- ---------------------------------------------------------------------

-- رمز فريد لكل مهمة + تنبيه الطالبات بمهمة جديدة + سجل
create or replace function public._on_task_insert() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_code text;
begin
  loop
    v_code := substr(translate(upper(encode(extensions.gen_random_bytes(9), 'base64')), '+/=0O1IL', ''), 1, 6);
    exit when length(v_code) = 6 and not exists (select 1 from public.task_codes where code = v_code);
  end loop;
  insert into public.task_codes(task_id, code) values (new.id, v_code);

  insert into public.notifications(user_id, title, body, icon, link, dedupe_key)
  select s.user_id, 'لديكِ مهمة جديدة', new.title || ' — ⭐ ' || new.points, '📚', '#/s/tasks', 'newtask:' || new.id
  from public.students s
  where s.active and (new.class_id is null or s.class_id = new.class_id)
  on conflict do nothing;

  perform public._log('create_task', 'task', new.id::text,
     jsonb_build_object('title', new.title, 'points', new.points, 'due_at', new.due_at, 'class_id', new.class_id));
  return new;
end $$;
create trigger trg_task_insert after insert on public.tasks
for each row execute function public._on_task_insert();

create or replace function public._on_task_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._log(case when tg_op = 'DELETE' then 'delete_task' else 'update_task' end, 'task',
                      coalesce(new.id, old.id)::text,
                      jsonb_build_object('title', coalesce(new.title, old.title)));
  return coalesce(new, old);
end $$;
create trigger trg_task_update after update or delete on public.tasks
for each row execute function public._on_task_update();

create or replace function public._on_reward_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._log(lower(tg_op) || '_reward', 'reward', coalesce(new.id, old.id)::text,
                      jsonb_build_object('title', coalesce(new.title, old.title), 'cost', coalesce(new.cost, old.cost)));
  return coalesce(new, old);
end $$;
create trigger trg_reward_change after insert or update or delete on public.rewards
for each row execute function public._on_reward_change();

-- ---------------------------------------------------------------------
-- 5) عرض ملخص الطالبات (يحترم صلاحيات المستخدم)
-- ---------------------------------------------------------------------
create view public.student_summary with (security_invoker = true) as
select s.id, s.user_id, s.full_name, s.username, s.class_id, s.active, s.is_demo, s.notes, s.created_at,
  coalesce(sum(p.amount), 0)::int as balance,
  coalesce(sum(p.amount) filter (where p.kind not in ('redemption','refund')), 0)::int as earned,
  count(p.id) filter (where p.track = 'initiative' and p.amount > 0)::int as initiatives,
  (select count(*) from public.task_completions c where c.student_id = s.id and c.status = 'approved')::int as tasks_done,
  greatest(max(p.created_at), (select max(c.submitted_at) from public.task_completions c where c.student_id = s.id)) as last_activity
from public.students s
left join public.points_transactions p on p.student_id = s.id
group by s.id;

-- ---------------------------------------------------------------------
-- 6) الأمان: RLS + الصلاحيات
-- ---------------------------------------------------------------------
alter table public.users               enable row level security;
alter table public.classes             enable row level security;
alter table public.students            enable row level security;
alter table public.lessons             enable row level security;
alter table public.tasks               enable row level security;
alter table public.task_codes          enable row level security;
alter table public.task_completions    enable row level security;
alter table public.rewards             enable row level security;
alter table public.redemptions         enable row level security;
alter table public.points_transactions enable row level security;
alter table public.notifications       enable row level security;
alter table public.activity_logs       enable row level security;
alter table public.settings            enable row level security;

-- القراءة
create policy users_read on public.users for select to authenticated
  using (id = auth.uid() or public.is_teacher());
create policy classes_read on public.classes for select to authenticated
  using (public.is_teacher() or id = public.my_class_id());
create policy students_read on public.students for select to authenticated
  using (public.is_teacher() or user_id = auth.uid());
create policy lessons_read on public.lessons for select to authenticated
  using (public.is_teacher() or class_id is null or class_id = public.my_class_id());
create policy tasks_read on public.tasks for select to authenticated
  using (public.is_teacher() or (status = 'active' and start_at <= now()
         and (class_id is null or class_id = public.my_class_id())));
create policy task_codes_read on public.task_codes for select to authenticated
  using (public.is_teacher());
create policy completions_read on public.task_completions for select to authenticated
  using (public.is_teacher() or student_id = public.my_student_id());
create policy rewards_read on public.rewards for select to authenticated
  using (public.is_teacher() or active);
create policy redemptions_read on public.redemptions for select to authenticated
  using (public.is_teacher() or student_id = public.my_student_id());
create policy points_read on public.points_transactions for select to authenticated
  using (public.is_teacher() or student_id = public.my_student_id());
create policy notifications_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy logs_read on public.activity_logs for select to authenticated
  using (public.is_teacher());
create policy settings_read on public.settings for select using (true);

-- الكتابة المباشرة مسموحة للمعلمة فقط على جداول الإعداد
create policy classes_write  on public.classes  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy lessons_write  on public.lessons  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy tasks_write    on public.tasks    for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy rewards_write  on public.rewards  for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
create policy settings_write on public.settings for update to authenticated using (public.is_teacher()) with check (public.is_teacher());
-- ملاحظة: لا توجد أي سياسة كتابة على points_transactions / task_completions / redemptions / students
-- ⇒ لا يمكن لأي مستخدم تعديلها إلا عبر الدوال الآمنة أعلاه.

-- صلاحيات الجداول (صريحة)
revoke all on all tables in schema public from anon, authenticated;
grant select on public.settings to anon, authenticated;
grant select on public.users, public.classes, public.students, public.lessons, public.tasks, public.task_codes,
                public.task_completions, public.rewards, public.redemptions, public.points_transactions,
                public.notifications, public.activity_logs, public.student_summary to authenticated;
grant insert, update, delete on public.classes, public.lessons, public.tasks, public.rewards to authenticated;
grant update on public.settings to authenticated;
grant all on all tables in schema public to service_role;

-- صلاحيات الدوال: نغلق الكل ثم نفتح العام فقط
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.needs_setup()                              to anon, authenticated;
grant execute on function public.bootstrap_teacher(text,text,text)          to anon, authenticated;
grant execute on function public.is_teacher(), public.my_student_id(), public.my_class_id(),
                          public.level_name(int)                            to authenticated;
grant execute on function public.admin_create_teacher(text,text,text),
                          public.admin_create_student(text,text,text,uuid,boolean),
                          public.admin_update_student(uuid,text,uuid,boolean,text),
                          public.admin_reset_password(uuid,text),
                          public.admin_delete_student(uuid),
                          public.admin_delete_demo_students(),
                          public.admin_adjust_points(uuid[],int,text,text),
                          public.teacher_mark_completed(uuid,uuid[],boolean),
                          public.teacher_review_completion(uuid,boolean,text),
                          public.teacher_undo_completion(uuid,text),
                          public.teacher_send_reminder(uuid,text),
                          public.teacher_decide_redemption(uuid,boolean,text),
                          public.create_flipped_template(uuid,timestamptz,text),
                          public.student_submit_task(uuid,text,text,text),
                          public.student_claim_code(text),
                          public.task_by_code(text),
                          public.student_redeem(uuid,text),
                          public.generate_my_due_reminders(),
                          public.mark_notifications_read(uuid[])    to authenticated;
-- الدوال التي تبدأ بـ _ داخلية ولا يمكن استدعاؤها من الموقع.
-- (student_balance / student_earned داخلية كذلك؛ الرصيد يُقرأ من student_summary)

-- تفعيل التحديث اللحظي للتنبيهات (اختياري)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ✅ انتهى. الخطوة التالية: افتحي الموقع وأنشئي حساب المعلمة من شاشة «الإعداد لأول مرة».
