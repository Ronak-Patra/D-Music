import { useState, useEffect, useCallback } from 'react';
import TrackPlayer, { useProgress } from 'react-native-track-player';

export function useSleepTimer() {
  const [sleepTimerEnd, setSleepTimerEnd] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  const { position } = useProgress(1000); // Wakes JS up every 1s when playing

  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (sleepTimerEnd) {
      // The interval handles standard foreground UI updates
      interval = setInterval(() => {
        const now = Date.now();
        const diff = sleepTimerEnd - now;
        
        if (diff <= 0) {
          TrackPlayer.pause();
          setSleepTimerEnd(null);
          setTimeLeftMs(null);
        } else {
          setTimeLeftMs(diff);
        }
      }, 1000);
      
      // Also evaluate immediately on position changes (heartbeat for background execution)
      const now = Date.now();
      const diff = sleepTimerEnd - now;
      if (diff <= 0) {
        TrackPlayer.pause();
        setSleepTimerEnd(null);
        setTimeLeftMs(null);
      }
    } else {
      setTimeLeftMs(null);
    }
    
    return () => clearInterval(interval);
  }, [sleepTimerEnd, position]);

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
