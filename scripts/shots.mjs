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
  ['front', 1, 0, 17, 0, 0.12],
  ['front-left', -16, 0, 14, -0.75, 0.15],
  ['back', 0, 0, -20, Math.PI, 0.12],
  ['back-right', 16, 0, -18, 2.4, 0.15],
  ['pool', 0, 0.13, -9, Math.PI, 0.35],
  ['pool-edge', -9, 0.13, -24, -2.5, 0.25],
  ['garden', -20, 0, -30, 2.6, 0.2],
  ['firepit', -15, 0, -22, 2.3, 0.4],
  ['outdoor-kitchen', 18, 0.13, -4, 0, 0.3],
  ['carport', 18, 0.13, 22, 0, 0.25],
  ['gate', 10, 0, 26, -2.3, 0.15],
  ['fountain', -8, 0, 23, 0, 0.3],
  ['hall', 1.5, 0.15, 4, 0, 0.2],
  ['hall-stair', 1.8, 0.15, 1.5, Math.PI - 0.5, 0.15],
  ['living', 8, 0.15, -3, Math.PI / 2, 0.2],
  ['kitchen', -2, 0.15, -4, Math.PI / 2, 0.2],
  ['bedroom4', -3, 0.15, 5, Math.PI / 2, 0.2],
  ['upper-lounge', 0, 3.45, -2, -Math.PI / 2, 0.2],
  ['gallery', 1.5, 3.45, -0.5, Math.PI, 0.35],
  ['terrace', 8, 3.45, 3, 0, 0.2],
  ['master', -4, 3.45, -2.5, Math.PI, 0.2],
  ['bedroom2', -9.5, 3.45, 3.5, Math.PI, 0.2],
  ['office', 11.3, 0.15, 6.3, Math.PI / 4, 0.25],
  ['dining', -2, 0.15, -0.2, 0, 0.25],
  ['master-bath', -8, 3.45, -4, Math.PI / 4, 0.25],
  ['dressing', -7.8, 3.45, -1.5, Math.PI / 2, 0.25],
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
    await page.screenshot({ path: join(outDir, `${name}.png`), timeout: 120000 });
  }

  // Climb the hall stair (first floor at 3.45 m) to check autostep.
  await page.evaluate(() => window.__game.debugTeleport(-0.9, 0.15, 6.45, 0, 0.3));
  await page.keyboard.down('z');
  await page.waitForTimeout(8000);
  await page.keyboard.up('z');
  const y = await page.evaluate(() => window.__game.playerPosition.y);
  console.log(`stairs climb: feet y = ${y.toFixed(2)} (expected ≈ 3.45)`);
  await page.screenshot({ path: join(outDir, 'stairs-top.png') });

  // Walk forward for 2 s, then run, to check animation and movement.
  await page.evaluate(() => window.__game.debugTeleport(1, 0, 16, 0, 0.25));
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
