// Headless screenshots from several viewpoints. Usage: node scripts/shots.mjs [phase-name]
// Starts its own Vite dev server, drives the app through window.__game / window.__store.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const phase = process.argv[2] ?? 'phase1';
const outDir = join(import.meta.dirname, '..', 'screenshots', phase);
mkdirSync(outDir, { recursive: true });

// [name, x, y, z, yaw, pitch, actions]
const VIEWS = [
  ['spawn', 0, 0, 3, Math.PI, 0.25],
  ['stairs', 6, 0, -6.5, Math.PI, 0.3],
  // Player just behind the wall, camera boom points through it: must be pulled in.
  ['wall-camera', -2, 0, -10.6, 0, 0.2],
  ['deck', 0, 0, 9, Math.PI, 0.35],
];

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

try {
  await page.goto('http://localhost:5199/');
  await page.waitForFunction(() => window.__store?.phase === 'home' || window.__store?.error, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__store.error);
  if (err) throw new Error(err);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(outDir, '00-home.png') });

  await page.click('button.visit');
  for (const [name, x, y, z, yaw, pitch] of VIEWS) {
    await page.evaluate(([x, y, z, yaw, pitch]) => window.__game.debugTeleport(x, y, z, yaw, pitch), [x, y, z, yaw, pitch]);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(outDir, `${name}.png`) });
  }

  // Climb the stairs (top at 1.02 m) to check autostep.
  await page.evaluate(() => window.__game.debugTeleport(6, 0, -5.5, Math.PI, 0.3));
  await page.keyboard.down('z');
  await page.waitForTimeout(3500);
  await page.keyboard.up('z');
  const y = await page.evaluate(() => window.__game.playerPosition.y);
  console.log(`stairs climb: feet y = ${y.toFixed(2)} (expected ≈ 1.02)`);
  await page.screenshot({ path: join(outDir, 'stairs-top.png') });

  // Walk forward for 2 s, then run, to check animation and movement.
  await page.evaluate(() => window.__game.debugTeleport(0, 0, 3, Math.PI, 0.25));
  await page.keyboard.down('z');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(outDir, 'walk.png') });
  await page.keyboard.down('Shift');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(outDir, 'run.png') });
  await page.keyboard.up('Shift');
  await page.keyboard.up('z');

  await page.keyboard.press('v');
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, 'first-person.png') });

  const info = await page.evaluate(() => ({ fps: window.__store.fps }));
  console.log(`ok: ${outDir} — fps ${info.fps}`);
} finally {
  if (errors.length) console.log('console errors:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
  await browser.close();
  await server.close();
}
