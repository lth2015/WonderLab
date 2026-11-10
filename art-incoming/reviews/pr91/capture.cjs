const { chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const output = '/workspace/.wonderlab-tools/pr91-settled-review';
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const results = [];
  try {
    for (const setup of [
      {name: 'desktop', viewport: {width: 1440, height: 900}, mobile: false},
      {name: 'mobile', viewport: {width: 390, height: 844}, mobile: true},
    ]) {
      const context = await browser.newContext({ viewport: setup.viewport, deviceScaleFactor: 1,
        isMobile: setup.mobile, hasTouch: setup.mobile, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [], aiCalls = [];
      let lotusResponse;
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', r => {if (new URL(r.url()).pathname === '/art/lotus.webp') lotusResponse = r.status();});
      page.on('request', r => {if (r.url().includes('/api/scene')) aiCalls.push(r.url());});
      await page.goto('http://127.0.0.1:5211/?fresh&tier=standard', {waitUntil: 'networkidle', timeout: 45000});
      await page.evaluate(async () => {
        const {Engine} = await import('/src/engine/engine.ts');
        const update = Engine.prototype.update;
        Engine.prototype.update = function(dt) {
          window.reviewEngine = this;
          return update.call(this, dt);
        };
      });
      await page.waitForFunction(() => !!window.reviewEngine, {timeout: 30000});
      await page.evaluate(() => window.reviewEngine.stop());
      const canvas = page.locator('canvas.world');
      await canvas.focus();
      await canvas.press('f');
      const input = page.getByRole('textbox', {name: '写一句话，改变世界'});
      // Keep the lotus weather while changing light: plain dusk/night commands replace weather.
      const scenes = setup.mobile ? [['day', '白天的荷塘']] : [
        ['day', '白天的荷塘'], ['dusk', '黄昏的荷塘'], ['night', '夜晚的荷塘']
      ];
      for (const [scene, text] of scenes) {
        await input.fill(text);
        await input.press('Enter');
        await input.blur();
        const state = await page.evaluate((timeOfDay) => {
          const e = window.reviewEngine;
          // Deliberate visual fixture: current R1 lotus phrase chooses daytime.
          // Preserve lotus while inspecting its other light states, without a parser claim.
          e.atmosphere.set({...e.atmosphere.state, timeOfDay, weather: 'lotus'});
          const renderLandscape = e.renderLandscape;
          e.renderLandscape = () => {};
          try {
            for (let i = 0; i < 1800; i++) {
              e.time += 1 / 60;
              e.update(1 / 60);
            }
          } finally { e.renderLandscape = renderLandscape; }
          e.renderLandscape();
          e.renderer.render(e.scene, e.camera);
          return {atmosphere: {...e.atmosphere.state}, day: e.atmosphere.day, dusk: e.atmosphere.dusk,
            lotus: e.atmosphere.lotus, lotusPresence: e.lotus.presence, lotusVisible: e.lotus.points.visible,
            fishCount: e.fishes.length, engineTime: e.time};
        }, scene);
        if (state.atmosphere.timeOfDay !== scene || state.lotus < 0.99 || !state.lotusVisible) {
          throw new Error('Scene did not settle as requested: ' + JSON.stringify(state));
        }
        const file = `${setup.name}-${scene}.png`;
        await page.screenshot({path: path.join(output, file), animations: 'disabled', timeout: 45000});
        results.push({viewport: setup.viewport, scene, file, state, lotusResponse, pageErrors: [...errors], aiCalls: [...aiCalls],
          mode: 'Visual fixture sets lotus and timeOfDay directly after UI input; not a language recognition check. Deterministic 30 seconds at 60 simulation steps per second; software WebGL; reduced motion. Landscape drawn after stepping. No realtime or device performance claim.'});
      }
      await context.close();
    }
  } finally {await browser.close();}
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(results, null, 2) + '\n');
  if (results.some(r => r.pageErrors.length || r.aiCalls.length || r.lotusResponse !== 200)) throw new Error('Runtime check failed');
  console.log(JSON.stringify({output, results}, null, 2));
}
main().catch(e => {console.error(e); process.exitCode = 1;});
