const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.7.0",
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
    // 1. SEARCH (Following AnimePahe pattern)
    // =====================
    async search(query, page = 1, filters = []) {
        try {
            const searchUrl = `${this.baseUrl}/browser?keyword=${encodeURIComponent(query)}&page=${page}`;
            const doc = await this.getPage(searchUrl);
            
            if (!doc) return { list: [], hasNextPage: false };

            const results = [];
            const items = doc.select(".aitem-wrapper .aitem, .film-list .film") || [];
            
            items.forEach(item => {
                results.push({
                    name: item.selectFirst(".title, .film-name")?.text?.trim() || "Unknown",
                    link: item.selectFirst("a")?.getHref,
                    imageUrl: item.selectFirst("img")?.attr("data-src") || 
                             item.selectFirst("img")?.attr("src"),
                    type: "anime",
                    provider: "animekai"
                });
            });

            return {
                list: results.filter(item => item.link),
                hasNextPage: doc.select(".pagination .next:not(.disabled)").length > 0
            };
        } catch (error) {
            console.error("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =====================
    // 2. DETAIL (AnimePahe style)
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackDetail(url);

            const title = doc.selectFirst("h1.title, h1.film-name")?.text?.trim() || "Unknown";
            const cover = doc.selectFirst("img.cover, .film-poster img")?.attr("src") || "";
            const description = doc.selectFirst(".description, .film-synopsis")?.text?.trim() || "";
            
            // Episode extraction
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
                    thumbnail: item.selectFirst("img")?.attr("src") || cover,
                    isFiller: false,
                    createdAt: new Date().toISOString()
                });
            });

            return {
                id: url.split('/').pop() || "unknown",
                title: title,
                coverImage: cover,
                description: description,
                status: this._detectStatus(doc),
                totalEpisodes: episodes.length || 0,
                episodes: episodes.length ? episodes : this._generateFallbackEpisodes(url, cover),
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
    // 3. VIDEO SOURCES (AnimePahe style)
    // =====================
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return this._getFallbackSources(episodeUrl);

            const preferredServer = this.getPreference("preferred_server") || "default";
            const preferredQuality = this.getPreference("video_quality") || "auto";

            const sources = [];
            const servers = doc.select(".server-list li, .server-tab") || [];
            
            for (const server of servers) {
                const serverName = (server.selectFirst(".server-name")?.text?.trim() || "default").toLowerCase();
                
                if (preferredServer !== "default" && !serverName.includes(preferredServer)) {
                    continue;
                }

                const videos = server.select("[data-video], .video-item") || [];
                for (const video of videos) {
                    const url = video.attr("data-video") || video.attr("data-src");
                    if (url) {
                        sources.push({
                            url: url,
                            quality: preferredQuality === "auto" 
                                ? this._detectQuality(video.text()) 
                                : preferredQuality,
                            server: serverName,
                            headers: {
                                "Referer": this.baseUrl,
                                "Origin": this.baseUrl
                            }
                        });
                    }
                }
            }

            return sources.length ? sources : this._getFallbackSources(episodeUrl);
        } catch (error) {
            console.error("Video error:", error);
            return this._getFallbackSources(episodeUrl);
        }
    }

    // =====================
    // 4. SETTINGS (AnimePahe style)
    // =====================
    getSourcePreferences() {
        return [
            {
                key: "preferred_server",
                listPreference: {
                    title: "Preferred Server",
                    summary: "Select default streaming server",
                    valueIndex: 0,
                    entries: ["Default", "Server 1", "Server 2"],
                    entryValues: ["default", "server1", "server2"]
                }
            },
            {
                key: "video_quality",
                listPreference: {
                    title: "Video Quality",
                    summary: "Preferred playback quality",
                    valueIndex: 0,
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
    _detectStatus(doc) {
        const statusText = doc.selectFirst(".status, .film-status")?.text?.toLowerCase() || "";
        if (statusText.includes("ongoing")) return "RELEASING";
        if (statusText.includes("complete") || statusText.includes("finished")) return "COMPLETED";
        return "UNKNOWN";
    }

    _detectQuality(text) {
        if (text.includes("1080")) return "1080";
        if (text.includes("720")) return "720";
        if (text.includes("480")) return "480";
        return "auto";
    }

    _generateFallbackEpisodes(url, cover) {
        return Array.from({ length: 12 }, (_, i) => ({
            id: `ep-${i+1}`,
            number: i+1,
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
            server: "fallback",
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
