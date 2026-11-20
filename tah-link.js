/* 🏆 ربط «تحدّي التحصيلي» بزر «سحب النقاط من المنصات» (طالبات الفصول الخمسة فقط) */
(function(){
  var CFG = {apiKey:"AIzaSyBq067CBAa0tLJxNMf60nObygvnRTgYwlI",authDomain:"chem-lab-shaikha.firebaseapp.com",projectId:"chem-lab-shaikha",storageBucket:"chem-lab-shaikha.firebasestorage.app",messagingSenderId:"305599144472",appId:"1:305599144472:web:ae27c01b81b925c238d96d"};
  var COL = "tahsili_results";
  var MY = ["أول ج","أول د","أول هـ","ثاني ج","ثاني د"];
  var PTS_SET = 1;   // نقطة لكل مجموعة أسئلة تجتازها الطالبة (50% فأكثر)
  var PTS_TOP = 1;   // نقطة إضافية لمن تحصل على 90% فأكثر في المجموعة
  if (typeof fetchItems !== "function" || typeof firebase === "undefined") return;
  var original = fetchItems;
  function app(){ return firebase.apps.find(function(a){ return a.name === "mizan"; }) || firebase.initializeApp(CFG, "mizan"); }

  fetchItems = async function(){
    var r = await original();
    S.links.tah = S.links.tah || {};
    var u = null; try { u = app().auth().currentUser; } catch(e){}
    if (!u) { r.errs.push("تحدّي التحصيلي: سجّلي الدخول في بطاقة «مختبر المركبات الأيونية» بالإعدادات ⚙️ (الحساب نفسه)"); return r; }
    try {
      var q = await app().firestore().collection(COL).get();
      q.forEach(function(d){
        var v = d.data() || {}, nn = normName(v.name);
        if (!nn || MY.indexOf(v.cls) < 0) return;
        Object.keys(v.sets || {}).forEach(function(k){
          var s = v.sets[k] || {}, pct = +s.pct || 0, base = "tah:" + nn + ":" + (v.course || "") + ":" + k;
          if (pct < 50) return;
          r.items.push({key:base, lt:"tah", lk:nn, who:v.name, sub:v.cls, src:"🏆 تحدّي التحصيلي",
            desc:(v.course ? v.course + " · " : "") + (s.title || "مجموعة أسئلة") + " (" + pct + "%)", pts:PTS_SET, track:"commitment", ts:s.at || 0});
          if (pct >= 90) r.items.push({key:base + ":top", lt:"tah", lk:nn, who:v.name, sub:v.cls, src:"🏆 تحدّي التحصيلي",
            desc:"⭐ تميّز 90% فأكثر: " + (s.title || ""), pts:PTS_TOP, track:"commitment", ts:s.at || 0});
        });
      });
      r.items = r.items.filter(function(i){ return !S.awarded[i.key] && i.pts > 0; });
    } catch(e) {
      r.errs.push("تحدّي التحصيلي: " + (e.code === "permission-denied" ? "لا توجد صلاحية قراءة" : "تعذّر الاتصال"));
    }
    return r;
  };
})();
