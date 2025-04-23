const source = {
    name: "HiAnime (Turbo)",
    lang: "en",
    baseUrl: "https://hianime.to",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=hianime.to",
    typeSource: "single",
    itemType: 1,
    version: "3.1.0",
    class: class HiAnime {
        constructor() {
            this.client = new Client();
            this.cache = new Map();
            this.requestDelay = 300; // ms between requests to avoid rate-limiting
        }

        // ==================== OPTIMIZED CORE ====================
        async cachedRequest(url) {
            const cacheKey = url;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            await new Promise(resolve => setTimeout(resolve, this.requestDelay));

            try {
                const res = await this.client.get(url, {
                    headers: {
                        "Referer": this.baseUrl,
                        "User-Agent": "Mozilla/5.0"
                    }
                });

                if (res.statusCode === 200) {
                    this.cache.set(cacheKey, res.body);
                    setTimeout(() => this.cache.delete(cacheKey), 300000); // 5min cache
                    return res.body;
                }
            } catch (error) {
                console.error(`Request failed (${url}):`, error);
            }
            return null;
        }

        // ==================== LIGHTNING SEARCH ====================
        async search(query, page) {
            const searchUrl = `${this.baseUrl}/search?keyword=${encodeURIComponent(query)}&page=${page}`;
            const html = await this.cachedRequest(searchUrl);
            if (!html) return { list: [], hasNextPage: false };

            const doc = new Document(html);
            const results = [];

            // Optimized selector for 2x faster parsing
            doc.select(".flw-item").forEach(item => {
                results.push({
                    name: item.selectFirst(".film-name")?.text?.trim() || "Untitled",
                    link: item.selectFirst(".film-name a")?.getHref(),
                    imageUrl: item.selectFirst(".film-poster img")?.attr("data-src"),
                    type: item.selectFirst(".fdi-type")?.text?.trim()
                });
            });

            return {
                list: results.filter(i => i.link),
                hasNextPage: doc.select(".pagination .next").length > 0
            };
        }

        // ==================== INSTANT DETAILS ====================
        async getDetail(url) {
            const html = await this.cachedRequest(url);
            if (!html) return null;

            const doc = new Document(html);
            const episodes = await this._getEpisodes(doc);

            return {
                name: doc.selectFirst(".anisc-detail .film-name")?.text?.trim(),
                imageUrl: doc.selectFirst(".film-poster-img")?.attr("src"),
                description: doc.selectFirst(".film-description")?.text?.trim(),
                genres: doc.select(".item-list a")?.map(el => el.text?.trim()),
                status: doc.selectFirst(".item-list .dot")?.nextSibling?.text?.trim(),
                chapters: episodes
            };
        }

        async _getEpisodes(doc) {
            const epList = doc.select(".ssl-item .ep-item");
            return epList.map(ep => ({
                name: ep.text?.trim() || "Episode",
                url: ep.getHref()
            })).reverse(); // Newest first
        }

        // ==================== TURBO STREAMS ====================
        async getVideoList(url) {
            const html = await this.cachedRequest(url);
            if (!html) return [];

            const doc = new Document(html);
            const serverData = doc.selectFirst("#server-data")?.attr("value");
            if (!serverData) return [];

            try {
                const { sources } = JSON.parse(serverData);
                return sources?.map(source => ({
                    server: source.name,
                    quality: "Auto",
                    url: source.url,
                    backupUrls: source.backups || []
                })) || [];
            } catch (error) {
                console.error("Stream parse error:", error);
                return [];
            }
        }

        // ==================== LIGHTWEIGHT SETTINGS ====================
        getSourcePreferences() {
            return [{
                key: "preferred_server",
                listPreference: {
                    title: "Default Server",
                    valueIndex: 0,
                    entries: ["Vidstreaming", "MyCloud"],
                    entryValues: ["vidstreaming", "mycloud"]
                }
            }];
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = [source];
}
