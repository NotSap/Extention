function Animekai() {
  const baseUrl = "https://animekai.to";

  async function fetchHTML(url) {
    const res = await fetch(url);
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }

  return {
    name: "Animekai",
    lang: "en",
    type: "anime",

    fetchPopular: async (page) => {
      const doc = await fetchHTML(`${baseUrl}/home?page=${page}`);
      const items = doc.querySelectorAll(".film_list-wrap .flw-item");

      return Array.from(items).map(item => ({
        title: item.querySelector(".film-name a")?.textContent.trim(),
        url: item.querySelector(".film-name a")?.href,
        thumbnailUrl: item.querySelector("img")?.getAttribute("data-src") || item.querySelector("img")?.src
      }));
    },

    fetchLatest: async (page) => {
      const doc = await fetchHTML(`${baseUrl}/home?page=${page}`);
      const items = doc.querySelectorAll(".film_list-wrap .flw-item");

      return Array.from(items).map(item => ({
        title: item.querySelector(".film-name a")?.textContent.trim(),
        url: item.querySelector(".film-name a")?.href,
        thumbnailUrl: item.querySelector("img")?.getAttribute("data-src") || item.querySelector("img")?.src
      }));
    },

    search: async (query, page) => {
      const doc = await fetchHTML(`${baseUrl}/search?keyword=${encodeURIComponent(query)}&page=${page}`);
      const results = doc.querySelectorAll(".film_list-wrap .flw-item");

      return Array.from(results).map(item => ({
        title: item.querySelector(".film-name a")?.textContent.trim(),
        url: item.querySelector(".film-name a")?.href,
        thumbnailUrl: item.querySelector("img")?.getAttribute("data-src") || item.querySelector("img")?.src
      }));
    },

    fetchAnimeInfo: async (url) => {
      const doc = await fetchHTML(url);

      const title = doc.querySelector("h2.film-name")?.textContent.trim();
      const thumbnailUrl = doc.querySelector(".film-poster img")?.getAttribute("data-src") || doc.querySelector(".film-poster img")?.src;
      const description = doc.querySelector(".description")?.textContent.trim();
      const episodes = Array.from(doc.querySelectorAll(".episodes-list .nav-item a")).map((ep, index) => ({
        name: ep.textContent.trim(),
        url: ep.href,
        number: index + 1
      }));

      return {
        title,
        thumbnailUrl,
        description,
        episodes
      };
    },

    fetchEpisodes: async (animeUrl) => {
      const doc = await fetchHTML(animeUrl);
      const episodeLinks = doc.querySelectorAll(".episodes-list .nav-item a");

      return Array.from(episodeLinks).map((ep, index) => ({
        name: ep.textContent.trim(),
        url: ep.href,
        number: index + 1
      }));
    },

    loadEpisodeSources: async (episodeUrl) => {
      const doc = await fetchHTML(episodeUrl);
      const iframe = doc.querySelector("iframe");

      if (!iframe) return [];

      const embedUrl = iframe.src;
      const res = await fetch(embedUrl);
      const embedHtml = await res.text();

      const m3u8Match = embedHtml.match(/file:\s*["'](.*?\.m3u8)["']/);

      if (m3u8Match) {
        return [{
          url: m3u8Match[1],
          quality: "default",
          isM3U8: true
        }];
      }

      return [];
    }
  };
}

globalThis.Animekai = Animekai;
