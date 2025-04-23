const source = {
    name: "HiAnime (Fixed Seasons)",
    lang: "en",
    baseUrl: "https://hianime.to",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=hianime.to",
    typeSource: "single",
    itemType: 1,
    version: "3.4.0",
    class: class HiAnime {
        constructor() {
            this.client = new Client();
            this.validServers = ["vidstreaming", "streamsb"]; // English-supported servers
            this.cache = new Map();
        }

        // ==================== SMART SEARCH ====================
        async search(query, page) {
            const cacheKey = `search:${query}:${page}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            const searchUrl = `${this.baseUrl}/filter?keyword=${encodeURIComponent(query)}&language[]=english&page=${page}`;
            const html = await this._request(searchUrl);
            if (!html) return { list: [], hasNextPage: false };

            const doc = new Document(html);
            const results = [];

            doc.select(".flw-item").forEach(item => {
                const title = this._cleanTitle(item.selectFirst(".film-name")?.text);
                const type = item.selectFirst(".fdi-type")?.text?.trim() || "TV";
                
                // Skip non-English and non-TV entries
                if (title && type === "TV") {
                    results.push({
                        name: title,
                        link: item.selectFirst("a")?.getHref(),
                        imageUrl: item.selectFirst("img")?.attr("data-src"),
                        year: item.selectFirst(".fdi-year")?.text?.trim()
                    });
                }
            });

            const response = {
                list: results,
                hasNextPage: doc.select(".pagination li.active + li").length > 0
            };
            
            this.cache.set(cacheKey, response);
            return response;
        }

        // ==================== TITLE CLEANING ====================
        _cleanTitle(title) {
            if (!title) return null;
            
            // Remove language tags and season numbers
            return title.trim()
                .replace(/\s*\(dub\)/gi, "")
                .replace(/\s*\(sub\)/gi, "")
                .replace(/\s*season\s*\d+/gi, "")
                .replace(/[一-龠ぁ-ゔァ-ヴー]/g, ""); // Remove Japanese chars
        }

        // ==================== SEASON HANDLING ====================
        async getDetail(url) {
            const cacheKey = `detail:${url}`;
            if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

            const html = await this._request(url);
            if (!html) return null;

            const doc = new Document(html);
            const title = this._cleanTitle(doc.selectFirst(".film-name")?.text);
            const altTitles = doc.select(".anisc-detail .item-title")?.map(el => el.text?.trim());

            // Find correct season
            const seasonMatch = url.match(/season-(\d+)/i);
            const season = seasonMatch ? `Season ${seasonMatch[1]}` : "Season 1";

            const response = {
                name: `${title} - ${season}`,
                imageUrl: doc.selectFirst(".film-poster-img")?.attr("src"),
                description: doc.selectFirst(".film-description")?.text?.trim(),
                chapters: await this._getEpisodes(doc, season),
                metadata: {
                    altTitles,
                    year: doc.selectFirst(".item-list span:-soup-contains('Released')")?.nextSibling?.text?.trim()
                }
            };

            this.cache.set(cacheKey, response);
            return response;
        }

        async _getEpisodes(doc, season) {
            return doc.select(".ssl-item .ep-item").map(ep => ({
                name: `${season} ${ep.text?.trim() || "Episode"}`,
                url: ep.getHref(),
                season: season
            })).reverse();
        }

        // ==================== RELIABLE STREAMING ====================
        async getVideoList(episodeUrl) {
            const html = await this._request(episodeUrl);
            if (!html) return [];

            const doc = new Document(html);
            const streams = [];

            for (const serverId of this.validServers) {
                const server = doc.select(`.server-item[data-id="${serverId}"]`)?.[0];
                if (!server) continue;

                const embedUrl = `${this.baseUrl}/ajax/server/${serverId}`;
                const json = await this._request(embedUrl);
                if (!json) continue;

                try {
                    const iframeSrc = new Document(JSON.parse(json).html)
                        .selectFirst("iframe")?.attr("src");
                    
                    if (iframeSrc) {
                        streams.push({
                            server: `HiAnime ${serverId.toUpperCase()}`,
                            quality: "1080p (English)",
                            url: iframeSrc.includes("//") ? `https:${iframeSrc}` : iframeSrc
                        });
                        break; // Use first working server
                    }
                } catch (error) {
                    console.error(`Server ${serverId} failed:`, error);
                }
            }

            return streams;
        }

        // ==================== CORE UTILITIES ====================
        async _request(url) {
            try {
                const res = await this.client.get(url, {
                    headers: {
                        "Referer": this.baseUrl,
                        "User-Agent": "Mozilla/5.0",
                        "Accept-Language": "en-US,en;q=0.9"
                    },
                    timeout: 10000
                });
                return res.statusCode === 200 ? res.body : null;
            } catch (error) {
                console.error(`Request failed: ${error.message}`);
                return null;
            }
        }

        getSourcePreferences() {
            return [{
                key: "preferred_server",
                listPreference: {
                    title: "Server Priority",
                    summary: "Vidstreaming (Recommended) > StreamSB",
                    valueIndex: 0,
                    entries: ["Vidstreaming", "StreamSB"],
                    entryValues: ["vidstreaming", "streamsb"]
                }
            }];
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = [source];
}
