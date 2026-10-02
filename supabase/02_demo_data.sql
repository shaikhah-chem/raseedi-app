-- =====================================================================
--  ✨ رصيدي الذهبي ✨ — بيانات تجريبية (اختياري)
--  شغّليه بعد 01_schema.sql لتجربة الموقع فورًا.
--
--  حساب المعلمة التجريبي :  teacher  /  Gold@2026
--  حساب الطالبة التجريبي :  sara     /  123456
--  بقية الطالبات         :  s02 ... s10 / 123456
--
--  لحذف الطالبات التجريبيات لاحقًا: الإعدادات ← «حذف البيانات التجريبية»
-- =====================================================================
do $$
declare
  v_t uuid; v_class uuid; v_lesson uuid; v_sid uuid; v_uid uuid;
  v_tasks uuid[]; v_task uuid; i int; j int;
  v_names text[] := array['سارة العتيبي','نورة الحربي','ريم المطيري','جود الشمري','لمى القحطاني',
                          'هيا الدوسري','رهف السبيعي','غلا العنزي','شهد الرشيدي','دانة الجهني'];
  v_users text[] := array['sara','s02','s03','s04','s05','s06','s07','s08','s09','s10'];
  v_due timestamptz := date_trunc('day', now() at time zone 'Asia/Riyadh') + interval '1 day 22 hours';
  v_students uuid[] := '{}';
begin
  v_due := v_due at time zone 'Asia/Riyadh';

  -- المعلمة
  if exists (select 1 from public.users where username = 'teacher') then
    raise notice 'البيانات التجريبية موجودة مسبقًا'; return;
  end if;
  v_t := public._create_auth_user('teacher', 'Gold@2026', 'أ. شيخه المطيري');
  insert into public.users(id, role, full_name, username) values (v_t, 'teacher', 'أ. شيخه المطيري', 'teacher');

  -- نعمل باسم المعلمة حتى تُسجَّل العمليات باسمها
  perform set_config('request.jwt.claims', json_build_object('sub', v_t, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_t::text, true);

  insert into public.classes(grade, name) values ('أول ثانوي', '1/1') returning id into v_class;

  for i in 1..10 loop
    v_sid := public.admin_create_student(v_names[i], v_users[i], '123456', v_class, true);
    v_students := v_students || v_sid;
  end loop;

  -- المكافآت
  insert into public.rewards(title, description, icon, cost, max_per_student, requires_approval, sort_order) values
   ('نقطة مشاركة إضافية في نشاط', 'تُضاف درجة مشاركة واحدة في نشاط صفي تختارينه', '🙋‍♀️', 5, 3, true, 1),
   ('+1 درجة في مهمة مؤهلة', 'وفق سياسة المعلمة: درجة واحدة في مهمة أدائية مؤهلة', '📈', 5, 2, true, 2),
   ('تأجيل موعد تسليم مهمة يومًا واحدًا', 'لمهمة واحدة تختارينها (عدا الاختبارات)', '⏳', 6, 1, true, 3),
   ('اختيار نشاط إثرائي', 'اختاري النشاط الإثرائي القادم لمجموعتك', '🧪', 8, null, true, 4),
   ('امتياز تعليمي: مساعدة المعلمة في عرض تجربة', 'تشاركين المعلمة في تنفيذ تجربة عرض أمام الفصل', '🥽', 10, 1, true, 5);

  -- درس المخاليط – الصف المقلوب (5 مهام)
  v_lesson := public.create_flipped_template(v_class, v_due, 'المخاليط');
  select array_agg(id order by sort_order) into v_tasks from public.tasks where lesson_id = v_lesson;

  -- إنجازات واقعية: الاختبار القبلي 8/10، الفيديو 7/10، الأسئلة 5/10، الورقة 4/10، الإثرائية 2/10
  for i in 1..10 loop
    if i <= 8 then perform public._complete_task(v_tasks[1], v_students[i], 'self', 'approved', true); end if;
    if i <= 7 then perform public._complete_task(v_tasks[2], v_students[i], 'self', 'approved', true); end if;
    if i <= 5 then perform public._complete_task(v_tasks[3], v_students[i], 'proof', 'approved', true,
                                                 'أجبت عن الأسئلة الخمسة في دفتري'); end if;
    if i = 6 then perform public._complete_task(v_tasks[3], v_students[i], 'proof', 'pending', true,
                                                'رابط إجابتي', 'https://example.com/answers'); end if;
    if i <= 4 then perform public._complete_task(v_tasks[4], v_students[i], 'code', 'approved', true); end if;
    if i <= 2 then perform public._complete_task(v_tasks[5], v_students[i], 'proof', 'approved', true,
                                                 'الهواء الجوي: مخلوط متجانس لأن مكوناته موزعة بانتظام'); end if;
  end loop;

  -- سجلات نقاط سابقة متنوعة (على مدى الأسابيع الماضية)
  for i in 1..10 loop
    for j in 1..(3 + (11 - i) / 2) loop
      insert into public.points_transactions(student_id, amount, kind, track, reason, created_by, created_at)
      values (v_students[i],
              (array[1,1,2,3,1,2])[1 + (i + j) % 6],
              'manual_add',
              (array['participation','commitment','commitment','initiative','participation','excellence'])[1 + (i + j) % 6],
              (array['مشاركة فعالة في النقاش','الاستعداد للحصة','تنفيذ المهمة في الوقت المحدد',
                     'مبادرة تعليمية: اقتراح نشاط للمجموعة','التعاون مع المجموعة','إنجاز مهمة إثرائية'])[1 + (i + j) % 6],
              v_t, now() - ((j * 3 + i) || ' days')::interval);
    end loop;
  end loop;

  -- مثال خصم مع سبب
  insert into public.points_transactions(student_id, amount, kind, reason, created_by, created_at)
  values (v_students[7], -1, 'manual_deduct', 'تسجيل مهمة دون تنفيذها فعليًا', v_t, now() - interval '5 days');

  -- مثال استبدال معتمد
  insert into public.redemptions(reward_id, student_id, cost, status, decided_by, decided_at, created_at)
  select r.id, v_students[2], r.cost, 'approved', v_t, now() - interval '2 days', now() - interval '3 days'
  from public.rewards r where r.sort_order = 1;
  insert into public.points_transactions(student_id, amount, kind, reason, redemption_id, created_by, created_at)
  select v_students[2], -r.cost, 'redemption', 'استبدال مكافأة: ' || r.title, (select id from public.redemptions limit 1), (select user_id from public.students where id = v_students[2]), now() - interval '3 days'
  from public.rewards r where r.sort_order = 1;

  raise notice 'تم إنشاء البيانات التجريبية ✅';
end $$;
