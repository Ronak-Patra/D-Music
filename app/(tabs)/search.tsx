import React, { useContext, useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, Dimensions, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSearch } from '@/hooks/useSearch';
import { TopBar } from '@/components/TopBar';
import { SearchResults } from '@/components/SearchResults';
import { MusicPlayerContext } from '@/contexts/MusicPlayerContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SearchScreen() {
  const searchState = useSearch();
  const { setQuery, setSearchType, searchTracks } = searchState;
  const { handleTrackSelect, musicQueue, isPlaying, currentTrack } = useContext(MusicPlayerContext);
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== 'light';
  const background = isDark ? '#050505' : '#f5efe6';
  const params = useLocalSearchParams();
  const lastQRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const q = params.q;
    if (!q || typeof q !== 'string') {
      lastQRef.current = undefined;
      return;
    }
    if (q === lastQRef.current) return;

    lastQRef.current = q;
    setQuery(q);
    const type = params.type;
    if (type && typeof type === 'string') {
      setSearchType(type as 'track' | 'album' | 'artist' | 'playlist');
    }
    searchTracks(q, type as 'track' | 'album' | 'artist' | 'playlist');
  }, [params.q, params.type, setQuery, setSearchType, searchTracks]);

  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e) => {
      setQuery('');
      searchState.clearResults();
    });
    return unsubscribe;
  }, [navigation, setQuery, searchState]);

  const [isListening, setIsListening] = React.useState(false);

  useSpeechRecognitionEvent("start", () => setIsListening(true));
  useSpeechRecognitionEvent("end", () => setIsListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    if (event.results[0]?.transcript) {
      const text = event.results[0].transcript;
      setQuery(text);
      setSearchType('track');
      searchTracks(text, 'track');
    }
  });
  useSpeechRecognitionEvent("error", (event) => {
    console.error('Speech error', event.error, event.message);
    setIsListening(false);
  });

  const startListening = async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      console.warn('Speech permissions denied');
      return;
    }
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: false,
        continuous: false,
      });
    } catch (e) {
      console.error('Voice start error:', e);
      setIsListening(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={background} translucent={false} />
      <TopBar
        currentView="search"
        onViewChange={() => {}}
        onSearchClick={() => {}}
        onSearchStart={() => {}}
        searchState={searchState}
        placeholderFontSize={SCREEN_WIDTH > 400 ? 18 : 15}
        isListening={isListening}
        onVoiceSearch={startListening}
      />
      <View style={styles.mainContent}>
        <SearchResults
          searchState={searchState}
          onTrackSelect={handleTrackSelect}
          onAddToQueue={musicQueue.addToQueue}
          isPlaying={isPlaying}
          currentTrack={currentTrack}
        />
      </View>
      {/* Music Recognition removed from FAB to TopBar */}
      {isListening && (
        <View style={styles.listeningOverlay}>
          <Ionicons name="pulse" size={64} color="#1DB954" />
          <Text style={styles.listeningText}>Listening...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    paddingTop: 16,
    flex: 1,
    paddingHorizontal: 2,
  },

  listeningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  listeningText: {
    color: '#1DB954',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  }
});
