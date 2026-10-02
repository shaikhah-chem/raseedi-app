# قاعدة بيانات «رصيدي الذهبي»

## الجداول والعلاقات

```
auth.users (حسابات الدخول — Supabase)
   │ 1:1
users ──────────────┐  (role: teacher | student)
   │ 1:1            │
students ── class_id ──► classes
   │                │
   ├──< task_completions >── tasks ──► classes
   │                         │   └──► lessons (درس الصف المقلوب)
   │                         └── 1:1 task_codes (رمز QR — مخفي عن الطالبات)
   ├──< points_transactions ──► tasks / redemptions / users(created_by)
   └──< redemptions >── rewards
users ──< notifications
users ──< activity_logs (actor)
settings (صف واحد)
```

| الجدول | الوصف | أهم الأعمدة |
|---|---|---|
| `users` | كل مستخدم مع دوره | id, role, full_name, username |
| `classes` | الصف والفصل | grade, name |
| `students` | الطالبات | user_id, class_id, full_name, username, active, is_demo |
| `lessons` | دروس «مهمتي قبل الحصة» | title, class_id, is_flipped |
| `tasks` | المهام | title, description, task_type, track, points, start_at, due_at, class_id, lesson_id, is_optional, verification, external_url |
| `task_codes` | رمز كل مهمة لـ QR | task_id, code |
| `task_completions` | الإنجازات | task_id, student_id, status, method, submitted_at, on_time, proof_*, points_awarded, reviewed_by |
| `points_transactions` | **سجل النقاط**: الرصيد = مجموع العمليات | student_id, amount (+/−), kind, track, reason, task_id, redemption_id, created_by, created_at |
| `rewards` | المكافآت | title, cost, max_per_student, stock, requires_approval, active |
| `redemptions` | عمليات الاستبدال | reward_id, student_id, cost, status, decided_by |
| `notifications` | التنبيهات | user_id, title, body, read_at |
| `activity_logs` | سجل التدقيق | actor_id, actor_name, action, entity, details, created_at |
| `settings` | إعدادات الموقع | reward_policy, teacher_credit, school_name |

العرض `student_summary`: الرصيد، النقاط المكتسبة، المبادرات، المهام المنجزة، آخر نشاط. يحترم صلاحيات المستخدم.

## الدوال الآمنة (RPC)

| الدالة | من يستدعيها | الوظيفة |
|---|---|---|
| `bootstrap_teacher` | زائر (مرة واحدة) | إنشاء أول معلمة |
| `admin_create_student` / `admin_update_student` / `admin_delete_student` / `admin_reset_password` | المعلمة | إدارة الطالبات |
| `admin_adjust_points` | المعلمة | إضافة أو خصم نقاط (السبب إلزامي، والرصيد لا يصبح سالبًا) |
| `teacher_mark_completed` / `teacher_review_completion` / `teacher_undo_completion` | المعلمة | رصد الإنجاز، واعتماد الإثبات، والإلغاء مع عكس النقاط |
| `teacher_send_reminder` | المعلمة | تذكير من لم تُكمل |
| `teacher_decide_redemption` | المعلمة | اعتماد الاستبدال أو رفضه (الرفض يعيد النقاط) |
| `create_flipped_template` | المعلمة | قالب درس المخاليط (5 مهام) |
| `student_submit_task` | الطالبة | تسجيل إنجاز أو رفع إثبات |
| `student_claim_code` / `task_by_code` | الطالبة | التسجيل برمز المهمة أو QR |
| `student_redeem` | الطالبة | الاستبدال (يتحقق من الرصيد والحد الأعلى والكمية) |
| `generate_my_due_reminders` | الطالبة | تنبيهات «تبقى أقل من يوم» |

الدوال التي تبدأ بـ `_` داخلية ولا يمكن استدعاؤها من المتصفح. `_add_points` هي **المكان الوحيد** الذي يُكتب منه في سجل النقاط.
