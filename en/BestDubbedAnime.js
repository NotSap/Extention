globalThis.extension = {
  name: "BestDubbedAnime",
  id: 123456789,
  iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=bestdubbedanime.com",
  baseUrl: "https://bestdubbedanime.com",
  lang: "en",
  isAdult: false,
  version: "1.0.0",
  extra: {},
  
  search: async function (query) {
    const url = `${this.baseUrl}/xz/searchgrid.php?p=1&limit=12&s=${encodeURIComponent(query)}&_=${Date.now()}`;
    const res = await fetch(url);
    const html = await res.text();
    const results = [];

    const regex = /<a href="([^"]+)"[^>]*>(?:[\s\S]*?)<img[^>]*src="([^"]+)"[^>]*>(?:[\s\S]*?)<div class="gridtitlek">([^<]+)<\/div>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const link = match[1].startsWith("http") ? match[1] : this.baseUrl + match[1];
      const image = match[2].startsWith("http") ? match[2] : this.baseUrl + match[2];
      const title = match[3];

      results.push({
        title: title,
        url: link,
        image: image
      });
    }

    return results;
  },

  fetchAnimeInfo: async function (url) {
    return {
      title: "Coming soon...",
      episodes: [],
    };
  },

  fetchEpisodes: async function (url) {
    return [];
  },

  loadEpisodeSources: async function (url) {
    return [];
  },

  fetchPopular: async function () {
    return [];
  },

  fetchLatest: async function () {
    return [];
  }
};
