// manga-yomi-anime.source.js
const AniwatchZoro = {
  // Required MangaYomi fields
  name: "Aniwatch/Zoro",
  id: "aniwatch_zoro",
  icon: "https://zoro.to/favicon.ico",
  version: "1.0",
  needsCloudflareBypass: true,
  supportedLanguages: ["en"],
  type: "anime", // Critical for proper categorization

  // Base URLs
  _sources: {
    aniwatch: "https://aniwatchtv.to",
    zoro: "https://zoro.to"
  },

  // Required MangaYomi methods
  async search(query) {
    try {
      const results = await Promise.any([
        this._searchAniwatch(query),
        this._searchZoro(query)
      ]);
      return this._deduplicate(results);
    } catch (error) {
      console.error("[Aniwatch/Zoro] Search failed:", error);
      return [];
    }
  },

  async getAnimeInfo(id) {
    const [source, realId] = id.split(":");
    try {
      return source === "aw" 
        ? await this._getAniwatchInfo(realId)
        : await this._getZoroInfo(realId);
    } catch (error) {
      console.error("[Aniwatch/Zoro] Info fetch failed:", error);
      return null;
    }
  },

  async getEpisodes(id) {
    const [source, realId] = id.split(":");
    try {
      return source === "aw"
        ? await this._getAniwatchEpisodes(realId)
        : await this._getZoroEpisodes(realId);
    } catch (error) {
      console.error("[Aniwatch/Zoro] Episodes fetch failed:", error);
      return [];
    }
  },

  async loadVideoSources(episodeId) {
    const [source, realId] = episodeId.split(":");
    try {
      return source === "aw"
        ? await this._loadAniwatchSources(realId)
        : await this._loadZoroSources(realId);
    } catch (error) {
      console.error("[Aniwatch/Zoro] Source load failed:", error);
      return [];
    }
  },

  // Implementation details
  async _searchAniwatch(query) {
    const url = `${this._sources.aniwatch}/search?keyword=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    
    return Array.from(doc.querySelectorAll(".flw-item")).map(el => ({
      id: `aw:${el.querySelector("a")?.href?.split("/").pop()}`,
      title: el.querySelector(".film-name")?.textContent?.trim(),
      image: el.querySelector("img")?.dataset?.src
    })).filter(i => i.id && i.title);
  },

  async _searchZoro(query) {
    const url = `${this._sources.zoro}/search?keyword=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    
    return Array.from(doc.querySelectorAll(".flw-item")).map(el => ({
      id: `zo:${el.querySelector("a")?.href?.split("/").pop()}`,
      title: el.querySelector(".film-name")?.textContent?.trim(),
      image: el.querySelector("img")?.dataset?.src
    })).filter(i => i.id && i.title);
  },

  async _getAniwatchInfo(id) {
    const url = `${this._sources.aniwatch}/watch/${id}`;
    const res = await fetch(url);
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    
    return {
      id: `aw:${id}`,
      title: doc.querySelector(".film-name")?.textContent?.trim(),
      description: doc.querySelector(".film-description")?.textContent?.trim(),
      image: doc.querySelector(".film-poster img")?.src,
      genres: Array.from(doc.querySelectorAll(".film-genre a")).map(a => a.textContent),
      episodes: await this._getAniwatchEpisodes(id)
    };
  },

  async _getAniwatchEpisodes(id) {
    const url = `${this._sources.aniwatch}/ajax/v2/episode/list/${id}`;
    const { html } = await (await fetch(url)).json();
    const doc = new DOMParser().parseFromString(html, "text/html");
    
    return Array.from(doc.querySelectorAll("a.ep-item")).map(el => ({
      id: `aw:${el.href.split("/").pop()}`,
      number: Number(el.dataset.number),
      title: `Episode ${el.dataset.number}`
    }));
  },

  async _loadAniwatchSources(id) {
    const url = `${this._sources.aniwatch}/watch/${id}`;
    const res = await fetch(url);
    const iframeSrc = (await res.text()).match(/iframe.*?src="(.*?)"/)?.[1];
    
    return [{
      url: iframeSrc?.startsWith("http") ? iframeSrc : `https:${iframeSrc}`,
      quality: "Auto",
      format: iframeSrc?.includes(".m3u8") ? "hls" : "mp4"
    }].filter(s => s.url);
  },

  // Similar implementations for Zoro methods
  async _getZoroInfo(id) { /* ... */ },
  async _getZoroEpisodes(id) { /* ... */ },
  async _loadZoroSources(id) { /* ... */ },

  // Helper methods
  _deduplicate(results) {
    const seen = new Set();
    return results.filter(item => {
      const key = item.title.toLowerCase();
      return seen.has(key) ? false : seen.add(key);
    });
  }
};

// MangaYomi registration
if (typeof registerSource !== "undefined") {
  registerSource(AniwatchZoro);
} else {
  console.warn("MangaYomi environment not detected");
}
