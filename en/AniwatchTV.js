// 1. First create a proper class definition
class AnimeSearch {
  constructor() {
    this.sources = {
      aniwatch: {
        baseUrl: "https://aniwatchtv.to",
        name: "Aniwatch",
        prefix: "aw_"
      },
      zoro: {
        baseUrl: "https://zoro.to",
        name: "Zoro",
        prefix: "zo_"
      }
    };
    
    // Initialize with default headers
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "text/html,application/xhtml+xml"
    };
  }

  // 2. Main search method - now properly bound to class instance
  async search(query) {
    if (!query || typeof query !== 'string') {
      throw new Error("Invalid search query");
    }
    
    try {
      console.log(`Searching for "${query}" across sources...`);
      
      // Try both sources simultaneously
      const results = await Promise.any([
        this._searchSource(query, 'aniwatch'),
        this._searchSource(query, 'zoro')
      ]).catch(() => []);
      
      return this._processResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      return [];
    }
  }

  // 3. Unified source search method
  async _searchSource(query, sourceName) {
    const source = this.sources[sourceName];
    if (!source) throw new Error(`Unknown source: ${sourceName}`);
    
    const searchUrl = `${source.baseUrl}/search?keyword=${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(searchUrl, { headers: this.headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const html = await response.text();
      const dom = new DOMParser().parseFromString(html, "text/html");
      
      const items = Array.from(dom.querySelectorAll(".flw-item"));
      if (!items.length) throw new Error("No results found");
      
      return items.map(item => ({
        id: `${source.prefix}${item.querySelector("a")?.href?.split('/').pop() || ''}`,
        title: item.querySelector(".film-name")?.textContent?.trim() || "Untitled",
        url: item.querySelector("a")?.href || '',
        image: item.querySelector("img")?.getAttribute("data-src") || '',
        source: source.name
      })).filter(item => item.id && item.title);
    } catch (error) {
      console.error(`${source.name} search failed:`, error);
      return [];
    }
  }

  // 4. Process and clean results
  _processResults(results) {
    // Remove duplicates by title
    const uniqueResults = [];
    const seenTitles = new Set();
    
    for (const item of results) {
      if (!seenTitles.has(item.title)) {
        seenTitles.add(item.title);
        uniqueResults.push(item);
      }
    }
    
    return uniqueResults;
  }
}

// ===== PROPER USAGE =====
// Initialize the search engine
const animeSearch = new AnimeSearch();

// Execute search properly
async function runSearch() {
  try {
    // Test the search
    const results = await animeSearch.search("one piece");
    console.log("Search Results:", results);
    
    if (results.length > 0) {
      // Additional operations can go here
    }
  } catch (error) {
    console.error("Search execution failed:", error);
  }
}

// Run the search
runSearch();
