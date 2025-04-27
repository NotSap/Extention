/** @type {Extension} */
const extension = {
  id: 92749201,
  name: "BestDubbedAnime",
  icon: "https://www.google.com/s2/favicons?sz=256&domain=bestdubbedanime.com",
  site: "https://bestdubbedanime.com",
  version: "1.0.0",
  langs: ["en"],
  isAdult: false,

  search: async (query, page, { fetch }) => {
    const searchUrl = `https://bestdubbedanime.com/search?query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl);
    const html = await res.text();

    const results = [];
    const regex = /<a href="(\/anime\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      results.push({
        title: match[2],
        url: `https://bestdubbedanime.com${match[1]}`,
        thumbnail: "",
      });
    }

    return { results };
  },

  fetchAnimeInfo: async (url, { fetch }) => {
    const res = await fetch(url);
    const html = await res.text();

    return {
      title: "Unknown Title",
      description: "No description available.",
      image: "",
      genres: [],
      status: "Unknown",
      episodes: [],
    };
  },

  fetchEpisodes: async (url, { fetch }) => {
    return [];
  },

  loadEpisodeSources: async (url, { fetch }) => {
    return [];
  },

  getSettings: () => [
    {
      key: "preferredQuality",
      type: "picker",
      name: "Preferred Quality",
      options: ["1080p", "720p", "480p"],
      defaultValue: "1080p",
    },
  ],
};
