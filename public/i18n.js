// Translation layer. English text is the key; Arabic lives in lang-ar.js and is registered at startup.
// Pure (no DOM globals): trDom works on any tree with nodeType/childNodes/get/setAttribute.

const dicts = { en: { ui: {}, names: {} } };
let current = "en";

const own = (obj, key) => (obj != null && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined);

export function registerLang(code, dict) { dicts[code] = { ui: dict.ui || {}, names: dict.names || {} }; }
export function setLang(code) { if (!dicts[code]) return false; current = code; return true; }
export function getLang() { return current; }
export function isRtl() { return current === "ar"; }
// Runs fn with another language active (unknown code = no change), then restores the current one.
export function withLang(code, fn) {
  const prev = current;
  if (dicts[code]) current = code;
  try { return fn(); } finally { current = prev; }
}
export function locale() { return current === "ar" ? "ar-EG-u-nu-latn" : undefined; }

export function detectLang(saved, navLang) {
  if (saved === "en" || saved === "ar") return saved;
  return String(navLang || "").toLowerCase().startsWith("ar") ? "ar" : "en";
}

function fill(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (own(params, k) !== undefined ? String(params[k]) : m));
}

export function t(text, params) {
  const hit = own(dicts[current].ui, text);
  return fill(hit != null ? hit : text, params);
}

// one for exactly 1, else other. Arabic also has a dual for exactly 2: an entry named `<other>#2` (when present) wins.
export function tn(one, other, n, params) {
  if (n === 2) { const dual = own(dicts[current].ui, other + "#2"); if (dual != null) return fill(dual, { n, ...params }); }
  return t(n === 1 ? one : other, { n, ...params });
}

export function nameOf(kind, name) {
  const table = own(dicts[current].names, kind);
  if (!table) return name;
  const exact = own(table, name);
  if (exact != null) return exact;
  const low = String(name).toLowerCase();
  for (const k of Object.keys(table)) if (k.toLowerCase() === low) return table[k];
  return name;
}

// The English key whose display name (in the current language) equals `name`; `name` itself otherwise.
// Used for names the user tapped or typed in Arabic, so stored data stays English.
export function reverseName(kind, name) {
  const table = own(dicts[current].names, kind);
  if (!table) return name;
  const low = String(name).trim().toLowerCase();
  for (const k of Object.keys(table)) if (String(table[k]).toLowerCase() === low) return k;
  return name;
}

const ATTRS = ["aria-label", "placeholder", "title", "alt"];
const SKIP = new Set(["SCRIPT", "STYLE", "SVG"]);
const original = new WeakMap(); // text node -> its English text

// Right-to-left text scrambles numbers: "138–189 g" and "97 / 500 XP" would read backwards. Each number
// (with its sign, range/ratio and unit) is wrapped in a left-to-right isolate so it keeps its order.
const NUMBER_RUN = /[+~−-]?\d[\d.,]*(?:\s*[–\-/×:→]\s*[+−-]?\d[\d.,]*)*%?(?:\s(?:kg|kcal|g|cm|min|XP|L|t)(?![A-Za-z]))?/g;
export function isolateNumbers(text) { return text.replace(NUMBER_RUN, m => "⁦" + m + "⁩"); }

function translateText(node) {
  const en = original.has(node) ? original.get(node) : node.nodeValue;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(en);
  const hit = current === "en" ? null : own(dicts[current].ui, m[2].replace(/\s+/g, " "));
  let out = null;
  if (hit != null) out = m[1] + (current === "ar" ? isolateNumbers(hit) : hit) + m[3];
  else if (current === "ar") { const iso = isolateNumbers(en); if (iso !== en) out = iso; }
  if (out != null) { original.set(node, en); node.nodeValue = out; }
  else if (original.has(node)) { node.nodeValue = en; original.delete(node); }
}

function translateAttr(el, attr) {
  const keep = "data-en-" + attr;
  const en = el.hasAttribute(keep) ? el.getAttribute(keep) : el.getAttribute(attr);
  if (en == null) return;
  const hit = current === "en" ? null : own(dicts[current].ui, en.trim());
  if (hit != null) { if (!el.hasAttribute(keep)) el.setAttribute(keep, en); el.setAttribute(attr, hit); }
  else if (el.hasAttribute(keep)) { el.setAttribute(attr, en); el.removeAttribute(keep); }
}

export function trDom(root) {
  const walk = n => {
    if (n.nodeType === 3) { translateText(n); return; }
    if (n.nodeType !== 1 && n.nodeType !== 11 && n.nodeType !== 9) return;
    if (n.nodeType === 1) {
      if (SKIP.has(String(n.tagName).toUpperCase()) || n.hasAttribute("data-no-tr")) return;
      for (const a of ATTRS) if (n.hasAttribute(a) || n.hasAttribute("data-en-" + a)) translateAttr(n, a);
    }
    for (const c of Array.from(n.childNodes || [])) walk(c);
  };
  walk(root);
}
