/**
 * The image a link to the site shows when it is shared — one per language, in
 * `public/og/<code>.jpg`, 1200 × 630: the headline of the home page, beside a table as
 * basedb draws it, in the language of the page. `Landing.astro` and the documentation
 * (`src/starlightRouteData.ts`) point to them.
 *
 * The images are kept in the repository: run this again when the headline, the facts or
 * the table's words change in a dictionary (`src/i18n/ui/*.ts`).
 *
 *   node scripts/og-images.mjs          every language
 *   node scripts/og-images.mjs fr en    some
 *
 * It needs Node 22.18 or later (it reads the dictionaries, written in TypeScript) and
 * Google Chrome — found in its usual place, or named by `CHROME`. The fonts come from
 * Google Fonts, as on the site.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { LOCALES } from '../src/i18n/locales.ts';
import fr from '../src/i18n/ui/fr.ts';

const WWW = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(WWW, 'public', 'og');
const WIDTH = 1200;
const HEIGHT = 630;

const CHROMES = [
	process.env.CHROME,
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium',
	'/usr/bin/chromium-browser',
];
const chrome = CHROMES.find((path) => path && existsSync(path));
if (!chrome) {
	console.error('Google Chrome est introuvable : donnez son chemin dans la variable CHROME.');
	process.exit(1);
}

/** The fonts of the scripts Inter does not draw. */
const SCRIPT_FONTS = { ja: 'Noto+Sans+JP', 'zh-cn': 'Noto+Sans+SC', ko: 'Noto+Sans+KR' };

const escape = (text) =>
	String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** A text of the dictionary in a language — its translation, or the French. */
function reader(over) {
	return (...path) => {
		const find = (dict) => path.reduce((node, key) => (node == null ? undefined : node[key]), dict);
		return find(over) ?? find(fr);
	};
}

function page(code, lang, text) {
	const hero = { title: text('teams', 'hero', 'title'), accent: text('teams', 'hero', 'titleAccent') };
	const facts = text('teams', 'hero', 'facts');
	const stage = (...path) => text('teams', 'stage', ...path);
	const money = new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
	const STATUS = { contact: '#f59e0b', meeting: '#0ea5e9', quote: '#a855f7', signed: '#22c55e' };
	const ROWS = [
		['signed', 4200],
		['quote', 12500],
		['meeting', 6400],
		['contact', 2100],
		['quote', 7500],
		['signed', 22000],
	];
	const clients = stage('clients');
	const rows = ROWS.map(
		([status, amount], i) => `
		<div class="row">
			<span class="n">${i + 1}</span>
			<span class="client">${escape(clients[i])}</span>
			<span><i class="chip" style="--c:${STATUS[status]}">${escape(stage('statuses', status))}</i></span>
			<span class="num">${escape(money.format(amount))}</span>
		</div>`,
	).join('');
	const script = SCRIPT_FONTS[code];
	const fonts = `family=Inter:wght@500;600;700;800${script ? `&family=${script}:wght@500;700;900` : ''}`;
	const family = `'Inter'${script ? `, '${script.replace(/\+/g, ' ')}'` : ''}, system-ui, sans-serif`;

	return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=block">
<style>
	html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
	body {
		position: relative;
		font-family: ${family};
		color: #f5f5f7;
		background: #060d08;
		-webkit-font-smoothing: antialiased;
	}
	.glow {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(700px 460px at 92% 108%, rgba(63, 203, 42, 0.42), transparent 70%),
			radial-gradient(560px 380px at 4% -12%, rgba(62, 224, 178, 0.16), transparent 70%);
	}
	.lines {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
		background-size: 48px 48px;
		-webkit-mask-image: radial-gradient(ellipse 70% 80% at 30% 45%, #000 20%, transparent 75%);
	}
	.brand {
		position: absolute;
		left: 72px;
		top: 62px;
		display: flex;
		align-items: center;
		gap: 16px;
		font-size: 40px;
		font-weight: 700;
		letter-spacing: -0.045em;
	}
	.brand svg { width: 54px; height: 54px; }
	.text {
		position: absolute;
		left: 72px;
		top: 164px;
		width: 580px;
		height: 300px;
		display: flex;
		align-items: center;
	}
	h1 {
		margin: 0;
		font-size: 68px;
		font-weight: 800;
		line-height: 1.04;
		letter-spacing: -0.045em;
		text-wrap: balance;
		/* Japanese breaks between phrases, Korean between words — never inside one. */
		word-break: ${code === 'ko' ? 'keep-all' : 'auto-phrase'};
	}
	h1 span { display: block; }
	h1 .accent {
		padding-bottom: 0.08em;
		color: transparent;
		background: linear-gradient(92deg, #3ee0b2 0%, #5fe07a 45%, #c9f06b 100%);
		-webkit-background-clip: text;
		background-clip: text;
	}
	.facts {
		position: absolute;
		left: 72px;
		bottom: 60px;
		width: 600px;
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.facts span {
		padding: 8px 15px;
		border-radius: 999px;
		font-size: 19px;
		font-weight: 600;
		color: #cdf5c6;
		background: rgba(110, 224, 138, 0.1);
		box-shadow: inset 0 0 0 1px rgba(110, 224, 138, 0.25);
	}
	.win {
		position: absolute;
		left: 700px;
		top: 104px;
		width: 620px;
		height: 440px;
		overflow: hidden;
		border-radius: 18px;
		font-size: 17px;
		color: #18181b;
		background: #fff;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 50px 90px -30px rgba(0, 0, 0, 0.8);
	}
	.bar {
		display: flex;
		gap: 8px;
		align-items: center;
		height: 38px;
		padding: 0 16px;
		background: #f4f4f5;
		border-bottom: 1px solid #e4e4e7;
	}
	.bar i { width: 12px; height: 12px; border-radius: 50%; background: #ff5f57; }
	.bar i:nth-child(2) { background: #febc2e; }
	.bar i:nth-child(3) { background: #28c840; }
	.tools {
		display: flex;
		align-items: center;
		gap: 18px;
		height: 56px;
		padding: 0 16px;
		border-bottom: 1px solid #e4e4e7;
		font-size: 15px;
		color: #52525b;
		white-space: nowrap;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 34px;
		padding: 0 12px;
		border: 1px solid #e4e4e7;
		border-radius: 9px;
		font-weight: 600;
		color: #18181b;
	}
	.add {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		height: 34px;
		padding: 0 14px;
		border-radius: 9px;
		font-weight: 600;
		color: #fff;
		background: #2a9d1c;
	}
	.row {
		display: grid;
		grid-template-columns: 44px 1.5fr 1.2fr 0.9fr;
		align-items: center;
		gap: 12px;
		height: 50px;
		padding-right: 20px;
		border-bottom: 1px solid #efeff1;
		white-space: nowrap;
	}
	.row.head { height: 40px; font-size: 14px; font-weight: 600; color: #71717a; background: #fafafa; }
	.n { text-align: center; font-size: 14px; color: #a1a1aa; }
	.client { overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
	.num { text-align: right; font-variant-numeric: tabular-nums; }
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 3px 11px;
		border-radius: 999px;
		font-size: 14.5px;
		font-style: normal;
		font-weight: 500;
		color: color-mix(in srgb, var(--c) 72%, #000);
		background: color-mix(in srgb, var(--c) 14%, #fff);
	}
	.chip::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--c); }
	.cursor { position: absolute; left: 684px; top: 516px; display: flex; align-items: flex-start; gap: 2px; }
	.cursor b {
		margin-top: 18px;
		padding: 3px 9px;
		border-radius: 7px;
		font-size: 14px;
		font-weight: 600;
		color: #fff;
		background: #ec4899;
	}
</style>
</head>
<body>
	<div class="glow"></div>
	<div class="lines"></div>
	<div class="brand">
		<svg viewBox="0 0 64 64" fill="none">
			<rect width="64" height="64" rx="16" fill="#D9F5B5"/>
			<path fill-rule="evenodd" d="M16 12h8v14h12c8.4 0 14 5.5 14 13s-5.6 13-14 13H16a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2Zm8 23v8h12c2.6 0 4-1.5 4-4s-1.4-4-4-4H24Z" fill="#143D2B"/>
			<rect x="32" y="12" width="18" height="8" rx="4" fill="#36734B"/>
		</svg>
		basedb
	</div>
	<div class="text">
		<h1><span>${escape(hero.title)}</span><span class="accent">${escape(hero.accent)}</span></h1>
	</div>
	<div class="facts">${facts.map((fact) => `<span>${escape(fact)}</span>`).join('')}</div>
	<div class="win">
		<div class="bar"><i></i><i></i><i></i></div>
		<div class="tools">
			<span class="pill">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
				${escape(stage('views', 'grid'))}
			</span>
			<span>${escape(stage('toolbar', 'filter'))}</span>
			<span>${escape(stage('toolbar', 'sort'))}</span>
			<span class="add">+ ${escape(stage('add'))}</span>
		</div>
		<div class="row head">
			<span class="n">#</span>
			<span>${escape(stage('columns', 'name'))}</span>
			<span>${escape(stage('columns', 'status'))}</span>
			<span class="num">${escape(stage('columns', 'amount'))}</span>
		</div>
		${rows}
	</div>
	<div class="cursor">
		<svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6-3.6 6.9z" fill="#ec4899" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>
		<b>Léa</b>
	</div>
	<script>
		// A long headline gets smaller until it fits its box.
		document.fonts.ready.then(() => {
			const box = document.querySelector('.text');
			const title = document.querySelector('h1');
			for (let size = 68; size > 36 && title.scrollHeight > box.clientHeight; size -= 2) title.style.fontSize = size + 'px';
		});
	</script>
</body>
</html>`;
}

const wanted = process.argv.slice(2);
const locales = LOCALES.filter((l) => wanted.length === 0 || wanted.includes(l.code));
mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'basedb-og-'));
try {
	for (const { code, lang } of locales) {
		const over = code === 'fr' ? {} : (await import(`../src/i18n/ui/${code}.ts`)).default;
		const html = join(work, `${code}.html`);
		const shot = join(work, `${code}.png`);
		writeFileSync(html, page(code, lang, reader(over)));
		execFileSync(
			chrome,
			[
				'--headless=new',
				'--disable-gpu',
				'--hide-scrollbars',
				'--force-device-scale-factor=1',
				`--window-size=${WIDTH},${HEIGHT}`,
				'--virtual-time-budget=10000',
				`--user-data-dir=${join(work, 'profile')}`,
				`--screenshot=${shot}`,
				pathToFileURL(html).href,
			],
			{ stdio: 'ignore' },
		);
		const image = sharp(shot);
		const { width, height } = await image.metadata();
		if (width !== WIDTH || height !== HEIGHT) throw new Error(`${code} : ${width} × ${height} au lieu de ${WIDTH} × ${HEIGHT}`);
		await image.jpeg({ quality: 90, mozjpeg: true }).toFile(join(OUT, `${code}.jpg`));
		console.log(`og/${code}.jpg`);
	}
} finally {
	rmSync(work, { recursive: true, force: true });
}
