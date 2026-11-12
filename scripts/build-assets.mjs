import { mkdir, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";
import * as simpleIcons from "simple-icons";
import { GLYPHS, LANGUAGES, PROVIDERS, STATUS_KEYS } from "../src/catalog.ts";

const FG = "#F4F4F5";
const BG_TOP = "#1B1B1F";
const BG_BOTTOM = "#0A0A0C";
const EDGE = "#2C2C32";

const siBySlug = new Map(Object.values(simpleIcons).map((icon) => [icon.slug, icon]));

function glyphMarkup(source) {
  if (source.si) {
    const icon = siBySlug.get(source.si);
    if (!icon) throw new Error(`simple-icons has no "${source.si}"`);
    return `<path d="${icon.path}" fill="${FG}"/>`;
  }
  if (source.text) {
    const size = source.text.length <= 2 ? 14.5 : 10.4;
    return `<text x="12" y="12" dy="0.36em" text-anchor="middle" font-family="Cascadia Mono, Consolas, monospace" font-weight="700" font-size="${size}" letter-spacing="-0.4" fill="${FG}">${source.text}</text>`;
  }
  const glyph = GLYPHS[source.glyph];
  if (!glyph) throw new Error(`no glyph "${source.glyph}"`);
  return `<g fill="none" stroke="${FG}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`;
}

function placed(inner, box, offset) {
  return `<g transform="translate(${offset} ${offset}) scale(${box / 24})">${inner}</g>`;
}

function largeTile(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/></linearGradient></defs>
  <rect x="6" y="6" width="500" height="500" rx="118" fill="url(#bg)" stroke="${EDGE}" stroke-width="4"/>
  ${placed(inner, 232, 140)}
</svg>`;
}

function smallTile(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/></linearGradient></defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  ${placed(inner, 224, 144)}
</svg>`;
}

function render(svg, width) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: true, defaultFontFamily: "Cascadia Mono" },
  })
    .render()
    .asPng();
}

const entries = [
  ...LANGUAGES.map((l) => ({ key: l.key, label: l.name, icon: l.icon })),
  ...PROVIDERS.map((p) => ({ key: p.key, label: p.name, icon: p.icon })),
  ...STATUS_KEYS.map((k) => ({ key: k, label: k, icon: { glyph: k } })),
  { key: "file", label: "file", icon: { glyph: "file" } },
  { key: "model", label: "model", icon: { glyph: "model" } },
];

const seen = new Set();
for (const e of entries) {
  if (seen.has(e.key)) throw new Error(`duplicate asset key "${e.key}"`);
  seen.add(e.key);
}

await Promise.all(["assets/svg", "assets/png/lg", "assets/png/sm"].map((d) => mkdir(d, { recursive: true })));

const sources = new Map();
for (const e of entries) {
  const inner = glyphMarkup(e.icon);
  const lg = largeTile(inner);
  sources.set(e.key, inner);
  await writeFile(`assets/svg/${e.key}.svg`, lg);
  await writeFile(`assets/png/lg/${e.key}.png`, render(lg, 512));
  await writeFile(`assets/png/sm/${e.key}.png`, render(smallTile(inner), 256));
}

await writeFile("assets/png/app-icon.png", render(largeTile(sources.get("cursor")), 1024));

const cols = 10;
const cell = 112;
const pad = 28;
const rows = Math.ceil(entries.length / cols);
const sheetW = pad * 2 + cols * cell;
const sheetH = pad * 2 + rows * (cell + 22);
const cells = entries
  .map((e, i) => {
    const x = pad + (i % cols) * cell;
    const y = pad + Math.floor(i / cols) * (cell + 22);
    const tile = largeTile(sources.get(e.key)).replace(
      'width="512" height="512"',
      `x="${x + 12}" y="${y}" width="88" height="88"`,
    );
    return `${tile}<text x="${x + 56}" y="${y + 106}" text-anchor="middle" font-family="Cascadia Mono, Consolas, monospace" font-size="11" fill="#9A9AA2">${e.label}</text>`;
  })
  .join("\n");
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" viewBox="0 0 ${sheetW} ${sheetH}"><rect width="100%" height="100%" fill="#232428"/>${cells}</svg>`;
await writeFile("assets/preview.png", render(sheet, sheetW * 2));

console.log(`built ${entries.length} icons`);
