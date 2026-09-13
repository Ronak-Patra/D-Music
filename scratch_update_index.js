const fs = require('fs');
let content = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');

// 1. Add musicStyle state
content = content.replace(
  'const [subRegion, setSubRegion] = useState<string | null>(null);',
  'const [subRegion, setSubRegion] = useState<string | null>(null);\n  const [musicStyle, setMusicStyle] = useState<string | null>(null);'
);

// 2. Add Music Styles UI below SubRegion UI
const uiCode =                 {formattedActiveRegion === 'India' && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
                    {['Hindi', 'Punjabi', 'Tamil', 'Telugu', 'Marathi', 'Bhojpuri', 'Bengali', 'Malayalam', 'Kannada', 'Haryanvi'].map((lang) => (
                      <TouchableOpacity
                        key={lang}
                        style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: subRegion === lang ? theme.accent : theme.border, backgroundColor: subRegion === lang ? theme.accent : theme.surface }}
                        onPress={() => setSubRegion(subRegion === lang ? null : lang)}
                      >
                        <Text style={{ color: subRegion === lang ? '#fff' : theme.textPrimary, fontWeight: '500' }}>{lang}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
                  {['Pop', 'Hip Hop', 'Rock', 'Acoustic', 'Devotional', 'Classical', 'Lofi'].map((style) => (
                    <TouchableOpacity
                      key={style}
                      style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: musicStyle === style ? theme.accent : theme.border, backgroundColor: musicStyle === style ? theme.accent : theme.surface }}
                      onPress={() => setMusicStyle(musicStyle === style ? null : style)}
                    >
                      <Text style={{ color: musicStyle === style ? '#fff' : theme.textPrimary, fontWeight: '500' }}>{style}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>;

content = content.replace(
  /\{\s*formattedActiveRegion === 'India' && \(\s*<ScrollView[\s\S]*?<\/ScrollView>\s*\)\s*\}/,
  uiCode
);

// 3. Update useEffect dependencies
content = content.replace(
  ']}, [activeRegion, subRegion, countryLoading, regionUrlMap, trendingCache]);',
  ']}, [activeRegion, subRegion, musicStyle, countryLoading, regionUrlMap, trendingCache]);'
);

// 4. Update the fetch logic to handle musicStyle
const oldFetchLogic =     if (!countryLoading && activeRegion && activeRegion !== 'your country') {
      if (activeRegion === 'India' && subRegion) {
        MusicAPI.searchTracks(\Top \ Songs\, 1, 20).then(res => {
          if (isMounted && res.tracks) {
            const seen = new Set<string>();
            const dedupedTracks = res.tracks.filter(t => {
              const key = \\|\\;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            setTrendingTracks(dedupedTracks);
          }
        });
        return () => { isMounted = false; };
      };

const newFetchLogic =     if (!countryLoading && activeRegion && activeRegion !== 'your country') {
      if ((activeRegion === 'India' && subRegion) || musicStyle) {
        let searchQuery = 'Top ';
        if (activeRegion === 'India' && subRegion) searchQuery += \\ \;
        if (musicStyle) searchQuery += \\ \;
        searchQuery += 'Songs';
        
        MusicAPI.searchTracks(searchQuery.trim(), 1, 20).then(res => {
          if (isMounted && res.tracks) {
            const seen = new Set<string>();
            const dedupedTracks = res.tracks.filter(t => {
              const key = \\|\\;
              const idKey = t.id.toString();
              if (seen.has(key) || seen.has(idKey)) return false;
              seen.add(key);
              seen.add(idKey);
              return true;
            });
            setTrendingTracks(dedupedTracks);
          }
        });
        return () => { isMounted = false; };
      };

content = content.replace(oldFetchLogic, newFetchLogic);

// 5. Update deduplication in Kworb Weekly
content = content.replace(
  /const key = \\\\\\$\\{t\.title\?\\\.toLowerCase\(\)\.trim\(\)\}\\\|\\\$\\{t\.artist\?\\\.toLowerCase\(\)\.trim\(\)\}\\\;\\s*if \(\!seen\.has\(key\)\) \{\\s*seen\.add\(key\);\\s*dedupedTracks\.push\(t\);\\s*\}/g,
  \const key = \\\\\\$\\{t.title?.toLowerCase().trim()}|\\\$\\{t.artist?.toLowerCase().trim()}\\\;
                  const idKey = t.id.toString();
                  if (!seen.has(key) && !seen.has(idKey)) {
                    seen.add(key);
                    seen.add(idKey);
                    dedupedTracks.push(t);
                  }\
);

fs.writeFileSync('app/(tabs)/index.tsx', content);
console.log('index.tsx updated successfully');
