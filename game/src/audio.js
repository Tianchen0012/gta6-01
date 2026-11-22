// Neon Tide — audio.js
// Every sound is synthesized with the Web Audio API — no audio files.
// A low synth pad hums underneath, the engine growls with speed, sirens
// wail when the police are near, and gunshots are bursts of noise.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    musicGain: null,
    muted: false,
    started: false,
  };

  audio.init = () => {
    if (audio.started) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);

      // Engine: a sawtooth whose pitch follows speed.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 40;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      const engineFilter = audio.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 700;
      audio.engineOsc.connect(engineFilter);
      engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();

      // Siren: a sine that swings between two notes.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'sine';
      audio.sirenOsc.frequency.value = 700;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();

      // Music: two detuned triangle waves holding a warm minor chord.
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.05;
      audio.musicGain.connect(audio.master);
      const chord = [110, 130.81, 164.81, 196];
      for (const f of chord) {
        const o = audio.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.connect(audio.musicGain);
        o.start();
      }
      // A slow LFO breathes the pad in and out.
      const lfo = audio.ctx.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoGain = audio.ctx.createGain();
      lfoGain.gain.value = 0.025;
      lfo.connect(lfoGain);
      lfoGain.connect(audio.musicGain.gain);
      lfo.start();

      audio.started = true;
    } catch {
      // No audio on this machine: the game plays on silently.
    }
  };

  audio.setEngine = (speedRatio, driving) => {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    audio.engineGain.gain.setTargetAtTime(driving ? 0.05 + speedRatio * 0.06 : 0, t, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(45 + speedRatio * 130, t, 0.08);
  };

  audio.setSiren = (wanted) => {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    if (wanted > 0) {
      const phase = (t % 1.2) < 0.6 ? 660 : 880;
      audio.sirenOsc.frequency.setTargetAtTime(phase, t, 0.05);
      audio.sirenGain.gain.setTargetAtTime(0.035, t, 0.2);
    } else {
      audio.sirenGain.gain.setTargetAtTime(0, t, 0.3);
    }
  };

  audio.blip = (freq, dur = 0.12, type = 'square', vol = 0.12) => {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(audio.master);
    o.start(t);
    o.stop(t + dur);
  };

  audio.noiseBurst = (dur = 0.18, vol = 0.25) => {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const g = audio.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(audio.master);
    src.start(t);
  };

  audio.shot = () => audio.noiseBurst(0.14, 0.22);
  audio.crash = () => audio.noiseBurst(0.25, 0.3);
  audio.pickup = () => { audio.blip(880, 0.1); setTimeout(() => audio.blip(1320, 0.14), 70); };
  audio.missionDone = () => {
    audio.blip(523, 0.14);
    setTimeout(() => audio.blip(659, 0.14), 120);
    setTimeout(() => audio.blip(784, 0.22), 240);
  };
  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  return audio;
}
