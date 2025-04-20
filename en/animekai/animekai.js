function getAnimeList() {
  const url = 'https://raw.githubusercontent.com/NotSap/mangayomi-animekai/main/en/animekai/anime_index.json';
  const response = fetch(url);
  return JSON.parse(response.body);
}

function fetchPopularAnime(page) {
  const list = getAnimeList();
  const perPage = 20;
  const start = (page - 1) * perPage;
  const end = start + perPage;

  const results = list.slice(start, end).map(anime => {
    return {
      title: anime.title,
      url: anime.url,
      thumbnailUrl: anime.thumbnail,
    };
  });

  return {
    anime: results,
    hasNextPage: end < list.length,
  };
}

function fetchLatestUpdates(page) {
  return fetchPopularAnime(page); // Assume same list sorted by update time (you can customize)
}

function searchRequest(query, page) {
  const list = getAnimeList();
  const results = list.filter(anime =>
    anime.title.toLowerCase().includes(query.toLowerCase())
  ).map(anime => {
    return {
      title: anime.title,
      url: anime.url,
      thumbnailUrl: anime.thumbnail,
    };
  });

  return {
    anime: results,
    hasNextPage: false,
  };
}

function fetchAnimeInfo(animeUrl) {
  const list = getAnimeList();
  const anime = list.find(a => a.url === animeUrl);
  if (!anime) return null;

  return {
    title: anime.title,
    genres: anime.genres || [],
    description: anime.description || '',
    status: anime.status || 'Unknown',
    author: anime.author || '',
    artist: anime.artist || '',
    thumbnailUrl: anime.thumbnail,
  };
}

function fetchEpisodes(animeUrl) {
  const list = getAnimeList();
  const anime = list.find(a => a.url === animeUrl);
  if (!anime || !anime.episodes) return [];

  return anime.episodes.map((ep, index) => ({
    name: ep.name || `Episode ${index + 1}`,
    url: ep.url,
    number: index + 1,
  }));
}

function loadEpisodeSources(episodeUrl) {
  const res = fetch(episodeUrl, {
    headers: {
      'Referer': 'https://animekai.to/',
    },
  });

  const html = res.body;
  const videoUrlMatch = html.match(/file:\s*"(https:\/\/[^"]+)"/);

  if (!videoUrlMatch) return [];

  return [
    {
      url: videoUrlMatch[1],
      quality: 'HD',
      isM3U8: videoUrlMatch[1].includes('.m3u8'),
    },
  ];
}
