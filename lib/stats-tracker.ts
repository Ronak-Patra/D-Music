import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from '../types/music';

const STATS_KEY = 'dmusic_stats_v1';
const HISTORY_KEY = 'dmusic_history_v1';

export interface PlaybackStats {
  totalPlayTimeMs: number;
  topTracks: { [trackId: string]: number }; // trackId -> playCount
}

export interface HistoryEntry {
  track: Track;
  playedAt: string;
}

export const getStats = async (): Promise<PlaybackStats> => {
  try {
    const data = await AsyncStorage.getItem(STATS_KEY);
    if (data) return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get stats:', error);
  }
  return { totalPlayTimeMs: 0, topTracks: {} };
};

export const recordPlay = async (track: Track, durationMs: number | string = 0) => {
  try {
    const stats = await getStats();
    stats.totalPlayTimeMs += Number(durationMs) || 0;
    const trackIdStr = track.id.toString();
    stats.topTracks[trackIdStr] = (stats.topTracks[trackIdStr] || 0) + 1;
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));

    // Update history (keep last 50)
    let history: HistoryEntry[] = [];
    const historyData = await AsyncStorage.getItem(HISTORY_KEY);
    if (historyData) history = JSON.parse(historyData);
    
    history.unshift({ track, playedAt: new Date().toISOString() });
    if (history.length > 50) history.pop();
    
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Failed to record play:', error);
  }
};

export const getHistory = async (): Promise<HistoryEntry[]> => {
  try {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    if (data) return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get history:', error);
  }
  return [];
};
