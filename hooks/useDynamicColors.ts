import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ImageColors from 'react-native-image-colors';
import { Track } from '@/types/music';
import { MusicAPI } from '@/lib/music-api';

export const DYNAMIC_COLORS_KEY = 'openspot_dynamic_colors_v1';

export function useDynamicColors(currentTrack: Track | null) {
  const [dynamicColorsEnabled, setDynamicColorsEnabled] = useState(true);
  const [songColor, setSongColor] = useState<string | null>(null);

  useEffect(() => {
    const loadSetting = async () => {
      try {
        const val = await AsyncStorage.getItem(DYNAMIC_COLORS_KEY);
        if (val !== null) {
          setDynamicColorsEnabled(val === 'true');
        }
      } catch (e) {
        console.error('Failed to load dynamic colors setting', e);
      }
    };
    loadSetting();
  }, []);

  const toggleDynamicColors = async (enabled: boolean) => {
    setDynamicColorsEnabled(enabled);
    try {
      await AsyncStorage.setItem(DYNAMIC_COLORS_KEY, String(enabled));
    } catch (e) {
      console.error('Failed to save dynamic colors setting', e);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchColors = async () => {
      if (!dynamicColorsEnabled || !currentTrack) {
        if (isMounted) setSongColor(null);
        return;
      }
      try {
        const url = MusicAPI.getOptimalImage(currentTrack.images);
        if (!url) {
          if (isMounted) setSongColor(null);
          return;
        }
        const colors = await ImageColors.getColors(url, {
          fallback: '#1DB954',
          cache: false,
          key: url + currentTrack.id,
        });
        if (isMounted) {
          if (colors.platform === 'android') {
            setSongColor(colors.dominant || '#1DB954');
          } else if (colors.platform === 'ios') {
            setSongColor(colors.primary || '#1DB954');
          } else {
            setSongColor('#1DB954');
          }
        }
      } catch (e) {
        console.error('Failed to fetch image colors', e);
        if (isMounted) setSongColor(null);
      }
    };
    fetchColors();
    return () => { isMounted = false; };
  }, [currentTrack?.id, dynamicColorsEnabled]);

  return { dynamicColorsEnabled, toggleDynamicColors, songColor };
}
