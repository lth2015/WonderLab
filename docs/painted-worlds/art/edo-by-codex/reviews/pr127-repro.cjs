const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const repo = process.env.WONDERLAB_REVIEW_REPO || process.cwd();
const sha = '3856eddf5fe43607540416c89176dfd68cdd9f57';
const esbuild = require(repo + '/node_modules/esbuild');
const source = execFileSync('git', ['show', sha + ':apps/qingming-edo/src/engine/sound.ts'], { cwd: repo, encoding: 'utf8' });
const js = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
const events = [];
const contexts = [];
let timerId = 0;
class Param {
  constructor(value, label) { this.current = value; this.label = label; }
  get value() { return this.current; }
  set value(value) { this.current = value; events.push({ event: 'value', label: this.label, value }); }
  setTargetAtTime(target, time, constant) { events.push({ event: 'target', label: this.label, target, time, constant }); }
  setValueAtTime(value, time) { events.push({ event: 'set', label: this.label, value, time }); }
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class Node {
  connect(destination) { return destination; }
  start() {}
  stop() {}
}
class Context {
  constructor() {
    this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000;
    this.destination = new Node(); this.gains = []; this.resumeCalls = 0;
    contexts.push(this);
  }
  createGain() {
    const n = new Node(); n.gain = new Param(1, 'gain-' + (this.gains.length + 1));
    this.gains.push(n); return n;
  }
  createDynamicsCompressor() {
    const n = new Node(); n.threshold = new Param(0, 'threshold'); n.ratio = new Param(1, 'ratio'); return n;
  }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() {
    const n = new Node();
    n.start = () => events.push({ event: 'bed-start', busGains: this.gains.slice(1, 4).map(g => g.gain.value) });
    return n;
  }
  createBiquadFilter() {
    const n = new Node(); n.frequency = new Param(0, 'frequency'); n.Q = new Param(0, 'q'); return n;
  }
  createOscillator() {
    const n = new Node(); n.frequency = new Param(0, 'osc-frequency'); n.detune = new Param(0, 'detune'); return n;
  }
  suspend() { return Promise.resolve(); }
  resume() { this.resumeCalls++; return Promise.resolve(); }
}
const moduleUnderTest = { exports: {} };
const sandbox = {
  module: moduleUnderTest, exports: moduleUnderTest.exports,
  window: { AudioContext: Context, setTimeout: () => ++timerId },
  document: { hidden: false, addEventListener() {} },
  navigator: { audioSession: { type: 'auto' } },
};
vm.runInNewContext(js, sandbox, { filename: 'sound-at-3856edd.cjs' });
const sound = moduleUnderTest.exports.sound;
sound.setLevels({ ambient: 0, ui: 0, music: 0 });
assert.equal(contexts.length, 0, 'setLevels must not create a context');
console.log('PASS: before unlock, AudioContext count = 0');
sound.unlock();
const firstBedIndex = events.findIndex(e => e.event === 'bed-start');
assert.ok(firstBedIndex >= 0);
assert.deepEqual(events[firstBedIndex].busGains, [1, 1, 1]);
const busLabels = new Set(['gain-2', 'gain-3', 'gain-4']);
assert.equal(events.slice(0, firstBedIndex).filter(e => busLabels.has(e.label)).length, 0);
console.log('CONFIRMED BUG: first bed start bus gains = ' + JSON.stringify(events[firstBedIndex].busGains));
console.log('CONFIRMED BUG: bus value/set/target operations before first bed start = 0');
const targets = events.filter(e => e.event === 'target' && busLabels.has(e.label));
assert.equal(targets.length, 3);
assert.ok(targets.every(e => e.target === 0 && e.constant === 0.05));
assert.ok(events.indexOf(targets[0]) > firstBedIndex);
console.log('CONFIRMED BUG: only later apply() schedules 3 gain targets at 0 with timeConstant = 0.05s');
// This is a gain-envelope calculation, not a sound level or hardware measurement.
const busEnvelopeAt20ms = Math.exp(-0.02 / 0.05);
assert.ok(busEnvelopeAt20ms > 0);
console.log('ENVELOPE: muted bus at 20ms = ' + busEnvelopeAt20ms.toFixed(6) + ' (target exponential from initial 1)');
contexts[0].state = 'interrupted';
sound.unlock();
assert.equal(contexts[0].resumeCalls, 0);
console.log('CONFIRMED BUG: unlock() with state=interrupted leaves resumeCalls = 0');
console.log('Source SHA: ' + sha);
console.log('LIMIT: deterministic fake-node control-flow/envelope proof; no audio rendering, OS silent switch, Safari or actual hearing tested.');
