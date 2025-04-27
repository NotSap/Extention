export default {
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
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const elements = doc.querySelectorAll(".film-detail a[href^='/anime/']");
    elements.forEach((el) => {
      const title = el.textContent.trim();
      const href = el.getAttribute("href");
      if (href && title) {
        results.push({
          title: title,
          url: `https://bestdubbedanime.com${href}`,
          thumbnail: "", // optional
        });
      }
    });

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
