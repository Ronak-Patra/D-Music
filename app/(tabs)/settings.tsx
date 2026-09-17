import React, { useCallback, useEffect, useMemo, useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Share,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useConnectivity } from '@/hooks/useConnectivity';
import { MusicPlayerContext } from '@/contexts/MusicPlayerContext';

import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeMode, useThemeMode } from '@/hooks/theme-mode';
import { useApiStatus } from '@/hooks/useApiStatus';
import { useToast } from '@/hooks/useToast';
const CURRENT_VERSION = '3.1.5';
const LINKEDIN_URL = 'https://www.linkedin.com/in/jash-gro/';
const TELEGRAM_URL = 'https://telegram.dog/deveIoper_x';
const INSTAGRAM_URL = 'https://www.instagram.com/jash_gro/';
const YOUTUBE_URL = 'https://www.youtube.com/@nerdsClub';
const TWITTER_URL = 'https://twitter.com/jash_gro';
const GITHUB_URL = 'https://github.com/BlackHatDevX';
const UPDATE_CONFIG_URL = 'https://raw.githubusercontent.com/BlackHatDevX/openspot-config/refs/heads/main/update-mobile.json';
const KWORD_URL = 'https://kworb.net/spotify/';
const REGION_OVERRIDE_KEY = 'openspot_region_override_v1';
const REGION_URL_MAP_KEY = 'openspot_region_url_map_v1';
const REGION_URL_MAP_TIMESTAMP_KEY = 'openspot_region_url_map_ts_v1';
const REGION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LANGUAGE_KEY = 'openspot_language_v1';
const PROVIDER_KEY = 'openspot_provider_v1';
const TRENDING_ENABLED_KEY = 'openspot_trending_enabled_v1';
const ROTATING_COVER_KEY = 'openspot_rotating_cover_v1';
const GESTURES_ENABLED_KEY = 'openspot_gestures_enabled_v1';
import { DeviceEventEmitter } from 'react-native';

interface PlatformUpdateConfig {
  latest_version: string;
  min_supported_version: string;
  force_update: boolean;
  changelog: Record<string, string[]>;
  release_url: string;
}

interface UpdateConfig {
  android: PlatformUpdateConfig;
  ios: PlatformUpdateConfig;
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const { mode, setMode } = useThemeMode();
  const { t, i18n } = useTranslation();

  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [region, setRegion] = useState<string>('auto');
  const [regionOptions, setRegionOptions] = useState<string[]>(['auto']);
  const [language, setLanguage] = useState<string>('en');
  const [provider, setProvider] = useState<string>('saavn');
  const [trendingEnabled, setTrendingEnabled] = useState<boolean>(true);
  const [rotatingCover, setRotatingCover] = useState<boolean>(true);
  const [gesturesEnabled, setGesturesEnabled] = useState<boolean>(true);
  const { dynamicColorsEnabled, toggleDynamicColors } = useContext(MusicPlayerContext);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [updateConfig, setUpdateConfig] = useState<UpdateConfig | null>(null);
  const [showForceUpdate, setShowForceUpdate] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showBetaWarning, setShowBetaWarning] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const { isProviderDisabled } = useApiStatus();
  const { toastMessage, toastType, showToast } = useToast();

  const currentVersion = Constants.expoConfig?.version ?? CURRENT_VERSION;

  const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const a = parts1[i] || 0;
      const b = parts2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  };

  const platformUpdateConfig = updateConfig
    ? (Platform.OS === 'ios' ? updateConfig.ios : updateConfig.android)
    : null;

  const isVersionSupported = platformUpdateConfig
    ? compareVersions(currentVersion, platformUpdateConfig.min_supported_version) >= 0
    : true;

  const updateAvailable = platformUpdateConfig
    ? compareVersions(platformUpdateConfig.latest_version, currentVersion) > 0
    : false;

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

  const modeOptions: { label: string; value: ThemeMode }[] = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'Auto', value: 'auto' },
  ];

  const languageOptions: { label: string; value: string; nativeLabel: string }[] = [
    { label: 'English', value: 'en', nativeLabel: 'English' },
    { label: 'Hindi', value: 'hi', nativeLabel: 'हिन्दी' },
    { label: 'Bengali', value: 'bn', nativeLabel: 'বাংলা' },
    { label: 'Punjabi', value: 'pa', nativeLabel: 'ਪੰਜਾਬੀ' },
    { label: 'Marathi', value: 'mr', nativeLabel: 'मराठी' },
    { label: 'Gujarati', value: 'gu', nativeLabel: 'ગુજરાતી' },
    { label: 'Tamil', value: 'ta', nativeLabel: 'தமிழ்' },
    { label: 'Telugu', value: 'te', nativeLabel: 'తెలుగు' },
    { label: 'Kannada', value: 'kn', nativeLabel: 'ಕನ್ನಡ' },
    { label: 'Malayalam', value: 'ml', nativeLabel: 'മലയാളം' },
    { label: 'Odia', value: 'or', nativeLabel: 'ଓଡ଼ିଆ' },
    { label: 'Assamese', value: 'as', nativeLabel: 'অসমীয়া' },
    { label: 'Urdu', value: 'ur', nativeLabel: 'اردو' },
    { label: 'Nepali', value: 'ne', nativeLabel: 'नेपाली' },
    { label: 'Sanskrit', value: 'sa', nativeLabel: 'संस्कृतम्' },
    { label: 'Spanish', value: 'es', nativeLabel: 'Español' },
    { label: 'Chinese', value: 'zh', nativeLabel: '中文' },
    { label: 'German', value: 'de', nativeLabel: 'Deutsch' },
    { label: 'French', value: 'fr', nativeLabel: 'Français' },
    { label: 'Russian', value: 'ru', nativeLabel: 'Русский' },
    { label: 'Hebrew', value: 'he', nativeLabel: 'עברית' },
    { label: 'Turkish', value: 'tr', nativeLabel: 'Türkçe' },
    { label: 'Korean', value: 'ko', nativeLabel: '한국어' },
  ];

  const providerOptions: { label: string; value: string }[] = [
    { label: 'Saavn', value: 'saavn' },
    { label: 'YouTube (Beta)', value: 'ytmusic' },
  ];

  const loadRegionOptions = async () => {
    try {
      const response = await fetch(KWORD_URL);
      const html = await response.text();
      const regionMap: Record<string, string> = {};
      const regex = /<tr><td class="mp text">([^<]+)<\/td>\s*<td class="mp text">[\s\S]*?<a href="([^"]+)">Weekly<\/a>/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        const name = match[1].trim();
        const url = `https://kworb.net/spotify/${match[2]}`;
        regionMap[name] = url;
      }
      await AsyncStorage.setItem(REGION_URL_MAP_KEY, JSON.stringify(regionMap));
      await AsyncStorage.setItem(REGION_URL_MAP_TIMESTAMP_KEY, Date.now().toString());
      const mergedOptions = ['auto', ...Object.keys(regionMap)];
      setRegionOptions(mergedOptions);
      setRegion((current) => (mergedOptions.includes(current) ? current : 'auto'));
    } catch (error) {
      console.error('Failed to load supported regions:', error);
    }
  };

  const checkForUpdates = useCallback(async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await fetch(UPDATE_CONFIG_URL);
      const data: UpdateConfig = await res.json();
      setUpdateConfig(data);

      const platformConfig = Platform.OS === 'ios' ? data.ios : data.android;
      setLatestVersion(platformConfig.latest_version);

      const isSupported = compareVersions(currentVersion, platformConfig.min_supported_version) >= 0;
      const hasUpdate = compareVersions(platformConfig.latest_version, currentVersion) > 0;

      if (!isSupported || (platformConfig.force_update && hasUpdate)) {
        setShowForceUpdate(true);
      }
    } catch (error) {
      console.error('Update check failed:', error);
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [currentVersion]);

  useEffect(() => {
    let isMounted = true;

    const loadAllSettings = async () => {
      try {
        const [storedRegion, storedLanguage, storedProvider, storedTrending, storedRotating, storedGestures, cachedMap] = await Promise.all([
          AsyncStorage.getItem(REGION_OVERRIDE_KEY),
          AsyncStorage.getItem(LANGUAGE_KEY),
          AsyncStorage.getItem(PROVIDER_KEY),
          AsyncStorage.getItem(TRENDING_ENABLED_KEY),
          AsyncStorage.getItem(ROTATING_COVER_KEY),
          AsyncStorage.getItem(GESTURES_ENABLED_KEY),
          AsyncStorage.getItem(REGION_URL_MAP_KEY),
        ]);

        if (!isMounted) return;

        if (storedRegion && storedRegion.trim()) setRegion(storedRegion);
        if (storedLanguage && storedLanguage.trim()) {
          setLanguage(storedLanguage);
          await i18n.changeLanguage(storedLanguage);
        }
        if (storedProvider && storedProvider.trim()) setProvider(storedProvider);
        if (storedTrending !== null) setTrendingEnabled(storedTrending === 'true');
        if (storedRotating !== null) setRotatingCover(storedRotating === 'true');
        if (storedGestures !== null) setGesturesEnabled(storedGestures === 'true');

        if (cachedMap) {
          const parsed = JSON.parse(cachedMap);
          const merged = ['auto', ...Object.keys(parsed)];
          setRegionOptions(merged);
          setRegion((current) => (merged.includes(current) ? current : 'auto'));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }

      if (isMounted) {
        await refreshRegionOptionsIfStale();
        void checkForUpdates();
      }
    };

    void loadAllSettings();

    return () => {
      isMounted = false;
    };
  }, [i18n, checkForUpdates]);

  const handleRegionChange = async (nextRegion: string) => {
    setRegion(nextRegion);
    try {
      await AsyncStorage.setItem(REGION_OVERRIDE_KEY, nextRegion);
    } catch (error) {
      console.error('Failed to save region setting:', error);
    }
  };

  const refreshRegionOptionsIfStale = async () => {
    try {
      const timestamp = await AsyncStorage.getItem(REGION_URL_MAP_TIMESTAMP_KEY);
      if (!timestamp || Date.now() - parseInt(timestamp, 10) > REGION_CACHE_TTL_MS) {
        await loadRegionOptions();
      }
    } catch {
      await loadRegionOptions();
    }
  };

  const handleLanguageChange = async (nextLanguage: string) => {
    setLanguage(nextLanguage);
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
      await i18n.changeLanguage(nextLanguage);
    } catch (error) {
      console.error('Failed to save language setting:', error);
    }
  };

  const handleProviderChange = async (nextProvider: string) => {
    setProvider(nextProvider);
    try {
      await AsyncStorage.setItem(PROVIDER_KEY, nextProvider);
    } catch (error) {
      console.error('Failed to save provider setting:', error);
    }
  };

  const handleBetaWarningProceed = async () => {
    if (pendingProvider) {
      setProvider(pendingProvider);
      try {
        await AsyncStorage.setItem(PROVIDER_KEY, pendingProvider);
      } catch (error) {
        console.error('Failed to save provider setting:', error);
      }
    }
    setShowBetaWarning(false);
    setPendingProvider(null);
  };

  const handleBetaWarningBack = () => {
    setShowBetaWarning(false);
    setPendingProvider(null);
  };

  const handleTrendingToggle = async (enabled: boolean) => {
    setTrendingEnabled(enabled);
    try {
      await AsyncStorage.setItem(TRENDING_ENABLED_KEY, String(enabled));
    } catch (error) {
      console.error('Failed to save trending setting:', error);
    }
  };

  const handleGesturesToggle = async (enabled: boolean) => {
    setGesturesEnabled(enabled);
    try {
      await AsyncStorage.setItem(GESTURES_ENABLED_KEY, String(enabled));
      DeviceEventEmitter.emit('onGesturesSettingChanged', enabled);
    } catch (error) {
      console.error('Failed to save gestures setting:', error);
    }
  };

  const handleRotatingCoverToggle = async (enabled: boolean) => {
    setRotatingCover(enabled);
    try {
      await AsyncStorage.setItem(ROTATING_COVER_KEY, String(enabled));
    } catch (error) {
      console.error('Failed to save rotating cover setting:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isCheckingUpdate} onRefresh={checkForUpdates} tintColor={theme.accent} />}
      >
        <Text style={[styles.title, { color: theme.textPrimary }]}>{t('settings.settings')}</Text>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{t('settings.theme')}</Text>
          <View style={styles.segmentRow}>
            {modeOptions.map((option) => {
              const active = mode === option.value;
              const label = t(`components.theme_${option.value}`, option.label);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.segmentButton,
                    { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                    active && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}
                  onPress={() => setMode(option.value)}
                >
                  <Text style={[styles.segmentText, { color: active ? '#fff' : theme.textSecondary }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{t('settings.language')}</Text>
          <TouchableOpacity
            style={[styles.dropdownButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
            onPress={() => setIsLanguageModalOpen(true)}
          >
            <Text style={[styles.dropdownButtonText, { color: theme.textPrimary }]}>
              {languageOptions.find((option) => option.value === language)?.label || 'English'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{t('settings.music_provider')}</Text>
          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
            {t('settings.provider_description')}
          </Text>
          <View style={styles.segmentRow}>
            {providerOptions.map((option) => {
              const active = provider === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.segmentButton,
                    { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                    active && { backgroundColor: theme.accent, borderColor: theme.accent },
                  ]}
                  onPress={() => handleProviderChange(option.value)}
                >
                  <Text style={[styles.segmentText, { color: active ? '#fff' : theme.textSecondary }]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 2 }]}>{t('settings.rotating_cover')}</Text>
              <Text style={[styles.cardText, { color: theme.textSecondary }]}>{t('settings.rotating_cover_description')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggleTrack, { backgroundColor: rotatingCover ? theme.accent : theme.surfaceElevated }]}
              onPress={() => handleRotatingCoverToggle(!rotatingCover)}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleThumb, rotatingCover && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 2 }]}>{t('settings.swipe_gestures', 'Swipe Gestures')}</Text>
              <Text style={[styles.cardText, { color: theme.textSecondary }]}>{t('settings.swipe_gestures_description', 'Enable left/right swipe to skip tracks in the full screen player')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggleTrack, { backgroundColor: gesturesEnabled ? theme.accent : theme.surfaceElevated }]}
              onPress={() => handleGesturesToggle(!gesturesEnabled)}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleThumb, gesturesEnabled && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 2 }]}>{t('settings.dynamic_colors', 'Dynamic UI Colors')}</Text>
                <Text style={[styles.cardText, { color: theme.textSecondary }]}>{t('settings.dynamic_colors_desc', 'Adapt app accent colors to the currently playing song')}</Text>
              </View>
            <TouchableOpacity
              style={[styles.toggleTrack, { backgroundColor: dynamicColorsEnabled ? theme.accent : theme.surfaceElevated }]}
              onPress={() => toggleDynamicColors?.(!dynamicColorsEnabled)}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleThumb, dynamicColorsEnabled && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{t('settings.local_audio_scanner', 'Local Audio Scanner')}</Text>
          <Text style={[styles.cardText, { color: theme.textSecondary, marginBottom: 12 }]}>
            {t('settings.local_audio_scanner_description', 'Scan your device for local audio files (.mp3, .flac) and add them to your D Music library.')}
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.accent }]}
            onPress={async () => {
              try {
                const { scanLocalAudio } = require('@/lib/local-audio');
                showToast('Scanning for local audio...', 'success');
                const tracks = await scanLocalAudio();
                showToast(`Scan complete! Found ${tracks.length} tracks.`, 'success');
              } catch (error: any) {
                showToast(error.message || 'Failed to scan local audio', 'error');
              }
            }}
          >
            <Text style={styles.primaryButtonText}>{t('settings.scan_local_storage', 'Scan Local Storage')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>{t('settings.made_with', 'Made with')}</Text>
            <Ionicons name="heart" size={13} color="#ff4444" />
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>{t('settings.by_d', 'by D')}</Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={isLanguageModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLanguageModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.languageModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 12 }]}>{t('settings.language')}</Text>
            <FlatList
              data={languageOptions}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const active = language === item.value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.languageOptionRow,
                      { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
                      active && { borderColor: theme.accent },
                    ]}
                    onPress={() => {
                      void handleLanguageChange(item.value);
                      setIsLanguageModalOpen(false);
                    }}
                  >
                    <View>
                      <Text style={[styles.languageOptionTitle, { color: theme.textPrimary }]}>{item.label}</Text>
                      <Text style={[styles.languageOptionSubtitle, { color: theme.textSecondary }]}>{item.nativeLabel}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
            <TouchableOpacity style={styles.cancelButtonRow} onPress={() => setIsLanguageModalOpen(false)}>
              <Text style={{ color: theme.textPrimary, fontSize: 15 }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Force Update Modal */}
            <Modal
        visible={isRegionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRegionModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.languageModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 12 }]}>{t('settings.region')}</Text>
            <FlatList
              data={regionOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const active = region === item;
                const label = item === 'auto' ? t('settings.auto') : item;
                return (
                  <TouchableOpacity
                    style={[
                      styles.languageOptionRow,
                      { borderColor: theme.border, backgroundColor: theme.surfaceElevated },
                      active && { borderColor: theme.accent },
                    ]}
                    onPress={() => {
                      handleRegionChange(item);
                      setIsRegionModalOpen(false);
                    }}
                  >
                    <View>
                      <Text style={[styles.languageOptionTitle, { color: theme.textPrimary }]}>{label}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={18} color={theme.accent} />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
            <TouchableOpacity style={styles.cancelButtonRow} onPress={() => setIsRegionModalOpen(false)}>
              <Text style={{ color: theme.textPrimary, fontSize: 15 }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showForceUpdate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.updateModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="warning" size={48} color="#ff4444" style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={[styles.cardTitle, { color: theme.textPrimary, textAlign: 'center', fontSize: 18 }]}>
              {!isVersionSupported ? 'Update Required' : 'Update Available'}
            </Text>
            <Text style={[styles.cardText, { color: theme.textSecondary, textAlign: 'center', marginBottom: 16 }]}>
              {!isVersionSupported
                ? `Your version (v${currentVersion}) is no longer supported. Minimum required: v${platformUpdateConfig?.min_supported_version}`
                : `A new version (v${platformUpdateConfig?.latest_version}) is available. Please update to continue.`}
            </Text>
            {platformUpdateConfig?.changelog && platformUpdateConfig.changelog[platformUpdateConfig.latest_version] && (
              <View style={[styles.changelogBox, { backgroundColor: theme.surfaceElevated }]}>
                <Text style={[styles.changelogTitle, { color: theme.textPrimary }]}>What&apos;s New:</Text>
                {platformUpdateConfig.changelog[platformUpdateConfig.latest_version].map((item, idx) => (
                  <Text key={idx} style={[styles.changelogItem, { color: theme.textSecondary }]}>
                    â€¢ {item}
                  </Text>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: '#ff4444', marginTop: 16 }]} 
              onPress={() => Linking.openURL(platformUpdateConfig?.release_url || '')}
            >
              <Text style={styles.primaryButtonText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Changelog Modal */}
      <Modal visible={showChangelog} transparent animationType="fade" onRequestClose={() => setShowChangelog(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.changelogModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 12 }]}>Changelog</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {platformUpdateConfig?.changelog && Object.entries(platformUpdateConfig.changelog)
                .sort(([a], [b]) => compareVersions(b, a))
                .map(([version, items]) => (
                  <View key={version} style={styles.changelogVersion}>
                    <Text style={[styles.changelogVersionTitle, { color: theme.textPrimary }]}>v{version}</Text>
                    {items.map((item, idx) => (
                      <Text key={idx} style={[styles.changelogItem, { color: theme.textSecondary }]}>
                        â€¢ {item}
                      </Text>
                    ))}
                  </View>
                ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancelButtonRow} onPress={() => setShowChangelog(false)}>
              <Text style={{ color: theme.textPrimary, fontSize: 15 }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Beta Warning Modal */}
      <Modal visible={showBetaWarning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.betaWarningCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="warning" size={48} color={theme.accent} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={[styles.cardTitle, { color: theme.textPrimary, textAlign: 'center', fontSize: 18 }]}>
              {t('settings.beta_warning_title')}
            </Text>
            <Text style={[styles.cardText, { color: theme.textSecondary, textAlign: 'center', marginBottom: 16 }]}>
              {t('settings.beta_warning_description')}
            </Text>
            <TouchableOpacity style={styles.betaLinkRow} onPress={() => Linking.openURL('https://t.me/openspot_music/15')}>
              <Text style={[styles.betaLinkText, { color: theme.accent }]}>{t('settings.beta_warning_link')}</Text>
              <Ionicons name="arrow-forward" size={16} color={theme.accent} />
            </TouchableOpacity>
            <View style={styles.betaButtonRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: theme.border, flex: 1, marginRight: 8 }]}
                onPress={handleBetaWarningBack}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>{t('settings.back')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.accent, flex: 1 }]}
                onPress={handleBetaWarningProceed}
              >
                <Text style={styles.primaryButtonText}>{t('settings.proceed')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {toastMessage && (
        <View style={[styles.toastContainer, { backgroundColor: toastType === 'error' ? '#ff4444' : '#1DB954' }]}>
          <Ionicons name={toastType === 'error' ? 'alert-circle' : 'checkmark-circle'} size={20} color="#fff" style={styles.toastIcon} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 140,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    marginBottom: 4,
  },
  primaryButton: {
    marginTop: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  languageModalCard: {
    width: '88%',
    maxHeight: '70%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  languageOptionRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  languageOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  languageOptionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  cancelButtonRow: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  versionButtonsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  updateModalCard: {
    width: '90%',
    maxHeight: '80%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  changelogModalCard: {
    width: '90%',
    maxHeight: '70%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  changelogBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  changelogTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  changelogVersion: {
    marginBottom: 16,
  },
  changelogVersionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  changelogItem: {
    fontSize: 13,
    marginLeft: 8,
    marginBottom: 4,
    lineHeight: 18,
  },
  toastContainer: {
    position: 'absolute',
    top: 65,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastIcon: {
    marginRight: 10,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  betaWarningCard: {
    width: '90%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  betaLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  betaLinkText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  betaButtonRow: {
    flexDirection: 'row',
    width: '100%',
  },
  socialButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButtonsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  updateButtonIcon: {
    marginRight: 8,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  shareSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  shareTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  shareText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  shareButtonIcon: {
    marginRight: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
