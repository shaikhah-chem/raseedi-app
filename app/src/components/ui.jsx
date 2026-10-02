import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TRACKS } from '../lib/constants';

/* ---------- Toast ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const show = useCallback((msg, type = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), type === 'err' ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast toast-${t.type}`}>{t.type === 'err' ? '⚠️ ' : t.type === 'ok' ? '✓ ' : ''}{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide, footer }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Confirm / Prompt ---------- */
const DialogCtx = createContext(null);
export const useDialog = () => useContext(DialogCtx);
export function DialogProvider({ children }) {
  const [st, setSt] = useState(null);
  const [val, setVal] = useState('');
  const resolver = useRef(null);
  const open = useCallback((opts) => new Promise((res) => { resolver.current = res; setVal(opts.defaultValue || ''); setSt(opts); }), []);
  const close = (v) => { resolver.current?.(v); setSt(null); };
  const api = useMemo(() => ({
    confirm: (title, body, okLabel = 'تأكيد', danger = false) => open({ title, body, okLabel, danger }),
    prompt: (title, label, opts = {}) => open({ title, label, input: true, okLabel: 'حفظ', ...opts }),
  }), [open]);
  return (
    <DialogCtx.Provider value={api}>
      {children}
      <Modal open={!!st} onClose={() => close(st?.input ? null : false)} title={st?.title}
        footer={<>
          <button className="btn btn-ghost" onClick={() => close(st?.input ? null : false)}>إلغاء</button>
          <button className={`btn ${st?.danger ? 'btn-danger' : 'btn-primary'}`} disabled={st?.input && st?.required !== false && !val.trim()}
            onClick={() => close(st?.input ? val.trim() : true)}>{st?.okLabel}</button>
        </>}>
        {st?.body && <p className="muted" style={{ marginTop: 0 }}>{st.body}</p>}
        {st?.input && (
          <label className="field">
            <span>{st.label}</span>
            <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} placeholder={st.placeholder || ''}
              onKeyDown={(e) => e.key === 'Enter' && val.trim() && close(val.trim())} />
          </label>
        )}
      </Modal>
    </DialogCtx.Provider>
  );
}

/* ---------- Small pieces ---------- */
export const Card = ({ className = '', children, ...p }) => <div className={`card ${className}`} {...p}>{children}</div>;

export function PageHeader({ icon, title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{icon && <span className="ph-icon" aria-hidden>{icon}</span>}{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Stat({ icon, label, value, sub, tone = 'purple' }) {
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-icon" aria-hidden>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

export function Progress({ value, max, color, label, showText = true, height = 10 }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress-wrap">
      {label && <div className="progress-label"><span>{label}</span>{showText && <b>{value}/{max} <small className="muted">({pct}%)</small></b>}</div>}
      <div className="progress" style={{ height }} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <div className="progress-fill" style={{ width: pct + '%', background: color }} />
      </div>
    </div>
  );
}

export const Badge = ({ cls = '', children }) => <span className={`badge ${cls}`}>{children}</span>;
export const TrackBadge = ({ track }) => {
  const t = TRACKS[track]; if (!t) return null;
  return <span className="badge" style={{ background: t.soft, color: '#2B2340', borderColor: t.color + '55' }}>
    <i className="dot" style={{ background: t.color }} />{t.short}</span>;
};
export const Spinner = ({ text = 'جارٍ التحميل...' }) => <div className="spinner-wrap"><div className="spinner" />{text}</div>;
export const Empty = ({ icon = '✨', title, children }) => (
  <div className="empty"><div className="empty-icon">{icon}</div><b>{title}</b>{children && <div className="muted">{children}</div>}</div>
);
export const ErrorBox = ({ error, onRetry }) => error ? (
  <div className="alert alert-err">⚠️ {error} {onRetry && <button className="btn btn-sm btn-ghost" onClick={() => onRetry()}>إعادة المحاولة</button>}</div>
) : null;

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
          {t.label}{t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const Stars = ({ n, big }) => <span className={`stars ${big ? 'stars-big' : ''}`}>⭐ {n}</span>;

/* ---------- اختيار طالبات ---------- */
export function StudentPicker({ students, classes, value, onChange }) {
  const [cls, setCls] = useState('');
  const [qs, setQs] = useState('');
  const list = students.filter((s) => s.active && (!cls || s.class_id === cls) && (!qs || s.full_name.includes(qs)));
  const allSel = list.length > 0 && list.every((s) => value.includes(s.id));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const toggleAll = () => onChange(allSel ? value.filter((id) => !list.some((s) => s.id === id)) : [...new Set([...value, ...list.map((s) => s.id)])]);
  return (
    <div className="picker">
      <div className="picker-bar">
        <select value={cls} onChange={(e) => setCls(e.target.value)} aria-label="الفصل">
          <option value="">كل الفصول</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.grade} — {c.name}</option>)}
        </select>
        <input placeholder="بحث بالاسم..." value={qs} onChange={(e) => setQs(e.target.value)} />
        <button type="button" className="btn btn-sm btn-ghost" onClick={toggleAll}>{allSel ? 'إلغاء التحديد' : 'تحديد الكل'}</button>
      </div>
      <div className="picker-list">
        {list.map((s) => (
          <label key={s.id} className={`chip-check ${value.includes(s.id) ? 'on' : ''}`}>
            <input type="checkbox" checked={value.includes(s.id)} onChange={() => toggle(s.id)} />{s.full_name}
          </label>
        ))}
        {!list.length && <span className="muted">لا توجد طالبات</span>}
      </div>
      <div className="muted small">المحدد: {value.length}</div>
    </div>
  );
}
