const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.7",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // [KEEP ALL ORIGINAL METHODS UNCHANGED UNTIL getDetail]
    getPreference(key) { /* ... unchanged ... */ }
    getBaseUrl() { /* ... unchanged ... */ }
    async request(url) { /* ... unchanged ... */ }
    async getPage(url) { /* ... unchanged ... */ }
    async search(query, page, filters) { /* ... unchanged ... */ }
    async getPopular(page) { /* ... unchanged ... */ }
    async getLatestUpdates(page) { /* ... unchanged ... */ }

    // FIXED DETAIL FETCHING WITH ANIFY-COMPATIBLE FORMAT
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this.createErrorResponse();

            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const title = doc.selectFirst("h1.title")?.attr(titlePref) || 
                         doc.selectFirst("h1.title")?.text;
            
            const cover = doc.selectFirst("img.cover")?.attr("src") ||
                         doc.selectFirst(".poster img")?.attr("src");
            
            const description = doc.selectFirst(".description")?.text;

            // ANIFY-COMPATIBLE EPISODE DATA
            const episodes = [];
            const episodeElements = doc.select(".episode-list li, .episode-wrap");
            
            episodeElements.forEach((element, index) => {
                const epNum = parseInt(element.attr("data-number") || 
                             element.selectFirst(".episode-num")?.text?.match(/\d+/)?.[0] || 
                             (index + 1));
                
                episodes.push({
                    id: `${url}-${epNum}`.replace(/[^a-zA-Z0-9]/g, '-'),
                    number: epNum,
                    title: element.selectFirst(".episode-title")?.text || `Episode ${epNum}`,
                    thumbnail: element.selectFirst("img")?.attr("src") || 
                             element.selectFirst("img")?.attr("data-src") || 
                             cover,
                    isFiller: false
                });
            });

            // ANIFY-COMPATIBLE RESPONSE
            return {
                id: url.split('/').pop(),
                title: title,
                coverImage: cover,
                bannerImage: cover, // Fallback to cover if no banner
                description: description,
                status: "UNKNOWN", // Can extract from page if available
                episodes: episodes,
                mappings: {
                    // Required by Anify
                    id: url.split('/').pop(),
                    providerId: "animekai",
                    similarity: 1
                }
            };
        } catch (error) {
            console.error("Failed to get detail:", error);
            return this.createErrorResponse();
        }
    }

    createErrorResponse() {
        return {
            id: "",
            title: "",
            coverImage: "",
            bannerImage: "",
            description: "",
            status: "UNKNOWN",
            episodes: [],
            mappings: {
                id: "",
                providerId: "animekai",
                similarity: 0
            }
        };
    }

    // FIXED VIDEO LIST FOR ANIFY
    async getVideoList(episodeId) {
        try {
            // Extract URL from episodeId (format: baseUrl-epNum)
            const [baseUrl, epNum] = episodeId.split('-').slice(0, -1).join('-').match(/(.*)-(\d+)$/) || [];
            if (!baseUrl) return [];
            
            const url = `${this.getBaseUrl()}${baseUrl}/episode/${epNum}`;
            const doc = await this.getPage(url);
            if (!doc) return [];

            const prefServers = this.getPreference("animekai_pref_stream_server") || ["1"];
            const prefSubDub = this.getPreference("animekai_pref_stream_subdub_type") || ["sub", "dub"];
            const splitStreams = this.getPreference("animekai_pref_extract_streams") !== false;

            // ANIFY-COMPATIBLE SOURCES
            const sources = [];
            const serverItems = doc.select(".server-list li, .server-item");
            
            serverItems.forEach(server => {
                const serverId = server.attr("data-id") || "default";
                if (!prefServers.includes(serverId)) return;
                
                const serverName = server.selectFirst(".server-name")?.text?.trim() || `Server ${serverId}`;
                const videoItems = server.select(".video-item, [data-video]");
                
                videoItems.forEach(video => {
                    const type = (video.attr("data-type") || "sub").toLowerCase();
                    if (!prefSubDub.includes(type)) return;
                    
                    const videoUrl = video.attr("data-video") || video.attr("data-src");
                    if (!videoUrl) return;

                    if (splitStreams) {
                        [360, 720, 1080].forEach(quality => {
                            sources.push({
                                url: videoUrl,
                                quality: quality,
                                audio: type === "dub" ? "dub" : "sub",
                                subtitles: [],
                                headers: {},
                                embed: false
                            });
                        });
                    } else {
                        sources.push({
                            url: videoUrl,
                            quality: 0, // Auto
                            audio: type === "dub" ? "dub" : "sub",
                            subtitles: [],
                            headers: {},
                            embed: false
                        });
                    }
                });
            });

            return sources;
        } catch (error) {
            console.error("Failed to get video list:", error);
            return [];
        }
    }

    // [KEEP ORIGINAL SETTINGS EXACTLY AS IS]
    getSourcePreferences() {
        return [
            /* ... Your existing unchanged settings ... */
        ];
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
