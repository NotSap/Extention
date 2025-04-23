const source = {
    name: "HiAnime (Ultimate Fix)",
    lang: "en",
    baseUrl: "https://hianime.to",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=hianime.to",
    typeSource: "single",
    itemType: 1,
    version: "3.5.0",
    class: class HiAnime {
        constructor() {
            this.client = new Client();
            this.cache = new Map();
            this.serversPriority = [
                "vidstreaming",  // Primary (English)
                "streamsb",     // Secondary
                "hd1",          // Fallback 1
                "hd2"           // Fallback 2
            ];
        }

        // ==================== INSTANT SEARCH ====================
        async search(query, page) {
            const cacheKey = `search:${query}:${page}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            const searchUrl = `${this.baseUrl}/filter?keyword=${encodeURIComponent(query)}&page=${page}`;
            const html = await this._fastRequest(searchUrl);
            if (!html) return { list: [], hasNextPage: false };

            const doc = new Document(html);
            const results = doc.select(".flw-item").map(item => ({
                name: this._cleanTitle(item.selectFirst(".film-name")?.text),
                link: item.selectFirst("a")?.getHref(),
                imageUrl: item.selectFirst("img")?.attr("data-src"),
                year: item.selectFirst(".fdi-year")?.text?.trim(),
                type: item.selectFirst(".fdi-type")?.text?.trim()
            })).filter(i => i.link);

            const response = {
                list: results,
                hasNextPage: doc.select(".pagination li.active + li").length > 0
            };
            this.cache.set(cacheKey, response);
            return response;
        }

        // ==================== SMART SEASON DETECTION ====================
        async getDetail(url) {
            const cacheKey = `detail:${url}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            const html = await this._fastRequest(url);
            if (!html) return null;

            const doc = new Document(html);
            const season = this._detectSeason(doc, url);
            const title = this._cleanTitle(doc.selectFirst(".film-name")?.text);

            const response = {
                name: season ? `${title} - ${season}` : title,
                imageUrl: doc.selectFirst(".film-poster-img")?.attr("src"),
                description: doc.selectFirst(".film-description")?.text?.trim(),
                chapters: this._getSeasonEpisodes(doc, season),
                metadata: {
                    altTitles: doc.select(".anisc-detail .item-title")?.map(el => el.text?.trim()),
                    year: doc.selectFirst(".item-list span:-soup-contains('Released')")?.nextSibling?.text?.trim()
                }
            };

            this.cache.set(cacheKey, response);
            return response;
        }

        _detectSeason(doc, url) {
            // 1. Check URL first (most reliable)
            const urlMatch = url.match(/season-(\d+)/i);
            if (urlMatch) return `Season ${urlMatch[1]}`;

            // 2. Check page elements
            const seasonText = doc.selectFirst(".anisc-detail span:-soup-contains('Season')")?.text?.trim();
            if (seasonText) return seasonText;

            // 3. Default to Season 1 if no info
            return "Season 1";
        }

        _getSeasonEpisodes(doc, season) {
            return doc.select(".ssl-item .ep-item").map(ep => ({
                name: `${season} ${ep.text?.trim() || "Episode"}`,
                url: ep.getHref(),
                season: season
            })).reverse();
        }

        // ==================== TURBO STREAMS ====================
        async getVideoList(episodeUrl) {
            const html = await this._fastRequest(episodeUrl);
            if (!html) return [];

            const doc = new Document(html);
            const streams = [];

            // Try servers in priority order
            for (const serverId of this.serversPriority) {
                const server = doc.select(`.server-item[data-id="${serverId}"]`)?.[0];
                if (!server) continue;

                const embedUrl = `${this.baseUrl}/ajax/server/${serverId}`;
                const json = await this._fastRequest(embedUrl);
                if (!json) continue;

                try {
                    const iframe = new Document(JSON.parse(json).html).selectFirst("iframe");
                    if (iframe) {
                        streams.push({
                            server: serverId.toUpperCase(),
                            quality: "Auto",
                            url: iframe.attr("src").replace(/^\/\//, "https://")
                        });
                        break; // Use first working server
                    }
                } catch (error) {
                    console.error(`Server ${serverId} failed:`, error);
                }
            }

            return streams;
        }

        // ==================== OPTIMIZED UTILITIES ====================
        async _fastRequest(url) {
            try {
                const res = await this.client.get(url, {
                    headers: {
                        "Referer": this.baseUrl,
                        "User-Agent": "Mozilla/5.0",
                        "Accept-Language": "en-US,en;q=0.5"
                    },
                    timeout: 5000 // 5s timeout for faster fallback
                });
                return res?.body;
            } catch {
                return null;
            }
        }

        _cleanTitle(title) {
            return title?.trim()
                .replace(/\s*\((dub|sub)\)/gi, "")
                .replace(/\s*-\s*$/, "")
                .replace(/\s{2,}/g, " ");
        }

        // ==================== USER SETTINGS ====================
        getSourcePreferences() {
            return [
                {
                    key: "language_filter",
                    listPreference: {
                        title: "Title Language",
                        summary: "Filter non-English titles",
                        valueIndex: 0,
                        entries: ["Show All", "English Only"],
                        entryValues: ["all", "english"]
                    }
                },
                {
                    key: "server_priority",
                    multiSelectListPreference: {
                        title: "Server Priority",
                        summary: "Drag to reorder servers",
                        values: this.serversPriority,
                        entries: this.serversPriority.map(s => s.toUpperCase()),
                        entryValues: this.serversPriority
                    }
                }
            ];
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = [source];
}
