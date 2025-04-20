const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.5.0",
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
        this.titleMappings = {
            "attack on titan: the last attack": "attack on titan final season"
        };
    }

    // =====================
    // 1. IMPROVED SEARCH WITH TITLE CORRECTION
    // =====================
    async search(query, page = 1, filters = []) {
        try {
            // Clean and normalize the query
            const cleanQuery = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
            
            // Check for known title mappings
            const correctedQuery = this.titleMappings[cleanQuery] || cleanQuery;
            
            const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(correctedQuery)}&page=${page}`;
            const doc = await this.getPage(searchUrl);
            
            if (!doc) return { list: [], hasNextPage: false };

            const results = [];
            const items = doc.select(".film-list .film, .aitem-wrapper .aitem") || [];
            
            items.forEach(item => {
                const title = item.selectFirst(".title, .film-name")?.text?.trim() || "Unknown";
                const link = item.selectFirst("a")?.getHref;
                const imageUrl = item.selectFirst("img")?.attr("data-src") || 
                               item.selectFirst("img")?.attr("src");
                
                if (link && imageUrl) {
                    results.push({
                        name: title,
                        link: link,
                        imageUrl: imageUrl,
                        // AnymeX specific fields
                        type: "anime",
                        provider: "animekai"
                    });
                }
            });

            return {
                list: results,
                hasNextPage: doc.select(".pagination .next:not(.disabled)").length > 0
            };
        } catch (error) {
            console.error("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =====================
    // 2. IMPROVED DETAIL FOR ANYMEX
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackDetail(url);

            // Extract all required fields for AnymeX
            const title = doc.selectFirst("h1.title, h1.film-name")?.text?.trim() || "Unknown";
            const cover = doc.selectFirst("img.cover, .film-poster img")?.attr("src") || "";
            const description = doc.selectFirst(".description, .film-synopsis")?.text?.trim() || "";
            
            // Enhanced episode detection
            const episodes = [];
            const episodeItems = doc.select(".episode-list li, .episode-item") || [];
            
            episodeItems.forEach((item, index) => {
                const epNum = parseInt(
                    item.attr("data-episode") || 
                    item.selectFirst(".episode-num")?.text?.match(/\d+/)?.[0] || 
                    (index + 1)
                );
                
                episodes.push({
                    id: `ep-${epNum}`,
                    number: epNum,
                    title: item.selectFirst(".episode-title")?.text?.trim() || `Episode ${epNum}`,
                    url: item.selectFirst("a")?.getHref || `${url}/episode-${epNum}`,
                    thumbnail: item.selectFirst("img")?.attr("src") || cover
                });
            });

            return {
                id: url.split('/').pop() || "unknown",
                title: title,
                coverImage: cover,
                description: description,
                status: this._detectStatus(doc),
                totalEpisodes: episodes.length || 25, // Default to 25 if unknown
                episodes: episodes.length ? episodes : this._generateFallbackEpisodes(url, cover),
                mappings: {
                    id: url.split('/').pop() || "unknown",
                    providerId: "animekai",
                    similarity: 95
                }
            };
        } catch (error) {
            console.error("Detail error:", error);
            return this._createFallbackDetail(url);
        }
    }

    // =====================
    // 3. IMPROVED VIDEO SOURCES FOR ANYMEX
    // =====================
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return this._getFallbackSources(episodeUrl);

            const sources = [];
            const servers = doc.select(".server-list li, .server-tab") || [];
            
            servers.forEach(server => {
                const serverName = server.selectFirst(".server-name")?.text?.trim() || "Server";
                const videos = server.select("[data-video], .video-item") || [];
                
                videos.forEach(video => {
                    const url = video.attr("data-video") || video.attr("data-src");
                    if (url) {
                        sources.push({
                            url: url,
                            quality: this._detectQuality(video.text()),
                            server: serverName,
                            headers: {
                                "Referer": episodeUrl,
                                "Origin": this.baseUrl
                            }
                        });
                    }
                });
            });

            return sources.length ? sources : this._getFallbackSources(episodeUrl);
        } catch (error) {
            console.error("Video error:", error);
            return this._getFallbackSources(episodeUrl);
        }
    }

    // =====================
    // 4. ANYMEX COMPATIBLE SETTINGS
    // =====================
    getSourcePreferences() {
        return [
            {
                key: "primary_server",
                listPreference: {
                    title: "Default Server",
                    summary: "Preferred video source",
                    valueIndex: 0,
                    entries: ["Main Server", "Backup Server 1", "Backup Server 2"],
                    entryValues: ["main", "backup1", "backup2"]
                }
            },
            {
                key: "default_quality",
                listPreference: {
                    title: "Video Quality",
                    summary: "Preferred playback quality",
                    valueIndex: 1,
                    entries: ["Auto", "480p", "720p", "1080p"],
                    entryValues: ["auto", "480", "720", "1080"]
                }
            },
            {
                key: "title_language",
                listPreference: {
                    title: "Title Language",
                    summary: "Preferred title display",
                    valueIndex: 0,
                    entries: ["English", "Romaji"],
                    entryValues: ["en", "jp"]
                }
            }
        ];
    }

    // =====================
    // HELPER METHODS
    // =====================
    _detectStatus(doc) {
        const statusText = doc.selectFirst(".status, .film-status")?.text?.toLowerCase() || "";
        if (statusText.includes("ongoing")) return "Ongoing";
        if (statusText.includes("complete") || statusText.includes("finished")) return "Completed";
        return "Unknown";
    }

    _detectQuality(text) {
        if (text.includes("1080")) return "1080";
        if (text.includes("720")) return "720";
        if (text.includes("480")) return "480";
        return "auto";
    }

    _generateFallbackEpisodes(url, cover) {
        return Array.from({ length: 25 }, (_, i) => ({
            id: `ep-${i+1}`,
            number: i+1,
            title: `Episode ${i+1}`,
            url: `${url}/episode-${i+1}`,
            thumbnail: cover
        }));
    }

    _createFallbackDetail(url) {
        const id = url.split("/").pop() || "fallback";
        return {
            id: id,
            title: id.replace(/-/g, " "),
            coverImage: "",
            description: "",
            status: "Unknown",
            totalEpisodes: 25,
            episodes: this._generateFallbackEpisodes(url, ""),
            mappings: {
                id: id,
                providerId: "animekai",
                similarity: 70
            }
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
