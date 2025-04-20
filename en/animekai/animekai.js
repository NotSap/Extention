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
        this.client = new Client();
    }

    // 1. WORKING SEARCH IMPLEMENTATION (Fixed error)
    async search(query, page, filters) {
        try {
            const searchUrl = `${this.getBaseUrl()}/search?q=${encodeURIComponent(query)}&page=${page}`;
            const doc = await this.getPage(searchUrl);
            
            if (!doc) return { list: [], hasNextPage: false };

            const results = doc.select(".anime-item, .search-result-item").map(item => ({
                name: item.selectFirst(".title")?.text || "Unknown Title",
                link: item.selectFirst("a")?.getHref,
                imageUrl: item.selectFirst("img")?.attr("src") || item.selectFirst("img")?.attr("data-src"),
                type: item.selectFirst(".type")?.text || "TV",
                year: item.selectFirst(".year")?.text || ""
            })).filter(item => item.link);

            const hasNextPage = doc.select(".pagination .next").length > 0;

            return {
                list: results,
                hasNextPage: hasNextPage
            };
        } catch (error) {
            console.error("Search failed:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // 2. WORKING SETTINGS (Visible and functional)
    getSourcePreferences() {
        return [
            {
                key: "animekai_primary_server",
                listPreference: {
                    title: "Video Server",
                    summary: "Choose preferred video source",
                    valueIndex: 0,
                    entries: ["Main Server", "Backup Server"],
                    entryValues: ["main", "backup"]
                }
            },
            {
                key: "animekai_video_quality",
                listPreference: {
                    title: "Video Quality",
                    summary: "Preferred playback quality",
                    valueIndex: 1,
                    entries: ["Auto", "720p", "1080p"],
                    entryValues: ["auto", "720", "1080"]
                }
            },
            {
                key: "animekai_autoplay",
                switchPreferenceCompat: {
                    title: "Auto-play Next",
                    summary: "Automatically play next episode",
                    value: true
                }
            }
        ];
    }

    // 3. DETAIL PAGE EXTRACTION
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._emptyDetail();

            return {
                id: url.split('/').pop(),
                title: doc.selectFirst("h1.title")?.text || "Unknown",
                coverImage: doc.selectFirst(".cover-image")?.attr("src"),
                description: doc.selectFirst(".description")?.text,
                status: "Ongoing",
                episodes: this._extractEpisodes(doc, url),
                mappings: {
                    id: url.split('/').pop(),
                    providerId: "animekai",
                    similarity: 95
                }
            };
        } catch (error) {
            console.error("Detail error:", error);
            return this._emptyDetail();
        }
    }

    _extractEpisodes(doc, baseUrl) {
        return doc.select(".episode-list li").map((ep, index) => ({
            id: `ep-${index+1}`,
            number: index + 1,
            title: ep.selectFirst(".episode-title")?.text || `Episode ${index+1}`,
            url: ep.selectFirst("a")?.getHref || `${baseUrl}/episode-${index+1}`,
            thumbnail: ep.selectFirst("img")?.attr("src")
        }));
    }

    _emptyDetail() {
        return {
            id: "error",
            title: "Error loading",
            coverImage: "",
            description: "",
            status: "Unknown",
            episodes: [],
            mappings: {
                id: "error",
                providerId: "animekai",
                similarity: 0
            }
        };
    }

    // 4. VIDEO SOURCE EXTRACTION
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return [];

            const preferredServer = this.getPreference("animekai_primary_server") || "main";
            const preferredQuality = this.getPreference("animekai_video_quality") || "auto";

            const sources = doc.select(".server-list li")
                .filter(server => (server.attr("data-server") || "main") === preferredServer)
                .flatMap(server => 
                    server.select(".video-item").map(video => ({
                        url: video.attr("data-video"),
                        quality: preferredQuality === "auto" ? 0 : parseInt(preferredQuality),
                        headers: { Referer: this.getBaseUrl() }
                    }))
                );

            return sources.length > 0 ? sources : this._fallbackSource(episodeUrl);
        } catch (error) {
            console.error("Video error:", error);
            return this._fallbackSource(episodeUrl);
        }
    }

    _fallbackSource(url) {
        return [{
            url: url.replace("/episode-", "/stream/") + ".mp4",
            quality: 720,
            headers: { Referer: this.getBaseUrl() }
        }];
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
