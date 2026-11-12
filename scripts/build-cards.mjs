import { readFile, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

const W = 720;
const ROW = 132;
const PAD = 24;
const IMG = 84;

const cards = [
  { lg: "typescript", sm: "anthropic", lines: ["Editing presence.ts", "Claude Opus 5.5 · 68K chars"], time: "1:02:13" },
  { lg: "thinking", sm: "openai", lines: ["Thinking", "GPT-5.6 Sol · 68K chars"], time: "1:04:40" },
  { lg: "cursor", lines: ["Last turn finished at 23:36", "Last Codebase contains 68K chars"], time: "1:05:02" },
];

const png = async (size, key) => `data:image/png;base64,${(await readFile(`assets/png/${size}/${key}.png`)).toString("base64")}`;

const rows = [];
for (const [i, c] of cards.entries()) {
  const y = PAD + i * ROW;
  const x = PAD;
  const tx = x + IMG + 18;
  const badge = c.sm
    ? `<circle cx="${x + IMG - 6}" cy="${y + IMG - 6}" r="17" fill="#18181B"/>
       <clipPath id="b${i}"><circle cx="${x + IMG - 6}" cy="${y + IMG - 6}" r="14"/></clipPath>
       <image href="${await png("sm", c.sm)}" x="${x + IMG - 20}" y="${y + IMG - 20}" width="28" height="28" clip-path="url(#b${i})"/>`
    : "";
  const divider = i ? `<line x1="${PAD}" x2="${W - PAD}" y1="${y - (ROW - IMG) / 2}" y2="${y - (ROW - IMG) / 2}" stroke="#26262B"/>` : "";
  rows.push(`${divider}
    <image href="${await png("lg", c.lg)}" x="${x}" y="${y}" width="${IMG}" height="${IMG}"/>
    ${badge}
    <text x="${tx}" y="${y + 17}" font-size="15" font-weight="600" fill="#F4F4F5">Cursor</text>
    <text x="${tx}" y="${y + 39}" font-size="14" fill="#D4D4D8">${c.lines[0]}</text>
    <text x="${tx}" y="${y + 59}" font-size="14" fill="#A1A1AA">${c.lines[1]}</text>
    <text x="${tx}" y="${y + 80}" font-size="13" font-weight="600" fill="#3BA55D">${c.time}</text>`);
}

const H = PAD * 2 + cards.length * ROW - (ROW - IMG);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Inter, Helvetica, sans-serif">
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" fill="#18181B" stroke="#2C2C32"/>
  ${rows.join("\n")}
</svg>`;

const out = new Resvg(svg, { fitTo: { mode: "width", value: W * 2 }, font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" } });
await writeFile("assets/cards.png", out.render().asPng());
console.log("built assets/cards.png");
