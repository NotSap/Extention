const extension = {
  name: "BestDubbedAnime",
  lang: "en",
  baseUrl: "https://bestdubbedanime.com",
  isManga: false,
  isNsfw: false,
  headers: {},

  search: async (query, page, { fetch }) => {
    // This will later be improved for real search
    return { results: [] };
  },

  fetchAnimeInfo: async (url, { fetch }) => {
    return {
      title: "Example Anime",
      description: "Description not available.",
      image: "",
      genres: [],
      status: "",
      episodes: [],
    };
  },

  fetchEpisodes: async (url, { fetch }) => {
    return [];
  },

  loadEpisodeSources: async (url, { fetch }) => {
    return [];
  },

  getSettings: () => {
    return [
      {
        key: "preferredQuality",
        type: "picker",
        name: "Preferred Quality",
        options: ["1080p", "720p", "480p"],
        defaultValue: "1080p",
      },
    ];
  },
};
