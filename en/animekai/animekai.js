function Animekai() {
  const baseUrl = "https://animekai.to";

  async function fetchDocument(url) {
    const res = await fetch(url);
    const html = await res.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  function parseAnimeList(doc) {
    const items = doc.querySelectorAll(".film_list-wrap .flw-item");
    return Array.from(items).map((el) => {
      const anchor = el.querySelector(".film-name a");
      return {
        title: anchor?.textContent.trim(),
        url: anchor?.href,
        thumbnailUrl: el.querySelector("img")?.getAttribute("data-src") || el.querySelector("img")?.src
      };
    });
  }

  function parseEpisodes(doc, url) {
    const epItems = doc.querySelectorAll(".eps-item");
    if (epItems.length === 0) {
      // fallback for single episode format
      return [{
        title: "Episode 1",
        url
      }];
    }
    return Array.from(epItems).map((el) => ({
      title: el.textContent.trim(),
      url: el.href
    }));
  }

  async function extractVideoSources(embedUrl) {
    const res = await fetch(embedUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const iframe = doc.querySelector("iframe");
    if (!iframe) return [];

    const embedSrc = iframe.src;
    const host = new URL(embedSrc).hostname;

    return [
      {
        url: embedSrc,
        quality: "Default",
        isM3U8: embedSrc.includes(".m3u8"),
        headers: {
          Referer: baseUrl
        }
      }
    ];
  }

  return {
    name: "Animekai",
    lang: "en",
    type: "anime",

    fetchPopular: async (page) => {
      const doc = await fetchDocument(`${baseUrl}/popular?page=${page}`);
      return parseAnimeList(doc);
    },

    fetchLatest: async (page) => {
      const doc = await fetchDocument(`${baseUrl}/?page=${page}`);
      return parseAnimeList(doc);
    },

    search: async (query, page) => {
      const doc = await fetchDocument(`${baseUrl}/search?keyword=${encodeURIComponent(query)}&page=${page}`);
      return parseAnimeList(doc);
    },

    fetchAnimeInfo: async (url) => {
      const doc = await fetchDocument(url);

      const title = doc.querySelector(".film-name")?.textContent.trim();
      const description = doc.querySelector(".description")?.textContent.trim();
      const thumbnailUrl = doc.querySelector(".film-poster img")?.src;
      const genres = Array.from(doc.querySelectorAll(".item.item-list a")).map(el => el.textContent.trim());

      return {
        title,
        description,
        genres,
        thumbnailUrl,
        url
      };
    },

    fetchEpisodes: async (url) => {
      const doc = await fetchDocument(url);
      return parseEpisodes(doc, url);
    },

    loadEpisodeSources: async (url) => {
      const doc = await fetchDocument(url);
      const iframe = doc.querySelector("iframe");
      if (!iframe) return [];
      const embedUrl = iframe.src.startsWith("http") ? iframe.src : baseUrl + iframe.src;
      return await extractVideoSources(embedUrl);
    }
  };
}

globalThis.Animekai = Animekai;
