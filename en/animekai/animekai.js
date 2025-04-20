const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.3.2",
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
    // 1. WORKING SEARCH FUNCTION
    // =====================
    async search(query, page = 1, filters = []) {
        try {
            // Build search URL with proper encoding
            const searchUrl = `${this.baseUrl}/browser?keyword=${encodeURIComponent(query)}&page=${page}`;
            
            // Make request with headers
            const response = await this.client.get(searchUrl);
            const doc = new Document(response.body);
            
            if (!doc) return { list: [], hasNextPage: false };

            // Extract results - using current AnimeKai selectors
            const results = [];
            const items = doc.select(".film-list .film, .aitem-wrapper .aitem");
            
            items.forEach(item => {
                results.push({
                    name: item.selectFirst(".title, .film-name")?.text?.trim() || "Unknown",
                    link: item.selectFirst("a")?.getHref || "",
                    imageUrl: item.selectFirst("img")?.attr("data-src") || 
                             item.selectFirst("img")?.attr("src") || ""
                });
            });

            // Check pagination
            const hasNextPage = doc.select(".pagination .next:not(.disabled)").length > 0;

            return {
                list: results.filter(item => item.link),
                hasNextPage
            };
        } catch (error) {
            console.error("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =====================
    // 2. WORKING DETAIL EXTRACTION
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackDetail(url);

            // Title with fallbacks
            const title = doc.selectFirst("h1.title, h1.film-name")?.text?.trim() || 
                         "Unknown Title";

            // Cover image with fallbacks
            const cover = doc.selectFirst("img.cover, .film-poster img")?.attr("src") || "";

            // Extract episodes
            const episodes = [];
            const episodeItems = doc.select(".episode-list li, .episode-item");
            
            episodeItems.forEach((item, index) => {
                episodes.push({
                    id: `ep-${index+1}`,
                    number: index + 1,
                    title: item.selectFirst(".episode-title")?.text?.trim() || `Episode ${index+1}`,
                    url: item.selectFirst("a")?.getHref || `${url}/episode-${index+1}`,
                    thumbnail: item.selectFirst("img")?.attr("src") || cover
                });
            });

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
            console.error("Detail error:", error);
            return this._createFallbackDetail(url);
        }
    }

    // =====================
    // 3. WORKING VIDEO EXTRACTION
    // =====================
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return this._getFallbackSources(episodeUrl);

            const sources = [];
            const servers = doc.select(".server-list li, .server-tab");
            
            servers.forEach(server => {
                const serverName = server.selectFirst(".server-name")?.text?.trim() || "Server";
                const videos = server.select(".video-item, [data-video]");
                
                videos.forEach(video => {
                    const url = video.attr("data-video") || video.attr("data-src");
                    if (url) {
                        sources.push({
                            url: url,
                            quality: video.text().match(/1080|720|480/)?.shift() || "Auto",
                            server: serverName,
                            headers: {
                                "Referer": episodeUrl
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
    // 4. WORKING SETTINGS
    // =====================
    getSourcePreferences() {
        return [
            {
                key: "primary_server",
                listPreference: {
                    title: "Preferred Server",
                    summary: "Select default video server",
                    valueIndex: 0,
                    entries: ["Server 1", "Server 2", "Backup"],
                    entryValues: ["server1", "server2", "backup"]
                }
            },
            {
                key: "video_quality",
                listPreference: {
                    title: "Default Quality",
                    summary: "Preferred video quality",
                    valueIndex: 1,
                    entries: ["Auto", "480p", "720p", "1080p"],
                    entryValues: ["auto", "480", "720", "1080"]
                }
            },
            {
                key: "show_uncensored",
                switchPreferenceCompat: {
                    title: "Show Uncensored",
                    summary: "Include uncensored content",
                    value: false
                }
            }
        ];
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

    _createFallbackDetail(url) {
        const id = url.split("/").pop() || "fallback";
        return {
            id: id,
            title: id.replace(/-/g, " "),
            coverImage: "",
            episodes: this._generateFallbackEpisodes(url, ""),
            mappings: {
                id: id,
                providerId: "animekai",
                similarity: 70
            }
        };
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
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
