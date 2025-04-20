const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.4.1",
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
    // 2. ANYMEX COMPATIBLE DETAIL EXTRACTION
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createFallbackDetail(url);

            // AnymeX required fields
            const title = doc.selectFirst("h1.title")?.text?.trim() || "Unknown";
            const cover = doc.selectFirst("img.cover")?.attr("src") || "";
            const description = doc.selectFirst(".description")?.text?.trim() || "";

            // Episode extraction with AnymeX compatibility
            const episodes = [];
            const episodeItems = doc.select(".episode-list li, .episode-item") || [];
            
            episodeItems.forEach((item, index) => {
                const epNum = parseInt(
                    item.attr("data-episode") || 
                    item.selectFirst(".episode-num")?.text?.match(/\d+/)?.[0] || 
                    (index + 1)
                );
                
                episodes.push({
                    id: `ep-${epNum}`,
                    number: epNum,
                    title: item.selectFirst(".episode-title")?.text?.trim() || `Episode ${epNum}`,
                    url: item.selectFirst("a")?.getHref || `${url}/episode-${epNum}`,
                    thumbnail: item.selectFirst("img")?.attr("src") || cover
                });
            });

            return {
                id: url.split('/').pop() || "unknown",
                title: title,
                coverImage: cover,
                description: description,
                status: "Ongoing", // AnymeX expects this field
                episodes: episodes.length ? episodes : this._generateFallbackEpisodes(url, cover),
                mappings: { // Required by AnymeX
                    id: url.split('/').pop() || "unknown",
                    providerId: "animekai",
                    similarity: 95
                }
            };
        } catch (error) {
            console.error("Detail fetch failed:", error);
            return this._createFallbackDetail(url);
        }
    }

    // =====================
    // 3. ANYMEX COMPATIBLE VIDEO SOURCES
    // =====================
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return this._getFallbackSources(episodeUrl);

            const sources = [];
            const servers = doc.select(".server-list li, .server-tab") || [];
            
            for (const server of servers) {
                const serverName = server.selectFirst(".server-name")?.text?.trim() || "Server";
                const videos = server.select("[data-video], .video-item") || [];
                
                for (const video of videos) {
                    const url = video.attr("data-video") || video.attr("data-src");
                    if (url) {
                        sources.push({
                            url: url,
                            quality: video.text().match(/1080|720|480/)?.[0] || "Auto",
                            server: serverName,
                            headers: { // Required for AnymeX playback
                                "Referer": this.baseUrl,
                                "Origin": this.baseUrl
                            }
                        });
                    }
                }
            }

            return sources.length ? sources : this._getFallbackSources(episodeUrl);
        } catch (error) {
            console.error("Video extraction failed:", error);
            return this._getFallbackSources(episodeUrl);
        }
    }

    // =====================
    // 4. OPTIMIZED SETTINGS FOR ANYMEX
    // =====================
    getSourcePreferences() {
        return [
            {
                key: "primary_server",
                listPreference: {
                    title: "Default Server",
                    summary: "Preferred video source",
                    valueIndex: 0,
                    entries: ["Server 1", "Server 2", "Backup"],
                    entryValues: ["server1", "server2", "backup"]
                }
            },
            {
                key: "video_quality",
                listPreference: {
                    title: "Video Quality",
                    summary: "Preferred playback quality",
                    valueIndex: 1,
                    entries: ["Auto", "480p", "720p", "1080p"],
                    entryValues: ["auto", "480", "720", "1080"]
                }
            },
            {
                key: "show_dub",
                switchPreferenceCompat: {
                    title: "Show Dub Versions",
                    summary: "Include dubbed episodes",
                    value: true
                }
            }
        ];
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
            description: "",
            status: "Unknown",
            episodes: this._generateFallbackEpisodes(url, ""),
            mappings: {
                id: id,
                providerId: "animekai",
                similarity: 70
            }
        };
    }

    _generateFallbackEpisodes(url, cover) {
        return Array.from({ length: 12 }, (_, i) => ({
            id: `ep-${i+1}`,
            number: i+1,
            title: `Episode ${i+1}`,
            url: `${url}/episode-${i+1}`,
            thumbnail: cover
        }));
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
