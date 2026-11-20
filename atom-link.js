/* ⚛️ ربط «رحلة إلى قلب الذرة» بزر «سحب النقاط من المنصات» */
(function(){
  var ATOM_API = "https://script.google.com/macros/s/AKfycbwTrE2mYpDH9QBZPI7X8D9rp2---XKeCFyp4ewsrRKj1-MOrzjSR80S8SpB6GwIdko/exec";
  var STAGE = {1:"عدّاد البروتونات والإلكترونات",2:"صيّادة النيوترونات",3:"بطاقة هوية الذرة",4:"المحققة: من الجسيمات إلى الرمز",5:"مسائل العالِمات",6:"ابني الذرة"};
  var PTS_STAGE = 1;   // نقطة لكل مرحلة تجتازها الطالبة
  var PTS_ALL   = 3;   // ثلاث نقاط إضافية عند إنهاء المراحل الست
  if (typeof fetchItems !== "function") return;
  var original = fetchItems;

  function atomKey(){
    S.settings = S.settings || {};
    var k = S.settings.atomKey;
    if (!k) { try { k = sessionStorage.getItem("atom_key") || localStorage.getItem("atom_key"); if (k && k.charAt(0) === '"') k = JSON.parse(k); } catch(e){} }
    if (!k) { k = window.prompt("⚛️ رحلة إلى قلب الذرة\nاكتبي الرمز السري للوحة المعلمة (يُطلب مرة واحدة فقط):"); }
    if (k) { k = String(k).trim(); if (S.settings.atomKey !== k) { S.settings.atomKey = k; try { save(); } catch(e){} } }
    return k;
  }

  fetchItems = async function(){
    var r = await original();
    S.links.atom = S.links.atom || {};
    var key = atomKey();
    if (!key) { r.errs.push("رحلة إلى قلب الذرة: لم يُدخل الرمز السري"); return r; }
    try {
      var d = await fetch(ATOM_API + "?action=results&key=" + encodeURIComponent(key)).then(function(x){ return x.json(); });
      if (!d.ok) { S.settings.atomKey = ""; try { save(); } catch(e){} r.errs.push("رحلة إلى قلب الذرة: الرمز السري غير صحيح"); return r; }
      var best = {};
      (d.rows || []).forEach(function(x){
        if (x.event !== "مرحلة" || x.sid === "test" || !x.level || !x.total) return;
        var nn = normName(x.name); if (!nn || nn === normName("اختبار النظام")) return;
        var acc = (+x.correct) / (+x.total); if (acc < 0.5) return;
        var k = nn + "|" + x.level, ts = Date.parse(x.t) || 0;
        if (!best[k] || (+x.stars) > best[k].stars) best[k] = {nn:nn, name:x.name, sec:x.section || "", lv:+x.level, stars:+x.stars || 0, ts:ts};
      });
      var count = {};
      Object.keys(best).forEach(function(k){
        var b = best[k];
        count[b.nn] = count[b.nn] || {n:0, b:b, ts:0};
        count[b.nn].n++; count[b.nn].ts = Math.max(count[b.nn].ts, b.ts);
        r.items.push({key:"atom:" + b.nn + ":" + b.lv, lt:"atom", lk:b.nn, who:b.name, sub:b.sec, src:"⚛️ رحلة إلى قلب الذرة",
          desc:"اجتياز المرحلة " + b.lv + ": " + (STAGE[b.lv] || "") + " " + "⭐".repeat(Math.min(3, b.stars)), pts:PTS_STAGE, track:"commitment", ts:b.ts});
      });
      Object.keys(count).forEach(function(nn){
        var c = count[nn]; if (c.n < 6) return;
        r.items.push({key:"atom:" + nn + ":all", lt:"atom", lk:nn, who:c.b.name, sub:c.b.sec, src:"⚛️ رحلة إلى قلب الذرة",
          desc:"🏆 إنهاء المراحل الست كاملة", pts:PTS_ALL, track:"commitment", ts:c.ts});
      });
      r.items = r.items.filter(function(i){ return !S.awarded[i.key] && i.pts > 0; });
    } catch(e) {
      r.errs.push("رحلة إلى قلب الذرة: تعذّر الاتصال");
    }
    return r;
  };
})();
