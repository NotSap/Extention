export default new Extension({
  name: "BestDubbedAnime",
  lang: "en",
  domains: ["bestdubbedanime.com"],

  fetchSearchAnime: async (search, page) => {
    const url = `https://bestdubbedanime.com/series?page=1`;
    const res = await request(url);
    const doc = parseHtml(res);

    const elements = doc.querySelectorAll(".col-lg-2.col-md-3.col-6");

    const searchLower = search.toLowerCase();
    const results = [];

    elements.forEach(el => {
      const title = el.querySelector("h6")?.textContent?.trim() ?? "";
      const href = el.querySelector("a")?.getAttribute("href") ?? "";
      const img = el.querySelector("img")?.getAttribute("src") ?? "";

      if (title.toLowerCase().includes(searchLower)) {
        results.push({
          title,
          url: "https://bestdubbedanime.com" + href,
          thumbnailUrl: img.startsWith("http") ? img : "https://bestdubbedanime.com" + img
        });
      }
    });

    return createPaginatedResults(results, false);
  },

  fetchPopularAnime: async (page) => {
    const url = `https://bestdubbedanime.com/series?page=${page}`;
    const res = await request(url);
    const doc = parseHtml(res);

    const elements = doc.querySelectorAll(".col-lg-2.col-md-3.col-6");
    const results = [];

    elements.forEach(el => {
      const title = el.querySelector("h6")?.textContent?.trim() ?? "";
      const href = el.querySelector("a")?.getAttribute("href") ?? "";
      const img = el.querySelector("img")?.getAttribute("src") ?? "";

      results.push({
        title,
        url: "https://bestdubbedanime.com" + href,
        thumbnailUrl: img.startsWith("http") ? img : "https://bestdubbedanime.com" + img
      });
    });

    return createPaginatedResults(results, false);
  },

  fetchAnimeInfo: async (url) => {
    const res = await request(url);
    const doc = parseHtml(res);

    const title = doc.querySelector(".anime__details__title h3")?.textContent?.trim() ?? "No Title";
    const description = doc.querySelector(".anime__details__text p")?.textContent?.trim() ?? "";
    const thumbnailUrl = doc.querySelector(".anime__details__pic img")?.getAttribute("src") ?? "";

    return {
      title,
      description,
      thumbnailUrl: thumbnailUrl.startsWith("http") ? thumbnailUrl : "https://bestdubbedanime.com" + thumbnailUrl,
      episodes: await BestDubbedAnime.fetchEpisodes(url)
    };
  },

  fetchEpisodes: async (url) => {
    const res = await request(url);
    const doc = parseHtml(res);

    const epElements = doc.querySelectorAll(".episode");
    const episodes = [];

    epElements.forEach((el, index) => {
      const href = el.querySelector("a")?.getAttribute("href") ?? "";
      const episodeNumber = index + 1;

      episodes.push({
        name: `Episode ${episodeNumber}`,
        url: "https://bestdubbedanime.com" + href,
        number: episodeNumber
      });
    });

    return episodes;
  },

  loadEpisodeSources: async (episodeUrl) => {
    const res = await request(episodeUrl);
    const doc = parseHtml(res);

    const iframe = doc.querySelector("iframe");
    const videoUrl = iframe?.getAttribute("src") ?? "";

    if (!videoUrl) {
      return [];
    }

    return [
      {
        url: videoUrl,
        quality: "Default",
        isM3U8: videoUrl.includes(".m3u8")
      }
    ];
  },

  getSettings: () => {
    return [
      {
        type: "header",
        label: "BestDubbedAnime Settings"
      },
      {
        type: "switch",
        key: "sortAZ",
        label: "Sort A-Z in Popular",
        defaultValue: false
      }
    ];
  }
});
