import { createClient } from '@supabase/supabase-js';

const cfg = window.RASEEDI_CONFIG || {};
export const SUPABASE_URL = (cfg.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '').trim();
export const SUPABASE_ANON_KEY = (cfg.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export const EMAIL_DOMAIN = 'raseedi.app';
export const usernameToEmail = (u) => {
  const v = String(u || '').trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${EMAIL_DOMAIN}`;
};

// رسائل الأخطاء بالعربية
export function arabicError(err) {
  if (!err) return '';
  const m = err.message || String(err);
  if (/Invalid login credentials/i.test(m)) return 'اسم المستخدم أو كلمة المرور غير صحيحة';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'تعذّر الاتصال بالخادم — تحققي من الإنترنت';
  if (/JWT expired/i.test(m)) return 'انتهت الجلسة، سجّلي الدخول من جديد';
  if (/permission denied|42501|row-level security/i.test(m)) return 'غير مصرح بهذه العملية';
  if (/duplicate key/i.test(m)) return 'هذه البيانات موجودة مسبقًا';
  if (/rate limit/i.test(m)) return 'محاولات كثيرة، انتظري قليلًا ثم أعيدي المحاولة';
  return m;
}

// استدعاء دالة على الخادم مع رمي خطأ عربي
export async function rpc(name, params = {}) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw new Error(arabicError(error));
  return data;
}

// تنفيذ استعلام ورمي الخطأ
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(arabicError(error));
  return data;
}

// جلب كل الصفوف على دفعات (Supabase يعيد 1000 صف كحد أقصى في الطلب الواحد)
export async function fetchAll(build, pageSize = 1000) {
  let from = 0; const out = [];
  for (;;) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw new Error(arabicError(error));
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
