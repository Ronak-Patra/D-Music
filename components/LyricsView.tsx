import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { useProgress } from 'react-native-track-player';
import { LyricsData } from '../lib/lyrics-api';

interface LyricsViewProps {
  lyricsData: LyricsData | null;
  textColor?: string;
  activeColor?: string;
}

interface LrcLine {
  time: number;
  text: string;
}

const parseLrc = (lrc: string): LrcLine[] => {
  const lines = lrc.split('\n');
  const result: LrcLine[] = [];
  const timeRegex = /\[(\d+):(\d+\.\d+)\]/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseFloat(match[2]);
      const time = min * 60 + sec;
      const text = line.replace(timeRegex, '').trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }
  return result;
};

export const LyricsView: React.FC<LyricsViewProps> = ({
  lyricsData,
  textColor = '#a9a9a9',
  activeColor = '#1DB954',
}) => {
  const progress = useProgress();
  const [parsedLyrics, setParsedLyrics] = useState<LrcLine[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  useEffect(() => {
    if (lyricsData?.syncedLyrics) {
      setParsedLyrics(parseLrc(lyricsData.syncedLyrics));
    } else {
      setParsedLyrics([]);
    }
  }, [lyricsData]);

  useEffect(() => {
    if (parsedLyrics.length > 0) {
      const currentTime = progress.position;
      // Find the active line
      let newActiveIndex = -1;
      for (let i = 0; i < parsedLyrics.length; i++) {
        if (currentTime >= parsedLyrics[i].time) {
          newActiveIndex = i;
        } else {
          break;
        }
      }

      if (newActiveIndex !== activeIndex) {
        setActiveIndex(newActiveIndex);
        // Auto scroll to the active line (roughly index * line height)
        if (newActiveIndex >= 0 && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: newActiveIndex * 40 - 100, // adjust offset to center
            animated: true,
          });
        }
      }
    }
  }, [progress.position, parsedLyrics, activeIndex]);

  if (!lyricsData) {
    return (
      <View style={styles.container}>
        <Text style={[styles.noLyrics, { color: textColor }]}>No lyrics available</Text>
      </View>
    );
  }

  if (parsedLyrics.length === 0 && lyricsData.plainLyrics) {
    return (
      <ScrollView style={styles.container}>
        <Text style={[styles.plainLyrics, { color: textColor }]}>
          {lyricsData.plainLyrics}
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView ref={scrollViewRef} style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.paddingView} />
      {parsedLyrics.map((line, index) => (
        <Text
          key={index}
          style={[
            styles.syncedLine,
            { color: index === activeIndex ? activeColor : textColor },
            index === activeIndex && styles.activeLine,
          ]}
        >
          {line.text}
        </Text>
      ))}
      <View style={styles.paddingView} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  paddingView: {
    height: 100,
  },
  noLyrics: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    opacity: 0.7,
  },
  plainLyrics: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    paddingVertical: 20,
  },
  syncedLine: {
    fontSize: 22,
    lineHeight: 34,
    textAlign: 'center',
    paddingVertical: 12,
    fontWeight: '600',
    opacity: 0.6,
  },
  activeLine: {
    fontSize: 28,
    opacity: 1,
  },
});
