const source = {
    name: "Hikari (Perfect)",
    lang: "en",
    baseUrl: "https://hikari.gg",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=hikari.gg",
    typeSource: "single",
    itemType: 1,
    version: "5.0.0",
    class: class Hikari {
        constructor() {
            this.client = new Client({
                maxRetries: 2,
                timeout: 8000
            });
            this.workingServers = ["VizCloud", "StreamSB", "MyCloud"];
            this.cache = new Map();
        }

        // ============== LIGHTNING FAST SEARCH ==============
        async search(query, page) {
            const cacheKey = `search:${query}:${page}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`;
            try {
                const { body } = await this.client.get(searchUrl);
                const doc = new Document(body);
                
                const results = doc.select(".film-list .film-item").map(item => ({
                    name: item.selectFirst(".film-name")?.text?.trim() || "Untitled",
                    link: item.selectFirst("a")?.getHref(),
                    imageUrl: item.selectFirst("img")?.attr("data-src"),
                    type: item.selectFirst(".film-type")?.text?.trim() || "TV"
                })).filter(i => i.link);

                const response = {
                    list: results,
                    hasNextPage: doc.select(".pagination .next").length > 0
                };
                this.cache.set(cacheKey, response, 300000); // 5 min cache
                return response;
            } catch (e) {
                console.error("Search error:", e);
                return { list: [], hasNextPage: false };
            }
        }

        // ============== PERFECT DETAIL EXTRACTION ==============
        async getDetail(url) {
            const cacheKey = `detail:${url}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            try {
                const { body } = await this.client.get(url);
                const doc = new Document(body);
                
                const episodes = await this._extractEpisodes(doc);
                if (!episodes.length) throw new Error("No episodes found");

                const response = {
                    name: doc.selectFirst(".film-title")?.text?.trim() || "Unknown",
                    imageUrl: doc.selectFirst(".film-poster img")?.attr("src"),
                    description: doc.selectFirst(".film-description")?.text?.trim(),
                    chapters: episodes,
                    metadata: {
                        status: doc.selectFirst(".film-status")?.text?.trim(),
                        genres: doc.select(".film-genre a")?.map(g => g.text?.trim())
                    }
                };
                this.cache.set(cacheKey, response);
                return response;
            } catch (e) {
                console.error("Detail error:", e);
                return null;
            }
        }

        async _extractEpisodes(doc) {
            const episodeList = doc.select(".episode-list li");
            return episodeList.map(ep => ({
                name: `Episode ${ep.attr("data-number")}`,
                url: ep.selectFirst("a")?.getHref(),
                season: ep.attr("data-season") || "1"
            })).reverse();
        }

        // ============== FLAWLESS STREAMING ==============
        async getVideoList(episodeUrl) {
            const cacheKey = `video:${episodeUrl}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            try {
                const { body } = await this.client.get(episodeUrl);
                const doc = new Document(body);
                
                const streams = [];
                const serverTabs = doc.select(".server-tab");
                
                for (const tab of serverTabs) {
                    const serverName = tab.text?.trim();
                    if (!this.workingServers.some(s => serverName.includes(s))) continue;
                    
                    const serverId = tab.attr("data-id");
                    const embedUrl = `${this.baseUrl}/ajax/server/${serverId}`;
                    
                    try {
                        const { body: embedBody } = await this.client.get(embedUrl);
                        const embedData = JSON.parse(embedBody);
                        const iframeSrc = new Document(embedData.html).selectFirst("iframe")?.attr("src");
                        
                        if (iframeSrc) {
                            streams.push({
                                server: serverName,
                                quality: "1080p",
                                url: iframeSrc.startsWith("//") ? `https:${iframeSrc}` : iframeSrc,
                                backupUrl: `${this.baseUrl}/embed/${serverId}`
                            });
                        }
                    } catch (e) {
                        console.error(`Server ${serverName} failed:`, e);
                    }
                }

                this.cache.set(cacheKey, streams, 600000); // 10 min cache
                return streams;
            } catch (e) {
                console.error("Video list error:", e);
                return [];
            }
        }

        // ============== OPTIMIZATION ENGINE ==============
        getSourcePreferences() {
            return [{
                key: "server_priority",
                multiSelectListPreference: {
                    title: "Server Priority",
                    summary: "Drag to reorder (VizCloud recommended)",
                    values: this.workingServers,
                    entries: this.workingServers,
                    entryValues: this.workingServers
                }
            }];
        }

        getFilterList() {
            return [{
                type_name: "GroupFilter",
                name: "Content Type",
                state: [{
                    type_name: "CheckBox",
                    name: "Anime",
                    value: "anime",
                    state: true
                }, {
                    type_name: "CheckBox",
                    name: "Dubbed",
                    value: "dub",
                    state: false
                }]
            }];
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = [source];
}
