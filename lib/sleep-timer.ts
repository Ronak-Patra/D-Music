import TrackPlayer from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SLEEP_TIMER_KEY = 'dmusic_sleep_timer_end_time';

export class SleepTimerManager {
  private static timerId: ReturnType<typeof setInterval> | null = null;
  private static listeners: Set<(timeLeftMs: number | null) => void> = new Set();

  static async startTimer(minutes: number) {
    const endTime = Date.now() + minutes * 60 * 1000;
    await AsyncStorage.setItem(SLEEP_TIMER_KEY, endTime.toString());
    this.scheduleCheck();
  }

  static async cancelTimer() {
    await AsyncStorage.removeItem(SLEEP_TIMER_KEY);
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.notifyListeners(null);
  }

  static async getEndTime(): Promise<number | null> {
    try {
      const val = await AsyncStorage.getItem(SLEEP_TIMER_KEY);
      return val ? parseInt(val, 10) : null;
    } catch {
      return null;
    }
  }

  static addListener(listener: (timeLeftMs: number | null) => void) {
    this.listeners.add(listener);
    this.scheduleCheck();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(timeLeftMs: number | null) {
    this.listeners.forEach(cb => cb(timeLeftMs));
  }

  /**
   * Called by background playback event or interval to enforce timer cutoff
   */
  static async checkTimerAndEnforce(): Promise<boolean> {
    const endTime = await this.getEndTime();
    if (!endTime) {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      this.notifyListeners(null);
      return false;
    }

    const now = Date.now();
    const diff = endTime - now;

    if (diff <= 0) {
      // Time expired! Stop/pause track player natively
      try {
        await TrackPlayer.pause();
      } catch (e) {
        console.error('Error pausing TrackPlayer on sleep timer expiration:', e);
      }
      await this.cancelTimer();
      return true;
    }

    this.notifyListeners(diff);
    return false;
  }

  private static scheduleCheck() {
    if (this.timerId) return;
    this.timerId = setInterval(() => {
      this.checkTimerAndEnforce();
    }, 1000);
  }
}
