import { Platform } from 'react-native';

export async function playDoorbellSound() {
  if (Platform.OS === 'web') {
    playWebDoorbellSound();
  } else {
    await scheduleNotificationSound();
  }
}

async function scheduleNotificationSound() {
  try {
    const Notifications = require('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '¡Alguien toca el timbre!',
        body: 'Alguien está en la puerta.',
        sound: 'doorbell.wav',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
  } catch (e) {
    console.error('Error playing notification sound:', e);
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


