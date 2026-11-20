/* 🧂 ربط «مختبر المركبات الأيونية» بزر «سحب النقاط من المنصات» */
(function(){
  var CFG = {apiKey:"AIzaSyBq067CBAa0tLJxNMf60nObygvnRTgYwlI",authDomain:"chem-lab-shaikha.firebaseapp.com",projectId:"chem-lab-shaikha",storageBucket:"chem-lab-shaikha.firebasestorage.app",messagingSenderId:"305599144472",appId:"1:305599144472:web:ae27c01b81b925c238d96d"};
  var COL = "icl_results";
  var PTS_DONE = 2;    // نقطتان لإنهاء النشاط
  var PTS_MASTER = 1;  // نقطة إضافية لمن تحصل على 70% فأكثر
  var MASTER = 70;
  if (typeof fetchItems !== "function" || typeof firebase === "undefined") return;
  var original = fetchItems;
  function app(){ return firebase.apps.find(function(a){ return a.name === "mizan"; }) || firebase.initializeApp(CFG, "mizan"); }
  function user(){ try { return app().auth().currentUser; } catch(e){ return null; } }

  fetchItems = async function(){
    var r = await original();
    S.links.icl = S.links.icl || {};
    if (!user()) { r.errs.push("مختبر المركبات الأيونية: سجّلي الدخول من الإعدادات ⚙️"); return r; }
    try {
      var q = await app().firestore().collection(COL).get(), best = {};
      q.forEach(function(d){
        var v = d.data() || {}, nn = normName(v.name);
        if (!nn || /تجربه المعلمه|اختبار/.test(nn)) return;
        var pct = +v.pct || 0, ts = v.ts && v.ts.toMillis ? v.ts.toMillis() : (Date.parse(v.clientTime) || 0);
        if (!best[nn] || pct > best[nn].pct) best[nn] = {name:v.name, sec:v.section ? "شعبة " + v.section : "", pct:pct, ts:ts, mode:v.mode};
      });
      Object.keys(best).forEach(function(nn){
        var b = best[nn];
        r.items.push({key:"icl:" + nn + ":done", lt:"icl", lk:nn, who:b.name, sub:b.sec, src:"🧂 مختبر المركبات الأيونية",
          desc:"إنهاء " + (b.mode === "challenge" ? "التحدي" : "النشاط") + " (" + Math.round(b.pct) + "%)", pts:PTS_DONE, track:"commitment", ts:b.ts});
        if (b.pct >= MASTER) r.items.push({key:"icl:" + nn + ":master", lt:"icl", lk:nn, who:b.name, sub:b.sec, src:"🧂 مختبر المركبات الأيونية",
          desc:"🏅 إتقان الدرس (" + MASTER + "% فأكثر)", pts:PTS_MASTER, track:"commitment", ts:b.ts});
      });
      r.items = r.items.filter(function(i){ return !S.awarded[i.key] && i.pts > 0; });
    } catch(e) {
      r.errs.push("مختبر المركبات الأيونية: " + (e.code === "permission-denied" ? "لا توجد صلاحية قراءة" : "تعذّر الاتصال"));
    }
    return r;
  };

  /* بطاقة الدخول في الإعدادات */
  function card(){
    if (typeof ui === "undefined" || ui.view !== "settings" || document.getElementById("iclCard")) return;
    var h = [].slice.call(document.querySelectorAll("b,h3,h4,strong,div")).find(function(e){ return (e.textContent || "").trim() === "📝 ورقة عمل ذكية"; });
    var anchor = h && (h.closest(".card") || h.parentElement);
    if (!anchor) return;
    var u = user(), el = document.createElement("div");
    el.id = "iclCard"; el.className = anchor.className || "card"; el.style.marginTop = "10px";
    el.innerHTML = '<b>🧂 مختبر المركبات الأيونية</b><p class="muted small" style="margin:4px 0 8px">حساب المعلمة في لوحة نتائج المختبر.</p>' +
      (u ? '<p style="margin:0 0 6px">✅ مسجّلة الدخول</p><button class="btn btn-o" id="iclOut">تسجيل الخروج</button>'
         : '<input id="iclEm" type="email" placeholder="البريد" style="width:100%;margin-bottom:6px"><input id="iclPw" type="password" placeholder="كلمة المرور" style="width:100%;margin-bottom:6px"><button class="btn btn-p" id="iclIn">تسجيل الدخول</button> <span id="iclMsg" class="small"></span>');
    anchor.insertAdjacentElement("afterend", el);
    var b = el.querySelector("#iclIn");
    if (b) b.onclick = function(){
      el.querySelector("#iclMsg").textContent = "⏳";
      app().auth().signInWithEmailAndPassword(el.querySelector("#iclEm").value.trim(), el.querySelector("#iclPw").value)
        .then(function(){ el.remove(); card(); })
        .catch(function(){ el.querySelector("#iclMsg").textContent = "❌ البريد أو كلمة المرور غير صحيحة"; });
    };
    var o = el.querySelector("#iclOut");
    if (o) o.onclick = function(){ app().auth().signOut().then(function(){ el.remove(); card(); }); };
  }
  if (typeof render === "function") {
    var r0 = render;
    render = function(){ var x = r0.apply(this, arguments); try { card(); } catch(e){} return x; };
  }
  try { app().auth().onAuthStateChanged(function(){ var c = document.getElementById("iclCard"); if (c) c.remove(); card(); }); } catch(e){}
})();
