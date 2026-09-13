import { Track } from '../types/music';
import { MusicAPI } from './music-api';
import { PlaylistStorage } from './playlist-storage';

export async function importSpotifyPlaylist(
  url: string,
  playlistName: string,
  onProgress?: (msg: string, current?: number, total?: number) => void
): Promise<{ success: boolean; matched: number; total: number }> {
  onProgress?.('Fetching playlist...');

  // Extract Playlist ID from URL
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error('Invalid Spotify playlist URL. Make sure it contains "playlist/ID".');
  }
  const playlistId = match[1];

  // Scrape Spotify OEmbed HTML
  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch Spotify playlist info (${res.status})`);
  }

  const html = await res.text();
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
  
  if (!nextDataMatch) {
    throw new Error('Could not parse Spotify playlist data from embed page.');
  }

  let data;
  try {
    data = JSON.parse(nextDataMatch[1]);
  } catch (e) {
    throw new Error('Failed to parse Spotify playlist JSON data.');
  }

  const entity = data.props?.pageProps?.state?.data?.entity;
  if (!entity || !entity.trackList || entity.trackList.length === 0) {
    throw new Error('No tracks found in the playlist.');
  }

  const playlistNameFromSpotify = entity.name || '';
  const spotifyTracks = entity.trackList;
  const total = spotifyTracks.length;
  const matchedTracks: Track[] = [];

  for (let i = 0; i < spotifyTracks.length; i++) {
    const track = spotifyTracks[i];
    // track.title is the song name, track.subtitle is the artist name
    const query = `${track.title} ${track.subtitle}`;
    onProgress?.('Searching...', i + 1, total);

    try {
      const searchRes = await MusicAPI.searchTracks(query);
      if (searchRes.tracks && searchRes.tracks.length > 0) {
        const matched = searchRes.tracks[0];
        matchedTracks.push(matched);
        await PlaylistStorage.saveTrackData(matched);
      }
    } catch (e) {
      console.error(`Error searching for "${query}":`, e);
    }
  }

  const finalName = playlistName.trim() || playlistNameFromSpotify || 'Imported from Spotify';

  const cover = matchedTracks.length > 0
    ? MusicAPI.getOptimalImage(matchedTracks[0].images)
    : '';

  await PlaylistStorage.addPlaylist({
    name: finalName,
    cover,
    trackIds: matchedTracks.map(t => t.id.toString()),
  });

  onProgress?.('Done!', matchedTracks.length, total);

  return { success: true, matched: matchedTracks.length, total };
}
