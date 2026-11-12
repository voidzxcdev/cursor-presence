import { readFile, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

const items = [
  { key: "thinking", label: "Thinking" },
  { key: "editing", label: "Editing" },
  { key: "running", label: "Running" },
  { key: "typescript", label: "Languages" },
  { key: "anthropic", label: "Models" },
  { key: "cursor", label: "Idle" },
];

const cell = 108;
const pad = 20;
const W = pad * 2 + items.length * cell;
const H = 128;
const png = async (key) => `data:image/png;base64,${(await readFile(`assets/png/lg/${key}.png`)).toString("base64")}`;

const cells = [];
for (const [i, item] of items.entries()) {
  const x = pad + i * cell;
  cells.push(`
    <image href="${await png(item.key)}" x="${x + 18}" y="12" width="72" height="72"/>
    <text x="${x + 54}" y="110" text-anchor="middle" font-size="12" fill="#A1A1AA">${item.label}</text>
  `);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Inter, Helvetica, sans-serif">
  <rect width="${W}" height="${H}" rx="16" fill="#18181B" stroke="#2C2C32"/>
  ${cells.join("\n")}
</svg>`;

const out = new Resvg(svg, {
  fitTo: { mode: "width", value: W * 2 },
  font: { loadSystemFonts: true, defaultFontFamily: "Segoe UI" },
});
await writeFile("assets/strip.png", out.render().asPng());
console.log("built assets/strip.png");
