import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface PlaylistCardProps {
  playlist: {
    name: string;
    cover: string;
    trackCount: number;
  };
  onPress: () => void;
  onShuffle?: () => void;
  onPlay?: () => void;
  onDownload?: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
  isOffline?: boolean;
  theme?: {
    surface: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    icon: string;
  };
}

export function PlaylistCard({ playlist, onPress, onShuffle, onPlay, onDownload, onLongPress, onDelete, isOffline, theme }: PlaylistCardProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.card, theme && { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <TouchableOpacity
        style={styles.infoArea}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        activeOpacity={0.85}
       >
        <View style={styles.coverWrapper}>
          <Image source={{ uri: playlist.cover }} style={[styles.cover, theme && { borderColor: theme.border }]} resizeMode="cover" />
          {isOffline && (
            <View style={styles.offlineBadge}>
              <Ionicons name="cloud-offline" size={10} color="#fff" />
              <Text style={styles.offlineBadgeText}>OFFLINE</Text>
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, theme && { color: theme.textPrimary }]} numberOfLines={1}>{playlist.name}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.count, theme && { color: theme.textSecondary }]}>{playlist.trackCount} {playlist.trackCount === 1 ? t('components.song') : t('components.songs')}</Text>
            {isOffline && (
              <View style={[styles.offlineTag, { borderColor: theme?.accent ?? '#1DB954' }]}>
                <Ionicons name="wifi" size={9} color={theme?.accent ?? '#1DB954'} style={{ marginRight: 2 }} />
                <Text style={[styles.offlineTagText, { color: theme?.accent ?? '#1DB954' }]}>Works Offline</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.actionRow}>
        {onDelete && (
          <TouchableOpacity style={styles.iconButton} onPress={onDelete}>
            <Ionicons name="trash" size={18} color="#ff4444" />
          </TouchableOpacity>
        )}
        {onDownload && (
          <TouchableOpacity style={styles.iconButton} onPress={onDownload}>
            <Ionicons name="download-outline" size={20} color={theme?.icon ?? "#fff"} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.iconButton} onPress={onShuffle}>
          <Ionicons name="shuffle" size={20} color={theme?.icon ?? "#fff"} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={onPlay}>
          <Ionicons name="play" size={20} color={theme?.accent ?? "#1DB954"} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 12,
    marginBottom: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  infoArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  coverWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#222',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  offlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1DB954',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  offlineBadgeText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  info: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  count: {
    color: '#888',
    fontSize: 13,
  },
  offlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  offlineTagText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  iconButton: {
    marginLeft: 4,
    padding: 8,
    borderRadius: 16,
  },
});