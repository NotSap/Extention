const AnimeSource = {
  name: "AniwatchTV + Zoro",
  lang: "en",
  aniwatchUrl: "https://aniwatchtv.to",
  zoroUrl: "https://zoro.to",
  iconUrl: "https://zoro.to/favicon.ico",
  type: "multi", // Now supports multiple sources

  // Unified search with fallback
  async search(query) {
    const [aniwatchResults, zoroResults] = await Promise.allSettled([
      this._aniwatchSearch(query),
      this._zoroSearch(query)
    ]);

    return [
      ...(aniwatchResults.status === "fulfilled" ? aniwatchResults.value : []),
      ...(zoroResults.status === "fulfilled" ? zoroResults.value : [])
    ];
  },

  // AniwatchTV implementation
  async _aniwatchSearch(query) {
    try {
      const res = await fetch(`${this.aniwatchUrl}/search?keyword=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      
      return Array.from(doc.querySelectorAll(".flw-item")).map(el => ({
        id: `aw-${el.querySelector("a")?.href?.match(/watch\/([^\/]+)/)?.[1] || ""}`,
        title: el.querySelector(".film-name a")?.textContent?.trim() || "",
        image: el.querySelector("img")?.dataset?.src || "",
        source: "Aniwatch"
      })).filter(i => i.id && i.title);
    } catch (e) {
      console.error("Aniwatch search failed:", e);
      return [];
    }
  },

  // Zoro.to fallback implementation
  async _zoroSearch(query) {
    try {
      const res = await fetch(`${this.zoroUrl}/search?keyword=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      
      return Array.from(doc.querySelectorAll(".flw-item")).map(el => ({
        id: `zo-${el.querySelector("a")?.href?.match(/watch\/([^\/]+)/)?.[1] || ""}`,
        title: el.querySelector(".film-name a")?.textContent?.trim() || "",
        image: el.querySelector("img")?.dataset?.src || "",
        source: "Zoro"
      })).filter(i => i.id && i.title);
    } catch (e) {
      console.error("Zoro search failed:", e);
      return [];
    }
  },

  // Unified info fetcher
  async fetchAnimeInfo(id) {
    if (id.startsWith("aw-")) {
      return this._fetchAniwatchInfo(id.replace("aw-", ""));
    } else if (id.startsWith("zo-")) {
      return this._fetchZoroInfo(id.replace("zo-", ""));
    }
    return null;
  },

  // AniwatchTV info fetcher
  async _fetchAniwatchInfo(id) {
    try {
      const res = await fetch(`${this.aniwatchUrl}/watch/${id}`);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      
      return {
        id: `aw-${id}`,
        title: doc.querySelector(".film-name")?.textContent?.trim() || "",
        description: doc.querySelector(".film-description")?.textContent?.trim() || "",
        image: doc.querySelector(".film-poster img")?.src || "",
        episodes: await this._fetchAniwatchEpisodes(id),
        source: "Aniwatch"
      };
    } catch (e) {
      console.error("Aniwatch info fetch failed:", e);
      return null;
    }
  },

  // Zoro.to info fetcher
  async _fetchZoroInfo(id) {
    try {
      const res = await fetch(`${this.zoroUrl}/watch/${id}`);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      
      return {
        id: `zo-${id}`,
        title: doc.querySelector(".film-name")?.textContent?.trim() || "",
        description: doc.querySelector(".film-description")?.textContent?.trim() || "",
        image: doc.querySelector(".film-poster img")?.src || "",
        episodes: await this._fetchZoroEpisodes(id),
        source: "Zoro"
      };
    } catch (e) {
      console.error("Zoro info fetch failed:", e);
      return null;
    }
  },

  // Episode loading implementations...
  async _fetchAniwatchEpisodes(id) {
    try {
      const res = await fetch(`${this.aniwatchUrl}/ajax/v2/episode/list/${id}`);
      const { html } = await res.json();
      const doc = new DOMParser().parseFromString(html, "text/html");
      
      return Array.from(doc.querySelectorAll("a.ep-item")).map(el => ({
        id: `aw-${el.href.match(/watch\/([^\/]+)/)?.[1] || ""}`,
        number: parseFloat(el.dataset.number) || 0
      }));
    } catch (e) {
      console.error("Aniwatch episodes fetch failed:", e);
      return [];
    }
  },

  async _fetchZoroEpisodes(id) {
    try {
      const res = await fetch(`${this.zoroUrl}/ajax/v2/episode/list/${id}`);
      const { html } = await res.json();
      const doc = new DOMParser().parseFromString(html, "text/html");
      
      return Array.from(doc.querySelectorAll("a.ep-item")).map(el => ({
        id: `zo-${el.href.match(/watch\/([^\/]+)/)?.[1] || ""}`,
        number: parseFloat(el.dataset.number) || 0
      }));
    } catch (e) {
      console.error("Zoro episodes fetch failed:", e);
      return [];
    }
  },

  // Unified source loader
  async loadEpisodeSources(episodeId) {
    if (episodeId.startsWith("aw-")) {
      return this._loadAniwatchSources(episodeId.replace("aw-", ""));
    } else if (episodeId.startsWith("zo-")) {
      return this._loadZoroSources(episodeId.replace("zo-", ""));
    }
    return [];
  },

  // Source loading implementations...
  async _loadAniwatchSources(id) {
    try {
      const res = await fetch(`${this.aniwatchUrl}/watch/${id}`);
      const iframeSrc = (await res.text()).match(/iframe.*?src="(.*?)"/)?.[1];
      return iframeSrc ? [{
        url: iframeSrc.startsWith("http") ? iframeSrc : `https:${iframeSrc}`,
        quality: "default",
        isM3U8: iframeSrc.includes(".m3u8"),
        source: "Aniwatch"
      }] : [];
    } catch (e) {
      console.error("Aniwatch source load failed:", e);
      return [];
    }
  },

  async _loadZoroSources(id) {
    try {
      const res = await fetch(`${this.zoroUrl}/watch/${id}`);
      const iframeSrc = (await res.text()).match(/iframe.*?src="(.*?)"/)?.[1];
      return iframeSrc ? [{
        url: iframeSrc.startsWith("http") ? iframeSrc : `https:${iframeSrc}`,
        quality: "default",
        isM3U8: iframeSrc.includes(".m3u8"),
        source: "Zoro"
      }] : [];
    } catch (e) {
      console.error("Zoro source load failed:", e);
      return [];
    }
  }
};

// Usage test
AnimeSource.search("one piece")
  .then(results => {
    console.log("Search Results:", results);
    if (results.length > 0) {
      return AnimeSource.fetchAnimeInfo(results[0].id);
    }
  })
  .then(animeInfo => {
    if (animeInfo) {
      console.log("Anime Info:", animeInfo);
      if (animeInfo.episodes.length > 0) {
        return AnimeSource.loadEpisodeSources(animeInfo.episodes[0].id);
      }
    }
  })
  .then(sources => console.log("Video Sources:", sources))
  .catch(console.error);
