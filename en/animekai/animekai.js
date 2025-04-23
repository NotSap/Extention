const source = {
    name: "HiAnime",
    lang: "en",
    baseUrl: "https://hianime.to",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=hianime.to",
    typeSource: "single",
    itemType: 1,
    version: "1.0.0",
    class: class HiAnime {
        constructor() {
            this.client = new Client();
            this.headers = {
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://hianime.to/"
            };
        }

        // ==================== CORE FUNCTIONS ====================
        async request(url) {
            try {
                const fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
                const res = await this.client.get(fullUrl, { headers: this.headers });
                return res?.body || null;
            } catch (error) {
                console.error(`Request failed for ${url}:`, error);
                return null;
            }
        }

        // ==================== SEARCH ====================
        async search(query, page) {
            try {
                const searchUrl = `/search?keyword=${encodeURIComponent(query)}&page=${page}`;
                const body = await this.request(searchUrl);
                if (!body) return { list: [], hasNextPage: false };

                const doc = new Document(body);
                const items = doc.select(".film_list-wrap .flw-item") || [];
                
                const results = items.map(item => ({
                    name: item.selectFirst(".film-name a")?.text()?.trim() || "Untitled",
                    link: item.selectFirst(".film-name a")?.getHref(),
                    imageUrl: item.selectFirst(".film-poster img")?.attr("data-src"),
                    type: item.selectFirst(".fdi-type")?.text()?.trim()
                })).filter(i => i.link);

                const hasNextPage = doc.select(".pagination .next")?.length > 0;
                return { list: results, hasNextPage };
            } catch (error) {
                console.error("Search error:", error);
                return { list: [], hasNextPage: false };
            }
        }

        // ==================== DETAILS ====================
        async getDetail(url) {
            try {
                const body = await this.request(url);
                if (!body) return null;

                const doc = new Document(body);
                const episodes = await this.getEpisodes(doc);

                return {
                    name: doc.selectFirst(".anisc-detail .film-name")?.text()?.trim(),
                    imageUrl: doc.selectFirst(".anisc-poster .film-poster-img")?.attr("src"),
                    description: doc.selectFirst(".anisc-detail .film-description")?.text()?.trim(),
                    genres: doc.select(".anisc-detail .item-list a")?.map(el => el.text()?.trim()),
                    status: doc.selectFirst(".anisc-detail .item-list span")?.text()?.trim(),
                    chapters: episodes
                };
            } catch (error) {
                console.error("Detail error:", error);
                return null;
            }
        }

        async getEpisodes(doc) {
            try {
                const items = doc.select(".ssl-item .ep-item") || [];
                return items.map(item => ({
                    name: item.text()?.trim() || "Episode",
                    url: item.getHref()
                })).reverse();
            } catch (error) {
                console.error("Episodes error:", error);
                return [];
            }
        }

        // ==================== VIDEO EXTRACTION ====================
        async getVideoList(episodeUrl) {
            try {
                const body = await this.request(episodeUrl);
                if (!body) return [];

                const doc = new Document(body);
                const servers = doc.select(".server-item") || [];
                const streams = [];

                for (const server of servers) {
                    const serverName = server.selectFirst(".server-name")?.text()?.trim();
                    const dataId = server.attr("data-id");
                    
                    if (dataId) {
                        const sources = await this.getServerSources(dataId);
                        if (sources) {
                            streams.push({
                                server: serverName,
                                quality: "Auto",
                                url: sources[0]?.file // Take first source
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

        async getServerSources(serverId) {
            try {
                const res = await this.request(`/ajax/server/list/${serverId}`);
                if (!res) return null;
                
                const data = JSON.parse(res);
                return data?.sources || null;
            } catch (error) {
                console.error("Server sources error:", error);
                return null;
            }
        }

        // ==================== SETTINGS ====================
        getSourcePreferences() {
            return [{
                key: "hianime_pref_server",
                listPreference: {
                    title: "Preferred Server",
                    summary: "Choose default streaming server",
                    valueIndex: 0,
                    entries: ["Vidstreaming", "MyCloud", "StreamSB"],
                    entryValues: ["vidstreaming", "mycloud", "streamsb"]
                }
            }];
        }

        getFilterList() {
            return [];
        }
    }
};

// Export for AnymeX
if (typeof module !== 'undefined') {
    module.exports = [source];
}
