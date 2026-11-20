/* 📋 رصد جماعي — اختيار عدة طالبات من قائمة (من كل الفصول) ومنحهن النقاط دفعة واحدة */
(function(){
  if (typeof render !== "function" || typeof pointsDialog !== "function") return;

  function openBulk(){
    var sel = {}, q = "", cf = "";
    var m = modal("📋 رصد جماعي",
      '<p class="muted small" style="margin-top:0">ابحثي أو اختاري الفصل، ثم ضعي ✔ أمام الطالبات، واضغطي «متابعة» لاختيار النقاط والسبب.</p>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
        '<input id="bkQ" placeholder="🔍 ابحثي بالاسم..." style="flex:1;min-width:160px">' +
        '<select id="bkC"><option value="">كل الفصول</option>' +
          S.classes.map(function(c){ return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join("") +
        '</select></div>' +
      '<div class="row" style="gap:8px;margin-bottom:6px">' +
        '<button class="btn btn-o btn-s" id="bkAll">تحديد الظاهرات</button>' +
        '<button class="btn btn-o btn-s" id="bkNone">إلغاء التحديد</button>' +
        '<span class="muted small" id="bkInfo"></span></div>' +
      '<div id="bkList" style="max-height:52vh;overflow:auto;border:1px solid #e5dcc8;border-radius:10px"></div>' +
      '<div id="bkChosen" class="small" style="margin:8px 0;line-height:1.9"></div>' +
      '<button class="btn btn-g btn-lg" style="width:100%" id="bkGo" disabled>متابعة</button>', true);

    var list = m.querySelector("#bkList");
    function cn(id){ var c = S.classes.find(function(x){ return x.id === id; }); return c ? c.name : ""; }
    function shown(){
      var nq = normName(q);
      return S.students.filter(function(s){
        return s.active !== false && (!cf || s.classId === cf) && (!nq || normName(s.name).indexOf(nq) >= 0);
      }).sort(function(a, b){
        return cn(a.classId).localeCompare(cn(b.classId), "ar") || a.name.localeCompare(b.name, "ar");
      });
    }
    function count(){ return Object.keys(sel).length; }
    function foot(){
      var ids = Object.keys(sel);
      m.querySelector("#bkGo").disabled = !ids.length;
      var n = ids.length, w = n === 1 ? "طالبة واحدة" : n === 2 ? "طالبتين" : n <= 10 ? n + " طالبات" : n + " طالبة";
      m.querySelector("#bkGo").textContent = n ? "متابعة: منح نقاط لـ " + w : "متابعة";
      m.querySelector("#bkChosen").innerHTML = ids.length ? "<b>المحددات:</b> " + ids.map(function(id){ return '<span class="badge" style="margin:2px">' + esc(sname(id)) + "</span>"; }).join(" ") : "";
    }
    function draw(){
      var arr = shown();
      m.querySelector("#bkInfo").textContent = "الظاهر: " + arr.length + " • المحدد: " + count();
      list.innerHTML = arr.length ? arr.map(function(s){
        return '<label style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid #f1ead9;cursor:pointer;' + (sel[s.id] ? "background:#FFF6DC" : "") + '">' +
          '<input type="checkbox" data-id="' + s.id + '" ' + (sel[s.id] ? "checked" : "") + ' style="width:20px;height:20px">' +
          '<span style="flex:1">' + esc(s.name) + '</span><span class="muted small">' + esc(cn(s.classId)) + ' • ⭐ ' + bal(s.id) + "</span></label>";
      }).join("") : '<p class="muted" style="text-align:center;padding:16px">لا توجد نتائج</p>';
      foot();
    }
    list.onchange = function(e){
      var id = e.target.getAttribute("data-id"); if (!id) return;
      if (e.target.checked) sel[id] = 1; else delete sel[id];
      e.target.closest("label").style.background = e.target.checked ? "#FFF6DC" : "";
      m.querySelector("#bkInfo").textContent = "الظاهر: " + shown().length + " • المحدد: " + count();
      foot();
    };
    m.querySelector("#bkQ").oninput = function(e){ q = e.target.value; draw(); };
    m.querySelector("#bkC").onchange = function(e){ cf = e.target.value; draw(); };
    m.querySelector("#bkAll").onclick = function(){ shown().forEach(function(s){ sel[s.id] = 1; }); draw(); };
    m.querySelector("#bkNone").onclick = function(){ sel = {}; draw(); };
    m.querySelector("#bkGo").onclick = function(){ var ids = Object.keys(sel); if (ids.length) pointsDialog(ids, function(){ render(); }); };
    draw();
    setTimeout(function(){ var i = m.querySelector("#bkQ"); if (i) i.focus(); }, 50);
  }

  var orig = render;
  render = function(){
    var out = orig.apply(this, arguments);
    try {
      var p = document.getElementById("pullBtn");
      if (p && !document.getElementById("bulkBtn")) {
        var b = document.createElement("button");
        b.className = "btn btn-p"; b.id = "bulkBtn"; b.textContent = "📋 رصد جماعي";
        b.onclick = openBulk;
        p.insertAdjacentElement("beforebegin", b);
      }
    } catch(e){}
    return out;
  };
  render();
})();
