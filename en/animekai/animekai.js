const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.1.0",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // Keep original search and settings unchanged
    getPreference(key) { /* unchanged */ }
    getBaseUrl() { /* unchanged */ }
    async request(url) { /* unchanged */ }
    async getPage(url) { /* unchanged */ }
    async search(query, page, filters) { /* unchanged */ }
    async getPopular(page) { /* unchanged */ }
    async getLatestUpdates(page) { /* unchanged */ }
    getSourcePreferences() { /* unchanged */ }

    // Fixed Anify-compatible detail fetch
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return null;

            // Extract metadata
            const title = doc.selectFirst("h1.title")?.text;
            const cover = doc.selectFirst("img.cover")?.attr("src");
            
            // Anify-required episode format
            const episodes = doc.select(".episode-list li").map((ep, index) => ({
                id: `ep-${index + 1}-${Date.now()}`, // Unique ID format
                number: index + 1,
                title: ep.selectFirst(".episode-title")?.text || `Episode ${index + 1}`,
                description: "",
                thumbnail: ep.selectFirst("img")?.attr("src") || cover,
                isFiller: false
            }));

            return {
                id: url.split('/').pop(),
                title: title,
                coverImage: cover,
                episodes: episodes,
                mappings: {
                    id: url.split('/').pop(),
                    providerId: "animekai",
                    similarity: 95
                }
            };
        } catch (error) {
            console.error("Detail fetch failed:", error);
            return null;
        }
    }

    // Fixed Anify-compatible video sources
    async getVideoList(episodeId) {
        try {
            // Extract anime ID from episode ID (format: animeId-ep-1)
            const [animeId, epNum] = episodeId.split('-ep-');
            const url = `${this.getBaseUrl()}/watch/${animeId}/episode-${epNum}`;
            
            const doc = await this.getPage(url);
            if (!doc) return [];

            // Get user preferences
            const prefServers = this.getPreference("animekai_pref_stream_server") || ["1"];
            const prefSubDub = this.getPreference("animekai_pref_stream_subdub_type") || ["sub", "dub"];
            const splitStreams = this.getPreference("animekai_pref_extract_streams");

            // Anify-required source format
            return doc.select(".server-list li").flatMap(server => {
                const serverId = server.attr("data-id");
                if (!prefServers.includes(serverId)) return [];
                
                return server.select(".video-item").map(video => ({
                    url: video.attr("data-video"),
                    quality: splitStreams ? 1080 : 0, // 0 = auto
                    audio: video.attr("data-type") === "dub" ? "dub" : "sub",
                    subtitles: [],
                    headers: {
                        Referer: this.getBaseUrl()
                    }
                }));
            });
        } catch (error) {
            console.error("Video list failed:", error);
            return [];
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
