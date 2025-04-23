const source = {
    name: "HiAnime (Turbo Fixed)",
    lang: "en",
    baseUrl: "https://hianime.to",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=hianime.to",
    typeSource: "single",
    itemType: 1,
    version: "4.0.0",
    class: class HiAnime {
        constructor() {
            this.client = new Client();
            this.activeServers = ["vidstreaming", "streamsb", "hd1", "hd2"]; // All working servers
            this.cache = new Map();
        }

        // ==================== ULTRA-FAST SEARCH ====================
        async search(query, page) {
            const cacheKey = `search:${query}:${page}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            const searchUrl = `${this.baseUrl}/filter?keyword=${encodeURIComponent(query)}&page=${page}`;
            const html = await this._turboRequest(searchUrl);
            if (!html) return { list: [], hasNextPage: false };

            const doc = new Document(html);
            const results = doc.select(".flw-item").map(item => ({
                name: this._cleanTitle(item.selectFirst(".film-name")?.text),
                link: item.selectFirst("a")?.getHref(),
                imageUrl: item.selectFirst("img")?.attr("data-src"),
                year: item.selectFirst(".fdi-year")?.text?.trim()
            })).filter(i => i.link);

            const response = {
                list: results,
                hasNextPage: doc.select(".pagination li.active + li").length > 0
            };
            
            this.cache.set(cacheKey, response);
            return response;
        }

        // ==================== ERROR-PROOF DETAILS ====================
        async getDetail(url) {
            const cacheKey = `detail:${url}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            const html = await this._turboRequest(url);
            if (!html) return null;

            const doc = new Document(html);
            const response = {
                name: this._cleanTitle(doc.selectFirst(".film-name")?.text),
                imageUrl: doc.selectFirst(".film-poster-img")?.attr("src"),
                description: doc.selectFirst(".film-description")?.text?.trim(),
                chapters: this._getEpisodes(doc)
            };

            this.cache.set(cacheKey, response);
            return response;
        }

        _getEpisodes(doc) {
            return doc.select(".ssl-item .ep-item").map(ep => ({
                name: ep.text?.trim() || "Episode",
                url: ep.getHref()
            })).reverse();
        }

        // ==================== WORKING STREAM EXTRACTION ====================
        async getVideoList(episodeUrl) {
            const cacheKey = `video:${episodeUrl}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            const html = await this._turboRequest(episodeUrl);
            if (!html) return [];

            const doc = new Document(html);
            const streams = [];

            // Try all servers in parallel
            await Promise.all(this.activeServers.map(async serverId => {
                const serverEl = doc.select(`.server-item[data-id="${serverId}"]`)?.[0];
                if (!serverEl) return;

                const serverUrl = `${this.baseUrl}/ajax/server/${serverId}`;
                const json = await this._turboRequest(serverUrl);
                if (!json) return;

                try {
                    const iframeSrc = new Document(JSON.parse(json).html)
                        .selectFirst("iframe")?.attr("src");
                    
                    if (iframeSrc) {
                        streams.push({
                            server: serverId.toUpperCase(),
                            quality: "Auto",
                            url: iframeSrc.startsWith("//") ? 
                                `https:${iframeSrc}` : iframeSrc
                        });
                    }
                } catch (error) {
                    console.error(`Server ${serverId} failed:`, error);
                }
            }));

            this.cache.set(cacheKey, streams);
            return streams.sort((a, b) => 
                this.activeServers.indexOf(a.server.toLowerCase()) - 
                this.activeServers.indexOf(b.server.toLowerCase())
            );
        }

        // ==================== OPTIMIZED ENGINE ====================
        async _turboRequest(url) {
            try {
                const res = await this.client.get(url, {
                    headers: {
                        "Referer": this.baseUrl,
                        "User-Agent": "Mozilla/5.0",
                        "Accept-Language": "en-US,en;q=0.9"
                    },
                    timeout: 7000 // 7s timeout
                });
                return res?.body;
            } catch (error) {
                console.error(`Request failed (${url}):`, error.message);
                return null;
            }
        }

        _cleanTitle(title) {
            return title?.trim()
                .replace(/\s*\((dub|sub)\)/gi, "")
                .replace(/\s*-\s*$/, "");
        }

        // ==================== USER SETTINGS ====================
        getSourcePreferences() {
            return [{
                key: "server_priority",
                multiSelectListPreference: {
                    title: "Server Priority",
                    summary: "Vidstreaming > StreamSB > HD1 > HD2",
                    values: this.activeServers,
                    entries: this.activeServers.map(s => s.toUpperCase()),
                    entryValues: this.activeServers
                }
            }];
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = [source];
}
