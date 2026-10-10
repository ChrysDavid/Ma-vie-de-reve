import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: process.cwd(), server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('console', (m) => m.type() !== 'log' && errs.push(m.text())); page.on('pageerror', (e) => errs.push(e.message));
try {
  await page.goto('http://localhost:5198/');
  await page.waitForFunction(() => window.__store?.phase === 'home' || window.__store?.error, null, { timeout: 180000 });
  await page.click('button.visit');
  for (const [n, x, y, z, yaw] of [['front', 1, 0, 17, 0], ['pool', 0, 0.13, -9, Math.PI]]) {
    await page.evaluate(([x, y, z, yaw]) => window.__game.debugTeleport(x, y, z, yaw, 0.3), [x, y, z, yaw]);
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      const r = window.__game.engine.renderer; const i = r.info;
      let meshes = 0, tris = 0; window.__game.engine.scene.traverse((o) => { if (o.isMesh) { meshes++; } });
      return { fps: window.__store.fps, calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, progs: i.programs.length, meshes, lights: (() => { let l = 0; window.__game.engine.scene.traverse((o) => o.isLight && l++); return l; })() };
    });
    console.log(n, JSON.stringify(info));
  }
  const per = await page.evaluate(() => window.__game.engine.scene.children.map((g, i) => { let t = 0, inst = 0; g.traverse((o) => { if (o.isMesh) { const ix = o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count; const n = o.isInstancedMesh ? o.count : 1; t += ix / 3 * n; if (o.isInstancedMesh) inst += n; } }); return i + ':' + (g.type) + ':' + Math.round(t / 1000) + 'k tris, inst ' + inst; }).filter((x) => !x.includes(':0k')));
  console.log(per.join(' | '));
  console.log(await page.evaluate(() => { const out = []; window.__game.engine.scene.children[5].traverse((o) => { if (o.isMesh) { const ix = o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count; const n = o.isInstancedMesh ? o.count : 1; out.push((o.name || o.material.name || '?') + ' ' + Math.round(ix / 3) + 'x' + n); } }); return out.join(' | '); }));
  const c = await page.evaluate(() => { let lost = false; const gl = window.__game.engine.renderer.getContext(); return gl.isContextLost(); });
  console.log('contextLost', c);
} finally { console.log([...new Set(errs)].slice(0, 6).join('\n')); await browser.close(); await server.close(); }
