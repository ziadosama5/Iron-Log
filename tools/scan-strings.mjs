// Finds the user-visible English text in the app's source, for the Arabic coverage test.
// Dev/test only; the app never loads this. See docs/superpowers/plans/2026-10-18-arabic-language.md.
//
// scanSource(source, {kind: "html" | "js"}) -> { labels: string[], violations: [{line, text, why}] }
//  - label: a whole text node / aria-label / placeholder / title / alt / t("...") / tn("...","...") text
//    that needs an entry in lang-ar.js.
//  - violation: English text glued to a ${} interpolation, a dynamic t() key, or an untranslated message
//    passed to toast()/setSync()/add() (coach insights).
// Only template literals and strings that contain an HTML tag are read as markup.

export const LABEL_ALLOW = new Set([
  "Iron Log", "English", "العربية", "firebase-config.js", "XP", "kg", "cm", "kcal", "g", "min", "s", "%", "PR", "e1RM", "1RM", "RPE"
]);

const SENT = "\u0001";
const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&times;": "×" };
const decode = s => s.replace(/&[a-z#0-9]+;/gi, m => ENTITIES[m] ?? m);

// ---------- low-level JS skipping ----------
const skipLine = (s, i) => { const j = s.indexOf("\n", i); return j < 0 ? s.length : j; };
const skipBlock = (s, i) => { const j = s.indexOf("*/", i + 2); return j < 0 ? s.length : j + 2; };
function skipQuoted(s, i) {
  const q = s[i]; i++;
  while (i < s.length) { if (s[i] === "\\") i += 2; else if (s[i] === q) return i + 1; else i++; }
  return i;
}
function skipRegex(s, i) {
  i++; let cls = false;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") i += 2;
    else if (c === "[") { cls = true; i++; }
    else if (c === "]") { cls = false; i++; }
    else if (c === "/" && !cls) { i++; while (/[a-z]/i.test(s[i] || "")) i++; return i; }
    else if (c === "\n") return i;
    else i++;
  }
  return i;
}
const REGEX_AFTER = /[(,=:[!&|?{};]/;

// Index of the "}" matching a "${" whose body starts at i.
function matchBrace(s, i) {
  let depth = 1, prev = "(";
  while (i < s.length) {
    const c = s[i];
    if (c === "/" && s[i + 1] === "/") { i = skipLine(s, i); continue; }
    if (c === "/" && s[i + 1] === "*") { i = skipBlock(s, i); continue; }
    if (c === '"' || c === "'") { i = skipQuoted(s, i); prev = "a"; continue; }
    if (c === "`") { i = readTemplate(s, i).end; prev = "a"; continue; }
    if (c === "/" && REGEX_AFTER.test(prev)) { i = skipRegex(s, i); prev = "a"; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return i; }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return s.length;
}

// Template literal starting at s[i] === "`": parts = [{text} | {expr, at}] (at = index of expr in s).
function readTemplate(s, i) {
  const parts = []; let text = ""; i++;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") { text += s.slice(i, i + 2); i += 2; }
    else if (c === "`") { parts.push({ text }); return { end: i + 1, parts }; }
    else if (c === "$" && s[i + 1] === "{") {
      parts.push({ text }); text = "";
      const at = i + 2, end = matchBrace(s, at);
      parts.push({ expr: s.slice(at, end), at });
      i = end + 1;
    } else { text += c; i++; }
  }
  parts.push({ text });
  return { end: i, parts };
}

// Arguments of the call whose "(" is at s[i], split on top-level commas.
function parseArgs(s, i) {
  const args = [], starts = [i + 1]; args.starts = starts; let depth = 0, start = i + 1, prev = "(";
  for (i; i < s.length; ) {
    const c = s[i];
    if (c === "/" && s[i + 1] === "/") { i = skipLine(s, i); continue; }
    if (c === "/" && s[i + 1] === "*") { i = skipBlock(s, i); continue; }
    if (c === '"' || c === "'") { i = skipQuoted(s, i); prev = "a"; continue; }
    if (c === "`") { i = readTemplate(s, i).end; prev = "a"; continue; }
    if (c === "/" && REGEX_AFTER.test(prev)) { i = skipRegex(s, i); prev = "a"; continue; }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) { args.push(s.slice(start, i)); args.end = i + 1; return args; }
    } else if (c === "," && depth === 1) { args.push(s.slice(start, i)); start = i + 1; starts.push(start); }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return args;
}

const unescape = s => s.replace(/\\(["'`\\])/g, "$1").replace(/\\n/g, "\n");

export function scanSource(source, { kind = "js" } = {}) {
  const labels = new Set(), violations = [];
  const nl = []; for (let i = source.indexOf("\n"); i >= 0; i = source.indexOf("\n", i + 1)) nl.push(i);
  const lineOf = off => { let lo = 0, hi = nl.length; while (lo < hi) { const m = (lo + hi) >> 1; if (nl[m] < off) lo = m + 1; else hi = m; } return lo + 1; };
  const violate = (off, text, why) => violations.push({ line: lineOf(off), text: String(text).trim().slice(0, 80), why });

  function addText(raw, off) {
    const s = decode(raw).replace(/\s+/g, " ").trim();
    const words = s.replace(/\u0001/g, " ").split(/[^A-Za-z]+/).filter(w => w && !LABEL_ALLOW.has(w));
    if (!words.length && s.includes(SENT)) return;
    if (!/[A-Za-z]/.test(s.replace(/\u0001/g, ""))) return;
    if (s.includes(SENT)) violate(off, s.replace(/\u0001/g, "${…}"), "interpolated text outside t()");
    else if (!LABEL_ALLOW.has(s)) labels.add(s);
  }

  function analyzeMarkup(markup, off) {
    markup = markup.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, " "));
    markup = markup.replace(/<!doctype[^>]*>/i, m => m.replace(/[^\n]/g, " "));
    const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^<>]*)>/g;
    let m, last = 0;
    while ((m = re.exec(markup))) {
      addText(markup.slice(last, m.index), off + last);
      const attrRe = /(?:^|\s)(aria-label|placeholder|title|alt)=(?:"([^"]*)"|'([^']*)')/g;
      let a;
      while ((a = attrRe.exec(m[3]))) addText(a[2] ?? a[3] ?? "", off + m.index);
      last = re.lastIndex;
      const tag = m[2].toLowerCase();
      if (!m[1] && (tag === "script" || tag === "style")) {
        const close = markup.toLowerCase().indexOf("</" + tag, re.lastIndex);
        re.lastIndex = close < 0 ? markup.length : close;
        last = re.lastIndex;
      }
    }
    addText(markup.slice(last), off + last);
  }

  function checkKey(arg, off) {
    const a = arg.trim(), q = a[0];
    if (q !== '"' && q !== "'" && q !== "`") return;
    if (q === "`") {
      const r = readTemplate(a, 0);
      if (r.parts.some(p => p.expr !== undefined)) { violate(off, a, "dynamic t() key"); return; }
      if (/[A-Za-z]/.test(r.parts[0].text) && !LABEL_ALLOW.has(r.parts[0].text)) labels.add(unescape(r.parts[0].text));
      return;
    }
    const lit = a.slice(1, a.lastIndexOf(q));
    if (!LABEL_ALLOW.has(lit)) labels.add(unescape(lit));
  }

  // Text of every string/template literal in an expression, ignoring anything inside t()/tn() calls.
  function literalsOutsideT(expr) {
    let e = expr, m;
    while ((m = /\btn?\(/.exec(e))) { const args = parseArgs(e, m.index + m[0].length - 1); e = e.slice(0, m.index) + " " + e.slice(args.end ?? e.length); }
    const out = [];
    (function walk(str) {
      for (let i = 0; i < str.length; ) {
        const c = str[i];
        if (c === '"' || c === "'") {
          const end = skipQuoted(str, i);
          if (!/[!=]==?\s*$/.test(str.slice(0, i))) out.push(str.slice(i + 1, end - 1)); // not a comparison operand
          i = end;
        }
        else if (c === "`") { const r = readTemplate(str, i); r.parts.forEach(p => (p.expr !== undefined ? walk(p.expr) : out.push(p.text))); i = r.end; }
        else i++;
      }
    })(e);
    return out;
  }
  function checkMessage(arg, off) {
    const a = arg.trim();
    if (literalsOutsideT(a).some(x => /[A-Za-z]/.test(x))) violate(off, a, "untranslated message");
  }

  function handleCall(name, s, parenIdx, base) {
    const args = parseArgs(s, parenIdx), off = base + parenIdx;
    // The key text (including any HTML in it) belongs to t()/tn(); it must not be read again as markup.
    const markKey = k => { const raw = args[k]; if (raw != null) keyLits.add(base + args.starts[k] + (raw.length - raw.trimStart().length)); };
    if (name === "t") { markKey(0); if (args[0] != null) checkKey(args[0], off); }
    else if (name === "tn") { [0, 1].forEach(k => { markKey(k); if (args[k] != null) checkKey(args[k], off); }); }
    else if (name === "toast" || name === "setSync") { if (args[0] != null) checkMessage(args[0], off); }
    else if (name === "add" && args.length >= 4) { [2, 3].forEach(k => checkMessage(args[k], off)); }
  }

  const keyLits = new Set();
  const CALLS = new Set(["t", "tn", "toast", "setSync", "add"]);
  const HAS_TAG = /<[a-zA-Z/]/;

  function scanJs(s, base) {
    let i = 0, prev = "(";
    while (i < s.length) {
      const c = s[i];
      if (c === "/" && s[i + 1] === "/") { i = skipLine(s, i); continue; }
      if (c === "/" && s[i + 1] === "*") { i = skipBlock(s, i); continue; }
      if (c === '"' || c === "'") {
        const e = skipQuoted(s, i), lit = s.slice(i + 1, e - 1);
        if (HAS_TAG.test(lit) && !keyLits.has(base + i)) analyzeMarkup(lit, base + i + 1);
        i = e; prev = "a"; continue;
      }
      if (c === "`") {
        const r = readTemplate(s, i);
        const markup = r.parts.map(p => (p.expr !== undefined ? SENT : p.text)).join("");
        if (HAS_TAG.test(r.parts.map(p => p.text || "").join("")) && !keyLits.has(base + i)) analyzeMarkup(markup, base + i + 1);
        for (const p of r.parts) if (p.expr !== undefined) scanJs(p.expr, base + p.at);
        i = r.end; prev = "a"; continue;
      }
      if (c === "/" && REGEX_AFTER.test(prev)) { i = skipRegex(s, i); prev = "a"; continue; }
      if (/[A-Za-z0-9_$]/.test(c)) {
        let j = i; while (j < s.length && /[A-Za-z0-9_$]/.test(s[j])) j++;
        const word = s.slice(i, j), before = s[i - 1] || " ";
        let k = j; while (k < s.length && /\s/.test(s[k])) k++;
        if (CALLS.has(word) && before !== "." && s[k] === "(") handleCall(word, s, k, base);
        prev = (word === "return" || word === "typeof" || word === "case") ? "(" : "a";
        i = j; continue;
      }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }

  if (kind === "html") {
    const marker = '<script type="module">', mi = source.indexOf(marker);
    if (mi < 0) analyzeMarkup(source, 0);
    else {
      analyzeMarkup(source.slice(0, mi), 0);
      const from = mi + marker.length, to = source.lastIndexOf("</script>");
      scanJs(source.slice(from, to < from ? source.length : to), from);
    }
  } else scanJs(source, 0);

  return { labels: [...labels], violations };
}
