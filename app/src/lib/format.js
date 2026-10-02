const LOCALE = 'ar-SA-u-ca-gregory-nu-latn';

export const fmtDateTime = (d) => d ? new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
}).format(new Date(d)) : '—';

export const fmtDate = (d) => d ? new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';
export const fmtShort = (d) => d ? new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(d)) : '—';

export function relTime(d) {
  if (!d) return '—';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  const f = (n, one, two, many) => n === 1 ? one : n === 2 ? two : `${n} ${many}`;
  if (s < 60) return 'الآن';
  if (s < 3600) return 'منذ ' + f(Math.floor(s / 60), 'دقيقة', 'دقيقتين', 'دقائق');
  if (s < 86400) return 'منذ ' + f(Math.floor(s / 3600), 'ساعة', 'ساعتين', 'ساعات');
  if (s < 86400 * 30) return 'منذ ' + f(Math.floor(s / 86400), 'يوم', 'يومين', 'أيام');
  return fmtDate(d);
}

export function timeLeft(due) {
  const s = (new Date(due).getTime() - Date.now()) / 1000;
  if (s <= 0) return { text: 'انتهى الموعد', urgent: false, over: true };
  if (s < 3600) return { text: `متبقٍ ${Math.ceil(s / 60)} دقيقة`, urgent: true };
  if (s < 86400) return { text: `متبقٍ ${Math.ceil(s / 3600)} ساعة`, urgent: true };
  const d = Math.floor(s / 86400);
  return { text: d === 1 ? 'متبقٍ يوم واحد' : d === 2 ? 'متبقٍ يومان' : `متبقٍ ${d} أيام`, urgent: false };
}

export const pts = (n) => {
  const a = Math.abs(n);
  if (a === 1) return 'نقطة';
  if (a === 2) return 'نقطتان';
  if (a >= 3 && a <= 10) return `${a} نقاط`;
  return `${a} نقطة`;
};

// datetime-local <-> ISO
export const toLocalInput = (d) => {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
export const fromLocalInput = (v) => new Date(v).toISOString();

// تصدير CSV متوافق مع Excel (UTF-8 BOM)
export function downloadCSV(filename, headers, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ضغط صورة الإثبات قبل الرفع
export function compressImage(file, maxSide = 1100, quality = 0.62) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let q = quality, out = c.toDataURL('image/jpeg', q);
      while (out.length > 550000 && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = reject; img.src = url;
  });
}

export const randomPassword = () => String(Math.floor(100000 + Math.random() * 900000));
