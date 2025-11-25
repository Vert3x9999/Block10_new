
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
};

const playTone = (
  freq: number, 
  type: OscillatorType, 
  duration: number, 
  startTime: number = 0, 
  vol: number = 0.1
) => {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
  
  // Envelope
  gain.gain.setValueAtTime(vol, ctx.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime + startTime);
  osc.stop(ctx.currentTime + startTime + duration);
};

export const playPlaceSound = () => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  // Short, soft "thud"
  playTone(300, 'sine', 0.1, 0, 0.15);
};

export const playClearSound = (lines: number) => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume();

  // Play a small chord/arpeggio based on number of lines
  // C Major 7thish arpeggio
  const baseFreq = 523.25; // C5
  const intervals = [1, 1.25, 1.5, 2, 2.5]; // C E G C E
  
  // Limit notes to avoid chaos
  const count = Math.min(lines + 1, 5);

  for (let i = 0; i < count; i++) {
    playTone(
      baseFreq * intervals[i], 
      'triangle', 
      0.3 + (i * 0.1), 
      i * 0.05, 
      0.1
    );
  }
};

export const playGameOverSound = () => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume();

  // Descending power-down sound
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 1.0);
  
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + 1.0);
};
