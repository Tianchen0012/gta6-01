// All sound is synthesised with WebAudio: no audio files, no network. Engine hum,
// gunshots, sirens, pickups and menu blips are built from oscillators and noise.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;

  // The context is only created on a user gesture (unlock): creating it on the
  // first frame would trip the browser's autoplay block and spam warnings.
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that an LFO sweeps between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 750;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenLfo = ctx.createOscillator();
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
    } catch {
      return false;
    }
    return true;
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ctx) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function tone(freq, duration, volume, type = 'sine', slideTo = null) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  return {
    unlock() {
      // Only build the context after a real gesture: building it on the first
      // frame trips the autoplay block and logs a warning every resume.
      const activation = window.navigator.userActivation;
      if (activation && !activation.hasBeenActive) return;
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    setEngine(speedRatio, driving) {
      if (!ctx) return;
      const target = driving ? 0.045 + speedRatio * 0.075 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(48 + speedRatio * 130, ctx.currentTime, 0.08);
    },
    setSiren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
    },
    gunshot() {
      noiseBurst(0.14, 0.5, 1800);
    },
    enemyShot() {
      noiseBurst(0.1, 0.22, 1200);
    },
    crash() {
      noiseBurst(0.25, 0.5, 500);
    },
    pickup() {
      tone(660, 0.12, 0.25, 'sine', 990);
    },
    cash() {
      tone(880, 0.1, 0.25, 'sine');
      setTimeout(() => tone(1318, 0.16, 0.25, 'sine'), 90);
    },
    mission() {
      tone(523, 0.12, 0.25, 'triangle');
      setTimeout(() => tone(659, 0.12, 0.25, 'triangle'), 110);
      setTimeout(() => tone(784, 0.22, 0.25, 'triangle'), 220);
    },
    fail() {
      tone(220, 0.3, 0.25, 'sawtooth', 110);
    },
    click() {
      tone(700, 0.05, 0.18, 'square');
    },
    busted() {
      tone(440, 0.2, 0.25, 'sawtooth', 330);
      setTimeout(() => tone(330, 0.35, 0.25, 'sawtooth', 220), 180);
    },
  };
}
