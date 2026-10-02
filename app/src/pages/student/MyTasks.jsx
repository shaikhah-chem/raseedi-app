import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoad } from '../../lib/hooks';
import { loadStudentAll } from '../../lib/studentData';
import { rpc } from '../../lib/supabase';
import { VERIFICATION } from '../../lib/constants';
import { compressImage, fmtDateTime, pts, timeLeft } from '../../lib/format';
import { Badge, Card, Empty, ErrorBox, Modal, PageHeader, Spinner, TrackBadge, useToast } from '../../components/ui';

export function celebrate(toast, res) {
  if (res?.status === 'pending') toast('أُرسل الإثبات ✅ ستُضاف النقاط بعد اعتماد المعلمة');
  else if (res?.points > 0) toast(`أحسنتِ! حصلتِ على ${pts(res.points)} ذهبية 🎉`);
  else if (res?.on_time === false) toast('سُجِّل إنجازك ✅ (بعد الموعد النهائي، لذا بدون نقاط)', 'info');
  else toast('سُجِّل إنجازك ✅');
  window.dispatchEvent(new Event('raseedi:notif'));
}

export default function MyTasks() {
  const toast = useToast(); const nav = useNavigate();
  const { data, loading, error, reload } = useLoad(loadStudentAll);
  const [code, setCode] = useState('');
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(null);
  const [showDone, setShowDone] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const cm = Object.fromEntries(data.comps.map((c) => [c.task_id, c]));
  const now = Date.now();
  const lessons = {};
  const others = [];
  data.tasks.forEach((t) => {
    if (t.lessons?.is_flipped) (lessons[t.lesson_id] ||= { lesson: t.lessons, tasks: [] }).tasks.push(t);
    else others.push(t);
  });
  const lessonList = Object.values(lessons).filter((g) => g.tasks.some((t) => !cm[t.id] || new Date(t.due_at) > now || showDone));
  const openOthers = others.filter((t) => new Date(t.due_at) > now).sort((a, b) => (cm[a.id] ? 1 : 0) - (cm[b.id] ? 1 : 0));
  const past = others.filter((t) => new Date(t.due_at) <= now);

  const done = async (t) => {
    setBusy(t.id);
    try { const r = await rpc('student_submit_task', { p_task_id: t.id }); celebrate(toast, r); reload(true); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(null); }
  };
  const claim = (e) => { e.preventDefault(); if (code.trim()) nav(`/claim/${code.trim().toUpperCase()}`); };

  const Item = ({ t }) => {
    const c = cm[t.id]; const tl = timeLeft(t.due_at); const v = VERIFICATION[t.verification];
    let status;
    if (c?.status === 'approved') status = <Badge cls="badge-ok">✅ مكتمل{c.points_awarded ? ` +${c.points_awarded}` : ''}</Badge>;
    else if (c?.status === 'pending') status = <Badge cls="badge-warn">⏳ بانتظار الاعتماد</Badge>;
    else if (tl.over) status = <Badge cls="badge-muted">انتهى الموعد</Badge>;
    else status = <Badge cls="badge-todo">لم يُنجز</Badge>;
    return (
      <div className={`stask ${c ? 'is-done' : ''}`}>
        <div className="stask-check" aria-hidden>{c?.status === 'approved' ? '☑️' : c ? '⏳' : '⬜'}</div>
        <div className="stask-main">
          <div className="stask-title"><b>{t.title}</b>{t.is_optional && <Badge cls="badge-gold">اختيارية</Badge>}</div>
          {t.description && <div className="muted small">{t.description}</div>}
          <div className="stask-meta small">
            <span className="gold-num">⭐ {t.points === 1 ? 'نقطة' : t.points === 2 ? 'نقطتان' : `${t.points} نقاط`}</span>
            <span>الحالة: {status}</span>
            <span className={tl.urgent && !c ? 'warn-txt' : 'muted'}>🗓 {fmtDateTime(t.due_at)}{!c && !tl.over ? ` • ${tl.text}` : ''}</span>
            <TrackBadge track={t.track} />
          </div>
          {!c && !tl.over && (
            <div className="stask-actions">
              {t.external_url && <a className="btn btn-sm btn-ghost" href={t.external_url} target="_blank" rel="noreferrer">🔗 فتح النشاط</a>}
              {t.verification === 'self' && <button className="btn btn-sm btn-primary" disabled={busy === t.id} onClick={() => done(t)}>✔️ أنجزتُ المهمة</button>}
              {t.verification === 'proof' && <button className="btn btn-sm btn-primary" onClick={() => setProof(t)}>📎 رفع إثبات الإنجاز</button>}
              {t.verification === 'code' && <span className="muted small">🔳 امسحي رمز QR أو أدخلي رمز المهمة في الأعلى بعد التنفيذ</span>}
              {t.verification === 'teacher' && <span className="muted small">👩‍🏫 ترصدها المعلمة في الحصة</span>}
            </div>
          )}
          {!c && tl.over && t.verification !== 'teacher' && t.verification !== 'code' && (
            <div className="stask-actions"><button className="btn btn-sm btn-ghost" onClick={() => t.verification === 'proof' ? setProof(t) : done(t)}>تسجيل متأخر (بدون نقاط)</button></div>
          )}
          {!c && <small className="muted">{v.icon} {v.label}</small>}
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader icon="📚" title="مهامي" subtitle="أنجزي المهمة قبل موعدها لتحصلي على نقاطها كاملة" />
      <Card className="code-card">
        <form onSubmit={claim} className="code-form">
          <span>🔳 لديكِ رمز مهمة؟</span>
          <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={8} aria-label="رمز المهمة" />
          <button className="btn btn-primary" disabled={!code.trim()}>تسجيل</button>
        </form>
      </Card>

      {lessonList.map((g) => {
        const req = g.tasks.filter((t) => !t.is_optional); const dn = req.filter((t) => cm[t.id]?.status === 'approved').length;
        return (
          <Card key={g.lesson.id} className="lesson-card">
            <div className="lesson-head">
              <div><small className="eyebrow">مهمتي قبل الحصة</small><h2>📚 درس: {g.lesson.title}</h2></div>
              <div className="lesson-score"><b>{dn}/{req.length}</b><small>مكتمل</small></div>
            </div>
            <div className="progress"><div className="progress-fill" style={{ width: `${req.length ? (dn / req.length) * 100 : 0}%`, background: 'var(--purple-2)' }} /></div>
            <div className="stask-list">{g.tasks.map((t) => <Item key={t.id} t={t} />)}</div>
          </Card>
        );
      })}

      <h2 className="section-title">مهام أخرى</h2>
      {!openOthers.length ? <Empty icon="🌿" title="لا توجد مهام أخرى حاليًا" /> : <Card className="stask-list">{openOthers.map((t) => <Item key={t.id} t={t} />)}</Card>}

      <button className="btn btn-ghost" onClick={() => setShowDone(!showDone)}>{showDone ? 'إخفاء' : 'عرض'} المهام المنتهية ({past.length})</button>
      {showDone && <Card className="stask-list">{past.map((t) => <Item key={t.id} t={t} />)}</Card>}

      {proof && <ProofModal task={proof} onClose={() => setProof(null)} onDone={(r) => { setProof(null); celebrate(toast, r); reload(true); }} />}
    </>
  );
}

function ProofModal({ task, onClose, onDone }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { setImg(await compressImage(f)); } catch { toast('تعذّر قراءة الصورة', 'err'); }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !url.trim() && !img) return toast('أرفقي صورة أو رابطًا أو وصفًا', 'err');
    setBusy(true);
    try { const r = await rpc('student_submit_task', { p_task_id: task.id, p_proof_text: text.trim() || null, p_proof_url: url.trim() || null, p_proof_image: img }); onDone(r); }
    catch (e2) { toast(e2.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open title={`إثبات إنجاز: ${task.title}`} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="field"><span>📷 صورة الإنجاز</span><input type="file" accept="image/*" capture="environment" onChange={pick} /></label>
        {img && <img src={img} alt="معاينة" className="proof-preview" />}
        <label className="field"><span>🔗 رابط (اختياري)</span><input dir="ltr" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></label>
        <label className="field"><span>✍️ وصف مختصر (اختياري)</span><textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} /></label>
        <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button><button className="btn btn-primary" disabled={busy}>{busy ? 'جارٍ الإرسال...' : 'إرسال الإثبات'}</button></div>
      </form>
    </Modal>
  );
}
