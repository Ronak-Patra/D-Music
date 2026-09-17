import { useState, useEffect, useCallback } from 'react';
import { SleepTimerManager } from '@/lib/sleep-timer';

export function useSleepTimer() {
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);

  useEffect(() => {
    // Check initially
    SleepTimerManager.checkTimerAndEnforce();

    // Subscribe to updates from SleepTimerManager
    const unsubscribe = SleepTimerManager.addListener((remainingMs) => {
      setTimeLeftMs(remainingMs);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const startSleepTimer = useCallback((minutes: number) => {
    SleepTimerManager.startTimer(minutes);
  }, []);

  const cancelSleepTimer = useCallback(() => {
    SleepTimerManager.cancelTimer();
  }, []);

  return {
    sleepTimerActive: timeLeftMs !== null && timeLeftMs > 0,
    timeLeftMs,
    startSleepTimer,
    cancelSleepTimer,
  };
}

