import React, { createContext, useState, useRef, useMemo } from 'react';
import { Track } from '@/types/music';
import { useMusicQueue } from '@/hooks/useMusicQueue';
import { useDynamicColors } from '@/hooks/useDynamicColors';
import { MusicAPI } from '@/lib/music-api';
import { useApiStatus } from '@/hooks/useApiStatus';
import { useToast } from '@/hooks/useToast';

interface MusicPlayerContextType {
  musicQueue: ReturnType<typeof useMusicQueue>;
  isPlaying: boolean;
  currentTrack: Track | null;
  handleTrackSelect: (track: Track, trackList?: Track[], startIndex?: number) => void;
  handleQueueTrackSelect: (track: Track, index: number) => void;
  handlePlayingStateChange: (playing: boolean) => void;
  toggleQueue: () => void;
  setPendingAutoPlay: () => void;
  dynamicColorsEnabled?: boolean;
  toggleDynamicColors?: (enabled: boolean) => void;
  songColor?: string | null;
  isQueueOpen: boolean;
  setIsQueueOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pendingAutoPlayRef: React.MutableRefObject<boolean>;
}

export const MusicPlayerContext = createContext<MusicPlayerContextType>({
  musicQueue: {} as ReturnType<typeof useMusicQueue>,
  isPlaying: false,
  currentTrack: null,
  handleTrackSelect: () => {},
  handleQueueTrackSelect: () => {},
  handlePlayingStateChange: () => {},
  toggleQueue: () => {},
  setPendingAutoPlay: () => {},
  isQueueOpen: false,
  setIsQueueOpen: () => {},
  pendingAutoPlayRef: { current: false },
});

export const MusicPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const musicQueue = useMusicQueue();
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const pendingPlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAutoPlayRef = useRef(false);
  
  const { isProviderDisabled } = useApiStatus();
  const { showToast } = useToast();

  const currentTrack = useMemo(
    () => musicQueue.tracks[musicQueue.currentIndex] ?? null,
    [musicQueue.tracks, musicQueue.currentIndex]
  );

  const { dynamicColorsEnabled, toggleDynamicColors, songColor } = useDynamicColors(currentTrack);

  const setPendingAutoPlay = () => {
    pendingAutoPlayRef.current = true;
  };

  const handleTrackSelect = (track: Track, trackList?: Track[], startIndex?: number) => {
    const trackProvider = track.provider || 'saavn';
    if (trackProvider !== 'local' && isProviderDisabled(trackProvider as 'saavn' | 'ytmusic')) {
      showToast('Currently API is down. Please use Saavn.', 'error');
      return;
    }

    if (pendingPlayTimeoutRef.current) {
      clearTimeout(pendingPlayTimeoutRef.current);
      pendingPlayTimeoutRef.current = null;
    }

    const isSameTrack = currentTrack?.id === track.id;
    const isSameQueue = trackList
      ? trackList.length === musicQueue.tracks.length &&
        trackList[startIndex ?? 0]?.id === track.id &&
        musicQueue.currentIndex === (startIndex ?? 0)
      : true;

    if (isSameTrack && isSameQueue) {
      pendingAutoPlayRef.current = !isPlaying;
      setIsPlaying(prev => !prev);
      return;
    }

    setIsPlaying(false);
    pendingAutoPlayRef.current = true;

    if (trackList && startIndex !== undefined) {
      const selectedTrack = trackList[startIndex];
      const selectedKey = `${selectedTrack.title?.toLowerCase().trim()}|${selectedTrack.artist?.toLowerCase().trim()}`;

      const deduplicatedList: Track[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < trackList.length; i++) {
        const t = trackList[i];
        const key = `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`;
        const idKey = t.id?.toString() || key;
        if (!seen.has(key) && !seen.has(idKey)) {
          seen.add(key);
          seen.add(idKey);
          deduplicatedList.push(t);
        }
      }

      let newStartIndex = deduplicatedList.findIndex(t => {
        const key = `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`;
        const idKey = t.id?.toString() || key;
        const selectedIdKey = selectedTrack.id?.toString() || selectedKey;
        return key === selectedKey || idKey === selectedIdKey;
      });

      if (newStartIndex === -1) newStartIndex = 0;
      musicQueue.setQueueTracks(deduplicatedList, newStartIndex);
    } else {
      musicQueue.setQueueTracks([track], 0);
    }

    void MusicAPI.addToRecentlyPlayed(track);
    setIsPlaying(true);
  };

  const handleQueueTrackSelect = (track: Track, index: number) => {
    const trackProvider = track.provider || 'saavn';
    if (isProviderDisabled(trackProvider as 'saavn' | 'ytmusic')) {
      showToast('Currently API is down. Please use Saavn.', 'error');
      return;
    }

    const isSameTrack = currentTrack?.id === track.id;
    if (isSameTrack) {
      setIsPlaying(prev => !prev);
      return;
    }
    setIsPlaying(false);
    pendingAutoPlayRef.current = true;
    musicQueue.setCurrentIndex(index);
    setIsPlaying(true);
  };

  const handlePlayingStateChange = (playing: boolean) => {
    setIsPlaying(playing);
  };

  const toggleQueue = () => {
    setIsQueueOpen(prev => !prev);
  };

  return (
    <MusicPlayerContext.Provider
      value={{
        musicQueue,
        isPlaying,
        currentTrack,
        handleTrackSelect,
        handleQueueTrackSelect,
        handlePlayingStateChange,
        toggleQueue,
        setPendingAutoPlay,
        dynamicColorsEnabled,
        toggleDynamicColors,
        songColor,
        isQueueOpen,
        setIsQueueOpen,
        pendingAutoPlayRef,
      }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
};
