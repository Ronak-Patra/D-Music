import { SearchResponse, SearchParams, Track } from '../types/music';
import { MusicApi } from './api';
import { YTMusicAPI } from './ytmusic-api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROVIDER_KEY = 'openspot_provider_v1';

export class MusicAPI {
  private static searchCache = new Map<string, Promise<SearchResponse>>();
  private static streamCache = new Map<string, Promise<string>>();
  private static recentlyPlayedStorageKey = 'openspot_recently_played_tracks_v1';
  private static recentlyPlayedLimit = 30;

  private static async getProvider(): Promise<'saavn' | 'ytmusic'> {
    try {
      const provider = await AsyncStorage.getItem(PROVIDER_KEY);
      return (provider === 'ytmusic' ? 'ytmusic' : 'saavn') as 'saavn' | 'ytmusic';
    } catch {
      return 'saavn';
    }
  }

  private static resolveProviderHint(trackOrProvider?: Track | 'saavn' | 'ytmusic'): 'saavn' | 'ytmusic' | 'local' | null {
    if (!trackOrProvider) return null;
    if (trackOrProvider === 'saavn' || trackOrProvider === 'ytmusic') {
      return trackOrProvider;
    }
    return trackOrProvider.provider || null;
  }

  static async search(params: SearchParams): Promise<SearchResponse> {
    const provider = await this.getProvider();
    
    if (provider === 'ytmusic' && (!params.type || params.type === 'track')) {
      return YTMusicAPI.search({ q: params.q, type: params.type });
    }
    return MusicApi.search(params);
  }

  static async searchTracks(query: string, page: number = 1, limit: number = 20): Promise<SearchResponse> {
    const provider = await this.getProvider();
    if (provider === 'ytmusic') {
      return YTMusicAPI.search({ q: query, type: 'track' });
    }
    return MusicApi.searchTracks(query, page, limit);
  }

  static async searchPlaylists(query: string, page: number = 1, limit: number = 20): Promise<SearchResponse> {
    return MusicApi.searchPlaylists(query, page, limit);
  }

  static async searchAlbums(query: string, page: number = 1, limit: number = 20): Promise<SearchResponse> {
    return MusicApi.searchAlbums(query, page, limit);
  }

  static async getStreamUrl(trackId: string, trackOrProvider?: Track | 'saavn' | 'ytmusic'): Promise<string> {
    if (typeof trackOrProvider === 'object' && trackOrProvider.provider === 'local') {
      return trackOrProvider.uri || '';
    }
    const hintedProvider = this.resolveProviderHint(trackOrProvider);
    const provider = hintedProvider || 'saavn';
    if (provider === 'ytmusic') {
      return YTMusicAPI.getStreamUrl(trackId);
    }
    return MusicApi.getStreamUrl(trackId);
  }

  static async getDownloadUrl(trackId: string, trackOrProvider?: Track | 'saavn' | 'ytmusic'): Promise<string> {
    const hintedProvider = this.resolveProviderHint(trackOrProvider);
    const provider = hintedProvider || 'saavn';
    if (provider === 'ytmusic') {
      return YTMusicAPI.getDownloadUrl(trackId);
    }
    
    return MusicApi.getStreamUrl(trackId);
  }

  static async getPopularTracks(): Promise<Track[]> {
    
    return MusicApi.getPopularTracks();
  }

  static async getAlbumSongs(albumId: string): Promise<Track[]> {
    return MusicApi.getAlbumSongs(albumId);
  }

  static async getArtistSongs(artistId: string, page: number = 0): Promise<{ tracks: Track[]; total: number }> {
    return MusicApi.getArtistSongs(artistId, page);
  }

  static async getPlaylistSongs(playlistId: string): Promise<Track[]> {
    return MusicApi.getPlaylistSongs(playlistId);
  }

  static async getPlaylistSongsPaginated(playlistId: string, page = 0): Promise<{ tracks: Track[]; total: number }> {
    return MusicApi.getPlaylistSongsPaginated(playlistId, page);
  }

  static async getRecentlyPlayed(): Promise<Track[]> {
    try {
      const stored = await AsyncStorage.getItem(this.recentlyPlayedStorageKey);
      if (!stored) return [];
      const parsed = JSON.parse(stored) as Track[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to read recently played tracks:', error);
      return [];
    }
  }

  static async addToRecentlyPlayed(track: Track): Promise<void> {
    try {
      const existing = await this.getRecentlyPlayed();
      const deduped = existing.filter((item) => item.id.toString() !== track.id.toString());
      const next = [track, ...deduped].slice(0, this.recentlyPlayedLimit);
      await AsyncStorage.setItem(this.recentlyPlayedStorageKey, JSON.stringify(next));
    } catch (error) {
      console.error('Failed to save recently played track:', error);
    }
  }

  static async clearRecentlyPlayed(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.recentlyPlayedStorageKey);
    } catch (error) {
      console.error('Failed to clear recently played tracks:', error);
    }
  }

  private static recentlyPlayedPlaylistsKey = 'openspot_recently_played_playlists_v1';

  static async getRecentlyPlayedPlaylists(): Promise<any[]> {
    try {
      const stored = await AsyncStorage.getItem(this.recentlyPlayedPlaylistsKey);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Failed to read recently played playlists:', error);
      return [];
    }
  }

  static async addToRecentlyPlayedPlaylists(playlist: { id: string; name?: string; title?: string; image?: any; images?: any; songCount?: number; description?: string }): Promise<void> {
    try {
      if (!playlist || !playlist.id) return;
      const existing = await this.getRecentlyPlayedPlaylists();
      const deduped = existing.filter(p => p.id?.toString() !== playlist.id?.toString());
      const itemToSave = {
        id: playlist.id.toString(),
        name: playlist.name || playlist.title || 'Playlist',
        title: playlist.name || playlist.title || 'Playlist',
        image: playlist.image || playlist.images,
        images: playlist.images || playlist.image,
        songCount: playlist.songCount,
        description: playlist.description,
        playedAt: Date.now(),
      };
      const next = [itemToSave, ...deduped].slice(0, 5);
      await AsyncStorage.setItem(this.recentlyPlayedPlaylistsKey, JSON.stringify(next));
    } catch (error) {
      console.error('Failed to save recently played playlist:', error);
    }
  }

  static async getMadeForYou(): Promise<Track[]> {
    return MusicApi.getMadeForYou();
  }

  static isPodcastOrNonMusic(item: any): boolean {
    return MusicApi.isPodcastOrNonMusic(item);
  }

  static async getNewReleases(languages?: string, limit?: number, genre?: string | null): Promise<Track[]> {
    return MusicApi.getNewReleases(languages, limit, genre || '');
  }

  static async resolveTrackById(trackId: string, preferredProvider?: 'saavn' | 'ytmusic'): Promise<Track | null> {
    const providers: ('saavn' | 'ytmusic')[] = preferredProvider
      ? [preferredProvider, preferredProvider === 'saavn' ? 'ytmusic' : 'saavn']
      : ['saavn', 'ytmusic'];

    for (const provider of providers) {
      try {
        const response = provider === 'saavn'
          ? await MusicApi.search({ q: trackId, type: 'track' })
          : await YTMusicAPI.search({ q: trackId, type: 'track' });
        if (response.tracks.length > 0) {
          return response.tracks[0];
        }
      } catch {
        
      }
    }

    return null;
  }

  static formatDuration(duration: number): string {
    const seconds = Math.floor(duration);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) {
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  static getOptimalImage(images: any): string {
    if (!images) return '';
    if (typeof images === 'string') {
      const trimmed = images.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('file://') || trimmed.startsWith('data:')) {
        return trimmed;
      }
      return '';
    }
    if (Array.isArray(images)) {
      const best = images.find(img => img?.quality === '500x500') ||
                   images.find(img => img?.quality === '150x150') ||
                   images[images.length - 1] ||
                   images[0];
      return best?.url || (typeof best === 'string' ? best : '');
    }
    if (typeof images === 'object') {
      return (typeof images.large === 'string' && images.large) ||
             (typeof images.thumbnail === 'string' && images.thumbnail) ||
             (typeof images.small === 'string' && images.small) ||
             '';
    }
    return '';
  }

  static isHighQuality(track: Track): boolean {
    return track.audioQuality.isHiRes || track.audioQuality.maximumBitDepth >= 24;
  }

  static getQualityBadge(track: Track): string | null {
    if (track.audioQuality.isHiRes) return 'Hi-Res';
    if (track.audioQuality.maximumBitDepth >= 24) return 'HD';
    return null;
  }

  static clearCache(): void {
    this.searchCache.clear();
    this.streamCache.clear();
  }

  static clearSearchCache(): void {
    this.searchCache.clear();
  }

  static clearStreamCache(): void {
    this.streamCache.clear();
  }
} 