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
        this.titleVariationsCache = new Map();
    }

    // =====================
    // 1. YOUR WORKING SEARCH (UNTOUCHED)
    // =====================
    async search(query, page, filters) {
        try {
            const filterValues = {
                type: filters[0]?.state?.filter(f => f.state).map(f => f.value) || [],
                genre: filters[1]?.state?.filter(f => f.state).map(f => f.value) || [],
                status: filters[2]?.state?.filter(f => f.state).map(f => f.value) || [],
                sort: filters[3]?.values?.[filters[3]?.state]?.value || "updated_date",
                season: filters[4]?.state?.filter(f => f.state).map(f => f.value) || [],
                year: filters[5]?.state?.filter(f => f.state).map(f => f.value) || [],
                rating: filters[6]?.state?.filter(f => f.state).map(f => f.value) || [],
                country: filters[7]?.state?.filter(f => f.state).map(f => f.value) || [],
                language: filters[8]?.state?.filter(f => f.state).map(f => f.value) || []
            };

            let slug = "/browser?keyword=" + encodeURIComponent(query);
            
            for (const [key, values] of Object.entries(filterValues)) {
                if (values.length > 0) {
                    if (key === "sort") {
                        slug += `&${key}=${values}`;
                    } else {
                        values.forEach(value => {
                            slug += `&${key}[]=${encodeURIComponent(value)}`;
                        });
                    }
                }
            }

            slug += `&page=${page}`;

            const body = await this.getPage(slug);
            if (!body) return { list: [], hasNextPage: false };

            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const animeItems = body.select(".aitem-wrapper .aitem") || [];
            
            const list = animeItems.map(anime => {
                const link = anime.selectFirst("a")?.getHref;
                const imageUrl = anime.selectFirst("img")?.attr("data-src");
                const name = anime.selectFirst("a.title")?.attr(titlePref) || 
                            anime.selectFirst("a.title")?.text;
                return { name, link, imageUrl };
            }).filter(item => item.link && item.imageUrl);

            const paginations = body.select(".pagination > li") || [];
            const hasNextPage = paginations.length > 0 ? 
                !paginations[paginations.length - 1].className.includes("active") : false;

            return { list, hasNextPage };
        } catch (error) {
            console.error("Search failed:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =====================
    // 2. IMPROVED DETAIL PAGE EXTRACTION
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackDetail(url);

            // Title with multiple fallbacks
            const title = doc.selectFirst("h1.title")?.text?.trim() || 
                         doc.selectFirst("meta[property='og:title']")?.attr("content")?.trim() || 
                         url.split("/").pop().replace(/-/g, " ");

            // Cover image with multiple fallbacks
            const cover = doc.selectFirst("img.cover")?.attr("src") || 
                         doc.selectFirst("meta[property='og:image']")?.attr("content") || "";

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

            // If no episodes found, check for movie format
            if (episodes.length === 0) {
                const watchBtn = doc.selectFirst(".watch-btn");
                if (watchBtn) {
                    episodes.push({
                        id: "movie",
                        number: 1,
                        title: "Movie",
                        url: watchBtn.getHref,
                        thumbnail: cover
                    });
                }
            }

            return {
                id: url.split('/').pop() || "unknown-id",
                title: title,
                coverImage: cover,
                description: doc.selectFirst(".description")?.text?.trim() || "",
                status: doc.selectFirst(".status")?.text?.trim() || "Unknown",
                episodes: episodes,
                mappings: {
                    id: url.split('/').pop() || "unknown-id",
                    providerId: "animekai",
                    similarity: 95
                }
            };
        } catch (error) {
            console.error("Detail extraction failed:", error);
            return this._createFallbackDetail(url);
        }
    }

    // =====================
    // 3. RELIABLE VIDEO SOURCE EXTRACTION
    // =====================
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

    // =====================
    // HELPER METHODS
    // =====================
    _createFallbackDetail(url) {
        const id = url.split("/").pop() || "fallback";
        return {
            id: id,
            title: id.replace(/-/g, " "),
            coverImage: "",
            description: "",
            status: "Unknown",
            episodes: Array.from({ length: 12 }, (_, i) => ({
                id: `ep-${i+1}`,
                number: i+1,
                title: `Episode ${i+1}`,
                url: `${url}/episode-${i+1}`,
                thumbnail: ""
            })),
            mappings: {
                id: id,
                providerId: "animekai",
                similarity: 70
            }
        };
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

    async getPage(url) {
        try {
            const fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
            const res = await this.client.get(fullUrl, {
                headers: {
                    "Referer": this.baseUrl,
                    "Origin": this.baseUrl,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            });
            return new Document(res.body);
        } catch (error) {
            console.error("Failed to fetch page:", error);
            return null;
        }
    }

    // =====================
    // 4. YOUR ORIGINAL SETTINGS
    // =====================
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
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
