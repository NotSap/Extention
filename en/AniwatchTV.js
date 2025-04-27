class AnimeAPI {
  constructor() {
    this.config = {
      name: "AniwatchTV + Zoro Fallback",
      version: "1.0",
      aniwatch: {
        baseUrl: "https://aniwatchtv.to",
        searchPath: "/search",
        ajaxPath: "/ajax/v2/episode/list"
      },
      zoro: {
        baseUrl: "https://zoro.to",
        searchPath: "/search",
        ajaxPath: "/ajax/v2/episode/list"
      },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml"
      }
    };
  }

  // Main search method
  async search(query) {
    try {
      console.log(`Initiating search for: ${query}`);
      
      const results = await Promise.any([
        this._searchAniwatch(query),
        this._searchZoro(query)
      ]).catch(() => []);

      if (!results.length) {
        throw new Error("No results from any source");
      }

      return this._removeDuplicates(results);
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  }

  // Aniwatch search implementation
  async _searchAniwatch(query) {
    const url = `${this.config.aniwatch.baseUrl}${this.config.aniwatch.searchPath}?keyword=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(url, { headers: this.config.headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const html = await response.text();
      const dom = new DOMParser().parseFromString(html, "text/html");
      
      return Array.from(dom.querySelectorAll(".flw-item")).map(item => ({
        id: `aw_${item.querySelector("a")?.href?.split('/').pop()}`,
        title: item.querySelector(".film-name")?.textContent?.trim(),
        url: item.querySelector("a")?.href,
        image: item.querySelector("img")?.getAttribute("data-src"),
        source: "Aniwatch"
      })).filter(item => item.id && item.title);
    } catch (error) {
      console.error("Aniwatch search failed:", error);
      return [];
    }
  }

  // Zoro search fallback
  async _searchZoro(query) {
    const url = `${this.config.zoro.baseUrl}${this.config.zoro.searchPath}?keyword=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(url, { headers: this.config.headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const html = await response.text();
      const dom = new DOMParser().parseFromString(html, "text/html");
      
      return Array.from(dom.querySelectorAll(".flw-item")).map(item => ({
        id: `zo_${item.querySelector("a")?.href?.split('/').pop()}`,
        title: item.querySelector(".film-name")?.textContent?.trim(),
        url: item.querySelector("a")?.href,
        image: item.querySelector("img")?.getAttribute("data-src"),
        source: "Zoro"
      })).filter(item => item.id && item.title);
    } catch (error) {
      console.error("Zoro search failed:", error);
      return [];
    }
  }

  // Helper to remove duplicate results
  _removeDuplicates(results) {
    const unique = new Map();
    results.forEach(item => {
      if (!unique.has(item.title)) {
        unique.set(item.title, item);
      }
    });
    return Array.from(unique.values());
  }

  // Get anime info
  async getAnimeInfo(id) {
    try {
      if (id.startsWith("aw_")) {
        return this._getAniwatchInfo(id.replace("aw_", ""));
      } else if (id.startsWith("zo_")) {
        return this._getZoroInfo(id.replace("zo_", ""));
      }
      throw new Error("Invalid ID format");
    } catch (error) {
      console.error("Info fetch error:", error);
      return null;
    }
  }

  // Additional methods for episodes, sources etc...
  // [Previous implementations from the last code can be added here]
}

// ===== USAGE EXAMPLE =====
const api = new AnimeAPI(); // Initialize properly

// Test search
api.search("one piece")
  .then(results => {
    console.log("Search Results:", results);
    if (results.length > 0) {
      return api.getAnimeInfo(results[0].id);
    }
  })
  .then(info => console.log("Anime Info:", info))
  .catch(err => console.error("Execution error:", err));
