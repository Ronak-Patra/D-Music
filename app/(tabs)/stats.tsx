import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getStats, getHistory, PlaybackStats, HistoryEntry } from '@/lib/stats-tracker';
import { Image } from 'expo-image';
import { MusicAPI } from '@/lib/music-api';

export default function StatsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  
  const theme = {
    background: isDark ? '#050505' : '#f5efe6',
    surface: isDark ? '#121212' : '#fffaf2',
    textPrimary: isDark ? '#ffffff' : '#2d2219',
    textSecondary: isDark ? '#a9a9a9' : '#7a6251',
    accent: isDark ? '#1DB954' : '#167c3a',
    border: isDark ? '#272727' : '#e4d5c5',
  };

  const [stats, setStats] = useState<PlaybackStats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const s = await getStats();
    const h = await getHistory();
    setStats(s);
    setHistory(h);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const formatPlayTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>Your Stats</Text>
        
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.statRow}>
            <Ionicons name="time" size={32} color={theme.accent} />
            <View style={{ marginLeft: 16 }}>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                {stats ? formatPlayTime(stats.totalPlayTimeMs) : '0h 0m'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Play Time</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Recently Played</Text>
        {history.length > 0 ? (
          history.map((entry, index) => (
            <View key={index} style={[styles.historyItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Image source={{ uri: MusicAPI.getOptimalImage(entry.track.images) }} style={styles.historyImg} />
              <View style={styles.historyInfo}>
                <Text style={[styles.historyTitle, { color: theme.textPrimary }]} numberOfLines={1}>{entry.track.title}</Text>
                <Text style={[styles.historyArtist, { color: theme.textSecondary }]} numberOfLines={1}>{entry.track.artist}</Text>
              </View>
              <Text style={[styles.historyTime, { color: theme.textSecondary }]}>
                {new Date(entry.playedAt).toLocaleDateString()}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No history yet.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  card: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 14, marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  historyImg: { width: 50, height: 50, borderRadius: 8 },
  historyInfo: { flex: 1, marginLeft: 12 },
  historyTitle: { fontSize: 16, fontWeight: '600' },
  historyArtist: { fontSize: 14, marginTop: 2 },
  historyTime: { fontSize: 12, marginLeft: 8 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16 },
});
