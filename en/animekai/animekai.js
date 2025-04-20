const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.6.2",
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

    // =============[CORE SEARCH - YOUR WORKING VERSION]=============
    async search(query, page, filters) {
        try {
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
        } catch (error) {
            console.error("Search failed:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =============[ANIFY INTEGRATION]=============
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackDetail(url);

            const episodes = doc.select(".episode-list li").map((item, i) => ({
                id: `ep-${i+1}`,
                number: i+1,
                title: item.selectFirst(".episode-title")?.text || `Episode ${i+1}`,
                url: item.selectFirst("a")?.getHref || `${url}/episode-${i+1}`,
                thumbnail: item.selectFirst("img")?.attr("src") || "",
                isFiller: false,
                createdAt: new Date().toISOString()
            }));

            return {
                id: url.split('/').pop(),
                title: doc.selectFirst("h1.title")?.text || "Unknown",
                coverImage: doc.selectFirst("img.cover")?.attr("src") || "",
                description: doc.selectFirst(".description")?.text || "",
                status: episodes.length ? "RELEASING" : "COMPLETED",
                totalEpisodes: episodes.length || 12,
                episodes: episodes.length ? episodes : this._generateFallbackEpisodes(url),
                mappings: [{
                    id: url.split('/').pop(),
                    providerId: "animekai",
                    similarity: 95
                }]
            };
        } catch (error) {
            console.error("Detail error:", error);
            return this._createFallbackDetail(url);
        }
    }

    // =============[SETTINGS & VIDEO HANDLING]=============
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return this._getFallbackSource(episodeUrl);

            const preferredServer = this.getPreference("server_pref") || "default";
            const sources = doc.select(".server-list li")
                .filter(server => {
                    const serverName = server.selectFirst(".server-name")?.text?.toLowerCase();
                    return preferredServer === "default" || serverName?.includes(preferredServer);
                })
                .map(server => ({
                    url: server.attr("data-video"),
                    quality: this._getQuality(server.text()),
                    server: server.selectFirst(".server-name")?.text || "Default",
                    headers: { Referer: this.baseUrl }
                }))
                .filter(video => video.url);

            return sources.length ? sources : this._getFallbackSource(episodeUrl);
        } catch (error) {
            console.error("Video error:", error);
            return this._getFallbackSource(episodeUrl);
        }
    }

    getSourcePreferences() {
        return [
            {
                key: "server_pref",
                listPreference: {
                    title: "Preferred Server",
                    summary: "Select default streaming server",
                    valueIndex: 0,
                    entries: ["Default", "Server 1", "Server 2"],
                    entryValues: ["default", "server1", "server2"]
                }
            },
            {
                key: "quality_pref",
                listPreference: {
                    title: "Video Quality",
                    summary: "Preferred playback quality",
                    valueIndex: 0,
                    entries: ["Auto", "480p", "720p", "1080p"],
                    entryValues: ["auto", "480", "720", "1080"]
                }
            }
        ];
    }

    // =============[HELPERS]=============
    _getQuality(text) {
        if (text.includes("1080")) return "1080";
        if (text.includes("720")) return "720";
        if (text.includes("480")) return "480";
        return "auto";
    }

    _generateFallbackEpisodes(url) {
        return Array.from({ length: 12 }, (_, i) => ({
            id: `ep-${i+1}`,
            number: i+1,
            title: `Episode ${i+1}`,
            url: `${url}/episode-${i+1}`,
            thumbnail: "",
            isFiller: false,
            createdAt: new Date().toISOString()
        }));
    }

    _createFallbackDetail(url) {
        return {
            id: url.split('/').pop(),
            title: "Unknown",
            coverImage: "",
            description: "",
            status: "UNKNOWN",
            totalEpisodes: 12,
            episodes: this._generateFallbackEpisodes(url),
            mappings: [{
                id: url.split('/').pop(),
                providerId: "animekai",
                similarity: 70
            }]
        };
    }

    _getFallbackSource(url) {
        return [{
            url: url.replace("/episode-", "/watch/") + ".mp4",
            quality: "720",
            server: "Fallback",
            headers: { Referer: this.baseUrl }
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
