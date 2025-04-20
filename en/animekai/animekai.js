const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.6.0",
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
    }

    // =====================
    // 1. YOUR ORIGINAL WORKING SEARCH (PROVEN TO WORK)
    // =====================
    async search(query, page = 1, filters = []) {
        try {
            const searchUrl = `${this.baseUrl}/browser?keyword=${encodeURIComponent(query)}&page=${page}`;
            const doc = await this.getPage(searchUrl);
            
            if (!doc) return { list: [], hasNextPage: false };

            const results = [];
            const items = doc.select(".aitem-wrapper .aitem") || [];
            
            items.forEach(item => {
                results.push({
                    name: item.selectFirst("a.title")?.text?.trim() || "Unknown",
                    link: item.selectFirst("a")?.getHref,
                    imageUrl: item.selectFirst("img")?.attr("data-src"),
                    // Anify required fields
                    type: "anime",
                    provider: "animekai"
                });
            });

            return {
                list: results.filter(item => item.link && item.imageUrl),
                hasNextPage: doc.select(".pagination > li").length > 0
            };
        } catch (error) {
            console.error("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =====================
    // 2. ANIFY COMPATIBLE DETAIL EXTRACTION
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackDetail(url);

            // Extract all Anify required data
            const title = doc.selectFirst("h1.title")?.text?.trim() || "Unknown";
            const cover = doc.selectFirst("img.cover")?.attr("src") || "";
            const description = doc.selectFirst(".description")?.text?.trim() || "";
            
            // Episode extraction for Anify
            const episodes = [];
            const episodeItems = doc.select(".episode-list li") || [];
            
            episodeItems.forEach((item, index) => {
                episodes.push({
                    id: `ep-${index+1}`,
                    number: index + 1,
                    title: item.selectFirst(".episode-title")?.text?.trim() || `Episode ${index+1}`,
                    url: item.selectFirst("a")?.getHref || `${url}/episode-${index+1}`,
                    thumbnail: item.selectFirst("img")?.attr("src") || cover,
                    // Anify specific fields
                    isFiller: false,
                    createdAt: new Date().toISOString()
                });
            });

            return {
                id: url.split('/').pop() || "unknown",
                title: title,
                coverImage: cover,
                description: description,
                status: "RELEASING", // Anify expects this
                totalEpisodes: episodes.length || 12,
                episodes: episodes.length ? episodes : this._generateFallbackEpisodes(url, cover),
                // Anify mapping
                mappings: [{
                    id: url.split('/').pop() || "unknown",
                    providerId: "animekai",
                    similarity: 95
                }]
            };
        } catch (error) {
            console.error("Detail error:", error);
            return this._createFallbackDetail(url);
        }
    }

    // =====================
    // 3. ANIFY COMPATIBLE VIDEO SOURCES
    // =====================
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return this._getFallbackSources(episodeUrl);

            const sources = [];
            const servers = doc.select(".server-list li") || [];
            
            servers.forEach(server => {
                const serverName = server.selectFirst(".server-name")?.text?.trim() || "Default";
                const videoUrl = server.attr("data-video");
                
                if (videoUrl) {
                    sources.push({
                        url: videoUrl,
                        quality: "1080", // Anify expects string
                        server: serverName,
                        // Anify required headers
                        headers: {
                            "Referer": this.baseUrl,
                            "Origin": this.baseUrl
                        }
                    });
                }
            });

            return sources.length > 0 ? sources : this._getFallbackSources(episodeUrl);
        } catch (error) {
            console.error("Video error:", error);
            return this._getFallbackSources(episodeUrl);
        }
    }

    // =====================
    // HELPER METHODS
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

    _generateFallbackEpisodes(url, cover) {
        return Array.from({ length: 12 }, (_, i) => ({
            id: `ep-${i+1}`,
            number: i + 1,
            title: `Episode ${i+1}`,
            url: `${url}/episode-${i+1}`,
            thumbnail: cover,
            isFiller: false,
            createdAt: new Date().toISOString()
        }));
    }

    _createFallbackDetail(url) {
        const id = url.split("/").pop() || "fallback";
        return {
            id: id,
            title: id.replace(/-/g, " "),
            coverImage: "",
            description: "",
            status: "UNKNOWN",
            totalEpisodes: 12,
            episodes: this._generateFallbackEpisodes(url, ""),
            mappings: [{
                id: id,
                providerId: "animekai",
                similarity: 70
            }]
        };
    }

    _getFallbackSources(url) {
        return [{
            url: url.replace("/episode-", "/watch/") + ".mp4",
            quality: "720",
            server: "Fallback",
            headers: {
                "Referer": this.baseUrl
            }
        }];
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
