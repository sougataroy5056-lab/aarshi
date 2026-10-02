// Builds the deployable site into public/.
// site/index.html is written as a page fragment (title + style + body markup + script),
// which is the format the Claude artifact preview expects. This wraps it in a full
// HTML document for Vercel and copies the assets it references.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";

const src = readFileSync("site/index.html", "utf8");
const bodyStart = src.indexOf('<div class="announce">');
if (bodyStart === -1) throw new Error("Could not find the start of the page body in site/index.html");

const head = src.slice(0, bodyStart).trim();
const body = src.slice(bodyStart).trim();

const description =
  "ARS SHI Parfums: six Eaux de Parfum in textured, foil-pressed boxes. 50 ml, ₹899 each. Free shipping over ₹1,499 and cash on delivery across India.";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="${description}">
<meta name="theme-color" content="#0E1B36">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ARS SHI Parfums">
<meta property="og:title" content="ARS SHI Parfums">
<meta property="og:description" content="${description}">
<meta property="og:image" content="/img/w/stage-wide.webp">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%230E1B36'/%3E%3Ctext x='32' y='43' text-anchor='middle' font-family='Palatino Linotype,Palatino,serif' font-size='30' fill='%23F4F7FC'%3EA%3C/text%3E%3C/svg%3E">
<link rel="preload" href="/fonts/pagella-regular.woff2" as="font" type="font/woff2" crossorigin>
${head}
</head>
<body>
${body}
</body>
</html>
`;

rmSync("public", { recursive: true, force: true });
mkdirSync("public/img", { recursive: true });
writeFileSync("public/index.html", html);
cpSync("site/img/w", "public/img/w", { recursive: true });
cpSync("site/fonts", "public/fonts", { recursive: true });
console.log("Built public/ (" + Math.round(html.length / 1024) + " KB index.html)");
