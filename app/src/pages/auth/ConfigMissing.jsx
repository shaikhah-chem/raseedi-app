export default function ConfigMissing() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 620 }}>
        <div className="auth-hero"><div className="auth-star">★</div><h1>✨ رصيدي الذهبي ✨</h1><p>خطوة أخيرة: ربط قاعدة البيانات</p></div>
        <ol className="steps">
          <li>افتحي مشروعك في <b>Supabase</b> ← Project Settings ← <b>API</b>.</li>
          <li>انسخي <b>Project URL</b> و <b>anon public key</b>.</li>
          <li>افتحي الملف <code>config.js</code> الموجود بجانب <code>index.html</code> والصقي القيمتين بين علامتي التنصيص.</li>
          <li>احفظي الملف وأعيدي رفع المجلد، ثم حدّثي الصفحة.</li>
        </ol>
        <pre className="code" dir="ltr">{`window.RASEEDI_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};`}</pre>
      </div>
    </div>
  );
}
