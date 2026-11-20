/* ⚖️ ربط «ميزان المعادلات الكيميائية» بزر «سحب النقاط من المنصات» */
(function(){
  var CFG = {apiKey:"AIzaSyBq067CBAa0tLJxNMf60nObygvnRTgYwlI",authDomain:"chem-lab-shaikha.firebaseapp.com",projectId:"chem-lab-shaikha",storageBucket:"chem-lab-shaikha.firebasestorage.app",messagingSenderId:"305599144472",appId:"1:305599144472:web:ae27c01b81b925c238d96d"};
  var COL = "balance_results";
  var TOTAL = 14;      // عدد معادلات الميزان
  var PTS_EQ  = 1;     // نقطة لكل معادلة تحلّها الطالبة
  var PTS_ALL = 3;     // ثلاث نقاط إضافية عند حل المعادلات الـ14 كلها
  if (typeof fetchItems !== "function" || typeof firebase === "undefined") return;
  var original = fetchItems, app = null;

  fetchItems = async function(){
    var r = await original();
    S.links.mizan = S.links.mizan || {};
    try {
      if (!app) app = firebase.apps.find(function(a){ return a.name === "mizan"; }) || firebase.initializeApp(CFG, "mizan");
      var q = await app.firestore().collection(COL).get();
      var seen = {};
      q.forEach(function(d){
        var v = d.data() || {};
        var nn = normName(v.name);
        if (!nn || /تجربه المعلمه|اختبار/.test(nn)) return;
        var ts = v.lastSeen && v.lastSeen.toMillis ? v.lastSeen.toMillis() : 0;
        var sec = v.section ? "شعبة " + v.section : "";
        seen[nn] = seen[nn] || {n:0, name:v.name, sec:sec, ts:0};
        Object.keys(v.levels || {}).forEach(function(lv){
          var L = v.levels[lv] || {}, no = (+lv) + 1, key = "mizan:" + nn + ":" + lv;
          if (seen[nn][key]) return; seen[nn][key] = 1; seen[nn].n++;
          seen[nn].ts = Math.max(seen[nn].ts, L.at || ts);
          r.items.push({key:key, lt:"mizan", lk:nn, who:v.name, sub:sec, src:"⚖️ ميزان المعادلات",
            desc:"موازنة المعادلة " + no + " " + "⭐".repeat(Math.max(0, Math.min(3, +L.stars || 0))), pts:PTS_EQ, track:"commitment", ts:L.at || ts});
        });
      });
      Object.keys(seen).forEach(function(nn){
        var s = seen[nn]; if (s.n < TOTAL) return;
        r.items.push({key:"mizan:" + nn + ":all", lt:"mizan", lk:nn, who:s.name, sub:s.sec, src:"⚖️ ميزان المعادلات",
          desc:"🏆 موازنة المعادلات الـ14 كلها", pts:PTS_ALL, track:"commitment", ts:s.ts});
      });
      r.items = r.items.filter(function(i){ return !S.awarded[i.key] && i.pts > 0; });
    } catch(e) {
      r.errs.push("ميزان المعادلات: " + (e.code === "permission-denied" ? "لا توجد صلاحية قراءة" : "تعذّر الاتصال"));
    }
    return r;
  };
})();
