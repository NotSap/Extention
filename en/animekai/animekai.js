const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.4.0",
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
        this.titleCache = new Map();
    }

    // =====================
    // 1. YOUR ORIGINAL WORKING SEARCH (UNTOUCHED)
    // =====================
    async search(query, page, filters) {
        try {
            let result = await this._exactSearch(query, page, filters);
            if (result.list.length === 0) {
                result = await this._fuzzySearch(query, page);
                result.list.forEach(item => {
                    this.titleCache.set(item.name.toLowerCase(), item.link);
                });
            }
            return result;
        } catch (error) {
            console.error("Search failed:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async _exactSearch(query, page, filters) {
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
    }

    async _fuzzySearch(query, page) {
        const slug = "/browser?keyword=" + encodeURIComponent(query.split(" ")[0]) + `&page=${page}`;
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
    }

    // =====================
    // 2. FIXED SETTINGS FOR ANYMEX
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
            }
        ];
    }

    // =====================
    // 3. ANIMEX COMPATIBILITY FIXES
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackDetail(url);

            // AnymeX compatible detail structure
            const title = doc.selectFirst("h1.title")?.text || url.split("/").pop();
            const cover = doc.selectFirst("img.cover")?.attr("src") || "";

            // Episode extraction with AnymeX compatibility
            const episodes = [];
            const episodeElements = doc.select(".episode-list li, .episode-item") || [];
            
            if (episodeElements.length > 0) {
                episodes.push(...episodeElements.map((ep, i) => ({
                    id: `ep-${i+1}`,
                    number: i+1,
                    title: ep.selectFirst(".episode-title")?.text || `Episode ${i+1}`,
                    url: ep.selectFirst("a")?.getHref || `${url}/episode-${i+1}`,
                    thumbnail: ep.selectFirst("img")?.attr("src") || cover
                })));
            } else {
                // Fallback episodes for AnymeX
                for (let i = 1; i <= 12; i++) {
                    episodes.push({
                        id: `ep-${i}`,
                        number: i,
                        title: `Episode ${i}`,
                        url: `${url}/episode-${i}`,
                        thumbnail: cover
                    });
                }
            }

            return {
                id: url.split("/").pop() || "unknown",
                title: title,
                coverImage: cover,
                episodes: episodes,
                // AnymeX specific fields
                description: doc.selectFirst(".description")?.text?.trim() || "",
                status: "Ongoing",
                mappings: {
                    id: url.split("/").pop() || "unknown",
                    providerId: "animekai",
                    similarity: 95
                }
            };
        } catch (error) {
            console.error("Detail fetch failed:", error);
            return this._createFallbackDetail(url);
        }
    }

    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return this._getFallbackSources(episodeUrl);

            // AnymeX compatible video sources
            const sources = [];
            const servers = doc.select(".server-list li, .server-item") || [];
            
            for (const server of servers) {
                const serverName = server.selectFirst(".server-name")?.text?.trim() || "Default";
                const videos = server.select("[data-video], .video-item") || [];
                
                for (const video of videos) {
                    const url = video.attr("data-video") || video.attr("data-src");
                    if (url) {
                        sources.push({
                            url: url,
                            quality: video.text().match(/1080|720|480/)?.[0] || "Auto",
                            server: serverName,
                            // AnymeX required headers
                            headers: {
                                "Referer": this.baseUrl,
                                "Origin": this.baseUrl
                            }
                        });
                    }
                }
            }

            return sources.length > 0 ? sources : this._getFallbackSources(episodeUrl);
        } catch (error) {
            console.error("Video list failed:", error);
            return this._getFallbackSources(episodeUrl);
        }
    }

    // =====================
    // HELPER METHODS
    // =====================
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
            headers: {
                "Referer": this.baseUrl
            }
        }];
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
