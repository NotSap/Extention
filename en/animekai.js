const source = {
    name: "AnimeKai (Fixed)",
    lang: "en",
    baseUrl: "https://animekai.to",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=animekai.to",
    typeSource: "single",
    itemType: 1,
    version: "3.6.0",
    class: class AnimeKai {
        constructor() {
            this.client = new Client();
            this.cache = new Map();
            this.serversPriority = ["1", "2"]; // Server 1 & 2 (HD1/HD2 equivalents)
        }

        // ==================== INSTANT SEARCH ====================
        async search(query, page) {
            const cacheKey = `search:${query}:${page}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            const searchUrl = `${this.baseUrl}/browser?keyword=${encodeURIComponent(query)}&page=${page}`;
            const html = await this._fastRequest(searchUrl);
            if (!html) return { list: [], hasNextPage: false };

            const doc = new Document(html);
            const results = doc.select(".aitem-wrapper .aitem").map(item => ({
                name: this._cleanTitle(item.selectFirst(".title")?.text),
                link: item.selectFirst("a")?.getHref(),
                imageUrl: item.selectFirst("img")?.attr("data-src"),
                type: item.selectFirst(".type")?.text?.trim() || "TV"
            })).filter(i => i.link);

            const response = {
                list: results,
                hasNextPage: doc.select(".pagination li.active + li").length > 0
            };
            this.cache.set(cacheKey, response);
            return response;
        }

        // ==================== ACCURATE SEASON HANDLING ====================
        async getDetail(url) {
            const cacheKey = `detail:${url}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            const html = await this._fastRequest(url);
            if (!html) return null;

            const doc = new Document(html);
            const season = this._detectSeason(doc, url);
            const title = this._cleanTitle(doc.selectFirst(".watch-section .title")?.text);

            const response = {
                name: season ? `${title} - ${season}` : title,
                imageUrl: doc.selectFirst(".poster img")?.attr("src"),
                description: doc.selectFirst(".desc")?.text?.trim(),
                chapters: await this._getEpisodes(doc, season)
            };

            this.cache.set(cacheKey, response);
            return response;
        }

        _detectSeason(doc, url) {
            // 1. Check URL for season info
            const urlMatch = url.match(/season-(\d+)/i) || url.match(/s(\d+)/i);
            if (urlMatch) return `Season ${urlMatch[1]}`;

            // 2. Check page elements
            const seasonText = doc.selectFirst("span:-soup-contains('Season')")?.text?.trim();
            if (seasonText) return seasonText;

            return "Season 1"; // Default
        }

        async _getEpisodes(doc, season) {
            const animeId = doc.selectFirst("#anime-rating")?.attr("data-id");
            if (!animeId) return [];

            const apiUrl = `${this.baseUrl}/ajax/episodes/list?ani_id=${animeId}`;
            const json = await this._fastRequest(apiUrl);
            if (!json) return [];

            try {
                const data = JSON.parse(json);
                if (data.status !== 200) return [];

                return new Document(data.result)
                    .select(".eplist li")
                    .map(ep => ({
                        name: `${season} Episode ${ep.attr("num")}`,
                        url: ep.selectFirst("a")?.attr("token"),
                        season: season
                    }))
                    .reverse();
            } catch (error) {
                console.error("Episode parse error:", error);
                return [];
            }
        }

        // ==================== RELIABLE STREAMING ====================
        async getVideoList(episodeToken) {
            const cacheKey = `video:${episodeToken}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            const streams = [];
            for (const serverId of this.serversPriority) {
                const stream = await this._extractStream(episodeToken, serverId);
                if (stream) {
                    streams.push(stream);
                    break; // Use first working server
                }
            }

            this.cache.set(cacheKey, streams);
            return streams;
        }

        async _extractStream(episodeToken, serverId) {
            try {
                const apiUrl = `${this.baseUrl}/ajax/links/list?token=${episodeToken}`;
                const json = await this._fastRequest(apiUrl);
                if (!json) return null;

                const data = JSON.parse(json);
                if (data.status !== 200) return null;

                const server = new Document(data.result)
                    .select(`span.server[data-lid="${serverId}"]`)
                    ?.[0];
                if (!server) return null;

                const viewUrl = `${this.baseUrl}/ajax/links/view?id=${serverId}`;
                const viewJson = await this._fastRequest(viewUrl);
                if (!viewJson) return null;

                const streamData = JSON.parse(viewJson);
                return streamData.status === 200 ? {
                    server: `Server ${serverId}`,
                    quality: "Auto",
                    url: streamData.result.url.replace(/^\/\//, "https://")
                } : null;
            } catch (error) {
                console.error(`Server ${serverId} failed:`, error);
                return null;
            }
        }

        // ==================== OPTIMIZED UTILITIES ====================
        async _fastRequest(url) {
            try {
                const res = await this.client.get(url, {
                    headers: {
                        "Referer": this.baseUrl,
                        "User-Agent": "Mozilla/5.0"
                    },
                    timeout: 5000 // 5s timeout
                });
                return res?.body;
            } catch {
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
                    summary: "Drag to reorder (1=HD1, 2=HD2)",
                    values: this.serversPriority,
                    entries: ["Server 1 (HD1)", "Server 2 (HD2)"],
                    entryValues: ["1", "2"]
                }
            }];
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = [source];
}
