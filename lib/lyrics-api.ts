export interface LyricsData {
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

export const fetchLyrics = async (title: string, artist: string, durationSec?: number): Promise<LyricsData | null> => {
  try {
    const cleanTitle = title.replace(/\([^)]*\)/g, '').split('-')[0].trim();
    const cleanArtist = artist.split(',')[0].trim();

    const url = new URL('https://lrclib.net/api/search');
    url.searchParams.append('track_name', cleanTitle);
    url.searchParams.append('artist_name', cleanArtist);
    
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'DMusic/1.0.0 (https://github.com/dmusic/dmusic)'
      }
    });
    const data = await response.json();
    
    if (data && data.length > 0) {
      // Find the closest match by duration if provided
      let bestMatch = data[0];
      if (durationSec) {
        let smallestDiff = Infinity;
        for (const item of data) {
          const diff = Math.abs((item.duration || 0) - durationSec);
          if (diff < smallestDiff) {
            smallestDiff = diff;
            bestMatch = item;
          }
        }
      }
      
      return {
        syncedLyrics: bestMatch.syncedLyrics,
        plainLyrics: bestMatch.plainLyrics,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch lyrics:', error);
    return null;
  }
};
