import { useSettings } from './settings';

/*
 * Sons originaux synthétisés avec la Web Audio API (aucun fichier, aucune licence) :
 * de courtes impulsions filtrées qui évoquent le bois sur le bois.
 */

export type SoundName = 'move' | 'capture' | 'check' | 'illegal' | 'start' | 'end' | 'lowtime';

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Petit « toc » : bruit blanc bref passé dans un filtre passe-bande. */
function knock(ac: AudioContext, at: number, freq: number, gain: number, length = 0.06) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * length), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 3;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(at);
}

/** Note brève (sinusoïde avec enveloppe), pour les annonces. */
function tone(ac: AudioContext, at: number, freq: number, length: number, gain = 0.15) {
  const osc = ac.createOscillator();
  osc.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, at + length);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + length);
}

export function playSound(name: SoundName): void {
  if (!useSettings.getState().sound) return;
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  switch (name) {
    case 'move':
      return knock(ac, t, 1800, 1.2);
    case 'capture':
      knock(ac, t, 1200, 1.4);
      return knock(ac, t + 0.05, 2200, 0.9);
    case 'check':
      knock(ac, t, 1800, 1.2);
      return tone(ac, t + 0.03, 880, 0.25, 0.12);
    case 'illegal':
      return tone(ac, t, 180, 0.18, 0.2);
    case 'start':
      tone(ac, t, 523, 0.15);
      return tone(ac, t + 0.12, 784, 0.25);
    case 'end':
      tone(ac, t, 784, 0.15);
      tone(ac, t + 0.12, 659, 0.15);
      return tone(ac, t + 0.24, 523, 0.35);
    case 'lowtime':
      return tone(ac, t, 1320, 0.08, 0.1);
  }
}
