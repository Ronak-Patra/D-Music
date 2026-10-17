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
const REGION_URL_MAP_KEY = 'openspot_region_url_map_v2';
const REGION_URL_MAP_TIMESTAMP_KEY = 'openspot_region_url_map_ts_v2';
const REGION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TRENDING_TRACKS_CACHE_KEY = 'TRENDING_TRACKS_CACHE_V2';
const REGION_OVERRIDE_KEY = 'openspot_region_override_v1';
const LANGUAGE_KEY = 'openspot_language_v1';
const FIRST_RUN_SETUP_KEY = 'openspot_first_run_setup_done_v1';
const TRENDING_ENABLED_KEY = 'openspot_trending_enabled_v1';

const INDIAN_LANGUAGES = [
  'hindi', 'punjabi', 'tamil', 'telugu', 'marathi', 'bhojpuri',
  'bengali', 'malayalam', 'kannada', 'haryanvi', 'gujarati', 'rajasthani',
  'urdu', 'odia', 'assamese'
];

const DEFAULT_REGION_MAP: Record<string, string> = {
  Global: 'https://kworb.net/spotify/country/global_weekly.html',
  'United States': 'https://kworb.net/spotify/country/us_weekly.html',
  'United Kingdom': 'https://kworb.net/spotify/country/gb_weekly.html',
  India: 'https://kworb.net/spotify/country/in_weekly.html',
  Canada: 'https://kworb.net/spotify/country/ca_weekly.html',
  Australia: 'https://kworb.net/spotify/country/au_weekly.html',
  Germany: 'https://kworb.net/spotify/country/de_weekly.html',
  France: 'https://kworb.net/spotify/country/fr_weekly.html',
  Japan: 'https://kworb.net/spotify/country/jp_weekly.html',
  Brazil: 'https://kworb.net/spotify/country/br_weekly.html',
};

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
  const [regionUrlMap, setRegionUrlMap] = useState<Record<string, string>>(DEFAULT_REGION_MAP);
  const [trendingCache, setTrendingCache] = useState<Record<string, Track>>({});
  const [recentlyPlayedTracks, setRecentlyPlayedTracks] = useState<Track[]>([]);
  const [recentlyPlayedPlaylists, setRecentlyPlayedPlaylists] = useState<any[]>([]);
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

  const [randomTracks, setRandomTracks] = useState<Track[]>([]);
  const [isRandomLoading, setIsRandomLoading] = useState(false);

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
        let parsedMap: Record<string, string> = DEFAULT_REGION_MAP;
        if (mapStr) {
          try {
            const m = JSON.parse(mapStr);
            if (m && Object.keys(m).length > 0) {
              parsedMap = { ...DEFAULT_REGION_MAP, ...m };
              setRegionUrlMap(parsedMap);
            }
          } catch {}
        }
        if (!done) setShowFirstRunSetup(true);
        if (stored !== null) setTrendingEnabled(stored === 'true');
        if (storedRegion && storedRegion.trim()) setRegionOverride(storedRegion);

        const isStale = !timestamp || Date.now() - parseInt(timestamp, 10) > REGION_CACHE_TTL_MS || Object.keys(parsedMap).length <= Object.keys(DEFAULT_REGION_MAP).length;
        if (isStale) {
          try {
            const res = await fetch(KWORD_URL);
            const html = await res.text();
            const freshMap: Record<string, string> = { ...DEFAULT_REGION_MAP };
            const regex = /<tr><td class="mp text">([^<]+)<\/td>\s*<td class="mp text">[\s\S]*?<a href="([^"]+)">Weekly<\/a>/g;
            let match;
            while ((match = regex.exec(html)) !== null) {
              const name = match[1].trim();
              freshMap[name] = `https://kworb.net/spotify/${match[2]}`;
            }
            setRegionUrlMap(freshMap);
            await AsyncStorage.setItem(REGION_URL_MAP_KEY, JSON.stringify(freshMap));
            await AsyncStorage.setItem(REGION_URL_MAP_TIMESTAMP_KEY, Date.now().toString());
          } catch (e) {
            console.error('Failed to load fresh kworb region map:', e);
          }
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
          const isStale = !timestamp || Date.now() - parseInt(timestamp, 10) > REGION_CACHE_TTL_MS || Object.keys(regionUrlMap).length <= Object.keys(DEFAULT_REGION_MAP).length;
          if (!isStale) return;

          const res = await fetch(KWORD_URL);
          const html = await res.text();
          const map: Record<string, string> = { ...DEFAULT_REGION_MAP };
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

  const fetchRecommendations = async (recentTracks: Track[]) => {
    if (isFetchingRecommendations || !recentTracks || recentTracks.length === 0) return;
    setIsFetchingRecommendations(true);
    try {
      // Gather top distinct artists from up to 10 recently played songs
      const last10 = recentTracks.slice(0, 10);
      const uniqueArtists = Array.from(
        new Set(
          last10
            .map(t => t.artist?.split(',')[0]?.split('&')[0]?.trim())
            .filter(Boolean)
        )
      ).slice(0, 4);

      const playedSignatures = new Set(
        last10.map(t => `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`)
      );
      const playedIds = new Set(last10.map(t => t.id?.toString()));

      const fetchQueries = uniqueArtists.map(artist =>
        MusicAPI.searchTracks(`${artist} songs`, 1, 6)
          .then(res => res.tracks || [])
          .catch(() => [] as Track[])
      );

      const results = await Promise.all(fetchQueries);
      const allFound = results.flat();

      const seen = new Set<string>();
      const deduped: Track[] = [];

      for (const t of allFound) {
        const key = `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`;
        const idKey = t.id?.toString();
        if (playedSignatures.has(key) || (idKey && playedIds.has(idKey)) || seen.has(key)) continue;
        seen.add(key);
        if (idKey) seen.add(idKey);
        deduped.push(t);
      }

      if (deduped.length > 0) {
        setRecommendedTracks(deduped);
      }
    } catch (e) {
      console.error('Failed to fetch recommendations:', e);
    } finally {
      setIsFetchingRecommendations(false);
    }
  };

  const loadRecentlyPlayed = React.useCallback(async () => {
    try {
      const [recentSongs, recentPlaylists] = await Promise.all([
        MusicAPI.getRecentlyPlayed(),
        MusicAPI.getRecentlyPlayedPlaylists(),
      ]);
      setRecentlyPlayedTracks(recentSongs);
      setRecentlyPlayedPlaylists(recentPlaylists);
      if (recentSongs && recentSongs.length > 0) {
        fetchRecommendations(recentSongs);
      }
    } catch (error) {
      console.error('Failed to load recently played tracks & playlists:', error);
      setRecentlyPlayedTracks([]);
      setRecentlyPlayedPlaylists([]);
    }
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadRecentlyPlayed();
    setRefreshing(false);
  }, [loadRecentlyPlayed]);

  useEffect(() => {
    void loadRecentlyPlayed();
  }, [loadRecentlyPlayed, currentTrack]);

  useFocusEffect(
    React.useCallback(() => {
      void loadRecentlyPlayed();
    }, [loadRecentlyPlayed])
  );

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

  // Helper to map region/sub-region/genre into refined search keywords
  const getSearchTermForFilters = (targetType: 'trending' | 'new' | 'random') => {
    let term = '';

    if (activeRegion === 'Anime') {
      term += 'Anime Japanese OST ';
    } else if (subRegion) {
      term += `${subRegion} `;
    } else if (activeRegion && activeRegion === 'India') {
      term += 'Hindi ';
    } else if (activeRegion && activeRegion !== 'your country') {
      term += 'English ';
    }

    if (musicStyle) {
      term += `${musicStyle} `;
    }

    if (targetType === 'new') {
      term += `Latest songs ${new Date().getFullYear()}`;
    } else if (targetType === 'random') {
      term += 'hits tracks songs';
    } else {
      term += 'top songs';
    }

    return term.trim();
  };

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
          const cachedTrack = cache[entry];
          if (activeRegion === 'India') {
            const lang = (cachedTrack.genre || (cachedTrack as any).language || '').toLowerCase().trim();
            if (lang === 'english' || lang === 'international') continue;
          } else if (activeRegion && activeRegion !== 'your country') {
            const lang = (cachedTrack.genre || (cachedTrack as any).language || '').toLowerCase().trim();
            if (INDIAN_LANGUAGES.includes(lang)) continue;
          }
          tracks.push(cachedTrack);
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
              const validTrack = res.tracks.find(t => {
                if (MusicAPI.isPodcastOrNonMusic(t)) return false;
                if (activeRegion === 'India') {
                  const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
                  if (lang === 'english' || lang === 'international') return false;
                } else if (activeRegion && activeRegion !== 'your country') {
                  const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
                  if (INDIAN_LANGUAGES.includes(lang)) return false;
                }
                return true;
              });

              if (validTrack) {
                cache[entry] = validTrack;
                tracks.push(validTrack);
                cacheChanged = true;

                if (isMounted) {
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
          const artist = match[1].trim();
          const title = match[2].trim();
          searchQueries.push(`${artist} ${title}`);
        }
        if (searchQueries.length > 0) {
          fetchTrendingTracks(searchQueries.slice(0, 50));
        } else if (activeRegion !== 'India' && activeRegion !== 'your country') {
          const intlSongs = await MusicAPI.getPlaylistSongs('1134595537').catch(() => []);
          if (isMounted) {
            const valid = intlSongs.filter(t => !MusicAPI.isPodcastOrNonMusic(t) && !INDIAN_LANGUAGES.includes((t.genre || (t as any).language || '').toLowerCase().trim()));
            setTrendingTracks(valid);
          }
        }
      } catch (e) {
        console.error('Failed to fetch kworb weekly chart:', e);
        if (activeRegion !== 'India' && activeRegion !== 'your country') {
          try {
            const intlSongs = await MusicAPI.getPlaylistSongs('1134595537');
            if (isMounted) {
              const valid = intlSongs.filter(t => !MusicAPI.isPodcastOrNonMusic(t) && !INDIAN_LANGUAGES.includes((t.genre || (t as any).language || '').toLowerCase().trim()));
              setTrendingTracks(valid);
            }
          } catch {
            if (isMounted) setTrendingTracks([]);
          }
        } else {
          if (isMounted) setTrendingTracks([]);
        }
      }
    };

    if (!countryLoading && activeRegion && activeRegion !== 'your country') {
      const hasSpecificFilter = !!musicStyle || !!subRegion || activeRegion === 'Anime';
      setIsTrendingLoading(true);

      if (hasSpecificFilter) {
        const fetchStyleOrRegion = async () => {
          // Direct official JioSaavn Top 50 Chart IDs for every language
          const OFFICIAL_LANGUAGE_CHARTS: Record<string, string> = {
            hindi: '1134543272',       // Hindi: India Superhits Top 50 (Official JioSaavn Chart)
            punjabi: '1134543511',     // Punjabi: India Superhits Top 50 (Official JioSaavn Chart)
            tamil: '1134651042',       // Tamil: India Superhits Top 50 (Official JioSaavn Chart)
            telugu: '1134643225',      // Telugu: India Superhits Top 50 (Official JioSaavn Chart)
            marathi: '1134710071',     // Marathi: India Superhits Top 50 (Official JioSaavn Chart)
            bhojpuri: '1134768973',    // Bhojpuri: India Superhits Top 50 (Official JioSaavn Chart)
            bengali: '1134638573',     // Bengali: India Superhits Top 50 (Official JioSaavn Chart)
            malayalam: '1134705865',   // Malayalam: India Superhits Top 50 (Official JioSaavn Chart)
            kannada: '1134591169',     // Kannada: India Superhits Top 50 (Official JioSaavn Chart)
            haryanvi: '1134770917',    // Haryanvi: India Superhits Top 50 (Official JioSaavn Chart)
            english: '1134595537',     // International : India Superhits Top 50 (Official JioSaavn Chart)
          };

          // 1. If language filter is selected without genre, load the official verified chart directly
          if (subRegion && !musicStyle) {
            const officialChartId = OFFICIAL_LANGUAGE_CHARTS[subRegion.toLowerCase()];
            if (officialChartId) {
              try {
                const chartTracks = await MusicAPI.getPlaylistSongs(officialChartId);
                if (chartTracks && chartTracks.length > 0) {
                  const validTracks = chartTracks.filter(t => !MusicAPI.isPodcastOrNonMusic(t));
                  if (validTracks.length > 0) {
                    return { tracks: validTracks };
                  }
                }
              } catch (e) {
                console.warn(`Failed to fetch official chart for ${subRegion}:`, e);
              }
            }
          }

          // 2. If genre is selected (with or without language), query curated genre playlists
          let playlistQueries: string[] = [];
          if (musicStyle && subRegion) {
            playlistQueries = [
              `${subRegion} ${musicStyle} Hits`.trim(),
              `${subRegion} ${musicStyle}`.trim(),
              `Best of ${subRegion} ${musicStyle}`.trim(),
              `${musicStyle} ${subRegion}`.trim(),
            ];
          } else if (musicStyle) {
            const langPrefix = activeRegion === 'India' ? 'Hindi' : (activeRegion === 'Anime' ? 'Anime' : 'English');
            playlistQueries = [
              `${langPrefix} ${musicStyle} Hits`.trim(),
              `Best of ${musicStyle} - ${langPrefix}`.trim(),
              `${musicStyle} - ${langPrefix}`.trim(),
              `International ${musicStyle}`.trim(),
              `${musicStyle} Hits`,
            ];
          } else if (activeRegion === 'Anime') {
            playlistQueries = [
              'Anime Hits',
              'Best Anime Songs',
              'Anime Japanese OST',
            ];
          }

          for (const pq of playlistQueries) {
            try {
              const plRes = await MusicAPI.searchPlaylists(pq, 1, 5);
              if (plRes.playlists && plRes.playlists.length > 0) {
                for (const pl of plRes.playlists) {
                  try {
                    const plTracks = await MusicAPI.getPlaylistSongs(pl.id);
                    if (plTracks && plTracks.length > 0) {
                      const validTracks = plTracks.filter(t => {
                        if (MusicAPI.isPodcastOrNonMusic(t)) return false;
                        if (activeRegion === 'India') {
                          const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
                          if (lang === 'english' || lang === 'international') return false;
                        } else if (activeRegion && activeRegion !== 'your country') {
                          const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
                          if (INDIAN_LANGUAGES.includes(lang)) return false;
                        }
                        return true;
                      });
                      if (validTracks.length > 0) {
                        return { tracks: validTracks };
                      }
                    }
                  } catch {}
                }
              }
            } catch {}
          }

          // Fallback to track search
          const queryName = getSearchTermForFilters('trending');
          try {
            const res = await MusicAPI.searchTracks(queryName, 1, 30);
            if (res.tracks && res.tracks.length > 0) {
              const validTracks = res.tracks.filter(t => {
                if (MusicAPI.isPodcastOrNonMusic(t)) return false;
                if (activeRegion === 'India') {
                  const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
                  if (lang === 'english' || lang === 'international') return false;
                } else if (activeRegion && activeRegion !== 'your country') {
                  const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
                  if (INDIAN_LANGUAGES.includes(lang)) return false;
                }
                return true;
              });
              if (validTracks.length > 0) {
                return { tracks: validTracks };
              }
            }
          } catch (e) {
            console.warn('Track search failed', e);
          }

          // Fallback to official language chart if subRegion is specified
          if (subRegion) {
            const officialChartId = OFFICIAL_LANGUAGE_CHARTS[subRegion.toLowerCase()];
            if (officialChartId) {
              try {
                const chartTracks = await MusicAPI.getPlaylistSongs(officialChartId);
                if (chartTracks && chartTracks.length > 0) {
                  const validTracks = chartTracks.filter(t => !MusicAPI.isPodcastOrNonMusic(t));
                  if (validTracks.length > 0) {
                    return { tracks: validTracks };
                  }
                }
              } catch {}
            }

            try {
              const relTracks = await MusicAPI.getNewReleases(subRegion.toLowerCase(), 30);
              if (relTracks && relTracks.length > 0) {
                return { tracks: relTracks };
              }
            } catch {}
          }

          return { tracks: [] };
        };
        
        fetchStyleOrRegion()
          .then(res => {
            if (isMounted) {
              const seen = new Set<string>();
              const dedupedTracks = (res?.tracks || []).filter(t => {
                if (!t || MusicAPI.isPodcastOrNonMusic(t)) return false;
                if (activeRegion === 'India') {
                  const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
                  if (lang === 'english' || lang === 'international') return false;
                } else if (activeRegion && activeRegion !== 'your country') {
                  const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
                  if (INDIAN_LANGUAGES.includes(lang)) return false;
                }
                const key = `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`;
                const idKey = String(t.id || key);
                if (seen.has(key) || seen.has(idKey)) return false;
                seen.add(key);
                seen.add(idKey);
                return true;
              });
              setTrendingTracks(dedupedTracks);
            }
          })
          .catch(err => {
            console.error('Error fetching filtered tracks:', err);
            if (isMounted) setTrendingTracks([]);
          })
          .finally(() => {
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
            if (activeRegion !== 'India' && activeRegion !== 'your country') {
              MusicAPI.getPlaylistSongs('1134595537').then(intlTracks => {
                if (isMounted) {
                  const validTracks = (intlTracks || []).filter(t => !MusicAPI.isPodcastOrNonMusic(t) && !INDIAN_LANGUAGES.includes((t.genre || (t as any).language || '').toLowerCase().trim()));
                  setTrendingTracks(validTracks);
                }
              }).catch(() => {
                if (isMounted) setTrendingTracks([]);
              }).finally(() => {
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
      }
    } else {
      if (isMounted) {
        setTrendingTracks([]);
        setIsTrendingLoading(false);
      }
    }
    
    const fetchNewReleases = async () => {
      if (countryLoading || !activeRegion) return;
      let langParam = 'hindi';
      if (activeRegion === 'India') {
        langParam = subRegion ? `${subRegion}` : 'hindi';
      } else if (activeRegion === 'Anime') {
        langParam = 'japanese,english';
      } else if (activeRegion && activeRegion !== 'your country') {
        langParam = 'english';
      }

      try {
        let candidateTracks: Track[] = [];

        if (musicStyle) {
          // If genre is selected, search curated new releases playlists and albums for that genre
          const langPrefix = subRegion ? subRegion : (activeRegion === 'India' ? 'Hindi' : (activeRegion === 'Anime' ? 'Anime' : 'English'));
          const genreNewQueries = [
            `New ${langPrefix} ${musicStyle}`.trim(),
            `Latest ${langPrefix} ${musicStyle}`.trim(),
            `${langPrefix} ${musicStyle} Hits`.trim(),
            `International ${musicStyle}`.trim(),
            `${musicStyle} - ${langPrefix}`.trim(),
          ];
          for (const gq of genreNewQueries) {
            try {
              const plRes = await MusicAPI.searchPlaylists(gq, 1, 3);
              if (plRes.playlists && plRes.playlists.length > 0) {
                for (const pl of plRes.playlists) {
                  // Fetch actual songs from playlist
                  const songs = await MusicAPI.getPlaylistSongs(pl.id);
                  if (songs && songs.length > 0) {
                    const validSongs = songs.filter(s => {
                      if (MusicAPI.isPodcastOrNonMusic(s)) return false;
                      if (activeRegion === 'India') {
                        const lang = (s.genre || (s as any).language || '').toLowerCase().trim();
                        if (lang === 'english' || lang === 'international') return false;
                      } else if (activeRegion && activeRegion !== 'your country') {
                        const lang = (s.genre || (s as any).language || '').toLowerCase().trim();
                        if (INDIAN_LANGUAGES.includes(lang)) return false;
                      }
                      return true;
                    });
                    if (validSongs.length > 0) {
                      candidateTracks.push(...validSongs);
                      break;
                    }
                  }
                }
                if (candidateTracks.length >= 15) break;
              }
            } catch {}
          }
          const albumNewTracks = await MusicAPI.getNewReleases(langParam, 40, musicStyle).catch(() => []);
          candidateTracks.push(...albumNewTracks);
        } else {
          // Standard official label new releases
          if (activeRegion !== 'India' && activeRegion !== 'your country') {
            try {
              const intlPlTracks = await MusicAPI.getPlaylistSongs('1302090358'); // Chartbusters 2026 - International
              if (intlPlTracks && intlPlTracks.length > 0) {
                candidateTracks.push(...intlPlTracks);
              }
            } catch {}
          }
          const albumNewTracks = await MusicAPI.getNewReleases(langParam, 50).catch(() => []);
          candidateTracks.push(...albumNewTracks);
        }

        if (!candidateTracks || candidateTracks.length === 0) {
          if (activeRegion !== 'India' && activeRegion !== 'your country') {
            const fallbackIntl = await MusicAPI.getPlaylistSongs('1134595537').catch(() => []);
            candidateTracks = fallbackIntl;
          } else {
            const primaryLang = langParam.split(',')[0].trim();
            const fallbackRes = await MusicAPI.searchTracks(`Latest ${primaryLang} songs ${new Date().getFullYear()}`, 1, 30).catch(() => ({ tracks: [] }));
            candidateTracks = fallbackRes.tracks || [];
          }
        }

        if (isMounted && candidateTracks.length > 0) {
          const now = new Date();
          // Strictly within the last 18 months
          const minTimestamp = new Date(now.getFullYear(), now.getMonth() - 18, 1).getTime();

          const parseReleaseTimestamp = (dateStr?: string): number => {
            if (!dateStr) return 0;
            let parsed = new Date(dateStr).getTime();
            if (!isNaN(parsed)) return parsed;
            const dmyMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
            if (dmyMatch) {
              const [, day, month, year] = dmyMatch;
              parsed = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).getTime();
              if (!isNaN(parsed)) return parsed;
            }
            if (/^\d{4}$/.test(dateStr)) {
              return new Date(`${dateStr}-01-01`).getTime();
            }
            return 0;
          };

          const seen = new Set<string>();
          const dedupedTracks = candidateTracks.filter(t => {
            if (MusicAPI.isPodcastOrNonMusic(t)) return false;
            // Strictly exclude Hollywood / English tracks when in India Region
            if (activeRegion === 'India') {
              const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
              if (lang === 'english' || lang === 'international') return false;
            } else if (activeRegion && activeRegion !== 'your country') {
              const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
              if (INDIAN_LANGUAGES.includes(lang)) return false;
            }
            const key = `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`;
            const idKey = String(t.id || key);
            if (seen.has(key) || seen.has(idKey)) return false;
            seen.add(key);
            seen.add(idKey);
            return true;
          });

          // Filter strictly: must have a valid recent release date and strictly exclude any podcast/episode
          let validDatedTracks = dedupedTracks.filter(t => {
            const ts = parseReleaseTimestamp(t.releaseDate);
            return ts >= minTimestamp && !MusicAPI.isPodcastOrNonMusic(t);
          });

          // Fallback if strict 18-month date filtering leaves too few tracks
          if (validDatedTracks.length < 5) {
            validDatedTracks = dedupedTracks.filter(t => !MusicAPI.isPodcastOrNonMusic(t));
          }

          // Sort strictly newest-released first by timestamp across the whole row
          const sortedTracks = [...validDatedTracks].sort((a, b) => {
            const timeA = parseReleaseTimestamp(a.releaseDate);
            const timeB = parseReleaseTimestamp(b.releaseDate);
            return timeB - timeA;
          });

          setNewReleasesTracks(sortedTracks);
        }
      } catch (e) {
        console.error('Failed to fetch new releases', e);
      }
    };

    const fetchRandomTracks = async () => {
      if (countryLoading || !activeRegion) return;
      setIsRandomLoading(true);
      try {
        let tracks: Track[] = [];
        if (musicStyle) {
          const langPrefix = subRegion ? subRegion : (activeRegion === 'India' ? 'Hindi' : (activeRegion === 'Anime' ? 'Anime' : 'English'));
          const plRes = await MusicAPI.searchPlaylists(`${langPrefix} ${musicStyle}`.trim(), 1, 3).catch(() => ({ playlists: [] }));
          if (plRes.playlists && plRes.playlists.length > 0) {
            const targetPl = plRes.playlists[Math.floor(Math.random() * plRes.playlists.length)];
            const plSongs = await MusicAPI.getPlaylistSongs(targetPl.id).catch(() => []);
            tracks = plSongs.filter(t => {
              if (MusicAPI.isPodcastOrNonMusic(t)) return false;
              if (activeRegion === 'India') {
                const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
                if (lang === 'english' || lang === 'international') return false;
              } else if (activeRegion && activeRegion !== 'your country') {
                const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
                if (INDIAN_LANGUAGES.includes(lang)) return false;
              }
              return true;
            });
          }
        }

        if (tracks.length === 0) {
          const queryName = getSearchTermForFilters('random');
          const randomPage = Math.floor(Math.random() * 3) + 1;
          const res = await MusicAPI.searchTracks(queryName, randomPage, 30).catch(() => ({ tracks: [] }));
          tracks = (res.tracks || []).filter(t => {
            if (MusicAPI.isPodcastOrNonMusic(t)) return false;
            if (activeRegion === 'India') {
              const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
              if (lang === 'english' || lang === 'international') return false;
            } else if (activeRegion && activeRegion !== 'your country') {
              const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
              if (INDIAN_LANGUAGES.includes(lang)) return false;
            }
            return true;
          });
        }
        if (isMounted && tracks.length > 0) {
          // Shuffle tracks randomly
          const shuffled = [...tracks].sort(() => Math.random() - 0.5);
          const seen = new Set<string>();
          const dedupedTracks = shuffled.filter(t => {
            if (activeRegion === 'India') {
              const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
              if (lang === 'english' || lang === 'international') return false;
            } else if (activeRegion && activeRegion !== 'your country') {
              const lang = (t.genre || (t as any).language || '').toLowerCase().trim();
              if (INDIAN_LANGUAGES.includes(lang)) return false;
            }
            const key = `${t.title?.toLowerCase().trim()}|${t.artist?.toLowerCase().trim()}`;
            const idKey = t.id.toString();
            if (seen.has(key) || seen.has(idKey)) return false;
            seen.add(key);
            seen.add(idKey);
            return true;
          });
          setRandomTracks(dedupedTracks);
        }
      } catch (e) {
        console.error('Failed to fetch random tracks', e);
      } finally {
        if (isMounted) setIsRandomLoading(false);
      }
    };
    
    if (activeRegion) {
      void fetchNewReleases();
      void fetchRandomTracks();
    }

    return () => { isMounted = false; };
  }, [activeRegion, subRegion, musicStyle, countryLoading, regionUrlMap, trendingCache]);

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener('tabPress', (e: any) => {
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
                  {['Pop', 'Hip Hop', 'Rock', 'Anime', 'Acoustic', 'Devotional', 'Classical', 'Lofi'].map((style) => (
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

            {randomTracks.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <SectionHeader title="Discover Random" />
                <HorizontalTrackList
                  title=""
                  tracks={randomTracks}
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
                <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="time-outline" size={32} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('home.no_recent') || t('home.empty_recent')}</Text>
                </View>
              )}
            </View>

            <View style={{ marginTop: 16 }}>
              <SectionHeader title={t('home.continue_listening_playlists') || 'Continue Listening Playlists'} />
              {recentlyPlayedPlaylists.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: 16, paddingRight: 8, paddingBottom: 8 }}
                >
                  {recentlyPlayedPlaylists.slice(0, 5).map((pl: any) => {
                    const rawImage = MusicAPI.getOptimalImage(pl.image || pl.images);
                    const plImage = (rawImage && !rawImage.includes('placeholder.com')) ? rawImage : '';
                    return (
                      <View key={pl.id} style={{ marginRight: 16 }}>
                        <TouchableOpacity
                          style={{
                            width: 156,
                            height: 212,
                            backgroundColor: isDark ? '#181818' : '#fffaf2',
                            borderColor: isDark ? '#232323' : '#e4d5c5',
                            borderWidth: 1,
                            borderRadius: 18,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.25,
                            shadowRadius: 10,
                            elevation: 8,
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                          }}
                          activeOpacity={0.85}
                          onPress={() => router.push(`/media/playlist/${pl.id}`)}
                        >
                          <View
                            style={{
                              width: 132,
                              height: 132,
                              borderRadius: 16,
                              overflow: 'hidden',
                              marginTop: 8,
                              marginBottom: 8,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isDark ? '#282828' : '#e8decb',
                            }}
                          >
                            {plImage ? (
                              <Image
                                source={{ uri: plImage }}
                                style={{ width: 132, height: 132, borderRadius: 16 }}
                                contentFit="cover"
                              />
                            ) : (
                              <View
                                style={{
                                  width: 132,
                                  height: 132,
                                  borderRadius: 16,
                                  backgroundColor: isDark ? '#2a2a2a' : '#dfd2c0',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Ionicons name="musical-notes" size={44} color={isDark ? '#666' : '#a89480'} />
                              </View>
                            )}
                            <View
                              style={{
                                position: 'absolute',
                                bottom: 6,
                                right: 6,
                                backgroundColor: isDark ? '#1DB954' : '#167c3a',
                                borderRadius: 20,
                                width: 36,
                                height: 36,
                                alignItems: 'center',
                                justifyContent: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.25,
                                shadowRadius: 4,
                                elevation: 4,
                              }}
                            >
                              <Ionicons name="play" size={20} color="#fff" style={{ marginLeft: 2 }} />
                            </View>
                          </View>
                          <View
                            style={{
                              alignItems: 'flex-start',
                              width: '100%',
                              paddingHorizontal: 10,
                              marginTop: 2,
                              paddingBottom: 10,
                              minHeight: 56,
                              justifyContent: 'flex-start',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: isDark ? '#fff' : '#2d2219',
                                marginBottom: 3,
                              }}
                              numberOfLines={2}
                            >
                              {pl.name || pl.title || 'Playlist'}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                color: isDark ? '#888' : '#7a6251',
                                lineHeight: 16,
                              }}
                              numberOfLines={1}
                            >
                              {pl.songCount ? `${pl.songCount} songs` : 'Playlist'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="albums-outline" size={32} color={theme.textSecondary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    {t('home.no_recent_playlists') || 'No played playlists found'}
                  </Text>
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
              data={['auto', 'Anime', ...Object.keys(regionUrlMap)]}
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
