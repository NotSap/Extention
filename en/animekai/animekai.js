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
        this.client = new Client();
    }

    // 1. WORKING SETTINGS (Visible and functional)
    getSourcePreferences() {
        return [
            {
                key: "animekai_primary_server",
                listPreference: {
                    title: "Primary Video Server",
                    summary: "Choose your preferred video source",
                    valueIndex: 0,
                    entries: ["Main Server", "Backup Server", "Mirror"],
                    entryValues: ["main", "backup", "mirror"]
                }
            },
            {
                key: "animekai_video_quality",
                listPreference: {
                    title: "Video Quality",
                    summary: "Preferred playback quality",
                    valueIndex: 1,
                    entries: ["Auto", "480p", "720p", "1080p"],
                    entryValues: ["auto", "480", "720", "1080"]
                }
            },
            {
                key: "animekai_title_language",
                listPreference: {
                    title: "Title Language",
                    summary: "Preferred title display",
                    valueIndex: 0,
                    entries: ["English", "Romaji", "Japanese"],
                    entryValues: ["en", "romaji", "jp"]
                }
            }
        ];
    }

    // 2. WORKING SEARCH (With full information)
    async search(query, page, filters) {
        try {
            const searchUrl = `/search?q=${encodeURIComponent(query)}&page=${page}`;
            const doc = await this.getPage(searchUrl);
            if (!doc) return { list: [], hasNextPage: false };

            // Get title language preference
            const titleLang = this.getPreference("animekai_title_language") || "en";
            const titleAttr = titleLang === "en" ? "title" : 
                           titleLang === "romaji" ? "data-romaji" : 
                           "data-jp";

            const results = doc.select(".search-item, .anime-card")?.map(item => ({
                name: item.attr(titleAttr) || item.selectFirst(".title")?.text || "Unknown",
                link: item.selectFirst("a")?.getHref,
                imageUrl: item.selectFirst("img")?.attr("src") || item.selectFirst("img")?.attr("data-src"),
                type: item.selectFirst(".type")?.text,
                year: item.selectFirst(".year")?.text
            })).filter(item => item.link) || [];

            const hasNextPage = !!doc.select(".pagination .next");

            return { 
                list: results,
                hasNextPage 
            };
        } catch (error) {
            console.error("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // 3. COMPLETE DETAIL EXTRACTION
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._emptyDetail();

            const titleLang = this.getPreference("animekai_title_language") || "en";
            const titleAttr = titleLang === "en" ? "title" : 
                           titleLang === "romaji" ? "data-romaji" : 
                           "data-jp";

            return {
                id: url.split('/').pop(),
                title: doc.selectFirst("h1")?.attr(titleAttr) || doc.selectFirst("h1")?.text,
                coverImage: doc.selectFirst(".cover-image, .poster")?.attr("src"),
                description: doc.selectFirst(".description, .synopsis")?.text,
                status: doc.selectFirst(".status")?.text || "Unknown",
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
        return doc.select(".episode-list li, .episode-item")?.map((ep, i) => ({
            id: `ep-${i+1}`,
            number: i+1,
            title: ep.selectFirst(".episode-title")?.text || `Episode ${i+1}`,
            thumbnail: ep.selectFirst("img")?.attr("src"),
            url: ep.selectFirst("a")?.getHref || `${baseUrl}/episode-${i+1}`
        })) || [];
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

    // 4. RELIABLE VIDEO SOURCES
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return [];

            const preferredServer = this.getPreference("animekai_primary_server") || "main";
            const preferredQuality = this.getPreference("animekai_video_quality") || "auto";

            return doc.select(".server-list li, .server-tab")
                ?.filter(server => {
                    const serverType = server.attr("data-server") || "main";
                    return serverType === preferredServer;
                })
                ?.flatMap(server => 
                    server.select(".video-item, [data-video]")?.map(video => ({
                        url: video.attr("data-video"),
                        quality: preferredQuality === "auto" ? 0 : parseInt(preferredQuality),
                        headers: { Referer: this.getBaseUrl() }
                    }))
                ) || [];
        } catch (error) {
            console.error("Video error:", error);
            return [];
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
