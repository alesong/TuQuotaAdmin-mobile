import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

let _player: AudioPlayer | null = null;
let _releaseTimer: ReturnType<typeof setTimeout> | null = null;
let _audioInit = false;

const SOUND_FILES: Record<string, any> = {
  'doorbell.wav': require('../../assets/sounds/doorbell.wav'),
  'doorbell_armonico.wav': require('../../assets/sounds/doorbell_armonico.wav'),
  'doorbell_digital.wav': require('../../assets/sounds/doorbell_digital.wav'),
};

async function ensureAudioInit() {
  if (_audioInit) return;
  _audioInit = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  } catch (e) {
    console.error('Error initializing audio mode:', e);
  }
}

export async function playDoorbellSound(soundFile?: string) {
  if (Platform.OS === 'web') {
    playWebDoorbellSound();
    return;
  }

  try {
    await ensureAudioInit();

    if (_releaseTimer) clearTimeout(_releaseTimer);
    if (_player) {
      _player.remove();
      _player = null;
    }

    const source = SOUND_FILES[soundFile || 'doorbell.wav'] || SOUND_FILES['doorbell.wav'];
    _player = createAudioPlayer(source);
    _player.play();

    _releaseTimer = setTimeout(() => {
      if (_player) {
        _player.remove();
        _player = null;
      }
    }, 5000);
  } catch (e) {
    console.error('Error playing doorbell sound:', e);
  }
}

function playWebDoorbellSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const audioCtx = new AudioCtx();
    const now = audioCtx.currentTime;

    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 880;

    const gain1 = audioCtx.createGain();
    gain1.gain.setValueAtTime(1.0, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 660;

    const gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(1.0, now + 0.4);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.4);
    osc2.stop(now + 1.2);

    setTimeout(() => {
      audioCtx.close();
    }, 2000);
  } catch (e) {
    console.error('Error playing web doorbell sound:', e);
  }
}
