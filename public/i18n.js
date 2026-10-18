// Translation layer. English text is the key; Arabic lives in lang-ar.js and is registered at startup.
// Pure (no DOM globals): trDom works on any tree with nodeType/childNodes/get/setAttribute.

const dicts = { en: { ui: {}, names: {} } };
let current = "en";

export function registerLang(code, dict) { dicts[code] = { ui: dict.ui || {}, names: dict.names || {} }; }
export function setLang(code) { if (!dicts[code]) return false; current = code; return true; }
export function getLang() { return current; }
export function isRtl() { return current === "ar"; }
export function locale() { return current === "ar" ? "ar-EG-u-nu-latn" : undefined; }

export function detectLang(saved, navLang) {
  if (saved === "en" || saved === "ar") return saved;
  return String(navLang || "").toLowerCase().startsWith("ar") ? "ar" : "en";
}

function fill(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

export function t(text, params) {
  const hit = dicts[current].ui[text];
  return fill(hit != null ? hit : text, params);
}

export function tn(one, other, n, params) { return t(n === 1 ? one : other, { n, ...params }); }

export function nameOf(kind, name) {
  const table = dicts[current].names[kind];
  if (!table) return name;
  if (table[name] != null) return table[name];
  const low = String(name).toLowerCase();
  for (const k of Object.keys(table)) if (k.toLowerCase() === low) return table[k];
  return name;
}

const ATTRS = ["aria-label", "placeholder", "title", "alt"];
const SKIP = new Set(["SCRIPT", "STYLE", "SVG"]);
const original = new WeakMap(); // text node -> its English text

function translateText(node) {
  const en = original.has(node) ? original.get(node) : node.nodeValue;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(en);
  const hit = current === "en" ? null : dicts[current].ui[m[2].replace(/\s+/g, " ")];
  if (hit != null) { original.set(node, en); node.nodeValue = m[1] + hit + m[3]; }
  else if (original.has(node)) { node.nodeValue = en; original.delete(node); }
}

function translateAttr(el, attr) {
  const keep = "data-en-" + attr;
  const en = el.hasAttribute(keep) ? el.getAttribute(keep) : el.getAttribute(attr);
  if (en == null) return;
  const hit = current === "en" ? null : dicts[current].ui[en.trim()];
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
