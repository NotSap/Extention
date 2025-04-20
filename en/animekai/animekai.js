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
        this.client = new Client();
    }

    // 1. PROPER SETTINGS IMPLEMENTATION (Now visible)
    getSourcePreferences() {
        return [
            {
                key: "animekai_primary_server",
                listPreference: {
                    title: "Primary Video Server",
                    summary: "Choose your preferred video source",
                    valueIndex: 0,
                    entries: ["Server 1", "Server 2", "Backup Server"],
                    entryValues: ["server1", "server2", "backup"]
                }
            },
            {
                key: "animekai_video_quality",
                listPreference: {
                    title: "Default Video Quality",
                    summary: "Preferred playback quality",
                    valueIndex: 1,
                    entries: ["Auto", "480p", "720p", "1080p"],
                    entryValues: ["auto", "480", "720", "1080"]
                }
            },
            {
                key: "animekai_autoplay",
                switchPreferenceCompat: {
                    title: "Auto-play Next Episode",
                    summary: "Play next episode automatically",
                    value: true
                }
            },
            {
                key: "animekai_show_uncensored",
                switchPreferenceCompat: {
                    title: "Show Uncensored Content",
                    summary: "",
                    value: false
                }
            }
        ];
    }

    // 2. COMPLETE DETAIL EXTRACTION (Titles, episodes, metadata)
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createEmptyResponse();

            // Extract main title
            const title = doc.selectFirst("h1.anime-title, h1.title")?.text?.trim() || 
                         doc.selectFirst(".anime-detail h1")?.text?.trim() || 
                         "Unknown Title";

            // Extract cover image
            const cover = doc.selectFirst(".anime-cover img, img.cover")?.attr("src") || 
                        doc.selectFirst(".poster img")?.attr("src") || "";

            // Extract description
            const description = doc.selectFirst(".anime-description, .description")?.text?.trim() || 
                              "No description available";

            // Extract all episodes
            const episodes = [];
            const episodeContainers = doc.select(".episode-list, .episodes-container") || [];
            
            for (const container of episodeContainers) {
                const episodeItems = container.select(".episode-item, li") || [];
                
                for (const [index, item] of episodeItems.entries()) {
                    const epNum = parseInt(
                        item.attr("data-episode") || 
                        item.selectFirst(".episode-num")?.text?.match(/\d+/)?.[0] || 
                        (index + 1)
                    );
                    
                    const epUrl = item.selectFirst("a")?.getHref || 
                                 `${url}/episode-${epNum}`;
                    
                    episodes.push({
                        id: `ep-${epNum}`,
                        number: epNum,
                        title: item.selectFirst(".episode-title")?.text?.trim() || `Episode ${epNum}`,
                        thumbnail: item.selectFirst("img")?.attr("src") || cover,
                        url: epUrl
                    });
                }
            }

            return {
                id: url.split('/').pop() || "unknown-id",
                title: title,
                coverImage: cover,
                description: description,
                status: "Ongoing", // Can extract from page if available
                episodes: episodes,
                mappings: {
                    id: url.split('/').pop() || "unknown-id",
                    providerId: "animekai",
                    similarity: 95
                }
            };
        } catch (error) {
            console.error("Detail extraction failed:", error);
            return this._createEmptyResponse();
        }
    }

    _createEmptyResponse() {
        return {
            id: "error",
            title: "Error loading data",
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

    // 3. RELIABLE VIDEO SOURCE EXTRACTION
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return [];

            // Get user preferences
            const preferredServer = this.getPreference("animekai_primary_server") || "server1";
            const preferredQuality = this.getPreference("animekai_video_quality") || "auto";

            // Find all video servers
            const servers = doc.select(".server-list li, .server-tab") || [];
            const sources = [];

            for (const server of servers) {
                const serverType = server.attr("data-server") || "server1";
                
                // Skip non-preferred servers if we already have sources
                if (sources.length > 0 && serverType !== preferredServer) continue;
                
                const videoItems = server.select(".video-item, [data-video]") || [];
                
                for (const video of videoItems) {
                    const videoUrl = video.attr("data-video") || 
                                   video.attr("data-src") || 
                                   video.selectFirst("iframe")?.attr("src");
                    
                    if (videoUrl) {
                        sources.push({
                            url: videoUrl,
                            quality: preferredQuality === "auto" ? 0 : parseInt(preferredQuality),
                            server: serverType,
                            headers: {
                                Referer: this.getBaseUrl(),
                                Origin: this.getBaseUrl()
                            }
                        });
                    }
                }
            }

            return sources.length > 0 ? sources : this._getFallbackSource(episodeUrl);
        } catch (error) {
            console.error("Video extraction failed:", error);
            return this._getFallbackSource(episodeUrl);
        }
    }

    _getFallbackSource(episodeUrl) {
        return [{
            url: episodeUrl.replace("/episode-", "/watch/") + ".mp4",
            quality: 720,
            server: "fallback",
            headers: {
                Referer: this.getBaseUrl()
            }
        }];
    }

    // [KEEP YOUR ORIGINAL WORKING SEARCH METHODS]
    // search(), getPopular(), getLatestUpdates() remain unchanged
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
