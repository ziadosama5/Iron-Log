// Looks: Classic (today's design), Carbon and Bloom. A look is a set of CSS tokens (looks.css) switched by <html data-look>;
// this file is the pure part: ids, the suggestion from the sex entered, each look's accent presets and the surfaces the accent
// contrast is computed against. Pure (no DOM), unit-tested in tests/looks.test.js.
import { PRESETS } from "./theme-tools.js";

export const LOOKS = ["classic", "carbon", "bloom"];

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// A saved look id, or "classic" for anything unknown.
export function cleanLook(v) { return typeof v === "string" && LOOKS.includes(v) ? v : "classic"; }

// A look to preselect for the sex a person entered; null = no suggestion.
export function suggestLook(sex) { return sex === "male" ? "carbon" : sex === "female" ? "bloom" : null; }

const LOOK_ACCENTS = {
  carbon: [
    { id: "ember", name: "Ember", hex: "#ff7a2f" }, { id: "amber", name: "Amber", hex: "#ffc61a" },
    { id: "mint", name: "Mint", hex: "#3ddc97" }, { id: "blue", name: "Blue", hex: "#4da3ff" },
    { id: "red", name: "Red", hex: "#ff5c7a" }, { id: "violet", name: "Violet", hex: "#b79bff" }
  ],
  bloom: [
    { id: "rose", name: "Rose", hex: "#c2255c" }, { id: "violet", name: "Violet", hex: "#7c3aed" },
    { id: "teal", name: "Teal", hex: "#0f8b8d" }, { id: "coral", name: "Coral", hex: "#d9480f" },
    { id: "gold", name: "Gold", hex: "#b8860b" }, { id: "blue", name: "Blue", hex: "#2563eb" }
  ]
};

export function accentPresetsFor(look) { return own(LOOK_ACCENTS, look) ? LOOK_ACCENTS[look] : PRESETS; }

// The accent saved when a look is picked: plate blue for Classic (the CSS defaults), else the look's first preset.
export function defaultAccentFor(look) { return own(LOOK_ACCENTS, look) ? LOOK_ACCENTS[look][0].hex : "plate"; }

// Card surface and page background per look and mode, used to keep the accent readable (applyAccent).
export const LOOK_ENV = {
  classic: { light: { surface: "#ffffff", bg: "#f3f5f9" }, dark: { surface: "#171d26", bg: "#0f1319" } },
  carbon: { light: { surface: "#ffffff", bg: "#f4f1ee" }, dark: { surface: "#181a1f", bg: "#101114" } },
  bloom: { light: { surface: "#ffffff", bg: "#fff4f6" }, dark: { surface: "#2a1c3a", bg: "#17102a" } }
};
export function envFor(look) { return own(LOOK_ENV, look) ? LOOK_ENV[look] : LOOK_ENV.classic; }
