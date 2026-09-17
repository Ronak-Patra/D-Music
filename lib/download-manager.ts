import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track } from '@/types/music';
import { MusicAPI } from '@/lib/music-api';
import { PlaylistStorage } from '@/lib/playlist-storage';

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
    } catch (e) {
      console.error('Error requesting directory permissions:', e);
    }
    return null;
  },

  async safeDelete(targetUri: string): Promise<boolean> {
    try {
      const masterUri = await this.getMasterFolderUri();
      if (!masterUri) return false;
      
      const getDocId = (uri: string) => {
        let dec = uri;
        try { while(dec !== decodeURIComponent(dec)) dec = decodeURIComponent(dec); } catch(e){}
        const parts = dec.split('/document/');
        return parts.length > 1 ? parts[1] : dec.replace('content://com.android.externalstorage.documents/tree/', '');
      };

      const targetDocId = getDocId(targetUri);
      const masterDocId = getDocId(masterUri);

      if (targetDocId === masterDocId || targetUri === masterUri || targetDocId === "") {
        console.warn("CRITICAL: Prevented deletion of master folder!", targetUri);
        return false;
      }

      // Convert to Tree URI to force expo to use DocumentFile.delete() instead of contentResolver.delete(), which has a bug on some devices
      let safeUri = targetUri;
      if (!safeUri.includes('/tree/')) {
        const treeMatch = masterUri.match(/\/tree\/([^/]+)/);
        if (treeMatch) {
          safeUri = safeUri.replace('/document/', `/tree/${treeMatch[1]}/document/`);
        }
      }

      await FileSystem.deleteAsync(safeUri, { idempotent: true });
      return true;
    } catch (e) {
      console.warn("Failed to safeDelete", e);
      return false;
    }
  },

  async safeDeleteDirContents(targetDirUri: string): Promise<boolean> {
    try {
      const masterUri = await this.getMasterFolderUri();
      if (!masterUri) return false;
      
      const getDocId = (uri: string) => {
        let dec = uri;
        try { while(dec !== decodeURIComponent(dec)) dec = decodeURIComponent(dec); } catch(e){}
        const parts = dec.split('/document/');
        return parts.length > 1 ? parts[1] : dec.replace('content://com.android.externalstorage.documents/tree/', '');
      };

      const targetDocId = getDocId(targetDirUri);
      const masterDocId = getDocId(masterUri);

      if (targetDocId === masterDocId || targetDirUri === masterUri || targetDocId === "") {
        console.warn("CRITICAL: Prevented interaction with master folder!", targetDirUri);
        return false;
      }

      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(targetDirUri);
      for (const file of files) {
        await FileSystem.deleteAsync(file, { idempotent: true });
      }
      return true;
    } catch (e) {
      console.warn("Failed to delete directory contents", e);
      return false;
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

      let targetDirUri = masterUri;
      
      // Safe name for file prefix only. Original name stored in AsyncStorage for matching.
      const safePlaylistName = playlistName ? playlistName.replace(/[^a-zA-Z0-9 -]/g, '').trim() : '';
      const safeTrackNameRaw = track.title ? track.title.replace(/[^a-zA-Z0-9 -]/g, '').trim() : track.id.toString();
      const safeTrackName = safePlaylistName ? `[${safePlaylistName}] ${safeTrackNameRaw}` : safeTrackNameRaw;

      // Download the audio file to cache first
      const audioUrl = await MusicAPI.getDownloadUrl(track.id.toString(), track);
      const tempAudioUri = `${FileSystem.cacheDirectory}temp_${track.id}.mp3`;
      await FileSystem.downloadAsync(audioUrl, tempAudioUri);

      // Create file in target directory (master folder)
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
        fileUri: finalFileUri,
        trackData: track,
        metadata: track,
        downloadedAt: new Date().toISOString(),
        playlistName: playlistName || null  // raw original name for matching
      }));

      // Also register in PlaylistStorage so it shows in Downloads tab
      await PlaylistStorage.addTrackToPlaylists(track, ['offline']);

      return true;
    } catch (e) {
      console.error('Download failed:', e);
      return false;
    }
  },

  async ensureDirectoryExists(parentUri: string, dirName: string): Promise<string> {
    const CACHE_KEY = `dir_map_v2_${parentUri}`; // Change key to avoid poisoned old caches
    let dirMap: Record<string, string> = {};
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) dirMap = JSON.parse(raw);
    } catch (e) {}

    if (dirMap[dirName]) {
      let cachedUri = dirMap[dirName];
      if (!cachedUri.includes('/tree/')) {
        const treeMatch = parentUri.match(/\/tree\/([^/]+)/);
        if (treeMatch) {
          cachedUri = cachedUri.replace('/document/', `/tree/${treeMatch[1]}/document/`);
          dirMap[dirName] = cachedUri;
          AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dirMap)).catch(() => {});
        }
      }
      return cachedUri;
    }

    try {
      const getDocId = (uri: string) => {
        let dec = uri;
        try { while(dec !== decodeURIComponent(dec)) dec = decodeURIComponent(dec); } catch(e){}
        const parts = dec.split('/document/');
        return parts.length > 1 ? parts[1] : dec;
      };
      const parentDocId = getDocId(parentUri);
      
      const findChild = async () => {
        const children = await FileSystem.StorageAccessFramework.readDirectoryAsync(parentUri);
        for (const child of children) {
          if (getDocId(child) === parentDocId) continue;
          let decoded = child;
          try { while(decoded !== decodeURIComponent(decoded)) decoded = decodeURIComponent(decoded); } catch(e){}
          if (decoded.endsWith(`/${dirName}`) || decoded.endsWith(`:${dirName}`) || decoded.endsWith(dirName)) {
            return child;
          }
        }
        return null;
      };

      let existing = await findChild();
      if (existing) {
        dirMap[dirName] = existing;
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dirMap));
        return existing;
      }
      
      await FileSystem.StorageAccessFramework.makeDirectoryAsync(parentUri, dirName);
      
      // RE-READ directory to get the natively-formatted Tree URI instead of manually manipulating it
      existing = await findChild();
      if (existing) {
        dirMap[dirName] = existing;
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dirMap));
        return existing;
      }
      
      throw new Error("Created directory but could not locate its native Tree URI.");
    } catch (e) {
      console.error('makeDirectoryAsync failed', e);
      throw new Error(`Failed to create or find directory: ${dirName}`);
    }
  },
  
  async downloadPlaylist(playlistName: string, tracks: Track[], onProgress: (progress: number) => void): Promise<number> {
    let masterUri = await this.getMasterFolderUri();
    if (!masterUri) {
      masterUri = await this.promptForMasterFolder();
      if (!masterUri) return 0;
    }

    let downloadedCount = 0;
    // Use the original playlistName for storage so the media screen can match it back
    // (do NOT sanitize for storage key - sanitize only for file naming)
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const offlineData = await AsyncStorage.getItem(`offline_${track.id}`);
      if (!offlineData) {
        // Pass original playlistName for storage, file will be prefixed with safe version
        const success = await this.downloadTrack(track, playlistName);
        if (success) {
          downloadedCount++;
        }
      } else {
        // Track already downloaded - update its playlistName if not set
        try {
          const parsed = JSON.parse(offlineData);
          if (!parsed.playlistName) {
            parsed.playlistName = playlistName;
            await AsyncStorage.setItem(`offline_${track.id}`, JSON.stringify(parsed));
          }
        } catch(e) {}
        downloadedCount++;
      }
      onProgress((i + 1) / tracks.length);
    }
    
    // Save playlist metadata JSON inside the master folder
    try {
        const existingFiles = await FileSystem.StorageAccessFramework.readDirectoryAsync(masterUri);
        const metaName = `[${safePlaylistName}] metadata.json`;
        let metaUri = existingFiles.find(uri => uri.endsWith(metaName));
        if (!metaUri) {
            metaUri = await FileSystem.StorageAccessFramework.createFileAsync(masterUri, metaName, 'application/json');
        }
        
        if (metaUri) {
          await FileSystem.writeAsStringAsync(metaUri, JSON.stringify({
              name: playlistName,
              tracks: tracks,
              downloadedAt: new Date().toISOString()
          }));
        }
    } catch(e) {
        console.error("Failed to save playlist metadata", e);
    }

    return downloadedCount;
  },

  async deletePlaylist(playlistName: string): Promise<boolean> {
    try {
        const masterUri = await this.getMasterFolderUri();
        if (!masterUri) return false;

        const safePlaylistName = playlistName.replace(/[^a-zA-Z0-9 -]/g, '').trim();
        const existingFiles = await FileSystem.StorageAccessFramework.readDirectoryAsync(masterUri);
        
        for (const fileUri of existingFiles) {
            let decoded = fileUri;
            try { while(decoded !== decodeURIComponent(decoded)) decoded = decodeURIComponent(decoded); } catch(e){}
            
            // Delete all files prefixed with the playlist name
            if (decoded.includes(`[${safePlaylistName}]`)) {
                await this.safeDelete(fileUri);
            }
        }
        
        // Remove from AsyncStorage
        const keys = await AsyncStorage.getAllKeys();
        const offlineKeys = keys.filter(k => k.startsWith('offline_'));
        for(const key of offlineKeys) {
            const data = await AsyncStorage.getItem(key);
            if(data) {
                const parsed = JSON.parse(data);
                if(parsed.playlistName === playlistName) {
                    await AsyncStorage.removeItem(key);
                }
            }
        }
        return true;
    } catch (e) {
        console.error("Failed to delete playlist", e);
        return false;
    }
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
          const keys = await AsyncStorage.getAllKeys();
          const offlineKeys = keys.filter(k => k.startsWith('offline_'));
          let count = 0;
          for (const key of offlineKeys) {
              const data = await AsyncStorage.getItem(key);
              if (data) {
                  const parsed = JSON.parse(data);
                  if (parsed.playlistName === playlistName) {
                      count++;
                  }
              }
          }
          return count;
      } catch (e) {
          console.warn('Failed to get playlist track count', e);
      }
      return 0;
  },

  async syncDownloads(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(k => k.startsWith('offline_'));
      const masterUri = await this.getMasterFolderUri();
      
      let masterFiles: string[] = [];
      if (masterUri) {
        try {
          masterFiles = await FileSystem.StorageAccessFramework.readDirectoryAsync(masterUri);
        } catch (e) {
          console.warn('Could not read master folder in syncDownloads', e);
        }
      }
      
      for (const key of offlineKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            const trackId = key.replace('offline_', '');
            let exists = false;

            if (parsed.fileUri) {
              // 1. Try getInfoAsync first
              const info = await FileSystem.getInfoAsync(parsed.fileUri);
              if (info.exists) {
                exists = true;
              } else if (masterFiles.length > 0) {
                // 2. Cross check against SAF directory listing in master folder
                const getDocId = (uri: string) => {
                  let dec = uri;
                  try { while(dec !== decodeURIComponent(dec)) dec = decodeURIComponent(dec); } catch(e){}
                  const parts = dec.split('/document/');
                  return parts.length > 1 ? parts[1] : dec;
                };
                const fileDocId = getDocId(parsed.fileUri);
                exists = masterFiles.some(mUri => getDocId(mUri) === fileDocId);
              }
            }

            if (!exists) {
              console.log(`Sync: Cleaning up dead track ${key}`);
              await AsyncStorage.removeItem(key);
              await PlaylistStorage.removeTrackFromPlaylist(trackId, 'offline');
            }
          } catch(e) {}
        }
      }
    } catch (e) {
      console.error('Failed to sync downloads', e);
    }
  }
};
