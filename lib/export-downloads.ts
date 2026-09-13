import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export const exportDownloadedTrack = async (fileUri: string, fileName: string) => {
  try {
    if (Platform.OS === 'android') {
      // In Android, we can use SAF to ask the user to save to a specific folder
      // For a smoother experience without prompting every time, we might just use Sharing.
      // Alternatively, FileSystem.StorageAccessFramework can be used to write to a public dir.
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      
      if (permissions.granted) {
        const directoryUri = permissions.directoryUri;
        const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          directoryUri,
          fileName,
          'audio/mpeg'
        );
        
        // Read the cached file as base64 and write it to the new public location
        const fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        await FileSystem.writeAsStringAsync(newFileUri, fileContent, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        return true;
      }
    } else {
      // iOS / Fallback
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { UTI: 'public.audio', mimeType: 'audio/mpeg', dialogTitle: 'Export Track' });
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Failed to export downloaded track:', error);
    return false;
  }
};
