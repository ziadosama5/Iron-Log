// node run.cjs <repo public dir> <harness dir> <port> : builds harness/index.html from public/index.html and serves it.
const fs = require("fs"), http = require("http"), path = require("path");
const [pub, har, port] = [process.argv[2], process.argv[3], +process.argv[4]];
let s = fs.readFileSync(path.join(pub, "index.html"), "utf8");
s = s.replace(/https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.2\/firebase-(app|auth|firestore)\.js/g, "/stubs/fb.js");
const driver = `<script>
(function(){
  var q=new URLSearchParams(location.search), go=q.get("go")||"", acc=q.get("acc");
  window.addEventListener("load",function(){ setTimeout(function(){
    var $=function(s){return document.querySelector(s);}, click=function(s){var e=$(s); if(e) e.click();};
    var kind=go.split(":")[0], arg=go.split(":")[1];
    var TAB={log:"today",days:"plan",gym:"plan",body:"progress",progress:"progress",goals:"progress",coach:"progress",history:"progress",friends:"friends",challenges:"friends",find:"friends",profile:"me"}, FIRST={today:"log",plan:"days",progress:"body",friends:"friends",me:"profile"};
    var nav=function(v){ click('.tabbar [data-tab="'+TAB[v]+'"]'); if(FIRST[TAB[v]]!==v) setTimeout(function(){ click('.pill[data-view="'+v+'"]'); },60); };
    if(kind==="view") nav(arg);
    if(kind==="badges"){ nav("goals"); setTimeout(function(){ click('[data-act="badges-all"]'); },200); }
    if(kind==="swipe"){ var tg=document.querySelector("#view-log h2")||document.body, mk=function(type,x,y){ var t=new Touch({identifier:1,target:tg,clientX:x,clientY:y}); tg.dispatchEvent(new TouchEvent(type,{bubbles:true,touches:type==="touchend"?[]:[t],changedTouches:[t]})); }; mk("touchstart",arg==="left"?300:120,400); mk("touchend",arg==="left"?100:320,410); }
    if(kind==="profile"){ nav("profile"); }
    if(kind==="friends"||kind==="friend"||kind==="ffind"){ nav(kind==="ffind"?"find":"friends"); setTimeout(function(){ setTimeout(function(){
      if(kind==="friend"){ var b=$('[data-act="fr-open"][data-uid="'+arg+'"]'); if(b) b.click(); }
      var mode=go.split(":")[2]; if(kind==="friend"&&mode){ setTimeout(function(){ click('[data-act="fr-report"]'); setTimeout(function(){ click('[data-act="fr-report-reason"][data-v="spam"]'); if(mode==="send") setTimeout(function(){ click('[data-act="fr-report-send"]'); },150); },150); },250); }
      if(kind==="ffind"){ var i=$("#find-q"); if(i){ i.value=decodeURIComponent(arg); $("#find-form").requestSubmit(); } }
    },400); },150); }
    if(kind==="days"||kind==="gym"){ nav(kind); setTimeout(function(){ setTimeout(function(){ if(kind==="days"&&arg==="edit"){ click('[data-act="edit-day"]'); } if(kind==="days"&&arg==="all"){ click('[data-act="edit-day"]'); setTimeout(function(){ click('[data-act="gym-showall"]'); },200); } },300); },150); }
    if(kind==="jr"){ var seq=decodeURIComponent(go.slice(3)).split(","), i=0; (function step(){ if(i>=seq.length) return; var t=seq[i++].split(":"); var sel=t.length===1?'[data-act="jr-'+t[0]+'"]':'[data-act="jr-'+t[0]+'"][data-v="'+t[1]+'"]'; click(sel); setTimeout(step,120); })(); }
    if(kind==="delete"&&!sessionStorage.getItem("__ranOnce")){ var dm=go.split(":")[1]||"idle"; nav("profile"); setTimeout(function(){ click('[data-act="delete-open"]'); setTimeout(function(){ if(dm!=="idle"){ click('[data-act="del-start"]'); } if(dm==="run"){ setTimeout(function(){ click('[data-act="del-yes"]'); },100); } },300); },150); }
    if(kind==="ch"){ var cm=go.split(":")[1]||"list"; nav("challenges"); setTimeout(function(){ setTimeout(function(){
      if(cm==="open") click('[data-act="ch-open"][data-id="c1"]');
      if(cm==="fin") click('[data-act="ch-open"][data-id="c3"]');
      if(cm==="new"||cm==="create"||cm==="invalid"){ click('[data-act="ch-new"]'); setTimeout(function(){ click('[data-act="ch-friend"]'); if(cm==="create") setTimeout(function(){ click('[data-act="ch-create"]'); },150); },150); }
      if(cm==="accept") click('[data-act="ch-accept"][data-id="c2"]');
      if(cm==="leave"){ click('[data-act="ch-open"][data-id="c1"]'); setTimeout(function(){ click('[data-act="ch-confirm"]'); setTimeout(function(){ click('[data-act="ch-leave-yes"]'); },150); },150); }
      if(cm==="delete"){ click('[data-act="ch-open"][data-id="c3"]'); setTimeout(function(){ click('[data-act="ch-confirm"]'); setTimeout(function(){ click('[data-act="ch-delete-yes"]'); },150); },150); }
    },300); },150); }
    if(kind==="find"){ nav("find"); setTimeout(function(){ var i=$("#find-q"); if(i){ i.value=decodeURIComponent(arg); $("#find-form").requestSubmit(); } },300); }
  },700); setTimeout(function(){ try{ document.body.setAttribute("data-calls",localStorage.getItem("__calls")||"[]"); }catch(e){} },6000); });
})();
</script>`;
s = s.replace("</body>", driver + "</body>");
s = s.replace("<head>", '<head><script>var q=new URLSearchParams(location.search);if(q.get("theme"))localStorage.setItem("ironlog.theme",q.get("theme"));if(q.get("lang"))localStorage.setItem("ironlog.lang",q.get("lang"));localStorage.setItem("ironlog.level.u1",q.get("cele")?"3":"99");if(q.get("acc"))localStorage.setItem("ironlog.accent",decodeURIComponent(q.get("acc")));</script>');
fs.writeFileSync(path.join(har, "index.html"), s);
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html";
  const root = (p.startsWith("/stubs/") || p === "/index.html") ? har : pub;
  fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Access-Control-Allow-Origin": "*", "Content-Type": types[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" }); r.end(d); });
}).listen(port);
console.log("serving on", port);
