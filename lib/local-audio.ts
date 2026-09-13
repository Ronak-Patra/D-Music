import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from '../types/music';

const LOCAL_TRACKS_KEY = 'dmusic_local_tracks_v1';

export const scanLocalAudio = async (): Promise<Track[]> => {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to access media library is required to scan local tracks.');
  }

  let media = await MediaLibrary.getAssetsAsync({
    mediaType: MediaLibrary.MediaType.audio,
    first: 1000,
  });

  const tracks: Track[] = media.assets.map(asset => {
    // Generate a clean title from the filename
    const cleanTitle = asset.filename ? asset.filename.replace(/\.[^/.]+$/, "") : "Unknown Track";

    return {
      id: `local_${asset.id}`,
      provider: 'local', // We can use 'local' or just leave it undefined/custom to bypass ytmusic
      title: cleanTitle,
      artist: 'Local Device',
      artistId: 0,
      albumTitle: 'Local Audio',
      albumCover: 'https://via.placeholder.com/300x300.png?text=Local+Audio', // Placeholder for local audio
      albumId: asset.albumId || 'local_album',
      releaseDate: new Date(asset.creationTime || Date.now()).toISOString(),
      genre: 'Local',
      duration: asset.duration,
      audioQuality: { maximumBitDepth: 16, maximumSamplingRate: 44100, isHiRes: false },
      version: null,
      label: '',
      labelId: 0,
      upc: '',
      mediaCount: 1,
      parental_warning: false,
      streamable: true,
      purchasable: false,
      previewable: false,
      genreId: 0,
      genreSlug: 'local',
      genreColor: '#333333',
      releaseDateStream: '',
      releaseDateDownload: '',
      maximumChannelCount: 2,
      images: {
        small: 'https://via.placeholder.com/150x150.png?text=Local',
        thumbnail: 'https://via.placeholder.com/150x150.png?text=Local',
        large: 'https://via.placeholder.com/500x500.png?text=Local',
        back: null,
      },
      isrc: '',
      uri: asset.uri, // Inject the local URI directly so TrackPlayer can play it
    } as any; // Cast as any because 'provider' might be strictly typed or 'uri' is missing in Track type
  });

  await AsyncStorage.setItem(LOCAL_TRACKS_KEY, JSON.stringify(tracks));
  return tracks;
};

export const getLocalAudio = async (): Promise<Track[]> => {
  try {
    const data = await AsyncStorage.getItem(LOCAL_TRACKS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error fetching local audio from storage:', error);
  }
  return [];
};
