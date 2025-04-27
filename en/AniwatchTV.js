const Aniwatch = {
  name: "AniwatchTV",
  lang: "en",
  baseUrl: "https://aniwatchtv.to",
  iconUrl: "https://aniwatchtv.to/favicon.ico",
  type: "single", // Direct streaming

  async search(query) {
    try {
      const searchUrl = `${this.baseUrl}/search?keyword=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0" } // Bypass anti-bot
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      return Array.from(doc.querySelectorAll(".flw-item")).map(el => ({
        id: el.querySelector(".film-name a")?.href?.match(/watch\/([^\/]+)/)?.[1] || "",
        title: el.querySelector(".film-name a")?.textContent?.trim() || "",
        image: el.querySelector("img")?.dataset?.src || ""
      })).filter(item => item.id && item.title);
      
    } catch (e) {
      console.error("Search failed:", e);
      return [];
    }
  },

  async fetchAnimeInfo(id) {
    try {
      const url = `${this.baseUrl}/watch/${id}`;
      const res = await fetch(url);
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");

      return {
        id: id,
        title: doc.querySelector(".film-name")?.textContent?.trim() || id,
        description: doc.querySelector(".film-description")?.textContent?.trim() || "",
        image: doc.querySelector(".film-poster img")?.src || "",
        episodes: await this.fetchEpisodes(id) // Auto-load episodes
      };
    } catch (e) {
      console.error("Info fetch failed:", e);
      return null;
    }
  },

  async fetchEpisodes(id) {
    try {
      const res = await fetch(`${this.baseUrl}/ajax/v2/episode/list/${id}`);
      const { html } = await res.json();
      const doc = new DOMParser().parseFromString(html, "text/html");

      return Array.from(doc.querySelectorAll("a.ep-item")).map(el => ({
        id: el.href.match(/watch\/([^\/]+)/)?.[1] || "",
        number: parseFloat(el.dataset.number) || 0,
        title: `Episode ${parseFloat(el.dataset.number)}`
      }));
    } catch (e) {
      console.error("Episodes fetch failed:", e);
      return [];
    }
  },

  async loadEpisodeSources(episodeId) {
    try {
      const res = await fetch(`${this.baseUrl}/watch/${episodeId}`);
      const iframeSrc = (await res.text()).match(/iframe.*?src="(.*?)"/)?.[1];
      if (!iframeSrc) return [];

      return [{
        url: iframeSrc.startsWith("http") ? iframeSrc : `https:${iframeSrc}`,
        quality: "default",
        isM3U8: iframeSrc.includes(".m3u8")
      }];
    } catch (e) {
      console.error("Source load failed:", e);
      return [];
    }
  }
};

// Usage example
Aniwatch.search("one piece")
  .then(console.log)
  .catch(console.error);
