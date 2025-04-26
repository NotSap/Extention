const baseUrl = "https://bestdubbedanime.com";

async function search(query) {
  const url = `${baseUrl}/xz/searchgrid.php?p=1&limit=12&s=${encodeURIComponent(query)}&_=${Date.now()}`;
  const res = await fetch(url);
  const html = await res.text();
  const results = [];

  const regex = /<a href="([^"]+)"[^>]*>(?:[\s\S]*?)<img[^>]*src="([^"]+)"[^>]*>(?:[\s\S]*?)<div class="gridtitlek">([^<]+)<\/div>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const link = match[1].startsWith("http") ? match[1] : baseUrl + match[1];
    const image = match[2].startsWith("http") ? match[2] : baseUrl + match[2];
    const title = match[3];

    results.push({
      title: title,
      url: link,
      image: image
    });
  }

  return results;
}

async function fetchAnimeInfo(url) {
  return {
    title: "Coming soon...",
    episodes: [],
  };
}

async function fetchEpisodes(url) {
  return [];
}

async function loadEpisodeSources(url) {
  return [];
}

async function fetchPopular() {
  return [];
}

async function fetchLatest() {
  return [];
}

// Create the extension object first
const extension = {
  id: "bestdubbedanime",
  name: "BestDubbedAnime",
  baseUrl: baseUrl,
  lang: "en",
  version: "1.0.0",
  icon: "https://www.google.com/s2/favicons?sz=64&domain=bestdubbedanime.com",
  isAdult: false,
  search: search,
  fetchAnimeInfo: fetchAnimeInfo,
  fetchEpisodes: fetchEpisodes,
  loadEpisodeSources: loadEpisodeSources,
  fetchPopular: fetchPopular,
  fetchLatest: fetchLatest
};

// Then assign it to globalThis
globalThis.extension = extension;
