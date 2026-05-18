/**
 * Builds 1242×2688 App Store marketing PNGs from full-screen simulator captures:
 * title + subtitle above a rounded iPhone-style frame.
 *
 * Usage: node scripts/app-store-screenshots.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const W = 1242;
const H = 2688;

const BG = "#F4F2EE";
const TITLE_COLOR = "#141413";
const SUBTITLE_COLOR = "#4A4A48";
const FRAME_STROKE = "#1C1C1E";
const FRAME_FILL = "#0B0B0C";

/** @type {{ input: string; out: string; title: string; subtitle: string }[]} */
const SLIDES = [
  {
    input:
      "/Users/cameroncons/.cursor/projects/Users-cameroncons-Listio/assets/Simulator_Screenshot_-_iPhone_17_-_2026-05-15_at_15.05.07-2367505c-2c01-4e1b-8ff2-d2b600b65ede.png",
    out: "01-recipes.png",
    title: "Organize Your Favorites",
    subtitle: "Keep all your go-to recipes in one easy-to-reach place.",
  },
  {
    input:
      "/Users/cameroncons/.cursor/projects/Users-cameroncons-Listio/assets/Simulator_Screenshot_-_iPhone_17_-_2026-05-15_at_15.05.04-0beb8625-2029-44f0-923e-4e6fb1d69614.png",
    out: "02-meals.png",
    title: "Plan Your Week",
    subtitle: "Organize your meals with ease.",
  },
  {
    input:
      "/Users/cameroncons/.cursor/projects/Users-cameroncons-Listio/assets/Simulator_Screenshot_-_iPhone_17_-_2026-05-15_at_15.05.01-2332836f-f60d-4de5-8144-e870bc3d7eb1.png",
    out: "03-shopping.png",
    title: "Smart Shopping List",
    subtitle: "Automatically generated from your meal plan.",
  },
];

function escapeXml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapSubtitle(text, maxCharsPerLine = 38) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxCharsPerLine) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function headerSvg(title, subtitle) {
  const subLines = wrapSubtitle(subtitle);
  const subTspans = subLines
    .map((ln, i) => {
      const dy = i === 0 ? 0 : 34;
      return `<tspan x="621" dy="${dy}px">${escapeXml(ln)}</tspan>`;
    })
    .join("");

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="300">
  <text x="621" y="108" text-anchor="middle" font-size="56" font-weight="700" fill="${TITLE_COLOR}"
    font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif">
    ${escapeXml(title)}
  </text>
  <text x="621" y="178" text-anchor="middle" font-size="30" font-weight="400" fill="${SUBTITLE_COLOR}"
    font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif">
    ${subTspans}
  </text>
</svg>`,
  );
}

/**
 * Rounded-rect mask (white inside, transparent outside) for dest-in composite.
 */
function roundedMaskSvg(width, height, rx) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" rx="${rx}" ry="${rx}" fill="white"/>
</svg>`,
  );
}

async function buildPhoneWithScreenshot(screenshotPath) {
  const meta = await sharp(screenshotPath).metadata();
  const srcW = meta.width ?? 470;
  const srcH = meta.height ?? 1024;

  const bezel = 16;
  const outerRx = 64;
  const screenRx = 52;
  const targetScreenW = 900;
  const targetScreenH = Math.round((targetScreenW * srcH) / srcW);

  const screen = await sharp(screenshotPath)
    .resize({
      width: targetScreenW,
      height: targetScreenH,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .composite([
      {
        input: await sharp(roundedMaskSvg(targetScreenW, targetScreenH, screenRx))
          .resize(targetScreenW, targetScreenH)
          .ensureAlpha()
          .png()
          .toBuffer(),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  const outerW = targetScreenW + bezel * 2;
  const outerH = targetScreenH + bezel * 2;

  const frameSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outerW}" height="${outerH}">
  <rect x="2" y="2" width="${outerW - 4}" height="${outerH - 4}" rx="${outerRx}" ry="${outerRx}"
    fill="${FRAME_FILL}" stroke="${FRAME_STROKE}" stroke-width="4"/>
</svg>`,
  );

  const frame = await sharp(frameSvg).png().toBuffer();

  return sharp({
    create: {
      width: outerW,
      height: outerH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: frame, left: 0, top: 0 },
      { input: screen, left: bezel, top: bezel },
    ])
    .png()
    .toBuffer();
}

async function main() {
  const outDir = path.join(process.cwd(), "marketing", "app-store-1242x2688");
  fs.mkdirSync(outDir, { recursive: true });

  for (const slide of SLIDES) {
    if (!fs.existsSync(slide.input)) {
      throw new Error(`Missing screenshot: ${slide.input}`);
    }

    const phone = await buildPhoneWithScreenshot(slide.input);
    const phoneMeta = await sharp(phone).metadata();
    const pw = phoneMeta.width ?? 0;
    const ph = phoneMeta.height ?? 0;
    const phoneLeft = Math.round((W - pw) / 2);
    const headerBlock = 310;
    const phoneTop = Math.min(
      Math.round(headerBlock + (H - headerBlock - ph) / 2),
      H - ph - 80,
    );

    const header = headerSvg(slide.title, slide.subtitle);

    await sharp({
      create: { width: W, height: H, channels: 3, background: BG },
    })
      .composite([
        { input: header, left: 0, top: 0 },
        { input: phone, left: phoneLeft, top: phoneTop },
      ])
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, slide.out));

    // eslint-disable-next-line no-console
    console.log(`Wrote ${path.join(outDir, slide.out)}`);
  }

  const probe = await sharp(path.join(outDir, SLIDES[0].out)).metadata();
  // eslint-disable-next-line no-console
  console.log(`Verified dimensions: ${probe.width}×${probe.height}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
