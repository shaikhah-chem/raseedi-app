import { Card, PageHeader } from '../components/ui';
import { LEVELS, TRACK_LIST } from '../lib/constants';
import { useAuth } from '../lib/auth';

const TIPS = ['أنجزي المهمة في وقتها.', 'بادري بالمشاركة.', 'قدّمي فكرة.', 'شاركي في الأنشطة.',
  'أنجزي المهام الإثرائية.', 'تعاوني مع مجموعتك.', 'كوني مستعدة للحصة.'];

export default function HowTo() {
  const { settings } = useAuth();
  return (
    <>
      <PageHeader icon="💡" title="كيف أجمع نقاطي؟" subtitle="دليل بسيط للحصول على النقاط الذهبية" />
      <div className="grid-2">
        <Card>
          <h3>كيف تحصلين على النقاط الذهبية؟</h3>
          <ul className="check-list">{TIPS.map((t) => <li key={t}>✔️ {t}</li>)}</ul>
        </Card>
        <Card>
          <h3>⏰ المسارعة بعدل</h3>
          <p>لا يعتمد النظام على «أول من تدخل». <b>كل طالبة تُنجز المهمة قبل الموعد النهائي تحصل على نقاطها كاملة.</b></p>
          <p className="muted">المهام الاختيارية والإثرائية تمنحكِ نقاطًا إضافية لمبادرتك.</p>
          <h3>🔳 طرق تسجيل الإنجاز</h3>
          <ul className="plain">
            <li>✅ الضغط على «أنجزتُ المهمة».</li>
            <li>🔳 مسح رمز QR أو إدخال رمز المهمة.</li>
            <li>📎 رفع إثبات (صورة / رابط) لتعتمده المعلمة.</li>
            <li>👩‍🏫 رصد المعلمة مباشرة في الحصة.</li>
          </ul>
        </Card>
      </div>

      <h2 className="section-title">مسارات النقاط</h2>
      <div className="grid-4">
        {TRACK_LIST.map((t) => (
          <Card key={t.key} className="track-card" style={{ borderTopColor: t.color }}>
            <h3><i className="dot" style={{ background: t.color }} /> {t.label}</h3>
            <ul className="plain small">{t.items.map((i) => <li key={i}>• {i}</li>)}</ul>
          </Card>
        ))}
      </div>

      <h2 className="section-title">المستويات</h2>
      <Card>
        <div className="levels">
          {LEVELS.map((l) => (
            <div key={l.name} className="level-step"><div className="level-icon">{l.icon}</div><b>{l.name}</b>
              <small className="muted">{l.max ? `${l.min} – ${l.max}` : `${l.min}+`} نقطة</small></div>
          ))}
        </div>
        <p className="muted small">المستوى يُحسب من مجموع النقاط التي اكتسبتِها، ولا ينخفض عند استبدال المكافآت. لا يوجد ترتيب بين الطالبات — كل طالبة ترى تقدمها الشخصي فقط.</p>
      </Card>

      <Card className="quote-card">
        <p>«النقاط ليست هدفًا بحد ذاتها...<br />بل وسيلة لنحتفي بمبادرتك وتقدمك 🌟»</p>
        {settings?.reward_policy && <small>{settings.reward_policy}</small>}
      </Card>
    </>
  );
}
