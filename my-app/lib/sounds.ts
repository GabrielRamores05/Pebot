// Notification sound utility using Web Speech API (AI voice) + Web Audio API (attention chime)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

// ── Voice Settings (synced to server DB) ────────────────────────────────

export interface VoiceSettings {
  voiceName: string;       // SpeechSynthesisVoice.name or '' for auto
  rate: number;            // 0.5 – 2
  pitch: number;           // 0 – 2
  volume: number;          // 0 – 1
  msgNewOrder: string;
  msgPreparing: string;
  msgCompleted: string;
  enabled: boolean;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceName: '',
  rate: 1,
  pitch: 1,
  volume: 1,
  msgNewOrder: 'New order received',
  msgPreparing: 'Your order is now being prepared',
  msgCompleted: 'Your order is ready for pickup',
  enabled: true,
};



// In-memory cache so we don't fetch every time a sound plays
let cachedSettings: VoiceSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 15_000; // 15 seconds

/** Fetch voice settings from the server (with caching) */
export async function fetchVoiceSettings(): Promise<VoiceSettings> {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL) {
    return cachedSettings;
  }
  try {
    const res = await fetch('/api/settings/voice', { cache: 'no-store' });
    if (!res.ok) throw new Error(`/api/settings/voice returned ${res.status}`);
    const data = await res.json();
    const settings = { ...DEFAULT_VOICE_SETTINGS, ...data };
    cachedSettings = settings;
    cacheTimestamp = now;
    return settings;
  } catch (e) {
    // Announcements still work with the defaults, so this is not worth
    // interrupting anyone over — but it has to be diagnosable.
    console.error('Failed to load voice settings, using the last known values:', e);
  }
  return cachedSettings ?? { ...DEFAULT_VOICE_SETTINGS };
}

/** Save voice settings to server */
export async function saveVoiceSettings(settings: VoiceSettings): Promise<boolean> {
  // Update cache immediately
  cachedSettings = { ...settings };
  cacheTimestamp = Date.now();
  try {
    const res = await fetch('/api/settings/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Synchronous getter — returns cached settings (call fetchVoiceSettings first) */
export function getVoiceSettings(): VoiceSettings {
  return cachedSettings ?? { ...DEFAULT_VOICE_SETTINGS };
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Play a short attention chime before voice */
function playChime(freqs: number[]) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.25);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch (e) {
    console.error('[Sound] Chime failed:', e);
  }
}

/** Speak a message using the browser's Speech Synthesis API */
async function speak(text: string) {
  try {
    const settings = await fetchVoiceSettings();
    if (!settings.enabled) return;

    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = settings.rate;
    utter.pitch = settings.pitch;
    utter.volume = settings.volume;

    utter.lang = 'en-US';

    const voices = synth.getVoices();
    if (settings.voiceName) {
      const chosen = voices.find((v) => v.name === settings.voiceName);
      if (chosen) utter.voice = chosen;
    } else {
      // Auto: pick an English voice
      const preferred =
        voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
        voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Google'))) ||
        voices.find((v) => v.lang.startsWith('en'));
      if (preferred) utter.voice = preferred;
    }

    synth.speak(utter);
  } catch (e) {
    console.error('[Sound] Speech synthesis failed:', e);
  }
}

/** Preview — speak arbitrary text with current settings */
export async function previewVoice(text?: string) {
  const defaultText = 'Hello! This is your CaféOS AI voice assistant.';
  speak(text ?? defaultText);
}

// ── Public notification functions ───────────────────────────────────────

/** New order — plays chime then announces (staff/kitchen side) */
export async function playNewOrderSound() {
  const s = await fetchVoiceSettings();
  playChime([523, 659, 784]);
  setTimeout(() => speak(s.msgNewOrder), 400);
}

/** Order preparing — plays chime then announces (customer side) */
export async function playPreparingSound() {
  const s = await fetchVoiceSettings();
  playChime([440, 554]);
  setTimeout(() => speak(s.msgPreparing), 350);
}

/** Order completed — plays chime then announces (customer side) */
export async function playCompletedSound() {
  const s = await fetchVoiceSettings();
  playChime([523, 659, 784, 1047]);
  setTimeout(() => speak(s.msgCompleted), 500);

  // Vibrate on mobile
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
}

/** Customer message — short double-chime notification (no full voice) */
export function playMessageSound() {
  playChime([660, 880]);
}
