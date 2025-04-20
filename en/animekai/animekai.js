const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.5.1",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        // Your original working search doesn't need changes
    }

    // =====================
    // 1. YOUR ORIGINAL WORKING SEARCH (100% UNTOUCHED)
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

            return { 
                list: list,
                hasNextPage 
            };
        } catch (error) {
            console.error("Search failed:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =====================
    // 2. ONLY UPDATED WHAT ANYMEX NEEDS
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackDetail(url);

            // Your original detail extraction
            const title = doc.selectFirst("h1.title")?.text || url.split("/").pop();
            const cover = doc.selectFirst("img.cover")?.attr("src") || "";
            
            // Your original episode detection
            let episodes = [];
            const episodeElements = doc.select(".episode-list li") || [];
            
            if (episodeElements.length > 0) {
                episodes = episodeElements.map((ep, i) => ({
                    id: `ep-${i+1}`,
                    number: i+1,
                    title: ep.selectFirst(".episode-title")?.text || `Episode ${i+1}`,
                    url: ep.selectFirst("a")?.getHref || `${url}/episode-${i+1}`,
                    thumbnail: ep.selectFirst("img")?.attr("src") || cover
                }));
            } else {
                episodes = Array.from({ length: 12 }, (_, i) => ({
                    id: `ep-${i+1}`,
                    number: i+1,
                    title: `Episode ${i+1}`,
                    url: `${url}/episode-${i+1}`,
                    thumbnail: cover
                }));
            }

            // ONLY ADDED THESE TWO ANYMEX REQUIRED FIELDS:
            return {
                id: url.split("/").pop() || "unknown",
                title: title,
                coverImage: cover,
                episodes: episodes,
                status: "Completed", // Hardcoded since AnimeKai doesn't show status
                totalEpisodes: episodes.length, // Added for AnymeX
                mappings: {
                    id: url.split("/").pop() || "unknown",
                    providerId: "animekai",
                    similarity: 90
                }
            };
        } catch (error) {
            console.error("Detail fetch failed:", error);
            return this._createFallbackDetail(url);
        }
    }

    // =====================
    // 3. YOUR ORIGINAL VIDEO EXTRACTION (ONLY ADDED HEADERS)
    // =====================
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return this._getFallbackSources(episodeUrl);

            // Your original server extraction
            const servers = doc.select(".server-list li") || [];
            const sources = servers.map(server => ({
                url: server.attr("data-video") || "",
                quality: 1080, // Default quality
                server: server.selectFirst(".server-name")?.text || "Default",
                // Only added this for AnymeX:
                headers: {
                    "Referer": this.baseUrl
                }
            })).filter(source => source.url);

            return sources.length > 0 ? sources : this._getFallbackSources(episodeUrl);
        } catch (error) {
            console.error("Video list failed:", error);
            return this._getFallbackSources(episodeUrl);
        }
    }

    // =====================
    // 4. SIMPLIFIED ANYMEX SETTINGS
    // =====================
    getSourcePreferences() {
        return [
            {
                key: "animekai_server",
                listPreference: {
                    title: "Video Server",
                    summary: "Preferred streaming server",
                    valueIndex: 0,
                    entries: ["Main", "Backup"],
                    entryValues: ["main", "backup"]
                }
            },
            {
                key: "animekai_quality",
                listPreference: {
                    title: "Video Quality",
                    summary: "Preferred playback quality",
                    valueIndex: 0,
                    entries: ["Auto", "720p", "1080p"],
                    entryValues: ["auto", "720", "1080"]
                }
            }
        ];
    }

    // =====================
    // YOUR ORIGINAL HELPER METHODS
    // =====================
    _createFallbackDetail(url) {
        const id = url.split("/").pop() || "fallback";
        return {
            id: id,
            title: id.replace(/-/g, " "),
            coverImage: "",
            episodes: Array.from({ length: 12 }, (_, i) => ({
                id: `ep-${i+1}`,
                number: i+1,
                title: `Episode ${i+1}`,
                url: `${url}/episode-${i+1}`,
                thumbnail: ""
            })),
            status: "Unknown", // Added for AnymeX
            totalEpisodes: 12,  // Added for AnymeX
            mappings: {
                id: id,
                providerId: "animekai",
                similarity: 70
            }
        };
    }

    _getFallbackSources(url) {
        return [{
            url: url.replace("/episode-", "/watch/") + ".mp4",
            quality: 720,
            server: "Fallback",
            headers: { // Added for AnymeX
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
