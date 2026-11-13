import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { VoiceSettings } from '../../lib/sounds';

const fetchMock = vi.fn();

function oscillator() {
  return {
    connect: vi.fn(),
    type: '',
    frequency: { value: 0 },
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function gainNode() {
  return {
    connect: vi.fn(),
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  };
}

function audioContext() {
  const oscillators: ReturnType<typeof oscillator>[] = [];
  const ctx = {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => {
      const osc = oscillator();
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(gainNode),
  };
  return { ctx, oscillators };
}

class FakeUtterance {
  rate = 1;
  pitch = 1;
  volume = 1;
  lang = '';
  voice: { name: string; lang: string } | null = null;
  constructor(public text: string) {}
}

function stubBrowser(voices: { name: string; lang: string }[] = []) {
  const audio = audioContext();
  const synth = { cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => voices) };
  vi.stubGlobal('window', {
    AudioContext: vi.fn(() => audio.ctx),
    speechSynthesis: synth,
  });
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('navigator', { vibrate: vi.fn() });
  return { audio, synth };
}

/** Fresh module per test: sounds.ts caches the settings in module scope. */
async function loadSounds() {
  vi.resetModules();
  return import('../../lib/sounds');
}

function settingsResponse(body: Partial<VoiceSettings>) {
  return { ok: true, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('fetchVoiceSettings', () => {
  test('merges the server values over the defaults', async () => {
    fetchMock.mockResolvedValue(settingsResponse({ rate: 1.5, msgNewOrder: 'Bagong order' }));
    const { DEFAULT_VOICE_SETTINGS, fetchVoiceSettings } = await loadSounds();

    await expect(fetchVoiceSettings()).resolves.toEqual({
      ...DEFAULT_VOICE_SETTINGS,
      rate: 1.5,
      msgNewOrder: 'Bagong order',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/settings/voice', { cache: 'no-store' });
  });

  test('serves the cached values within the cache window', async () => {
    fetchMock.mockResolvedValue(settingsResponse({ rate: 1.5 }));
    const { fetchVoiceSettings } = await loadSounds();

    await fetchVoiceSettings();
    await fetchVoiceSettings();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  test('refetches once the cache has expired', async () => {
    fetchMock.mockResolvedValue(settingsResponse({ rate: 1.5 }));
    const { fetchVoiceSettings } = await loadSounds();
    const now = vi.spyOn(Date, 'now');

    now.mockReturnValue(0);
    await fetchVoiceSettings();
    now.mockReturnValue(20_000);
    await fetchVoiceSettings();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('falls back to the defaults when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { DEFAULT_VOICE_SETTINGS, fetchVoiceSettings } = await loadSounds();

    await expect(fetchVoiceSettings()).resolves.toEqual(DEFAULT_VOICE_SETTINGS);
    expect(console.error).toHaveBeenCalled();
  });

  test('keeps the last known values when a later request fails', async () => {
    const { fetchVoiceSettings, saveVoiceSettings, DEFAULT_VOICE_SETTINGS } = await loadSounds();
    fetchMock.mockResolvedValue({ ok: true });
    await saveVoiceSettings({ ...DEFAULT_VOICE_SETTINGS, rate: 2 });

    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(Date.now() + 60_000);
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(fetchVoiceSettings()).resolves.toMatchObject({ rate: 2 });
  });
});

describe('saveVoiceSettings', () => {
  test('posts the settings and reports success', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const { DEFAULT_VOICE_SETTINGS, getVoiceSettings, saveVoiceSettings } = await loadSounds();
    const settings = { ...DEFAULT_VOICE_SETTINGS, volume: 0.5 };

    await expect(saveVoiceSettings(settings)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/settings/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    // The cache is updated immediately so the next sound uses the new values.
    expect(getVoiceSettings()).toEqual(settings);
  });

  test('reports failure when the request is rejected or refused', async () => {
    const { DEFAULT_VOICE_SETTINGS, saveVoiceSettings } = await loadSounds();

    fetchMock.mockResolvedValue({ ok: false });
    await expect(saveVoiceSettings(DEFAULT_VOICE_SETTINGS)).resolves.toBe(false);

    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(saveVoiceSettings(DEFAULT_VOICE_SETTINGS)).resolves.toBe(false);
  });
});

describe('getVoiceSettings', () => {
  test('is the defaults until something has been loaded or saved', async () => {
    const { DEFAULT_VOICE_SETTINGS, getVoiceSettings, fetchVoiceSettings } = await loadSounds();

    expect(getVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS);

    fetchMock.mockResolvedValue(settingsResponse({ pitch: 0.5 }));
    await fetchVoiceSettings();

    expect(getVoiceSettings()).toMatchObject({ pitch: 0.5 });
  });
});

describe('announcements', () => {
  test('a new order chimes on three notes and speaks the configured message', async () => {
    vi.useFakeTimers();
    const { audio, synth } = stubBrowser();
    fetchMock.mockResolvedValue(settingsResponse({ msgNewOrder: 'Bagong order', rate: 1.5 }));
    const { playNewOrderSound } = await loadSounds();

    await playNewOrderSound();
    expect(audio.oscillators).toHaveLength(3);

    await vi.runAllTimersAsync();
    expect(synth.cancel).toHaveBeenCalled();
    const spoken = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(spoken.text).toBe('Bagong order');
    expect(spoken.rate).toBe(1.5);
    expect(spoken.lang).toBe('en-US');
  });

  test('a completed order chimes, speaks and vibrates', async () => {
    vi.useFakeTimers();
    const { audio, synth } = stubBrowser();
    fetchMock.mockResolvedValue(settingsResponse({ msgCompleted: 'Ready for pickup' }));
    const { playCompletedSound } = await loadSounds();

    await playCompletedSound();
    await vi.runAllTimersAsync();

    expect(audio.oscillators).toHaveLength(4);
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).text).toBe('Ready for pickup');
    expect(navigator.vibrate).toHaveBeenCalled();
  });

  test('a preparing order announces its own message', async () => {
    vi.useFakeTimers();
    const { audio, synth } = stubBrowser();
    fetchMock.mockResolvedValue(settingsResponse({ msgPreparing: 'Being prepared' }));
    const { playPreparingSound } = await loadSounds();

    await playPreparingSound();
    await vi.runAllTimersAsync();

    expect(audio.oscillators).toHaveLength(2);
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).text).toBe('Being prepared');
  });

  test('nothing is spoken when announcements are turned off', async () => {
    vi.useFakeTimers();
    const { synth } = stubBrowser();
    fetchMock.mockResolvedValue(settingsResponse({ enabled: false }));
    const { playNewOrderSound } = await loadSounds();

    await playNewOrderSound();
    await vi.runAllTimersAsync();

    expect(synth.speak).not.toHaveBeenCalled();
  });

  test('the chosen voice is used when it exists, otherwise an English one', async () => {
    vi.useFakeTimers();
    const { synth } = stubBrowser([
      { name: 'Microsoft Zira', lang: 'en-US' },
      { name: 'Google Filipino', lang: 'fil-PH' },
    ]);
    fetchMock.mockResolvedValue(settingsResponse({ voiceName: 'Microsoft Zira' }));
    const { previewVoice } = await loadSounds();

    await previewVoice('Testing one two');
    await vi.runAllTimersAsync();

    const spoken = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(spoken.text).toBe('Testing one two');
    expect(spoken.voice?.name).toBe('Microsoft Zira');
  });

  test('an unknown configured voice falls back to an English voice', async () => {
    vi.useFakeTimers();
    const { synth } = stubBrowser([{ name: 'Samantha', lang: 'en-GB' }]);
    fetchMock.mockResolvedValue(settingsResponse({ voiceName: 'Missing Voice' }));
    const { previewVoice } = await loadSounds();

    await previewVoice();
    await vi.runAllTimersAsync();

    const spoken = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(spoken.text).toContain('Pebot');
    expect(spoken.voice).toBeNull();
  });

  test('auto voice selection prefers an English voice', async () => {
    vi.useFakeTimers();
    const { synth } = stubBrowser([
      { name: 'Google Filipino', lang: 'fil-PH' },
      { name: 'Samantha', lang: 'en-GB' },
    ]);
    fetchMock.mockResolvedValue(settingsResponse({ voiceName: '' }));
    const { previewVoice } = await loadSounds();

    await previewVoice();
    await vi.runAllTimersAsync();

    expect((synth.speak.mock.calls[0][0] as FakeUtterance).voice?.name).toBe('Samantha');
  });

  test('a customer message is a short double chime with no speech', async () => {
    const { audio, synth } = stubBrowser();
    const { playMessageSound } = await loadSounds();

    playMessageSound();

    expect(audio.oscillators).toHaveLength(2);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  test('a browser with no audio support never breaks the caller', async () => {
    vi.stubGlobal('window', {});
    const { playMessageSound } = await loadSounds();

    expect(() => playMessageSound()).not.toThrow();
    expect(console.error).toHaveBeenCalledWith('[Sound] Chime failed:', expect.anything());
  });

  test('a browser with no speech support never breaks the announcement', async () => {
    vi.useFakeTimers();
    const audio = audioContext();
    vi.stubGlobal('window', { AudioContext: vi.fn(() => audio.ctx) });
    fetchMock.mockResolvedValue(settingsResponse({}));
    const { playNewOrderSound } = await loadSounds();

    await playNewOrderSound();
    await vi.runAllTimersAsync();

    expect(console.error).toHaveBeenCalledWith(
      '[Sound] Speech synthesis failed:',
      expect.anything(),
    );
  });
});
