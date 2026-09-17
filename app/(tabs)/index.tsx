import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, StatusBar, Text, TouchableOpacity, ScrollView, Modal, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSearch } from '@/hooks/useSearch';
import { TopBar } from '@/components/TopBar';
import { MusicPlayerContext } from '@/contexts/MusicPlayerContext';
import { MusicAPI } from '@/lib/music-api';
import { Track } from '@/types/music';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLikedSongs } from '@/hooks/useLikedSongs';
import { HorizontalTrackList } from '@/components/HorizontalTrackList';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '@/hooks/useColorScheme';
import { COUNTRY_NAMES } from '@/constants/countryNames';
import { useTranslation } from 'react-i18next';
import { useThemeMode, ThemeMode } from '@/hooks/theme-mode';
import { useConnectivity } from '@/hooks/useConnectivity';
import { GreetingHeader } from '@/components/GreetingHeader';
import { QuickActions } from '@/components/QuickActions';
import { SectionHeader } from '@/components/SectionHeader';

const KWORD_URL = 'https://kworb.net/spotify/';
const REGION_URL_MAP_KEY = 'openspot_region_url_map_v1';
const REGION_URL_MAP_TIMESTAMP_KEY = 'openspot_region_url_map_ts_v1';
const REGION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TRENDING_TRACKS_CACHE_KEY = 'TRENDING_TRACKS_CACHE_V1';
const REGION_OVERRIDE_KEY = 'openspot_region_override_v1';
const LANGUAGE_KEY = 'openspot_language_v1';
const FIRST_RUN_SETUP_KEY = 'openspot_first_run_setup_done_v1';
const TRENDING_ENABLED_KEY = 'openspot_trending_enabled_v1';

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const { t, i18n } = useTranslation();
  const { mode, setMode } = useThemeMode();
  const isDark = colorScheme !== 'light';
  const theme = useMemo(
    () => ({
      background: isDark ? '#050505' : '#f5efe6',
      surface: isDark ? '#121212' : '#fffaf2',
      surfaceElevated: isDark ? '#1b1b1b' : '#efe4d6',
      textPrimary: isDark ? '#ffffff' : '#2d2219',
      textSecondary: isDark ? '#a9a9a9' : '#7a6251',
      border: isDark ? '#272727' : '#e4d5c5',
      accent: isDark ? '#1DB954' : '#167c3a',
    }),
    [isDark]
  );

  const [currentView, setCurrentView] = React.useState<'home' | 'search'>('home');
  const searchState = useSearch();
  const { clearResults } = searchState;
  const { handleTrackSelect, musicQueue, isPlaying, currentTrack } = useContext(MusicPlayerContext);
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [newReleasesTracks, setNewReleasesTracks] = useState<Track[]>([]);
  const [mostViewedTracks, setMostViewedTracks] = useState<Track[]>([]);
  const { getLikedSongsAsTrack } = useLikedSongs();
  const likedTracks = getLikedSongsAsTrack();
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState('your country');
  const [regionOverride, setRegionOverride] = useState<string>('auto');
  const [countryLoading, setCountryLoading] = useState(true);
  const [regionUrlMap, setRegionUrlMap] = useState<Record<string, string>>({});
  const [trendingCache, setTrendingCache] = useState<Record<string, Track>>({});
  const [recentlyPlayedTracks, setRecentlyPlayedTracks] = useState<Track[]>([]);
  const [showFirstRunSetup, setShowFirstRunSetup] = useState(false);
  const [setupRegion, setSetupRegion] = useState<string>('auto');
  const [setupLanguage, setSetupLanguage] = useState<string>('en');
  const [setupTheme, setSetupTheme] = useState<ThemeMode>(mode);
  const [isHomeRegionModalOpen, setIsHomeRegionModalOpen] = useState(false);
  const [subRegion, setSubRegion] = useState<string | null>(null);
  const [musicStyle, setMusicStyle] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([]);
  const [isFetchingRecommendations, setIsFetchingRecommendations] = useState(false);

  const handleRegionChange = async (nextRegion: string) => {
    setRegionOverride(nextRegion);
    setSubRegion(null);
    try {
      await AsyncStorage.setItem(REGION_OVERRIDE_KEY, nextRegion);
    } catch (error) {
      console.error('Failed to save region setting:', error);
    }
  };
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const { isOffline } = useConnectivity();
  const wasOfflineRef = React.useRef(false);
  const [trendingEnabled, setTrendingEnabled] = useState<boolean>(true);
  const scrollRef = useRef<ScrollView>(null);

  const languageOptions: { label: string; value: string; nativeLabel: string }[] = [
    { label: 'English', value: 'en', nativeLabel: 'English' },
    { label: 'Hindi', value: 'hi', nativeLabel: 'Hindi' },
    { label: 'Spanish', value: 'es', nativeLabel: 'Espanol' },
    { label: 'Chinese', value: 'zh', nativeLabel: 'Zhongwen' },
    { label: 'German', value: 'de', nativeLabel: 'Deutsch' },
    { label: 'French', value: 'fr', nativeLabel: 'Francais' },
    { label: 'Russian', value: 'ru', nativeLabel: 'Russkiy' },
    { label: 'Hebrew', value: 'he', nativeLabel: 'Ivrit' },
    { label: 'Turkish', value: 'tr', nativeLabel: 'TÃ¼rkÃ§e' },
    { label: 'Korean', value: 'ko', nativeLabel: 'í•œêµ­ì–´' },
  ];

  
  useEffect(() => {
    (async () => {
      try {
        const [cacheStr, mapStr, done, stored, storedRegion, timestamp] = await Promise.all([
          AsyncStorage.getItem(TRENDING_TRACKS_CACHE_KEY),
          AsyncStorage.getItem(REGION_URL_MAP_KEY),
          AsyncStorage.getItem(FIRST_RUN_SETUP_KEY),
          AsyncStorage.getItem(TRENDING_ENABLED_KEY),
          AsyncStorage.getItem(REGION_OVERRIDE_KEY),
          AsyncStorage.getItem(REGION_URL_MAP_TIMESTAMP_KEY),
        ]);
        if (cacheStr) setTrendingCache(JSON.parse(cacheStr));
        if (mapStr) setRegionUrlMap(JSON.parse(mapStr));
        if (!done) setShowFirstRunSetup(true);
        if (stored !== null) setTrendingEnabled(stored === 'true');
        if (storedRegion && storedRegion.trim()) setRegionOverride(storedRegion);

        const isStale = !timestamp || Date.now() - parseInt(timestamp, 10) > REGION_CACHE_TTL_MS;
        if (isStale) {
          const res = await fetch(KWORD_URL);
          const html = await res.text();
          const freshMap: Record<string, string> = {};
          const regex = /<tr><td class="mp text">([^<]+)<\/td>\s*<td class="mp text">[\s\S]*?<a href="([^"]+)">Weekly<\/a>/g;
          let match;
          while ((match = regex.exec(html)) !== null) {
            const name = match[1].trim();
            freshMap[name] = `https://kworb.net/spotify/${match[2]}`;
          }
          setRegionUrlMap(freshMap);
          await AsyncStorage.setItem(REGION_URL_MAP_KEY, JSON.stringify(freshMap));
          await AsyncStorage.setItem(REGION_URL_MAP_TIMESTAMP_KEY, Date.now().toString());
        }
      } catch (e) {
        console.error('Failed to load cached data:', e);
      }
    })();
  }, []);

  useEffect(() => {
    setSetupTheme(mode);
  }, [mode]);

  useEffect(() => {
    if (!isOffline && wasOfflineRef.current) {
      void (async () => {
        try {
          const timestamp = await AsyncStorage.getItem(REGION_URL_MAP_TIMESTAMP_KEY);
          const isStale = !timestamp || Date.now() - parseInt(timestamp, 10) > REGION_CACHE_TTL_MS;
          if (!isStale) return;

          const res = await fetch(KWORD_URL);
          const html = await res.text();
          const map: Record<string, string> = {};
          const regex = /<tr><td class="mp text">([^<]+)<\/td>\s*<td class="mp text">[\s\S]*?<a href="([^"]+)">Weekly<\/a>/g;
          let match;
          while ((match = regex.exec(html)) !== null) {
            const name = match[1].trim();
            map[name] = `https://kworb.net/spotify/${match[2]}`;
          }
          setRegionUrlMap(map);
          await AsyncStorage.setItem(REGION_URL_MAP_KEY, JSON.stringify(map));
          await AsyncStorage.setItem(REGION_URL_MAP_TIMESTAMP_KEY, Date.now().toString());
        } catch (e) {
          console.error('Region URL map re-fetch error:', e);
        }
      })();
      if (regionOverride === 'auto') {
        void (async () => {
          try {
            setCountryLoading(true);
            const res = await fetch('https://ipinfo.io/json');
            const data = await res.json();
            if (data && data.country && COUNTRY_NAMES[data.country]) {
              setDetectedCountry(COUNTRY_NAMES[data.country]);
            } else {
              setDetectedCountry('your country');
            }
          } catch (e) {
            console.error('Country re-fetch error:', e);
          } finally {
            setCountryLoading(false);
          }
        })();
      }
    }
    wasOfflineRef.current = isOffline;
  }, [isOffline, regionOverride]);

  const loadRecentlyPlayed = React.useCallback(async () => {
    try {
      const recent = await MusicAPI.getRecentlyPlayed();
      setRecentlyPlayedTracks(recent);
      if (recent && recent.length > 0) {
        fetchRecommendations(recent[0]);
      }
    } catch (error) {
      console.error('Failed to load recently played tracks:', error);
      setRecentlyPlayedTracks([]);
    }
  }, []);

  const fetchRecommendations = async (baseTrack: Track) => {
    if (isFetchingRecommendations || recommendedTracks.length > 0) return;
    setIsFetchingRecommendations(true);
    try {
      const res = await MusicAPI.searchTracks(baseTrack.artist, 1, 15);
      if (res && res.tracks) {
        const seen = new Set<string>();
        seen.add(`${baseTrack.title?.toLowerCase().trim()}|${baseTrack.artist?.toLowerCase().trim()}`);
        if (baseTrack.id) seen.add(baseTrack.id.toString());
        const dedupedTracks = res.tracks.filter(t => {
          const key = `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`;
          const idKey = t.id.toString();
          if (seen.has(key) || seen.has(idKey)) return false;
          seen.add(key);
          seen.add(idKey);
          return true;
        });
        setRecommendedTracks(dedupedTracks);
      }
    } catch (e) {
      console.error('Failed to fetch recommendations:', e);
    } finally {
      setIsFetchingRecommendations(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadRecentlyPlayed();
    setRefreshing(false);
  }, [loadRecentlyPlayed]);

  useEffect(() => {
    void loadRecentlyPlayed();
  }, [loadRecentlyPlayed, currentTrack]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('https://ipinfo.io/json');
        const data = await res.json();
        if (data && data.country && COUNTRY_NAMES[data.country]) {
          setDetectedCountry(COUNTRY_NAMES[data.country]);
        } else {
          setDetectedCountry('your country');
        }
      } catch (e) {
        console.error('Country fetch error:', e);
        setDetectedCountry('your country');
      } finally {
        setCountryLoading(false);
      }
    })();
  }, []);

  const activeRegion = regionOverride === 'auto' ? detectedCountry : regionOverride;
  const formattedActiveRegion = activeRegion
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  useEffect(() => {
    let isMounted = true;

    const isRecentTrack = (track: Track, maxMonthsAge: number = 6) => {
      if (!track.releaseDate) return true;
      const release = new Date(track.releaseDate);
      if (isNaN(release.getTime())) {
        if (track.releaseDate.length === 4) {
          const year = parseInt(track.releaseDate);
          return (new Date().getFullYear() - year) <= 1;
        }
        return true;
      }
      const now = new Date();
      const monthsDiff = (now.getFullYear() - release.getFullYear()) * 12 + now.getMonth() - release.getMonth();
      return monthsDiff >= 0 && monthsDiff <= maxMonthsAge;
    };

    const fetchTrendingTracks = async (list: string[]) => {

      let cache = { ...trendingCache };
      const tracks: Track[] = [];
      let cacheChanged = false;


      for (const entry of list) {
        if (cache[entry]) {
          tracks.push(cache[entry]);
        }
      }


      if (isMounted) {
        // Deduplicate
        const seen = new Set<string>();
        const dedupedTracks: Track[] = [];
        for (const t of tracks) {
          const key = `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`;
          const idKey = t.id.toString();
          if (!seen.has(key) && !seen.has(idKey)) {
            seen.add(key);
            seen.add(idKey);
            dedupedTracks.push(t);
          }
        }
        setTrendingTracks(dedupedTracks);
      }


      for (const entry of list) {
        if (!cache[entry]) {
          try {
            const res = await MusicAPI.searchTracks(entry);
            if (res.tracks && res.tracks.length > 0) {
              cache[entry] = res.tracks[0];
              tracks.push(res.tracks[0]);
              cacheChanged = true;


              if (isMounted) {
                // Deduplicate
                const seen = new Set<string>();
                const dedupedTracks: Track[] = [];
                for (const t of tracks) {
                  const key = `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`;
                  const idKey = t.id.toString();
                  if (!seen.has(key) && !seen.has(idKey)) {
                    seen.add(key);
                    seen.add(idKey);
                    dedupedTracks.push(t);
                  }
                }
                setTrendingTracks(dedupedTracks);
              }
            } else {
              console.warn(`[Trending] No results for: ${entry}`);
            }
          } catch (e) {
            console.error(`[Trending] Error fetching "${entry}":`, e);
          }
        }
      }

      if (cacheChanged) {
        setTrendingCache(cache);
        try {
          await AsyncStorage.setItem(TRENDING_TRACKS_CACHE_KEY, JSON.stringify(cache));
        } catch (e) {
          console.error('Failed to save trending tracks cache:', e);
        }
      }
    };

    const fetchKworbWeekly = async (weeklyUrl: string) => {
      try {
        const res = await fetch(weeklyUrl);
        const html = await res.text();
        const trackRegex = /<td class="text mp"><div><a href="[^"]+">([^<]+)<\/a> - <a href="[^"]+">([^<]+)<\/a>/g;
        const searchQueries: string[] = [];
        let match;
        while ((match = trackRegex.exec(html)) !== null) {
          searchQueries.push(match[2].trim());
        }
        fetchTrendingTracks(searchQueries.slice(0, 50));
      } catch (e) {
        console.error('Failed to fetch kworb weekly chart:', e);
        if (isMounted) setTrendingTracks([]);
      }
    };

    if (!countryLoading && activeRegion && activeRegion !== 'your country') {
      const hasSpecificFilter = !!musicStyle || !!subRegion;
      setIsTrendingLoading(true);

      if (hasSpecificFilter) {
        const fetchStyleOrRegion = async () => {
          let searchQuery = 'Top 50 ';
          if (subRegion) searchQuery += `${subRegion} `;
          else if (activeRegion && activeRegion !== 'India' && activeRegion !== 'your country') searchQuery += `${activeRegion} `;
          if (musicStyle) searchQuery += `${musicStyle} `;
          
          try {
            const queryName = searchQuery.trim();
            const res = await MusicAPI.search({ q: queryName, type: 'playlist' });
            if (res.playlists && res.playlists.length > 0) {
              const pId = res.playlists[0].id;
              const result = await MusicAPI.getPlaylistSongsPaginated(pId, 0);
              if (result.tracks && result.tracks.length > 0) {
                return { tracks: result.tracks };
              }
            }
            return MusicAPI.searchTracks(queryName.replace('Top 50', '').trim(), 1, 30);
          } catch (e) {
            console.warn('Playlist fallback to track search failed', e);
            return MusicAPI.searchTracks(searchQuery.replace('Top 50', '').trim(), 1, 30);
          }
        };
        
        fetchStyleOrRegion().then(res => {
          if (isMounted && res.tracks) {
            const seen = new Set<string>();
            const dedupedTracks = res.tracks.filter(t => {
              const key = `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`;
              const idKey = t.id.toString();
              if (seen.has(key) || seen.has(idKey)) return false;
              seen.add(key);
              seen.add(idKey);
              return true;
            });
            setTrendingTracks(dedupedTracks);
          }
          if (isMounted) setIsTrendingLoading(false);
        });
      } else {
        const activeKey = activeRegion.toLowerCase();
        const regionKey = Object.keys(regionUrlMap).find(k => k.toLowerCase() === activeKey);
        if (regionKey && regionUrlMap[regionKey]) {
          fetchKworbWeekly(regionUrlMap[regionKey]).finally(() => {
            if (isMounted) setIsTrendingLoading(false);
          });
        } else {
          const globalKey = Object.keys(regionUrlMap).find(k => k.toLowerCase() === 'global');
          if (globalKey && regionUrlMap[globalKey]) {
            fetchKworbWeekly(regionUrlMap[globalKey]).finally(() => {
              if (isMounted) setIsTrendingLoading(false);
            });
          } else {
            if (isMounted) {
              setTrendingTracks([]);
              setIsTrendingLoading(false);
            }
          }
        }
      }
    } else {
      if (isMounted) {
        setTrendingTracks([]);
        setIsTrendingLoading(false);
      }
    }
    
    const fetchNewReleases = async () => {
      if (countryLoading || !activeRegion) return;
      let query = 'Latest ';
      if (subRegion) query += `${subRegion} `;
      else if (activeRegion && activeRegion !== 'India' && activeRegion !== 'your country') query += `${activeRegion} `;
      else if (activeRegion === 'India') query += `Hindi `;
      if (musicStyle) query += `${musicStyle} `;
      
      query += ` ${new Date().getFullYear()}`;
      
      try {
        const queryName = query.trim();
        const albumRes = await MusicAPI.search({ q: queryName, type: 'album' });
        let finalTracks: Track[] = [];
        
        if (albumRes.albums && albumRes.albums.length > 0) {
          const albumPromises = albumRes.albums.slice(0, 3).map(a => MusicAPI.getAlbumSongs(a.id));
          const albumResults = await Promise.allSettled(albumPromises);
          
          for (const res of albumResults) {
            if (res.status === 'fulfilled' && res.value && res.value.length > 0) {
              finalTracks = [...finalTracks, ...res.value];
            }
          }
        }
        
        if (finalTracks.length === 0) {
          const fallbackQuery = queryName.replace('Latest', '').replace(new Date().getFullYear().toString(), '').trim();
          const res = await MusicAPI.searchTracks(fallbackQuery, 1, 15);
          finalTracks = res.tracks || [];
        }
        
        if (isMounted && finalTracks && finalTracks.length > 0) {
          const seen = new Set<string>();
          const dedupedTracks = finalTracks.filter(t => {
            if (!isRecentTrack(t, 6)) return false;
            const key = `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`;
            const idKey = t.id.toString();
            if (seen.has(key) || seen.has(idKey)) return false;
            seen.add(key);
            seen.add(idKey);
            return true;
          });
          setNewReleasesTracks(dedupedTracks);
        }
      } catch (e) {
        console.error('Failed to fetch new releases', e);
      }
    };
    
    if (activeRegion) {
      void fetchNewReleases();
    }

    return () => { isMounted = false; };
  }, [activeRegion, subRegion, musicStyle, countryLoading, regionUrlMap, trendingCache]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e) => {
      setCurrentView('home');
      clearResults();
    });
    return unsubscribe;
  }, [navigation, clearResults]);

  const handleViewChange = (view: 'home' | 'search') => {
    setCurrentView(view);
    if (view === 'home') {
      clearResults();
    }
  };

  const handleSearchClick = () => {
    router.push('/search');
  };

  const handleSearchStart = () => {
    setCurrentView('search');
  };

  const saveFirstRunSetup = async () => {
    setIsSavingSetup(true);
    try {
      await AsyncStorage.setItem(REGION_OVERRIDE_KEY, setupRegion);
      await AsyncStorage.setItem(LANGUAGE_KEY, setupLanguage);
      await AsyncStorage.setItem(FIRST_RUN_SETUP_KEY, '1');
      await i18n.changeLanguage(setupLanguage);
      setMode(setupTheme);
      setRegionOverride(setupRegion);
      setShowFirstRunSetup(false);
    } catch (error) {
      console.error('Failed to save first run setup:', error);
    } finally {
      setIsSavingSetup(false);
    }
  };

  const handleHomeTrackSelect = React.useCallback(
    (track: Track, trackList?: Track[], startIndex?: number) => {
      handleTrackSelect(track, trackList, startIndex);
      setRecentlyPlayedTracks((prev) => {
        const withoutCurrent = prev.filter((item) => item.id.toString() !== track.id.toString());
        return [track, ...withoutCurrent].slice(0, 30);
      });
    },
    [handleTrackSelect]
  );

  const handleShuffleLiked = React.useCallback(() => {
    if (likedTracks.length > 0) {
      const randomIndex = Math.floor(Math.random() * likedTracks.length);
      handleHomeTrackSelect(likedTracks[randomIndex], likedTracks, randomIndex);
    }
  }, [likedTracks, handleHomeTrackSelect]);

  const handleLibraryNav = React.useCallback(() => {
    router.push('/library');
  }, [router]);

  const handleDownloadsNav = React.useCallback(() => {
    router.push('/downloads');
  }, [router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} translucent={false} />
      <TopBar
        currentView={currentView}
        onViewChange={handleViewChange}
        onSearchClick={handleSearchClick}
        onSearchStart={handleSearchStart}
        searchState={searchState}
      />
      <View style={styles.mainContent}>
        {currentView === 'home' ? (
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          >
            <GreetingHeader />
            <QuickActions
              onShuffleLiked={handleShuffleLiked}
              onDownloads={handleDownloadsNav}
              onLibrary={handleLibraryNav}
            />

            {trendingEnabled && (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.textPrimary }}>
                    {t('home.trending_in', { region: '' }).replace('...', '').trim()}
                  </Text>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surfaceElevated, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}
                    onPress={() => setIsHomeRegionModalOpen(true)}
                  >
                    <Text style={{ color: theme.textPrimary, marginRight: 4, fontSize: 13, fontWeight: '600' }}>
                      {countryLoading ? '...' : (formattedActiveRegion || t('home.your_country'))}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                {formattedActiveRegion === 'India' && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
                    {['Hindi', 'Punjabi', 'Tamil', 'Telugu', 'Marathi', 'Bhojpuri', 'Bengali', 'Malayalam', 'Kannada', 'Haryanvi'].map((lang) => (
                      <TouchableOpacity
                        key={lang}
                        style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: subRegion === lang ? theme.accent : theme.border, backgroundColor: subRegion === lang ? theme.accent : theme.surface }}
                        onPress={() => setSubRegion(subRegion === lang ? null : lang)}
                      >
                        <Text style={{ color: subRegion === lang ? '#fff' : theme.textPrimary, fontSize: 13, fontWeight: '600' }}>{lang}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
                  {['Pop', 'Hip Hop', 'Rock', 'Acoustic', 'Devotional', 'Classical', 'Lofi'].map((style) => (
                    <TouchableOpacity
                      key={style}
                      style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: musicStyle === style ? theme.accent : theme.border, backgroundColor: musicStyle === style ? theme.accent : theme.surface }}
                      onPress={() => setMusicStyle(musicStyle === style ? null : style)}
                    >
                      <Text style={{ color: musicStyle === style ? '#fff' : theme.textPrimary, fontWeight: '500' }}>{style}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {isTrendingLoading ? (
                  <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
                    {t('home.loading_trending')}
                  </Text>
                ) : trendingTracks.length > 0 ? (
                  <HorizontalTrackList
                    title=""
                    tracks={trendingTracks}
                    onTrackSelect={handleHomeTrackSelect}
                    isPlaying={isPlaying}
                    currentTrack={currentTrack}
                  />
                ) : (
                  <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
                    No tracks found for this filter.
                  </Text>
                )}
              </View>
            )}

            {newReleasesTracks.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <SectionHeader title={t('home.new_releases') !== 'home.new_releases' ? t('home.new_releases') : 'New Releases'} />
                <HorizontalTrackList
                  title=""
                  tracks={newReleasesTracks}
                  onTrackSelect={handleHomeTrackSelect}
                  isPlaying={isPlaying}
                  currentTrack={currentTrack}
                />
              </View>
            )}



            <View style={{ marginTop: 16 }}>
              <SectionHeader title={t('home.liked_songs')} onSeeAll={handleLibraryNav} />
              {likedTracks.length > 0 ? (
                <HorizontalTrackList
                  title=""
                  tracks={likedTracks}
                  onTrackSelect={handleHomeTrackSelect}
                  isPlaying={isPlaying}
                  currentTrack={currentTrack}
                />
              ) : (
                <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="heart-outline" size={24} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    {t('home.empty_liked')}
                  </Text>
                </View>
              )}
            </View>

            <View style={{ marginTop: 16 }}>
              <SectionHeader title={t('home.continue_listening')} />
              {recentlyPlayedTracks.length > 0 ? (
                <HorizontalTrackList
                  title=""
                  tracks={recentlyPlayedTracks.slice(0, 10)}
                  onTrackSelect={handleHomeTrackSelect}
                  isPlaying={isPlaying}
                  currentTrack={currentTrack}
                />
              ) : (
                <View style={[styles.emptyState, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <Ionicons name="time-outline" size={32} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('home.no_recent') || t('home.empty_recent')}</Text>
                </View>
              )}
            </View>

            {recommendedTracks.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <SectionHeader title={t('home.recommended_for_you') || 'Recommended for You'} />
                <HorizontalTrackList
                  title=""
                  tracks={recommendedTracks}
                  onTrackSelect={handleHomeTrackSelect}
                  isPlaying={isPlaying}
                  currentTrack={currentTrack}
                />
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          <></>
        )}
      </View>
      <Modal visible={showFirstRunSetup} transparent animationType="fade">
        <View style={styles.setupOverlay}>
          <View style={[styles.setupCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.setupTitle, { color: theme.textPrimary }]}>{t('home.welcome_title')}</Text>
            <Text style={[styles.setupSubtitle, { color: theme.textSecondary }]}>
              {t('home.welcome_subtitle')}
            </Text>

            <Text style={[styles.setupSectionTitle, { color: theme.textPrimary }]}>{t('settings.region')}</Text>
            <TouchableOpacity
              style={[styles.setupDropdownButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              onPress={() => setIsRegionModalOpen(true)}
            >
              <Text style={[styles.setupDropdownButtonText, { color: theme.textPrimary }]}>
                {setupRegion === 'auto' ? t('settings.auto') : setupRegion}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.setupSectionTitle, { color: theme.textPrimary }]}>{t('settings.language')}</Text>
            <TouchableOpacity
              style={[styles.setupDropdownButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
              onPress={() => setIsLanguageModalOpen(true)}
            >
              <Text style={[styles.setupDropdownButtonText, { color: theme.textPrimary }]}>
                {languageOptions.find((option) => option.value === setupLanguage)?.label || 'English'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.setupSectionTitle, { color: theme.textPrimary }]}>{t('settings.theme')}</Text>
            <View style={styles.setupRow}>
              {[
                { label: t('components.theme_light'), value: 'light' as ThemeMode },
                { label: t('components.theme_dark'), value: 'dark' as ThemeMode },
                { label: t('components.theme_auto'), value: 'auto' as ThemeMode },
              ].map((themeOption) => {
                const active = setupTheme === themeOption.value;
                return (
                  <TouchableOpacity
                    key={`setup-theme-${themeOption.value}`}
                    style={[
                      styles.setupSegment,
                      { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
                      active && { backgroundColor: theme.accent, borderColor: theme.accent },
                    ]}
                    onPress={() => setSetupTheme(themeOption.value)}
                  >
                    <Text style={[styles.setupSegmentText, { color: active ? '#fff' : theme.textSecondary }]}>{themeOption.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.setupContinueButton, { backgroundColor: theme.accent }]}
              onPress={saveFirstRunSetup}
              disabled={isSavingSetup}
            >
              {isSavingSetup ? <ActivityIndicator color="#fff" /> : <Text style={styles.setupContinueText}>{t('home.continue')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isLanguageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLanguageModalOpen(false)}
      >
        <View style={styles.setupModalOverlay}>
          <View style={[styles.setupLanguageModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.setupSectionTitle, { color: theme.textPrimary, marginBottom: 12 }]}>{t('settings.language')}</Text>
            <FlatList
              data={languageOptions}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const active = setupLanguage === item.value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.setupLanguageOptionRow,
                      { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
                      active && { borderColor: theme.accent },
                    ]}
                    onPress={() => {
                      setSetupLanguage(item.value);
                      setIsLanguageModalOpen(false);
                    }}
                  >
                    <View>
                      <Text style={[styles.setupLanguageOptionTitle, { color: theme.textPrimary }]}>{item.label}</Text>
                      <Text style={[styles.setupLanguageOptionSubtitle, { color: theme.textSecondary }]}>{item.nativeLabel}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
            <TouchableOpacity style={styles.setupCancelButtonRow} onPress={() => setIsLanguageModalOpen(false)}>
              <Text style={{ color: theme.textPrimary, fontSize: 15 }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isRegionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRegionModalOpen(false)}
      >
        <View style={styles.setupModalOverlay}>
          <View style={[styles.setupLanguageModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.setupSectionTitle, { color: theme.textPrimary, marginBottom: 12 }]}>{t('settings.region')}</Text>
            <FlatList
              data={['auto', ...Object.keys(regionUrlMap)]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const active = setupRegion === item;
                const label = item === 'auto' ? t('settings.auto') : item;
                return (
                  <TouchableOpacity
                    style={[
                      styles.setupLanguageOptionRow,
                      { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
                      active && { borderColor: theme.accent },
                    ]}
                    onPress={() => {
                      setSetupRegion(item);
                      setIsRegionModalOpen(false);
                    }}
                  >
                    <Text style={[styles.setupLanguageOptionTitle, { color: theme.textPrimary }]}>{label}</Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
            <TouchableOpacity style={styles.setupCancelButtonRow} onPress={() => setIsRegionModalOpen(false)}>
              <Text style={{ color: theme.textPrimary, fontSize: 15 }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isHomeRegionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsHomeRegionModalOpen(false)}
      >
        <View style={styles.setupModalOverlay}>
          <View style={[styles.setupLanguageModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.setupSectionTitle, { color: theme.textPrimary, marginBottom: 12 }]}>{t('settings.region')}</Text>
            <FlatList
              data={['auto', ...Object.keys(regionUrlMap)]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const active = regionOverride === item;
                const label = item === 'auto' ? t('settings.auto') : item;
                return (
                  <TouchableOpacity
                    style={[
                      styles.setupLanguageOptionRow,
                      { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
                      active && { borderColor: theme.accent },
                    ]}
                    onPress={() => {
                      handleRegionChange(item);
                      setIsHomeRegionModalOpen(false);
                    }}
                  >
                    <Text style={[styles.setupLanguageOptionTitle, { color: theme.textPrimary }]}>{label}</Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
            <TouchableOpacity style={styles.setupCancelButtonRow} onPress={() => setIsHomeRegionModalOpen(false)}>
              <Text style={{ color: theme.textPrimary, fontSize: 15 }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    paddingTop: 10,
    flex: 1,
  },
  setupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  setupCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  setupTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  setupSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  setupSectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '700',
  },
  setupWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  setupChip: {
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  setupChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  setupRow: {
    flexDirection: 'row',
    gap: 8,
  },
  setupSegment: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  setupSegmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  setupDropdownButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setupDropdownButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  setupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  setupLanguageModalCard: {
    width: '88%',
    maxHeight: '70%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  setupLanguageOptionRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setupLanguageOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  setupLanguageOptionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  setupCancelButtonRow: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  setupContinueButton: {
    marginTop: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  setupContinueText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 22,
  },
  emptyBox: {
    marginHorizontal: 16,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
  },
});
