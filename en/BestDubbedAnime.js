const extension = {
  id: "bestdubbedanime",
  name: "BestDubbedAnime",
  icon: "https://www.google.com/s2/favicons?sz=64&domain=bestdubbedanime.com",
  version: "1.0.0",
  baseUrl: "https://bestdubbedanime.com",
  isAdult: false,
  lang: "en",

  async search(query) {
    const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const html = await response.text();
    // Parse HTML and return search results
    return [];
  },

  async fetchAnimeInfo(url) {
    const response = await fetch(url);
    const html = await response.text();
    // Parse HTML and return anime info
    return {};
  },

  async fetchEpisodes(url) {
    const response = await fetch(url);
    const html = await response.text();
    // Parse HTML and return episodes
    return [];
  },

  async loadEpisodeSources(url) {
    const response = await fetch(url);
    const html = await response.text();
    // Parse HTML and return video sources
    return [];
  },

  async fetchPopular() {
    // Implement fetching popular anime
    return [];
  },

  async fetchLatest() {
    // Implement fetching latest anime
    return [];
  }
};
