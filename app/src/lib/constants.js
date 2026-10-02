export const SITE_NAME = 'رصيدي الذهبي';
export const MOTTO = 'كل مبادرة... تصنع فرقًا';

export const TRACKS = {
  commitment:    { key: 'commitment',    label: 'مسار الالتزام',  short: 'التزام',  dot: '🟣', color: '#7B5CB8', soft: '#F0EBF9',
                   items: ['إنجاز المهمة قبل الموعد', 'الاستعداد للحصة', 'إكمال متطلبات الصف المقلوب', 'الالتزام بالتعليمات'] },
  initiative:    { key: 'initiative',    label: 'مسار المبادرة',  short: 'مبادرة',  dot: '🟡', color: '#C9962B', soft: '#FBF3E1',
                   items: ['اقتراح فكرة', 'تنفيذ مبادرة', 'تطوير نشاط', 'تقديم فكرة إبداعية', 'التطوع لتنفيذ مهمة'] },
  participation: { key: 'participation', label: 'مسار المشاركة',  short: 'مشاركة',  dot: '🔵', color: '#3B82C4', soft: '#E8F1FA',
                   items: ['المشاركة في النقاش', 'المشاركة في النشاط', 'التعاون مع المجموعة', 'دعم زميلات المجموعة بطريقة إيجابية'] },
  excellence:    { key: 'excellence',    label: 'مسار التميز',    short: 'تميز',    dot: '🟢', color: '#2E9D6E', soft: '#E6F5EE',
                   items: ['إنجاز مهمة إثرائية', 'إنتاج مورد تعليمي', 'تقديم حل إبداعي', 'إنجاز مشروع متميز'] },
};
export const TRACK_LIST = Object.values(TRACKS);

export const LEVELS = [
  { min: 0,  max: 4,   icon: '⭐',     name: 'بداية ذهبية' },
  { min: 5,  max: 9,   icon: '⭐⭐',   name: 'خطوة ذهبية' },
  { min: 10, max: 19,  icon: '⭐⭐⭐', name: 'مبادرة نشطة' },
  { min: 20, max: 29,  icon: '🌟',     name: 'نجمة المبادرة' },
  { min: 30, max: null, icon: '🏆',    name: 'صانعة أثر' },
];
export function levelFor(earned = 0) {
  let idx = 0;
  LEVELS.forEach((l, i) => { if (earned >= l.min) idx = i; });
  const cur = LEVELS[idx]; const next = LEVELS[idx + 1] || null;
  return { ...cur, index: idx, next, toNext: next ? next.min - earned : 0 };
}

export const VERIFICATION = {
  self:    { label: 'تأكيد الطالبة', hint: 'تضغط الطالبة «أنجزتُ المهمة» وتُحتسب النقاط فورًا إن كان قبل الموعد', icon: '✅' },
  code:    { label: 'رمز المهمة / QR', hint: 'تمسح الطالبة رمز QR أو تُدخل رمز المهمة بعد تنفيذ النشاط', icon: '🔳' },
  proof:   { label: 'رفع إثبات + اعتماد', hint: 'ترفع الطالبة صورة أو رابطًا، وتُحتسب النقاط بعد اعتمادك', icon: '📎' },
  teacher: { label: 'رصد المعلمة', hint: 'ترصدين الإنجاز بنفسك من صفحة المهمة', icon: '👩‍🏫' },
};

export const TASK_TYPES = ['اختبار قبلي', 'فيديو', 'أسئلة', 'ورقة عمل', 'ورقة ذكية', 'نشاط', 'مهمة أدائية', 'إثرائية', 'مشروع', 'مبادرة', 'أخرى'];

export const TX_KIND = {
  task: 'إنجاز مهمة', manual_add: 'إضافة', manual_deduct: 'خصم',
  redemption: 'استبدال', refund: 'استرجاع', reversal: 'إلغاء إنجاز',
};

export const REDEMPTION_STATUS = {
  pending:  { label: 'بانتظار الاعتماد', cls: 'badge-warn' },
  approved: { label: 'معتمد', cls: 'badge-ok' },
  rejected: { label: 'مرفوض (أُعيدت النقاط)', cls: 'badge-muted' },
};
