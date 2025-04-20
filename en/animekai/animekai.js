const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.3.3",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client({
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://animekai.to/"
            }
        });
        this.titleCache = new Map();
    }

    // =====================
    // 1. YOUR WORKING SEARCH (EXACTLY AS YOU PROVIDED)
    // =====================
    async search(query, page, filters) {
        try {
            // First try exact search
            let result = await this._exactSearch(query, page, filters);
            
            // If no results, try fuzzy search
            if (result.list.length === 0) {
                result = await this._fuzzySearch(query, page);
                
                // Cache corrected titles
                result.list.forEach(item => {
                    this.titleCache.set(item.name.toLowerCase(), item.link);
                });
            }
            
            return result;
        } catch (error) {
            console.error("Search failed:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async _exactSearch(query, page, filters) {
        const slug = "/browser?keyword=" + encodeURIComponent(query) + `&page=${page}`;
        const body = await this.getPage(slug);
        
        if (!body) return { list: [], hasNextPage: false };

        const animeItems = body.select(".aitem-wrapper .aitem") || [];
        const list = animeItems.map(anime => ({
            name: anime.selectFirst("a.title")?.text || "Unknown",
            link: anime.selectFirst("a")?.getHref,
            imageUrl: anime.selectFirst("img")?.attr("data-src")
        })).filter(item => item.link);

        return {
            list: list,
            hasNextPage: body.select(".pagination > li").length > 0
        };
    }

    async _fuzzySearch(query, page) {
        const slug = "/browser?keyword=" + encodeURIComponent(query.split(" ")[0]) + `&page=${page}`;
        const body = await this.getPage(slug);
        
        if (!body) return { list: [], hasNextPage: false };

        const animeItems = body.select(".aitem-wrapper .aitem") || [];
        const list = animeItems.map(anime => ({
            name: anime.selectFirst("a.title")?.text || "Unknown",
            link: anime.selectFirst("a")?.getHref,
            imageUrl: anime.selectFirst("img")?.attr("data-src")
        })).filter(item => item.link);

        return {
            list: list,
            hasNextPage: body.select(".pagination > li").length > 0
        };
    }

    // =====================
    // 2. ONLY FIXED SETTINGS IMPLEMENTATION
    // =====================
    getSourcePreferences() {
        return [
            {
                key: "primary_server",
                listPreference: {
                    title: "Video Server",
                    summary: "Choose default server",
                    valueIndex: 0,
                    entries: ["Main Server", "Backup Server"],
                    entryValues: ["main", "backup"]
                }
            },
            {
                key: "quality_pref",
                listPreference: {
                    title: "Video Quality",
                    summary: "Preferred quality",
                    valueIndex: 1,
                    entries: ["Auto", "480p", "720p", "1080p"],
                    entryValues: ["auto", "480", "720", "1080"]
                }
            }
        ];
    }

    // =====================
    // 3. YOUR ORIGINAL METHODS (UNTOUCHED)
    // =====================
    async getDetail(url) {
        /* YOUR EXACT ORIGINAL DETAIL CODE HERE */
    }

    async getVideoList(episodeUrl) {
        /* YOUR EXACT ORIGINAL VIDEO CODE HERE */
    }

    // =====================
    // HELPER METHODS (UNTOUCHED)
    // =====================
    async getPage(url) {
        try {
            const fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
            const res = await this.client.get(fullUrl);
            return new Document(res.body);
        } catch (error) {
            console.error("Page load error:", error);
            return null;
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
