import React, { useContext, useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, Dimensions, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSearch } from '@/hooks/useSearch';
import { TopBar } from '@/components/TopBar';
import { SearchResults } from '@/components/SearchResults';
import { MusicPlayerContext } from './_layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocalSearchParams } from 'expo-router';

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

  const [isListening, setIsListening] = React.useState(false);

  const startListening = () => {
    setIsListening(true);
    // Mock listening for 3 seconds
    setTimeout(() => {
      setIsListening(false);
      setQuery('Despacito'); // Mock recognized song
      setSearchType('track');
      searchTracks('Despacito', 'track');
    }, 3000);
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
      
      {/* Music Recognition FAB */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: isListening ? '#ff4444' : '#1DB954' }]} 
        onPress={startListening}
        disabled={isListening}
      >
        <Ionicons name={isListening ? "mic" : "musical-notes"} size={28} color="#fff" />
      </TouchableOpacity>
      
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
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
