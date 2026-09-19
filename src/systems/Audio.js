export class AudioSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.noise = null;
    this.last = new Map();
  }

  unlock() {
    if (this.context) {
      this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.context.destination);
    const buffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    this.noise = buffer;
  }

  tone(type, start, end, duration, volume, pan = 0, delay = 0) {
    if (!this.context) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    oscillator.connect(gain).connect(panner).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  burst(filterType, start, end, duration, volume, pan = 0) {
    if (!this.context || !this.noise) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner();
    source.buffer = this.noise;
    source.playbackRate.value = 0.85 + Math.random() * 0.3;
    filter.type = filterType;
    filter.frequency.setValueAtTime(start, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, end), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(filter).connect(gain).connect(panner).connect(this.master);
    source.start(now, Math.random() * 0.4);
    source.stop(now + duration + 0.03);
  }

  play(name, pan = 0) {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (now - (this.last.get(name) || -1) < 0.035) return;
    this.last.set(name, now);
    const pitch = 0.96 + Math.random() * 0.08;
    if (name === 'shot') {
      this.burst('bandpass', 2600, 700, 0.07, 0.26, pan);
      this.tone('square', 520 * pitch, 150, 0.08, 0.08, pan);
    } else if (name === 'hit') {
      this.tone('triangle', 620 * pitch, 210, 0.06, 0.15, pan);
    } else if (name === 'dash') {
      this.burst('highpass', 900, 4200, 0.16, 0.2, pan);
      this.tone('sine', 160, 660, 0.18, 0.1, pan);
    } else if (name === 'relay') {
      this.burst('lowpass', 2400, 90, 0.55, 0.42, pan);
      this.tone('sawtooth', 180, 42, 0.48, 0.18, pan);
    } else if (name === 'pickup') {
      [640, 920, 1380].forEach((frequency, index) => this.tone('triangle', frequency, frequency * 1.02, 0.13, 0.1, pan, index * 0.045));
    } else if (name === 'down') {
      this.tone('sawtooth', 380, 54, 0.38, 0.15, pan);
      this.burst('lowpass', 1200, 80, 0.32, 0.22, pan);
    } else if (name === 'overdrive') {
      this.burst('bandpass', 240, 3600, 0.32, 0.25, pan);
      [220, 440, 880].forEach((frequency, index) => this.tone('sine', frequency, frequency * 1.5, 0.28, 0.09, pan, index * 0.055));
    }
  }
}
