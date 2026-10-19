import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = p => readFileSync(new URL("../public/" + p, import.meta.url), "utf8");
const PAGES = { "privacy.html": "/terms.html", "terms.html": "/privacy.html" };
const CONTACT = "ziadosamaabdo@gmail.com";

// The text of one language block of a page.
function block(html, lang) {
  const re = new RegExp('<section[^>]*data-l="' + lang + '"[^>]*>([\\s\\S]*?)</section>');
  const m = html.match(re);
  assert.ok(m, "has a " + lang + " block");
  return m[1];
}
const h2s = s => (s.match(/<h2[ >]/g) || []).length;

test("both pages exist and are standalone, with an English and an Arabic block of the same shape", () => {
  for (const [file, other] of Object.entries(PAGES)) {
    assert.ok(existsSync(new URL("../public/" + file, import.meta.url)), file);
    const html = read(file);
    assert.match(html, /<!doctype html>/i, file);
    assert.match(html, /<meta[^>]+name="viewport"/i, file);
    assert.match(html, /<meta[^>]+charset/i, file);
    assert.ok(html.includes(CONTACT), file + " shows the contact address");
    assert.ok(html.includes('href="/"'), file + " links back to the app");
    assert.ok(html.includes('href="' + other + '"'), file + " links to the other page");
    const en = block(html, "en"), ar = block(html, "ar");
    assert.ok(h2s(en) >= 5, file + " has real sections");
    assert.equal(h2s(en), h2s(ar), file + ": same sections in both languages");
    assert.ok(en.includes(CONTACT) && ar.includes(CONTACT), file + " contact in both languages");
    assert.ok(/[؀-ۿ]/.test(ar), file + " Arabic block is Arabic");
  }
});

test("the privacy policy says what the app actually does", () => {
  const en = block(read("privacy.html"), "en").toLowerCase();
  for (const phrase of ["google", "workout", "body", "food", "username", "friends", "public", "private", "report", "delete my account", "under 13", "no ads", "not sell", "firebase"]) {
    assert.ok(en.includes(phrase), "privacy mentions: " + phrase);
  }
});

test("the terms include the not-medical-advice line and acceptable use", () => {
  const en = block(read("terms.html"), "en").toLowerCase();
  for (const phrase of ["not medical advice", "impersonat", "harass", "as is", "remove"]) assert.ok(en.includes(phrase), "terms mention: " + phrase);
});

test("the pages are cached by the service worker so they open offline", () => {
  const sw = read("sw.js");
  assert.ok(sw.includes('"/privacy.html"') && sw.includes('"/terms.html"'));
});
