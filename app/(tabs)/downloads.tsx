import React, { useState, useCallback, useContext, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput, ScrollView, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlaylistStorage } from '@/lib/playlist-storage';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { PlaylistList } from '@/components/PlaylistList';
import { MusicAPI } from '@/lib/music-api';
import { DownloadManager } from '@/lib/download-manager';
import { MusicPlayerContext } from './_layout';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from 'react-i18next';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useRouter } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SortKey = 'dateAdded' | 'title' | 'artist';

interface OfflineTrackMeta {
  trackData: Track;
  fileUri?: string;
  thumbUri?: string;
}

interface TrackRowProps {
  item: Track;
  thumbUri: string | null;
  isLikedTrack: boolean;
  isSelected: boolean;
  selectionMode: boolean;
  isActiveTrack: boolean;
  isCurrentlyPlaying: boolean;
  accentColor: string;
  textPrimary: string;
  textSecondary: string;
  surface: string;
  border: string;
  onPlay: () => void;
  onLike: () => void;
  onDelete: () => void;
  onLongPress: () => void;
  onSelect: () => void;
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

const DownloadTrackRow = React.memo(({
  item, thumbUri, isLikedTrack, isSelected, selectionMode,
  isActiveTrack, isCurrentlyPlaying,
  accentColor, textPrimary, textSecondary, surface, border,
  onPlay, onLike, onDelete, onLongPress, onSelect,
}: TrackRowProps) => (
  <TouchableOpacity
    onPress={selectionMode ? onSelect : onPlay}
    onLongPress={onLongPress}
    activeOpacity={0.75}
    style={[
      styles.trackRow,
      { backgroundColor: surface, borderColor: isSelected ? accentColor : isActiveTrack ? accentColor : border },
      (isSelected || isActiveTrack) && { borderWidth: 1.5 },
    ]}
  >
    <View style={styles.albumArtWrapper}>
      <Image
        source={{ uri: thumbUri || item.images?.large || item.albumCover }}
        style={styles.albumArt}
        contentFit="cover"
      />
      {isSelected && (
        <View style={[styles.artOverlay, { backgroundColor: accentColor + 'cc' }]}>
          <Ionicons name="checkmark" size={22} color="#fff" />
        </View>
      )}
      {isActiveTrack && !isSelected && (
        <View style={[styles.artOverlay, { backgroundColor: '#000000aa' }]}>
          <Ionicons
            name={isCurrentlyPlaying ? 'musical-notes' : 'pause'}
            size={18}
            color={accentColor}
          />
        </View>
      )}
    </View>

    <View style={styles.info}>
      <Text
        style={[styles.title, { color: isActiveTrack ? accentColor : textPrimary }]}
        numberOfLines={1}
      >
        {item.title}
      </Text>
      <Text style={[styles.artist, { color: textSecondary }]} numberOfLines={1}>
        {item.artist}
      </Text>
    </View>

    {!selectionMode && (
      <>
        <TouchableOpacity onPress={onLike} style={styles.iconButton} hitSlop={HIT_SLOP}>
          <Ionicons
            name={isLikedTrack ? 'heart' : 'heart-outline'}
            size={22}
            color={isLikedTrack ? accentColor : textPrimary}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.iconButton} hitSlop={HIT_SLOP}>
          <Ionicons name="trash" size={22} color="#ff4444" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onPlay} style={styles.iconButton} hitSlop={HIT_SLOP}>
          <Ionicons
            name={isCurrentlyPlaying ? 'pause-circle' : 'play-circle'}
            size={26}
            color={accentColor}
          />
        </TouchableOpacity>
      </>
    )}
  </TouchableOpacity>
));
DownloadTrackRow.displayName = 'DownloadTrackRow';


interface CollapsibleSectionProps {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  accent: string;
  textPrimary: string;
  surface: string;
  border: string;
  children: React.ReactNode;
}

function CollapsibleSection({
  title, count, collapsed, onToggle,
  accent, textPrimary, surface, border, children,
}: CollapsibleSectionProps) {
  return (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.75}
        style={[styles.sectionHeader, { backgroundColor: surface, borderColor: border }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: accent }]}>{title}</Text>
          <Text style={[styles.sectionCount, { color: textPrimary }]}>{count} songs</Text>
        </View>
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={20}
          color={accent}
        />
      </TouchableOpacity>
      {!collapsed && children}
    </View>
  );
}


export default function DownloadsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const { isOffline } = useConnectivity();

  const theme = useMemo(() => ({
    background: isDark ? '#050505' : '#f5efe6',
    surface: isDark ? '#121212' : '#fffaf2',
    border: isDark ? '#272727' : '#e4d5c5',
    textPrimary: isDark ? '#fff' : '#2d2219',
    textSecondary: isDark ? '#888' : '#7a6251',
    accent: isDark ? '#1DB954' : '#167c3a',
  }), [isDark]);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [offlinePlaylists, setOfflinePlaylists] = useState<any[]>([]);
  const [offlinePlaylistCovers, setOfflinePlaylistCovers] = useState<Record<string, string>>({});
  const [thumbMap, setThumbMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('dateAdded');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Collapsible state
  const [playlistsCollapsed, setPlaylistsCollapsed] = useState(false);
  const [downloadedCollapsed, setDownloadedCollapsed] = useState(true);
  const [localCollapsed, setLocalCollapsed] = useState(true);

  const { isLiked, toggleLike } = useLikedSongs();
  const { handleTrackSelect, currentTrack, isPlaying } = useContext(MusicPlayerContext);

  const searchInputRef = useRef<TextInput>(null);
  const tracksRef = useRef<Track[]>([]);
  tracksRef.current = tracks;

  // App's document directory - songs downloaded from the app go here
  const APP_DOWNLOAD_DIR = FileSystem.documentDirectory || '';

  const handleScanFolder = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your audio files.');
        return;
      }
      setLoading(true);

      const media = await MediaLibrary.getAssetsAsync({ mediaType: 'audio', first: 2000 });
      const audioFiles = media.assets;

      if (audioFiles.length === 0) {
        Alert.alert('No audio files found', 'No supported audio files were found on this device.');
        setLoading(false);
        return;
      }

      let addedCount = 0;
      for (const asset of audioFiles) {
        // Get the real file:// URI for reliable playback
        let playbackUri = asset.uri;
        try {
          const info = await MediaLibrary.getAssetInfoAsync(asset.id);
          if (info.localUri) playbackUri = info.localUri;
        } catch {}

        // Avoid duplicates by checking stored localUri
        const existingTrack = tracksRef.current.find(t => t.uri === playbackUri || t.uri === asset.uri);
        if (existingTrack) continue;

        const trackId = `local_${asset.id}`;
        const filename = asset.filename || 'Unknown File';

        const localTrack = {
          id: trackId,
          title: filename.replace(/\.(mp3|m4a|wav|flac|ogg|opus|aac)$/i, ''),
          artist: 'Local File',
          artistId: 0,
          provider: 'local',
          uri: playbackUri,  // Store file:// URI for reliable TrackPlayer playback
          images: { small: '', thumbnail: '', large: '', back: null },
          duration: asset.duration ? asset.duration * 1000 : 0,
        } as Track;

        const meta: OfflineTrackMeta = {
          trackData: localTrack,
          fileUri: playbackUri,
        };

        await AsyncStorage.setItem(`offline_${trackId}`, JSON.stringify(meta));
        await PlaylistStorage.addTrackToPlaylists(localTrack, ['offline']);
        addedCount++;
      }

      Alert.alert('Scan Complete', `Added ${addedCount} new audio files.`);
      await fetchOfflineTracks();
    } catch (error) {
      console.error('Error scanning folder:', error);
      Alert.alert('Error', 'Failed to scan the device.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOfflineTracks = useCallback(async () => {
    setLoading(true);
    try {
      const playlists = await PlaylistStorage.getPlaylists();
      const offline = playlists.find(pl => pl.name === 'offline');
      if (!offline) { setTracks([]); return; }

      const reversedIds = [...offline.trackIds].reverse();

      const entries = await Promise.all(
        reversedIds.map(async (id) => {
          try {
            const raw = await AsyncStorage.getItem(`offline_${id}`);
            if (raw) {
              const meta: OfflineTrackMeta = JSON.parse(raw);
              if (meta.trackData) return { id, meta };
            }
          } catch { /* ignore corrupt entries */ }

          if (!isOffline) {
            try {
              const resolved = await MusicAPI.resolveTrackById(id);
              if (resolved) return { id, meta: { trackData: resolved } as OfflineTrackMeta };
            } catch (e) {
              console.warn(`API fallback failed for track ${id}:`, e);
            }
          }
          return null;
        })
      );

      const valid = entries.filter(Boolean) as { id: string; meta: OfflineTrackMeta }[];
      setTracks(valid.map(e => e.meta.trackData));

      const newThumbMap: Record<string, string> = {};
      setThumbMap(newThumbMap);

      // Find downloaded playlists
      try {
        const downloadedPlaylistNames = await DownloadManager.getDownloadedPlaylists();
        const validPlaylists = [];
        const playlistCovers: Record<string, string> = {};
        
        for (const name of downloadedPlaylistNames) {
            const count = await DownloadManager.getPlaylistTrackCount(name);
            validPlaylists.push({
                name,
                trackIds: [], // We don't have this right away
                trackCount: count
            });
            // Try to find a cover from newThumbMap or use default
            playlistCovers[name] = 'https://misc.scdn.co/liked-songs/liked-songs-640.png';
        }
        
        setOfflinePlaylists(validPlaylists);
        setOfflinePlaylistCovers(playlistCovers);
      } catch (e) {
        console.error("Failed to load downloaded playlists", e);
      }

    } finally {
      setLoading(false);
    }
  }, [isOffline]);

  useFocusEffect(
    React.useCallback(() => {
      fetchOfflineTracks();
      return () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
      };
    }, [fetchOfflineTracks])
  );

  const displayedTracks = useMemo(() => {
    let result = [...tracks];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      );
    }
    if (sortKey === 'title') result.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortKey === 'artist') result.sort((a, b) => a.artist.localeCompare(b.artist));
    return result;
  }, [tracks, searchQuery, sortKey]);

  // Group tracks: "Downloaded Songs" = downloaded from app (in documentDirectory) or non-local
  // "Local Audio Files" = scanned from device (provider === 'local' and NOT in documentDirectory)
  const { downloadedTracks, localTracks } = useMemo(() => {
    const downloaded: Track[] = [];
    const local: Track[] = [];
    displayedTracks.forEach(track => {
      if (track.provider === 'local') {
        // Check if this file lives in the app's own download folder
        const uri = track.uri || '';
        if (APP_DOWNLOAD_DIR && uri.startsWith(APP_DOWNLOAD_DIR)) {
          downloaded.push(track);
        } else {
          local.push(track);
        }
      } else {
        // Downloaded from JioSaavn / YT Music
        downloaded.push(track);
      }
    });
    return { downloadedTracks: downloaded, localTracks: local };
  }, [displayedTracks, APP_DOWNLOAD_DIR]);

  const handlePlay = useCallback((track: Track, sectionTracks: Track[], indexInSection: number) => {
    handleTrackSelect(track, sectionTracks, indexInSection);
  }, [handleTrackSelect]);

  const handleShuffle = useCallback(() => {
    if (displayedTracks.length === 0) return;
    const shuffled = [...displayedTracks].sort(() => Math.random() - 0.5);
    handleTrackSelect(shuffled[0], shuffled, 0);
  }, [displayedTracks, handleTrackSelect]);

  const handlePlaylistPlay = async (playlist: any, shuffle = false) => {
    const tracks = await PlaylistStorage.getPlaylistTracks(playlist);
    const offlineT = tracks.filter(t => thumbMap[t.id.toString()] || displayedTracks.find(dt => dt.id.toString() === t.id.toString()));
    if (offlineT.length > 0) {
      let playTracks = offlineT;
      if (shuffle) {
        playTracks = [...offlineT].sort(() => Math.random() - 0.5);
      }
      handleTrackSelect(playTracks[0], playTracks, 0);
    }
  };

  const handlePlayAll = useCallback(() => {
    if (displayedTracks.length > 0) {
      handleTrackSelect(displayedTracks[0], displayedTracks, 0);
    }
  }, [displayedTracks, handleTrackSelect]);

  const deleteTrack = useCallback(async (track: Track) => {
    try {
      await PlaylistStorage.removeTrackFromPlaylist(track.id.toString(), 'offline');
      const raw = await AsyncStorage.getItem(`offline_${track.id}`);
      if (raw) {
        const { fileUri, thumbUri } = JSON.parse(raw);
        if (fileUri) await FileSystem.deleteAsync(fileUri, { idempotent: true });
        if (thumbUri) await FileSystem.deleteAsync(thumbUri, { idempotent: true });
        await AsyncStorage.removeItem(`offline_${track.id}`);
      }
      setTracks(prev => prev.filter(t => t.id !== track.id));
      setThumbMap(prev => {
        const next = { ...prev };
        delete next[track.id.toString()];
        return next;
      });
    } catch {
      Alert.alert('Error', 'Failed to delete offline file.');
    }
  }, []);

  const handleDelete = useCallback((track: Track) => {
    Alert.alert(
      t('components.delete_download') || 'Delete Download',
      `Remove "${track.title}" from offline music?`,
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        { text: t('common.delete') || 'Delete', style: 'destructive', onPress: () => deleteTrack(track) },
      ]
    );
  }, [deleteTrack, t]);

  const handleDeletePlaylist = useCallback((playlist: any) => {
    Alert.alert(
      'Delete Downloaded Playlist',
      `Are you sure you want to delete "${playlist.name}" and all its downloaded songs?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const masterUri = await DownloadManager.getMasterFolderUri();
              if (masterUri) {
                const targetDirUri = await DownloadManager.ensureDirectoryExists(masterUri, playlist.name.replace(/[^a-zA-Z0-9 -]/g, '').trim());
                await FileSystem.deleteAsync(targetDirUri, { idempotent: true });
                setOfflinePlaylists(prev => prev.filter(p => p.name !== playlist.name));
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to delete playlist folder.');
            }
          }
        }
      ]
    );
  }, []);

  const handleDeleteSelected = useCallback(() => {
    Alert.alert(
      'Delete Selected',
      `Remove ${selectedIds.size} track${selectedIds.size > 1 ? 's' : ''} from offline music?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            const toDelete = tracksRef.current.filter(t => selectedIds.has(t.id.toString()));
            await Promise.all(toDelete.map(deleteTrack));
            setSelectionMode(false);
            setSelectedIds(new Set());
          },
        },
      ]
    );
  }, [selectedIds, deleteTrack]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const enterSelectionMode = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(displayedTracks.map(t => t.id.toString())));
  }, [displayedTracks]);

  const renderTrackItem = useCallback((item: Track, sectionTracks: Track[], index: number) => {
    const isActiveTrack = currentTrack?.id?.toString() === item.id?.toString();
    const isCurrentlyPlaying = isActiveTrack && isPlaying;

    return (
      <DownloadTrackRow
        key={item.id.toString()}
        item={item}
        thumbUri={thumbMap[item.id.toString()] ?? null}
        isLikedTrack={isLiked(item.id)}
        isSelected={selectedIds.has(item.id.toString())}
        selectionMode={selectionMode}
        isActiveTrack={isActiveTrack}
        isCurrentlyPlaying={isCurrentlyPlaying}
        accentColor={theme.accent}
        textPrimary={theme.textPrimary}
        textSecondary={theme.textSecondary}
        surface={theme.surface}
        border={theme.border}
        onPlay={() => handlePlay(item, sectionTracks, index)}
        onLike={() => toggleLike(item)}
        onDelete={() => handleDelete(item)}
        onLongPress={() => enterSelectionMode(item.id.toString())}
        onSelect={() => toggleSelection(item.id.toString())}
      />
    );
  }, [
    thumbMap, isLiked, selectedIds, selectionMode, theme,
    currentTrack, isPlaying,
    handlePlay, toggleLike, handleDelete, enterSelectionMode, toggleSelection,
  ]);

  const keyExtractor = useCallback((item: Track) => item.id.toString(), []);

  const SORT_LABELS: Record<SortKey, string> = {
    dateAdded: t('downloads.date_added'),
    title: t('downloads.title'),
    artist: t('downloads.artist'),
  };

  const toggleDownloadedCollapsed = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDownloadedCollapsed(v => !v);
  }, []);

  const togglePlaylistsCollapsed = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPlaylistsCollapsed(v => !v);
  }, []);

  const toggleLocalCollapsed = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLocalCollapsed(v => !v);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          {selectionMode ? (
            <>
              <TouchableOpacity onPress={exitSelectionMode} hitSlop={HIT_SLOP}>
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                {selectedIds.size} selected
              </Text>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={selectAll}
                  style={[styles.headerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="checkmark-done" size={20} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteSelected}
                  style={[styles.headerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="trash" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                  Downloads
                </Text>
                <Text style={[styles.trackCount, { color: theme.textSecondary }]}>
                  {tracks.length} songs
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.headerActions}
              >
                <TouchableOpacity
                  onPress={() => setShowSearch(v => !v)}
                  style={[styles.headerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="search" size={20} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowSortMenu(v => !v)}
                  style={[styles.headerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="filter" size={20} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleScanFolder}
                  style={[styles.headerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="scan" size={20} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShuffle}
                  style={[styles.headerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="shuffle" size={20} color={theme.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePlayAll}
                  style={[styles.headerButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <Ionicons name="play" size={20} color={theme.accent} />
                </TouchableOpacity>
              </ScrollView>
            </>
          )}
        </View>

        {/* Search bar */}
        {showSearch && (
          <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search downloads..."
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.textPrimary }]}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={HIT_SLOP}>
                <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Sort menu */}
        {showSortMenu && (
          <View style={[styles.sortMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
              <TouchableOpacity
                key={key}
                onPress={() => { setSortKey(key); setShowSortMenu(false); }}
                style={[
                  styles.sortOption,
                  sortKey === key && { backgroundColor: theme.accent + '22' },
                ]}
              >
                <Text style={[styles.sortLabel, { color: sortKey === key ? theme.accent : theme.textPrimary }]}>
                  {SORT_LABELS[key]}
                </Text>
                {sortKey === key && <Ionicons name="checkmark" size={16} color={theme.accent} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Content */}
        {loading ? (
          <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 40 }} />
        ) : displayedTracks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-download-outline" size={52} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {searchQuery ? `No results for "${searchQuery}"` : t('components.no_offline_music')}
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
            {/* Downloaded Playlists Section */}
            {offlinePlaylists.length > 0 && (
              <CollapsibleSection
                title="Downloaded Playlists"
                count={offlinePlaylists.length}
                collapsed={playlistsCollapsed}
                onToggle={togglePlaylistsCollapsed}
                accent={theme.accent}
                textPrimary={theme.textPrimary}
                surface={theme.surface}
                border={theme.border}
              >
                <PlaylistList
                  playlists={offlinePlaylists.map(pl => ({
                    ...pl,
                    cover: offlinePlaylistCovers[pl.name] || pl.cover,
                  }))}
                  onPlaylistPress={(pl) => {
                    router.push(`/media/playlist/${pl.name}?title=${encodeURIComponent(pl.name)}&offline=true`);
                  }}
                  onPlaylistPlay={pl => handlePlaylistPlay(pl, false)}
                  onPlaylistShuffle={pl => handlePlaylistPlay(pl, true)}
                  onPlaylistLongPress={handleDeletePlaylist}
                  onPlaylistDelete={handleDeletePlaylist}
                  theme={{
                    surface: theme.surface,
                    border: theme.border,
                    textPrimary: theme.textPrimary,
                    textSecondary: theme.textSecondary,
                    accent: theme.accent,
                    icon: theme.textPrimary
                  }}
                />
              </CollapsibleSection>
            )}

            {/* Downloaded Songs Section */}
            {downloadedTracks.length > 0 && (
              <CollapsibleSection
                title="Downloaded Songs"
                count={downloadedTracks.length}
                collapsed={downloadedCollapsed}
                onToggle={toggleDownloadedCollapsed}
                accent={theme.accent}
                textPrimary={theme.textPrimary}
                surface={theme.surface}
                border={theme.border}
              >
                {downloadedTracks.map((track, index) =>
                  renderTrackItem(track, downloadedTracks, index)
                )}
              </CollapsibleSection>
            )}

            {/* Local Audio Files Section */}
            {localTracks.length > 0 && (
              <CollapsibleSection
                title="Local Audio Files"
                count={localTracks.length}
                collapsed={localCollapsed}
                onToggle={toggleLocalCollapsed}
                accent={theme.accent}
                textPrimary={theme.textPrimary}
                surface={theme.surface}
                border={theme.border}
              >
                {localTracks.map((track, index) =>
                  renderTrackItem(track, localTracks, index)
                )}
              </CollapsibleSection>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingTop: 20, paddingHorizontal: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  trackCount: { fontSize: 14, fontWeight: '400', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerButton: { padding: 8, borderRadius: 20, borderWidth: 1 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  sortMenu: { borderWidth: 1, borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  sortOption: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  sortLabel: { fontSize: 15 },
  trackRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, marginBottom: 10, padding: 10,
  },
  albumArtWrapper: { position: 'relative', marginRight: 14 },
  albumArt: { width: 54, height: 54, borderRadius: 8, backgroundColor: '#222' },
  artOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, marginRight: 8 },
  title: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  artist: { fontSize: 13 },
  iconButton: { padding: 6, borderRadius: 16 },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 16 },
  emptyText: { fontSize: 16, textAlign: 'center', fontWeight: '500', marginTop: 16 },
  listContent: { paddingBottom: 120 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionCount: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
});