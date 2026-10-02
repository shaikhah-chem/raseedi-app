import { Link } from 'react-router-dom';
import { supabase, q, rpc } from '../lib/supabase';
import { useLoad } from '../lib/hooks';
import { relTime } from '../lib/format';
import { Card, Empty, ErrorBox, PageHeader, Spinner, useToast } from '../components/ui';

export default function Notifications() {
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() =>
    q(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(150)));
  const unread = (data || []).filter((n) => !n.read_at).length;

  const markAll = async () => {
    try { await rpc('mark_notifications_read', { p_ids: null }); await reload(true); window.dispatchEvent(new Event('raseedi:notif')); toast('تم تعليم الكل كمقروء'); }
    catch (e) { toast(e.message, 'err'); }
  };
  const markOne = async (n) => {
    if (n.read_at) return;
    await rpc('mark_notifications_read', { p_ids: [n.id] }).catch(() => {});
    reload(true); window.dispatchEvent(new Event('raseedi:notif'));
  };

  return (
    <>
      <PageHeader icon="🔔" title="التنبيهات" subtitle={unread ? `لديكِ ${unread} تنبيه غير مقروء` : 'لا توجد تنبيهات جديدة'}
        actions={unread > 0 && <button className="btn btn-ghost" onClick={markAll}>تعليم الكل كمقروء</button>} />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Spinner /> : !data?.length ? <Empty icon="🔕" title="لا توجد تنبيهات بعد" /> : (
        <Card className="list-card">
          {data.map((n) => {
            const body = (
              <>
                <div className="notif-icon" aria-hidden>{n.icon}</div>
                <div className="notif-txt"><b>{n.title}</b>{n.body && <span className="muted">{n.body}</span>}</div>
                <small className="muted nowrap">{relTime(n.created_at)}</small>
                {!n.read_at && <i className="unread-dot" aria-label="غير مقروء" />}
              </>
            );
            return n.link
              ? <Link key={n.id} to={n.link.replace(/^#/, '')} className={`notif ${n.read_at ? '' : 'unread'}`} onClick={() => markOne(n)}>{body}</Link>
              : <div key={n.id} className={`notif ${n.read_at ? '' : 'unread'}`} onClick={() => markOne(n)}>{body}</div>;
          })}
        </Card>
      )}
    </>
  );
}
