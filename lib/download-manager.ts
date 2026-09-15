import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from '@/lib/music-api';
import { MusicAPI } from '@/lib/music-api';

const MASTER_FOLDER_KEY = 'master_download_folder_uri';

export const DownloadManager = {
  async getMasterFolderUri(): Promise<string | null> {
    return AsyncStorage.getItem(MASTER_FOLDER_KEY);
  },

  async promptForMasterFolder(): Promise<string | null> {
    try {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        await AsyncStorage.setItem(MASTER_FOLDER_KEY, permissions.directoryUri);
        return permissions.directoryUri;
      }
      return null;
    } catch (e) {
      console.error('Failed to request directory permissions', e);
      return null;
    }
  },

  async clearMasterFolder(): Promise<void> {
    await AsyncStorage.removeItem(MASTER_FOLDER_KEY);
  },

  async downloadTrack(track: Track, playlistName?: string, precalculatedDirUri?: string): Promise<boolean> {
    try {
      let masterUri = await this.getMasterFolderUri();
      if (!masterUri) {
        masterUri = await this.promptForMasterFolder();
        if (!masterUri) return false; // User cancelled
      }

      let targetDirUri = precalculatedDirUri || masterUri;

      // If downloading as part of a playlist and no precalculated URI was provided, ensure the sub-folder exists
      if (playlistName && !precalculatedDirUri) {
        const safePlaylistName = playlistName.replace(/[^a-zA-Z0-9 -]/g, '').trim();
        targetDirUri = await this.ensureDirectoryExists(masterUri, safePlaylistName);
      }

      // Download the audio file to cache first
      const audioUrl = await MusicAPI.getDownloadUrl(track.id.toString(), track);
      const tempAudioUri = `${FileSystem.cacheDirectory}temp_${track.id}.mp3`;
      await FileSystem.downloadAsync(audioUrl, tempAudioUri);

      // Create file in target directory
      const safeTrackName = track.title ? track.title.replace(/[^a-zA-Z0-9 -]/g, '').trim() : track.id.toString();
      const existingFiles = await FileSystem.StorageAccessFramework.readDirectoryAsync(targetDirUri);
      
      let finalFileUri = existingFiles.find(uri => uri.includes(safeTrackName));
      
      if (!finalFileUri) {
        finalFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          targetDirUri,
          safeTrackName,
          'audio/mpeg'
        );
      }

      // Read from cache and write to SAF
      const base64Audio = await FileSystem.readAsStringAsync(tempAudioUri, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(finalFileUri, base64Audio, { encoding: FileSystem.EncodingType.Base64 });
      
      // Cleanup temp
      await FileSystem.deleteAsync(tempAudioUri, { idempotent: true });

      // Save metadata locally in our app so we can find it
      await AsyncStorage.setItem(`offline_${track.id}`, JSON.stringify({
        fileUri: finalFileUri, // SAF URI!
        trackData: track,
        downloadedAt: new Date().toISOString(),
        playlistName: playlistName || null
      }));

      return true;
    } catch (e) {
      console.error('Download failed:', e);
      return false;
    }
  },

  async ensureDirectoryExists(parentUri: string, dirName: string): Promise<string> {
    try {
      const children = await FileSystem.StorageAccessFramework.readDirectoryAsync(parentUri);
      // Check if folder exists based on name mapping. SAF is tricky with names, 
      // but usually the name is at the end of the URI or encoded.
      // A safe way is to just try creating it. If it fails, maybe it exists?
      // Actually, we can check if any child ends with the encoded dirName.
      for (const child of children) {
        const decoded = decodeURIComponent(child);
        if (decoded.endsWith(dirName) || decoded.includes(dirName)) {
          return child;
        }
      }
      return await FileSystem.StorageAccessFramework.makeDirectoryAsync(parentUri, dirName);
    } catch (e) {
      console.warn('Directory might already exist, returning parent. Err:', e);
      return parentUri;
    }
  },
  
  async downloadPlaylist(playlistName: string, tracks: Track[], onProgress: (progress: number) => void): Promise<number> {
    let downloadedCount = 0;
    
    // Prompt for master folder once if not set
    let masterUri = await this.getMasterFolderUri();
    if (!masterUri) {
      masterUri = await this.promptForMasterFolder();
      if (!masterUri) return 0;
    }

    // Create folder once
    const safePlaylistName = playlistName.replace(/[^a-zA-Z0-9 -]/g, '').trim();
    const targetDirUri = await this.ensureDirectoryExists(masterUri, safePlaylistName);

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const offlineData = await AsyncStorage.getItem(`offline_${track.id}`);
      if (!offlineData) {
        const success = await this.downloadTrack(track, playlistName, targetDirUri);
        if (success) {
          downloadedCount++;
        }
      } else {
        // Track already downloaded, but maybe not in this playlist?
        // We'll consider it done for now.
        downloadedCount++;
      }
      onProgress((i + 1) / tracks.length);
    }
    
    // Save playlist metadata JSON inside the folder
    try {
        const existingFiles = await FileSystem.StorageAccessFramework.readDirectoryAsync(targetDirUri);
        let metaUri = existingFiles.find(uri => uri.endsWith('playlist.json'));
        if (!metaUri) {
            metaUri = await FileSystem.StorageAccessFramework.createFileAsync(targetDirUri, 'playlist', 'application/json');
        }
        
        await FileSystem.writeAsStringAsync(metaUri, JSON.stringify({
            name: playlistName,
            tracks: tracks,
            downloadedAt: new Date().toISOString()
        }));
    } catch(e) {
        console.error("Failed to save playlist metadata", e);
    }

    return downloadedCount;
  },
  
  async getDownloadedPlaylists(): Promise<string[]> {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(k => k.startsWith('offline_'));
      const playlists = new Set<string>();
      
      for(const key of offlineKeys) {
          const data = await AsyncStorage.getItem(key);
          if(data) {
              const parsed = JSON.parse(data);
              if(parsed.playlistName) {
                  playlists.add(parsed.playlistName);
              }
          }
      }
      return Array.from(playlists);
  },

  async getPlaylistTrackCount(playlistName: string): Promise<number> {
      try {
          const masterUri = await this.getMasterFolderUri();
          if (!masterUri) return 0;
          const safePlaylistName = playlistName.replace(/[^a-zA-Z0-9 -]/g, '').trim();
          const targetDirUri = await this.ensureDirectoryExists(masterUri, safePlaylistName);
          const existingFiles = await FileSystem.StorageAccessFramework.readDirectoryAsync(targetDirUri);
          const metaUri = existingFiles.find(uri => uri.endsWith('playlist.json'));
          if (metaUri) {
              const metaData = await FileSystem.readAsStringAsync(metaUri);
              const parsed = JSON.parse(metaData);
              if (parsed.tracks) {
                  return parsed.tracks.length;
              }
          }
      } catch (e) {
          console.warn('Failed to get playlist track count', e);
      }
      return 0;
  }
};
