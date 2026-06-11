const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'wedding-photos.json');
const outRoot = path.join(root, 'vobe2', 'www.ziuwedding.site', 'images', '_previews');

const QUALITY = 36;
const MAX_WIDTH = 560;

function toPosix(p) {
  return p.split(path.sep).join('/');
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function mapCategoryFolder(cat) {
  if (cat === 'guest') return 'guest';
  if (cat === 'prewedding') return 'prewedding';
  return 'wedding';
}

async function main() {
  const rawBuf = await fs.promises.readFile(jsonPath);
  let data;
  try {
    data = JSON.parse(rawBuf.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    data = JSON.parse(rawBuf.toString('utf16le').replace(/^\uFEFF/, ''));
  }

  if (!Array.isArray(data.photos)) {
    throw new Error('wedding-photos.json khong co photos[]');
  }

  await ensureDir(outRoot);

  let ok = 0;
  let fail = 0;

  for (const p of data.photos) {
    const srcRel = p.src;
    const srcAbs = path.join(root, srcRel);

    if (!fs.existsSync(srcAbs)) {
      fail += 1;
      continue;
    }

    const catFolder = mapCategoryFolder(p.category || p.cat);
    const baseName = path.parse(srcAbs).name;
    const outDir = path.join(outRoot, catFolder);
    await ensureDir(outDir);

    const outAbs = path.join(outDir, `${String(p.id).padStart(4, '0')}-${baseName}.webp`);

    try {
      await sharp(srcAbs)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 6 })
        .toFile(outAbs);

      const outRel = path.relative(root, outAbs);
      p.preview = toPosix(outRel);
      ok += 1;
    } catch (e) {
      fail += 1;
    }
  }

  data.previewConfig = {
    format: 'webp',
    quality: QUALITY,
    maxWidth: MAX_WIDTH,
    generatedAt: new Date().toISOString(),
    note: 'Grid uses preview; lightbox and download use original src.'
  };

  await fs.promises.writeFile(jsonPath, JSON.stringify(data, null, 4), 'utf8');
  console.log(`Done. OK=${ok}, FAIL=${fail}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
