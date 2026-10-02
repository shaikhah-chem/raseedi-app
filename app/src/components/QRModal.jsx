import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Modal, useToast } from './ui';
import { fmtDateTime } from '../lib/format';

export const claimUrl = (code) => `${window.location.origin}${window.location.pathname}#/claim/${code}`;

export default function QRModal({ task, code, onClose }) {
  const [img, setImg] = useState('');
  const [big, setBig] = useState(false);
  const toast = useToast();
  const url = claimUrl(code);
  useEffect(() => { QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: '#2B2340', light: '#ffffff' } }).then(setImg); }, [url]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast('تم نسخ الرابط'); } catch { toast(url); } };
  return (
    <Modal open wide title={`رمز المهمة: ${task.title}`} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={copy}>🔗 نسخ رابط التسجيل</button>
        <a className="btn btn-ghost" href={img} download={`QR-${task.title}.png`}>⬇️ تنزيل الصورة</a>
        <button className="btn btn-ghost" onClick={() => window.print()}>🖨 طباعة</button>
        <button className="btn btn-primary" onClick={() => setBig(true)}>⛶ عرض على الشاشة</button></>}>
      <div className="qr-box print-area">
        <div className="qr-brand">✨ رصيدي الذهبي ✨</div>
        <h2>{task.title}</h2>
        {img && <img src={img} alt="QR" className="qr-img" />}
        <div className="qr-code" dir="ltr">{code}</div>
        <p>امسحي الرمز بكاميرا الجوال بعد تنفيذ النشاط، أو أدخلي الرمز في صفحة «مهامي»</p>
        <small className="muted">⭐ {task.points} • الموعد: {fmtDateTime(task.due_at)}</small>
      </div>
      <p className="muted small no-print">💡 للرصد التلقائي من نشاط خارجي (ورقة ذكية / اختبار): ضعي هذا الرابط في نهاية النشاط، وعند فتحه تُسجَّل المهمة للطالبة مباشرة:<br /><code dir="ltr" className="break">{url}</code></p>
      {big && (
        <div className="qr-full" onClick={() => setBig(false)}>
          <div className="qr-full-inner"><h1>{task.title}</h1>{img && <img src={img} alt="QR" />}<div className="qr-code" dir="ltr">{code}</div><small>اضغطي في أي مكان للإغلاق</small></div>
        </div>
      )}
    </Modal>
  );
}
