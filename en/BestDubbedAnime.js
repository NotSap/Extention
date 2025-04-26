const baseUrl = "https://bestdubbedanime.com";

const extension = {
  id: "bestdubbedanime",
  name: "BestDubbedAnime",
  icon: "https://www.google.com/s2/favicons?sz=64&domain=bestdubbedanime.com",
  version: "1.0.0",
  baseUrl: baseUrl,
  isAdult: false,
  lang: "en",

  async search(query) {
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
        image: image,
      });
    }

    return results;
  },

  async fetchAnimeInfo(url) {
    return {
      title: "Coming soon...",
      episodes: [],
    };
  },

  async fetchEpisodes(url) {
    return [];
  },

  async loadEpisodeSources(url) {
    return [];
  },

  async fetchPopular() {
    return [];
  },

  async fetchLatest() {
    return [];
  }
};
