const source = {
    name: "AnimeKai (Stable)",
    lang: "en",
    baseUrl: "https://animekai.to",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=animekai.to",
    typeSource: "single",
    itemType: 1,
    version: "2.0.2",
    class: class AnimeKai {
        constructor() {
            this.client = new Client();
            this.cache = new Map();
        }

        // ========== CORE METHODS ==========
        async request(url, options = {}) {
            try {
                const fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
                const cacheKey = fullUrl + JSON.stringify(options);
                
                // Return cached response if available
                if (this.cache.has(cacheKey)) {
                    return this.cache.get(cacheKey);
                }

                const res = await this.client.get(fullUrl, {
                    headers: {
                        "Referer": this.baseUrl,
                        "User-Agent": "Mozilla/5.0"
                    },
                    ...options
                });

                // Cache successful responses for 5 minutes
                if (res.statusCode === 200) {
                    this.cache.set(cacheKey, res.body);
                    setTimeout(() => this.cache.delete(cacheKey), 300000);
                }

                return res.body;
            } catch (error) {
                console.error(`Request failed: ${url}`, error);
                return null;
            }
        }

        // ========== SEARCH ==========
        async search(query, page) {
            try {
                const searchUrl = `/browser?keyword=${encodeURIComponent(query)}&page=${page}`;
                const html = await this.request(searchUrl);
                if (!html) return { list: [], hasNextPage: false };

                const doc = new Document(html);
                const items = doc.select(".aitem-wrapper .aitem") || [];
                
                const results = items.map(item => ({
                    name: item.selectFirst(".title")?.text()?.trim() || "Unknown Title",
                    link: item.selectFirst("a")?.getHref(),
                    imageUrl: item.selectFirst("img")?.attr("data-src"),
                    type: item.selectFirst(".type")?.text()?.trim()
                })).filter(i => i.link && i.imageUrl);

                const hasNextPage = doc.select(".pagination li.active + li")?.length > 0;
                return { list: results, hasNextPage };
            } catch (error) {
                console.error("Search error:", error);
                return { list: [], hasNextPage: false };
            }
        }

        // ========== DETAILS ==========
        async getDetail(url) {
            try {
                const html = await this.request(url);
                if (!html) return null;

                const doc = new Document(html);
                const mainSection = doc.selectFirst(".watch-section");
                if (!mainSection) return null;

                return {
                    name: mainSection.selectFirst(".title")?.text()?.trim(),
                    imageUrl: mainSection.selectFirst(".poster img")?.attr("src"),
                    description: mainSection.selectFirst(".desc")?.text()?.trim(),
                    genres: mainSection.select(".detail span:contains('Genres') + a")?.map(el => el.text()),
                    status: this.parseStatus(mainSection.selectFirst(".detail span:contains('Status')")?.text()),
                    chapters: await this.getEpisodes(doc)
                };
            } catch (error) {
                console.error("Detail error:", error);
                return null;
            }
        }

        parseStatus(statusText) {
            if (!statusText) return "Unknown";
            if (statusText.includes("Ongoing")) return "Ongoing";
            if (statusText.includes("Completed")) return "Completed";
            return statusText.trim();
        }

        async getEpisodes(doc) {
            try {
                const animeId = doc.selectFirst("#anime-rating")?.attr("data-id");
                if (!animeId) return [];

                const token = await this.generateToken(animeId);
                const apiUrl = `/ajax/episodes/list?ani_id=${animeId}&_=${token}`;
                const json = await this.request(apiUrl);
                if (!json) return [];

                const data = JSON.parse(json);
                if (data.status !== 200) return [];

                const episodesDoc = new Document(data.result);
                const items = episodesDoc.select(".eplist li") || [];
                
                return items.map(item => ({
                    name: `Episode ${item.attr("num")}`,
                    url: item.selectFirst("a")?.attr("token")
                })).reverse();
            } catch (error) {
                console.error("Episodes error:", error);
                return [];
            }
        }

        async generateToken(id) {
            // Simplified token generation - replace with actual logic if needed
            return Date.now().toString();
        }

        // ========== VIDEO EXTRACTION ==========
        async getVideoList(episodeToken) {
            try {
                const token = await this.generateToken(episodeToken);
                const apiUrl = `/ajax/links/list?token=${episodeToken}&_=${token}`;
                const json = await this.request(apiUrl);
                if (!json) return [];

                const data = JSON.parse(json);
                if (data.status !== 200) return [];

                const serversDoc = new Document(data.result);
                const servers = serversDoc.select(".server-items") || [];
                const streams = [];

                for (const server of servers) {
                    const serverType = server.attr("data-id");
                    const serverItems = server.select("span.server") || [];
                    
                    for (const item of serverItems) {
                        const serverId = item.attr("data-lid");
                        const serverName = item.text();
                        
                        const streamUrl = await this.getStreamUrl(serverId);
                        if (streamUrl) {
                            streams.push({
                                server: `${serverName} (${serverType})`,
                                quality: "Auto",
                                url: streamUrl
                            });
                        }
                    }
                }

                return streams;
            } catch (error) {
                console.error("Video list error:", error);
                return [];
            }
        }

        async getStreamUrl(serverId) {
            try {
                const token = await this.generateToken(serverId);
                const apiUrl = `/ajax/links/view?id=${serverId}&_=${token}`;
                const json = await this.request(apiUrl);
                if (!json) return null;

                const data = JSON.parse(json);
                return data.status === 200 ? data.result?.url : null;
            } catch (error) {
                console.error("Stream URL error:", error);
                return null;
            }
        }

        // ========== SETTINGS ==========
        getSourcePreferences() {
            return [{
                key: "animekai_pref_server",
                listPreference: {
                    title: "Preferred Server",
                    summary: "Server to use for streaming",
                    valueIndex: 0,
                    entries: ["Server 1", "Server 2"],
                    entryValues: ["1", "2"]
                }
            }];
        }

        getFilterList() {
            return [{
                type_name: "GroupFilter",
                name: "Content Type",
                state: [{
                    type_name: "CheckBox",
                    name: "TV Series",
                    value: "tv",
                    state: true
                }, {
                    type_name: "CheckBox",
                    name: "Movies",
                    value: "movie",
                    state: true
                }]
            }];
        }
    }
};

// Export for AnymeX
if (typeof module !== 'undefined') {
    module.exports = [source];
}
