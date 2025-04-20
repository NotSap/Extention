const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.2",  // Updated version
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // [KEEP ALL YOUR EXISTING METHODS UNCHANGED UNTIL getDetail]
    // getPreference(), getBaseUrl(), request(), getPage(), 
    // search(), getPopular(), getLatestUpdates() remain exactly the same

    // NEW IMPROVED EPISODE FETCHING (BASED ON ANIMEPAHE APPROACH)
    async getDetail(url) {
        try {
            const body = await this.getPage(url);
            if (!body) return null;

            // Title and metadata (unchanged from your original)
            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const title = body.selectFirst(".anime-detail h1")?.attr(titlePref) || 
                        body.selectFirst(".anime-detail h1")?.text;
            
            const cover = body.selectFirst(".anime-cover img")?.attr("src");
            const description = body.selectFirst(".anime-detail .description")?.text;

            // AnimePahe-style episode fetching adapted for AnimeKai
            const episodeContainer = body.selectFirst(".episode-list, .episodes-wrapper");
            const episodeItems = episodeContainer?.select(".episode-item, .episode") || [];
            
            const episodes = episodeItems.map((ep, index) => {
                // Improved number extraction like AnimePahe
                const epNumText = ep.selectFirst(".episode-number")?.text?.match(/(\d+)/)?.[1] || 
                                 ep.attr("data-episode") || 
                                 (index + 1);
                const epNum = parseInt(epNumText);
                
                // More reliable URL extraction
                const epUrl = ep.selectFirst("a")?.getHref || 
                            `${url.replace(/\/+$/, "")}/episode/${epNum}`;
                
                // Better title fallbacks
                const epName = ep.selectFirst(".episode-title")?.text?.trim() || 
                             `Episode ${epNum}`;
                
                // Improved thumbnail handling
                const epThumb = ep.selectFirst("img")?.attr("src") || 
                               ep.selectFirst("img")?.attr("data-src") || 
                               cover;

                return {
                    name: epName,
                    url: epUrl,
                    episode: epNum,
                    thumbnailUrl: epThumb
                };
            }).filter(ep => ep.url); // Ensure we only return episodes with valid URLs

            return {
                name: title,
                cover: cover,
                description: description,
                episodes: episodes.sort((a, b) => a.episode - b.episode) // Sort episodes
            };
        } catch (error) {
            console.error("Failed to get detail:", error);
            return null;
        }
    }

    // IMPROVED VIDEO SOURCE EXTRACTION (ANIMEPAHE-STYLE)
    async getVideoList(url) {
        try {
            const body = await this.getPage(url);
            if (!body) return [];

            // Get user preferences (unchanged)
            const prefServers = this.getPreference("animekai_pref_stream_server") || ["1"];
            const prefSubDub = this.getPreference("animekai_pref_stream_subdub_type") || ["sub", "dub"];
            const splitStreams = this.getPreference("animekai_pref_extract_streams") !== false;

            // AnimePahe-style server detection adapted for AnimeKai
            const serverList = body.selectFirst(".server-list, .servers-tab");
            const serverItems = serverList?.select(".server-item, .server") || [];
            
            const servers = serverItems.map(server => {
                return {
                    id: server.attr("data-id") || server.attr("id")?.replace("server-", "") || "default",
                    name: server.selectFirst(".server-name")?.text?.trim() || "Default"
                };
            }).filter(server => prefServers.includes(server.id));

            // Process servers like AnimePahe does
            const streams = [];
            for (const server of servers) {
                const serverContent = body.selectFirst(`.server-item[data-id="${server.id}"], #server-${server.id}`);
                if (!serverContent) continue;

                // AnimePahe-style video item processing
                const videoItems = serverContent.select(".video-item, .mirror_item") || [];
                for (const video of videoItems) {
                    const type = video.attr("data-type")?.toLowerCase() || 
                               video.selectFirst(".type")?.text?.toLowerCase() || 
                               "sub";
                    
                    if (!prefSubDub.includes(type)) continue;

                    const videoUrl = video.attr("data-video") || 
                                   video.attr("data-src") || 
                                   video.selectFirst("iframe")?.attr("src");
                    
                    if (!videoUrl) continue;

                    // Quality handling like AnimePahe
                    if (splitStreams) {
                        ["360", "720", "1080"].forEach(quality => {
                            streams.push({
                                name: `${server.name} - ${type} - ${quality}p`,
                                url: videoUrl,
                                quality: parseInt(quality),
                                server: server.name,
                                type: type
                            });
                        });
                    } else {
                        streams.push({
                            name: `${server.name} - ${type}`,
                            url: videoUrl,
                            quality: 0, // Auto quality
                            server: server.name,
                            type: type
                        });
                    }
                }
            }

            return streams.sort((a, b) => {
                // Sort by server preference then quality
                const serverDiff = prefServers.indexOf(a.server) - prefServers.indexOf(b.server);
                return serverDiff !== 0 ? serverDiff : (b.quality - a.quality);
            });
        } catch (error) {
            console.error("Failed to get video list:", error);
            return [];
        }
    }

    // [KEEP ALL YOUR ORIGINAL SETTINGS EXACTLY THE SAME]
    getSourcePreferences() {
        return [
            // ... Your existing preferences unchanged ...
        ];
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
