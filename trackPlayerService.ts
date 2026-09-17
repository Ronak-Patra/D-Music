import TrackPlayer, { Event } from 'react-native-track-player';
import { SleepTimerManager } from '@/lib/sleep-timer';

export default async function trackPlayerService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());

  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    try {
      await TrackPlayer.skipToNext();
      await TrackPlayer.play();
    } catch {}
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    try {
      await TrackPlayer.skipToPrevious();
      await TrackPlayer.play();
    } catch {}
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, async (e) => {
    try {
      await TrackPlayer.seekTo((e as any).position);
    } catch {}
  });

  // Background playback progress event - wakes up JS engine even when screen is locked/off
  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, async () => {
    await SleepTimerManager.checkTimerAndEnforce();
  });

  TrackPlayer.addEventListener(Event.PlaybackState, async () => {
    await SleepTimerManager.checkTimerAndEnforce();
  });
}

