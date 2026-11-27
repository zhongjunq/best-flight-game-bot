// All sound is synthesised live with WebAudio — no audio files, no network.
// The engine hum is two detuned oscillators whose pitch follows the throttle;
// rings, drops, landings and crashes are short envelopes on oscillators and noise.

export function createAudio() {
  let context = null;
  let engineOscA = null;
  let engineOscB = null;
  let engineGain = null;
  let engineFilter = null;
  let started = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
    } catch {
      return false;
    }
    return true;
  }

  function startEngine() {
    if (started || !ensure()) return;
    started = true;
    engineOscA = context.createOscillator();
    engineOscB = context.createOscillator();
    engineGain = context.createGain();
    engineFilter = context.createBiquadFilter();
    engineOscA.type = 'sawtooth';
    engineOscB.type = 'triangle';
    engineOscA.frequency.value = 62;
    engineOscB.frequency.value = 93;
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain.gain.value = 0.0;
    engineOscA.connect(engineFilter);
    engineOscB.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(context.destination);
    engineOscA.start();
    engineOscB.start();
  }

  function blip(frequency, duration, type, volume, when = 0) {
    if (!ensure()) return;
    const t = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function noiseBurst(duration, volume, filterFrequency) {
    if (!ensure()) return;
    const t = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(t);
  }

  return {
    /** Call on the first user gesture so the context is allowed to sound. */
    unlock() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume().catch(() => {});
      startEngine();
    },
    /** Throttle 0..1 and speed in knots steer the engine hum. */
    setEngine(throttle, speedKnots) {
      if (!started || !engineOscA) return;
      const base = 52 + throttle * 58 + speedKnots * 0.12;
      engineOscA.frequency.setTargetAtTime(base, context.currentTime, 0.08);
      engineOscB.frequency.setTargetAtTime(base * 1.5, context.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.028 + throttle * 0.05, context.currentTime, 0.1);
      engineFilter.frequency.setTargetAtTime(320 + throttle * 900, context.currentTime, 0.1);
    },
    ring() {
      blip(880, 0.16, 'sine', 0.22);
      blip(1318, 0.24, 'sine', 0.18, 0.07);
    },
    drop() {
      blip(392, 0.12, 'triangle', 0.2);
      noiseBurst(0.12, 0.1, 900);
    },
    land() {
      [523, 659, 784, 1046].forEach((freq, i) => blip(freq, 0.22, 'triangle', 0.18, i * 0.09));
    },
    mission() {
      [659, 880].forEach((freq, i) => blip(freq, 0.18, 'sine', 0.2, i * 0.1));
    },
    scrape() {
      noiseBurst(0.25, 0.25, 500);
    },
    crash() {
      noiseBurst(0.7, 0.4, 320);
      blip(70, 0.5, 'sawtooth', 0.25);
    },
    lowFuel() {
      blip(660, 0.1, 'square', 0.08);
      blip(660, 0.1, 'square', 0.08, 0.16);
    },
  };
}
