import { useState } from 'react';
import { useLoad } from '../../lib/hooks';
import { loadStudentAll } from '../../lib/studentData';
import { TRACK_LIST, TX_KIND } from '../../lib/constants';
import { fmtDateTime } from '../../lib/format';
import { Card, Empty, ErrorBox, PageHeader, Spinner, TrackBadge } from '../../components/ui';

export default function History() {
  const { data, loading, error, reload } = useLoad(loadStudentAll);
  const [track, setTrack] = useState('');
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const list = data.txs.filter((t) => !track || t.track === track);
  return (
    <>
      <PageHeader icon="📜" title="سجل إنجازاتي" subtitle="كل نقطة حصلتِ عليها وسببها" />
      <div className="chips">
        <button className={`chip ${!track ? 'on' : ''}`} onClick={() => setTrack('')}>الكل</button>
        {TRACK_LIST.map((t) => <button key={t.key} className={`chip ${track === t.key ? 'on' : ''}`} onClick={() => setTrack(t.key)}>{t.dot} {t.short}</button>)}
      </div>
      {!list.length ? <Empty icon="📜" title="لا توجد سجلات بعد" /> : (
        <Card className="timeline">{list.map((t) => (
          <div key={t.id} className="tl-item">
            <div className={`tl-amt ${t.amount > 0 ? 'pos' : 'neg'}`}>{t.amount > 0 ? '+' : ''}{t.amount} ⭐</div>
            <div className="tl-body"><b>{t.reason}</b><div className="small muted">{TX_KIND[t.kind]} {t.track && <TrackBadge track={t.track} />} • {fmtDateTime(t.created_at)}</div></div>
          </div>))}</Card>
      )}
    </>
  );
}
