const https = require('https');

const search = (q) => {
  const options = {
    hostname: 'www.jiosaavn.com',
    path: `/api.php?__call=search.getAlbumResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&q=${encodeURIComponent(q)}&p=1&n=2`,
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  };

  https.get(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.results) {
            json.results.forEach(p => {
                const options2 = {
                    hostname: 'www.jiosaavn.com',
                    path: `/api.php?__call=content.getAlbumDetails&_format=json&_marker=0&api_version=4&ctx=web6dot0&albumid=${p.id}`,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                };
                https.get(options2, (res2) => {
                    let data2 = '';
                    res2.on('data', chunk => data2 += chunk);
                    res2.on('end', () => {
                        const album = JSON.parse(data2);
                        if (album.list && album.list.length > 0) {
                            console.log(`\nAlbum: ${p.title}`);
                            console.log(`Track: ${album.list[0].title}`);
                            console.log(`Release Date: ${album.list[0].more_info?.release_date} / Year: ${album.list[0].year}`);
                        }
                    });
                });
            });
        }
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    });
  });
};

search('Latest Punjabi 2026');
