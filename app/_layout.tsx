import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useThemeMode, ThemeModeProvider } from '@/hooks/theme-mode';
import { LikedSongsProvider } from '@/hooks/useLikedSongs';
import { useApiStatus } from '@/hooks/useApiStatus';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MusicPlayerProvider } from '@/contexts/MusicPlayerContext';
import '@/lib/i18n';

SplashScreen.preventAutoHideAsync();

function AppNavigation() {
  const { resolvedScheme } = useThemeMode();
  const { apiStatus, loading } = useApiStatus();
  const PROVIDER_KEY = 'openspot_provider_v1';

  useEffect(() => {
    const checkAndSwitchProvider = async () => {
      if (loading || !apiStatus) return;

      try {
        const currentProvider = await AsyncStorage.getItem(PROVIDER_KEY);
        if (!currentProvider) return;

        if (currentProvider === 'ytmusic' && apiStatus.ytmusic?.disabled) {
          await AsyncStorage.setItem(PROVIDER_KEY, 'saavn');
          console.log('Auto-switched provider from ytmusic to saavn (ytmusic disabled)');
        } else if (currentProvider === 'saavn' && apiStatus.saavn?.disabled) {
          await AsyncStorage.setItem(PROVIDER_KEY, 'ytmusic');
          console.log('Auto-switched provider from saavn to ytmusic (saavn disabled)');
        }
      } catch (error) {
        console.error('Failed to check/switch provider:', error);
      }
    };

    checkAndSwitchProvider();
  }, [apiStatus, loading]);

  return (
    <LikedSongsProvider>
      <MusicPlayerProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      </MusicPlayerProvider>
    </LikedSongsProvider>
  );
}

import { View, Image, Animated, StyleSheet } from 'react-native';
import { useState, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (loaded) {
      // Hide native splash screen so the JS overlay smoothly takes over
      SplashScreen.hideAsync().catch(() => {});

      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }).start(() => {
          setIsSplashVisible(false);
        });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [loaded]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ThemeModeProvider>
            {loaded && <AppNavigation />}
          </ThemeModeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
      {isSplashVisible && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: '#000000',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: fadeAnim,
              zIndex: 999999,
            },
          ]}
          pointerEvents="none"
        >
          <Image
            source={require('../assets/images/splash-icon.png')}
            style={{ width: 220, height: 220, resizeMode: 'contain' }}
          />
        </Animated.View>
      )}
    </GestureHandlerRootView>
  );
}