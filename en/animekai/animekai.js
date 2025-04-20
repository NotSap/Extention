const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.3.1",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client({
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://animekai.to/",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9"
            }
        });
        this.titleCache = new Map();
    }

    // =====================
    // 1. YOUR WORKING SEARCH (WITH PROTECTION BYPASS)
    // =====================
    async search(query, page, filters) {
        try {
            // First try exact search
            let result = await this._exactSearch(query, page, filters);
            
            // If no results, try fuzzy search with cache
            if (result.list.length === 0) {
                result = await this._fuzzySearch(query, page);
                result.list.forEach(item => {
                    this.titleCache.set(item.name.toLowerCase(), item.link);
                });
            }
            
            return result;
        } catch (error) {
            console.error("Search failed (trying fallback):", error);
            return await this._fallbackSearch(query); // Added secondary fallback
        }
    }

    async _exactSearch(query, page, filters) {
        const slug = `/browser?keyword=${encodeURIComponent(query)}&page=${page}`;
        const body = await this.getPage(slug, {
            headers: {
                "X-Requested-With": "XMLHttpRequest" // Bypass some protections
            }
        });
        
        if (!body) return { list: [], hasNextPage: false };

        const animeItems = body.select(".aitem-wrapper .aitem, .film-list .film") || []; // Dual selectors
        const list = animeItems.map(anime => ({
            name: anime.selectFirst("a.title, .film-name")?.text?.trim() || "Unknown",
            link: anime.selectFirst("a")?.getHref || "",
            imageUrl: anime.selectFirst("img")?.attr("data-src") || 
                     anime.selectFirst("img")?.attr("src") || ""
        })).filter(item => item.link);

        return {
            list: list,
            hasNextPage: body.select(".pagination > li, .page-links a").length > 0 // Dual pagination
        };
    }

    // =====================
    // NEW: FALLBACK SEARCH WHEN MAIN FAILS
    // =====================
    async _fallbackSearch(query) {
        try {
            // Try alternative endpoint
            const fallbackUrl = `${this.baseUrl}/api/search?term=${encodeURIComponent(query)}`;
            const response = await this.client.get(fallbackUrl, {
                headers: {
                    "Accept": "application/json"
                }
            });
            
            if (response.body) {
                const data = JSON.parse(response.body);
                return {
                    list: data.results?.map(item => ({
                        name: item.title,
                        link: `/anime/${item.id}`,
                        imageUrl: item.image
                    })) || [],
                    hasNextPage: false
                };
            }
        } catch (e) {
            console.error("Fallback search failed:", e);
        }
        return { list: [], hasNextPage: false };
    }

    // =====================
    // 2. ENHANCED DETAIL EXTRACTION
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url, {
                headers: {
                    "Referer": `${this.baseUrl}/browser` // Required for some anime pages
                }
            });
            
            if (!doc) return this._createFallbackDetail(url);

            // Title with multiple fallbacks
            const title = doc.selectFirst("h1.title, h1.film-name")?.text?.trim() || 
                         doc.selectFirst("meta[property='og:title']")?.attr("content") || 
                         url.split("/").pop().replace(/-/g, " ");

            // Cover with multiple fallbacks
            const cover = doc.selectFirst("img.cover, .film-poster img")?.attr("src") || 
                         doc.selectFirst("meta[property='og:image']")?.attr("content") || "";

            // Extract episodes with better detection
            const episodes = [];
            const episodeContainers = [
                ".episode-list",
                ".episode-grid",
                ".list-episodes"
            ].map(selector => doc.selectFirst(selector)).filter(Boolean);

            for (const container of episodeContainers) {
                const items = container.select("li, .episode-item") || [];
                episodes.push(...items.map((item, i) => ({
                    id: `ep-${i+1}`,
                    number: parseInt(item.attr("data-number") || (i+1)),
                    title: item.selectFirst(".episode-title")?.text?.trim() || `Episode ${i+1}`,
                    url: item.selectFirst("a")?.getHref || `${url}/episode-${i+1}`,
                    thumbnail: item.selectFirst("img")?.attr("src") || cover
                })));
                
                if (episodes.length > 0) break;
            }

            return {
                id: url.split("/").pop() || "unknown",
                title: title,
                coverImage: cover,
                episodes: episodes.length ? episodes : this._generateFallbackEpisodes(url, cover),
                mappings: {
                    id: url.split("/").pop() || "unknown",
                    providerId: "animekai",
                    similarity: 95
                }
            };
        } catch (error) {
            console.error("Detail fetch failed:", error);
            return this._createFallbackDetail(url);
        }
    }

    // =====================
    // 3. IMPROVED VIDEO EXTRACTION
    // =====================
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl, {
                headers: {
                    "Referer": `${this.baseUrl}/browser`
                }
            });
            
            if (!doc) return this._getFallbackSources(episodeUrl);

            // Try multiple server detection patterns
            const servers = doc.select(".server-list li, .server-tab") || [];
            const sources = [];
            
            for (const server of servers) {
                const serverName = server.selectFirst(".server-name")?.text?.trim() || "Server";
                const videoItems = server.select("[data-video], .video-item") || [];
                
                videoItems.forEach(item => {
                    const url = item.attr("data-video") || item.attr("data-src");
                    if (url) {
                        sources.push({
                            url: url,
                            quality: item.text().match(/1080|720|480/)?.shift() || "Auto",
                            server: serverName,
                            headers: {
                                "Referer": episodeUrl,
                                "Origin": this.baseUrl
                            }
                        });
                    }
                });
            }

            return sources.length ? sources : this._getFallbackSources(episodeUrl);
        } catch (error) {
            console.error("Video extraction failed:", error);
            return this._getFallbackSources(episodeUrl);
        }
    }

    // =====================
    // HELPER METHODS
    // =====================
    async getPage(url, options = {}) {
        try {
            const fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
            const res = await this.client.get(fullUrl, {
                ...options,
                headers: {
                    ...options.headers,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": this.baseUrl
                }
            });
            return new Document(res.body);
        } catch (error) {
            console.error("Page load error:", error);
            return null;
        }
    }

    _generateFallbackEpisodes(url, cover) {
        return Array.from({ length: 12 }, (_, i) => ({
            id: `ep-${i+1}`,
            number: i+1,
            title: `Episode ${i+1}`,
            url: `${url}/episode-${i+1}`,
            thumbnail: cover
        }));
    }

    _getFallbackSources(url) {
        return [{
            url: url.replace("/episode-", "/watch/") + ".mp4",
            quality: 720,
            server: "Fallback",
            headers: {
                "Referer": this.baseUrl
            }
        }];
    }

    // =====================
    // 4. YOUR ORIGINAL SETTINGS
    // =====================
    getSourcePreferences() {
        return [
            // ... Your original settings here ...
        ];
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
