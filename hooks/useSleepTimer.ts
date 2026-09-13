import { useState, useEffect, useCallback } from 'react';
import TrackPlayer from 'react-native-track-player';

export function useSleepTimer() {
  const [sleepTimerEnd, setSleepTimerEnd] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (sleepTimerEnd) {
      interval = setInterval(() => {
        const now = Date.now();
        const diff = sleepTimerEnd - now;
        
        if (diff <= 0) {
          // Timer finished
          TrackPlayer.pause();
          setSleepTimerEnd(null);
          setTimeLeftMs(null);
        } else {
          setTimeLeftMs(diff);
        }
      }, 1000);
    } else {
      setTimeLeftMs(null);
    }
    
    return () => clearInterval(interval);
  }, [sleepTimerEnd]);

  const startSleepTimer = useCallback((minutes: number) => {
    setSleepTimerEnd(Date.now() + minutes * 60 * 1000);
  }, []);

  const cancelSleepTimer = useCallback(() => {
    setSleepTimerEnd(null);
    setTimeLeftMs(null);
  }, []);

  return {
    sleepTimerActive: sleepTimerEnd !== null,
    timeLeftMs,
    startSleepTimer,
    cancelSleepTimer
  };
}
