/** Generate every brand asset from branding/mark.svg. Run after `npm ci --prefix www`. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const root = new URL('../', import.meta.url)
const require = createRequire(new URL('www/package.json', root))
const sharp = require('sharp')
const mark = await readFile(new URL('branding/mark.svg', root), 'utf8')
const inverseColors = { '#143D2B': '#D9F5B5', '#D9F5B5': '#143D2B', '#72CA89': '#36734B' }
const inverse = mark.replace(/#143D2B|#D9F5B5|#72CA89/g, (color) => inverseColors[color])
const symbol = mark
  .replace(/ {2}<rect width="64"[^\n]+\n/, '')
  .replace(/#D9F5B5|#72CA89/g, 'currentColor')

const lockup = (icon, color) => {
  const content = icon.replace(/<svg[^>]+>/, '').replace('</svg>', '')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="64" viewBox="0 0 256 64">
  <title>basedb</title>${content}
  <text x="78" y="46" fill="${color}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="44" font-weight="700" letter-spacing="-2.2">basedb</text>
</svg>\n`
}

const assets = {
  'mark.svg': mark,
  'mark-light.svg': inverse,
  'symbol.svg': symbol,
  'logo.svg': lockup(mark, '#143D2B'),
  'logo-light.svg': lockup(inverse, '#F4F8EF'),
}

async function write(path, content) {
  const url = new URL(path, root)
  await mkdir(new URL('.', url), { recursive: true })
  await writeFile(url, content)
}

for (const [name, content] of Object.entries(assets)) {
  for (const directory of ['branding', 'apps/web/public/brand', 'www/public/brand']) {
    await write(`${directory}/${name}`, content)
  }
}

// PNG-backed ICO entries: old browsers get the same silhouette at native pixel sizes.
const sizes = [16, 32, 48]
const pngs = await Promise.all(
  sizes.map((size) => sharp(Buffer.from(mark)).resize(size).png().toBuffer()),
)
const directory = Buffer.alloc(6 + sizes.length * 16)
directory.writeUInt16LE(1, 2)
directory.writeUInt16LE(sizes.length, 4)
let offset = directory.length
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16
  directory[entry] = size
  directory[entry + 1] = size
  directory.writeUInt16LE(1, entry + 4)
  directory.writeUInt16LE(32, entry + 6)
  directory.writeUInt32LE(pngs[index].length, entry + 8)
  directory.writeUInt32LE(offset, entry + 12)
  offset += pngs[index].length
}
const ico = Buffer.concat([directory, ...pngs])
const apple = await sharp(Buffer.from(mark))
  .resize(180)
  .flatten({ background: '#143D2B' })
  .png()
  .toBuffer()
const large = await sharp(Buffer.from(mark)).resize(512).png().toBuffer()
for (const path of [
  'branding/favicon.ico',
  'apps/web/src/app/favicon.ico',
  'www/public/favicon.ico',
]) {
  await write(path, ico)
}
for (const path of [
  'branding/apple-touch-icon.png',
  'apps/web/src/app/apple-icon.png',
  'www/public/apple-touch-icon.png',
]) {
  await write(path, apple)
}
for (const path of [
  'branding/icon-512.png',
  'apps/web/public/brand/icon-512.png',
  'www/public/brand/icon-512.png',
]) {
  await write(path, large)
}
for (const path of [
  'apps/web/src/app/icon.svg',
  'www/public/favicon.svg',
  'www/src/assets/logo.svg',
]) {
  await write(path, mark)
}
await write('www/src/assets/logo-light.svg', inverse)

// A portable presentation of the identity, including icons at their actual sizes.
const place = (svg, x, y, width, height) =>
  svg.replace(
    /<svg[^>]+>/,
    `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${width / height === 4 ? '256 64' : '64 64'}">`,
  )
const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <rect width="1200" height="760" fill="#F6F8F2"/>
  <g font-family="system-ui, -apple-system, Segoe UI, sans-serif">
    <text x="56" y="57" fill="#143D2B" font-size="14" font-weight="600" letter-spacing="3">BASEDB / IDENTITÉ</text>
    <text x="1144" y="57" text-anchor="end" fill="#6B7D6D" font-size="13">Le b modulaire</text>
    ${place(assets['logo.svg'], 344, 160, 512, 128)}
    <text x="600" y="337" text-anchor="middle" fill="#6B7D6D" font-size="17">Des bases solides. Des possibilités ouvertes.</text>
    <rect x="40" y="403" width="548" height="226" rx="20" fill="#143D2B"/>
    ${place(assets['logo-light.svg'], 170, 469, 288, 72)}
    <text x="64" y="604" fill="#AFC3AE" font-size="11" letter-spacing="2">SUR FOND SOMBRE</text>
    <rect x="612" y="403" width="548" height="226" rx="20" fill="#E8EEDF"/>
    ${[16, 32, 48, 64].map((size, index) => place(mark, 742 + index * 74, 507 - size / 2, size, size)).join('')}
    <text x="636" y="604" fill="#617360" font-size="11" letter-spacing="2">UNE SIGNATURE, À TOUTES LES TAILLES</text>
    ${['#143D2B', '#D9F5B5', '#72CA89'].map((color, index) => `<circle cx="${64 + index * 172}" cy="697" r="12" fill="${color}"/><text x="${85 + index * 172}" y="702" fill="#617360" font-size="12">${color}</text>`).join('')}
    <text x="1144" y="702" text-anchor="end" fill="#6B7D6D" font-size="12">SVG · favicon · icône mobile</text>
  </g>
</svg>`
await write('branding/preview.png', await sharp(Buffer.from(preview)).png().toBuffer())
console.log('Brand assets generated for the app, website and documentation.')
