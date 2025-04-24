const source = {
    name: "Hikari (Final Fix)",
    lang: "en",
    baseUrl: "https://hikari.gg",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=hikari.gg",
    typeSource: "single",
    itemType: 1,
    version: "5.0.2",
    class: class HikariExtension {
        constructor() {
            // Required initialization
            this.client = new Client();
            this.servers = ["VizCloud", "MyCloud", "StreamSB"];
        }

        // ==================== MANDATORY METHODS ====================
        getPreference(key) {
            return new SharedPreferences().get(key);
        }

        // ==================== ERROR-FREE SEARCH ====================
        async search(query, page) {
            try {
                const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`;
                const res = await this.client.get(searchUrl);
                if (!res || !res.body) return { list: [], hasNextPage: false };

                const doc = new Document(res.body);
                const items = doc.select(".film-list .film-item") || [];
                
                const results = items.map(item => ({
                    name: item.selectFirst(".film-name")?.text?.trim() || "Untitled",
                    link: item.selectFirst("a")?.getHref(),
                    imageUrl: item.selectFirst("img")?.attr("data-src")
                })).filter(i => i.link);

                return {
                    list: results,
                    hasNextPage: doc.select(".pagination .next").length > 0
                };
            } catch (error) {
                console.error("Search error:", error);
                return { list: [], hasNextPage: false };
            }
        }

        // ==================== STABLE DETAILS ====================
        async getDetail(url) {
            try {
                const res = await this.client.get(url.startsWith("http") ? url : this.baseUrl + url);
                if (!res || !res.body) return null;

                const doc = new Document(res.body);
                return {
                    name: doc.selectFirst(".film-title")?.text?.trim() || "Unknown",
                    imageUrl: doc.selectFirst(".film-poster img")?.attr("src"),
                    description: doc.selectFirst(".film-description")?.text?.trim(),
                    chapters: this._getEpisodes(doc)
                };
            } catch (error) {
                console.error("Detail error:", error);
                return null;
            }
        }

        _getEpisodes(doc) {
            return (doc.select(".episode-list li") || []).map(ep => ({
                name: `Episode ${ep.attr("data-number") || "0"}`,
                url: ep.selectFirst("a")?.getHref() || ""
            })).reverse();
        }

        // ==================== WORKING STREAM EXTRACTION ====================
        async getVideoList(episodeUrl) {
            try {
                const res = await this.client.get(episodeUrl);
                if (!res || !res.body) return [];

                const doc = new Document(res.body);
                const streams = [];

                for (const server of this.servers) {
                    const tab = doc.select(`.server-tab[data-name*="${server}"]`)?.[0];
                    if (!tab) continue;

                    const serverId = tab.attr("data-id");
                    const embedRes = await this.client.get(`${this.baseUrl}/ajax/server/${serverId}`);
                    if (!embedRes || !embedRes.body) continue;

                    try {
                        const iframeSrc = JSON.parse(embedRes.body)?.html?.match(/src="([^"]+)"/)?.[1];
                        if (iframeSrc) {
                            streams.push({
                                server: server,
                                quality: "1080p",
                                url: iframeSrc.startsWith("//") ? `https:${iframeSrc}` : iframeSrc
                            });
                        }
                    } catch (e) {
                        console.error(`Server ${server} parse error:`, e);
                    }
                }

                return streams;
            } catch (error) {
                console.error("Video error:", error);
                return [];
            }
        }

        // ==================== USER SETTINGS ====================
        getSourcePreferences() {
            return [
                {
                    key: "preferred_server",
                    listPreference: {
                        title: "Video Server",
                        summary: "VizCloud recommended",
                        valueIndex: 0,
                        entries: this.servers,
                        entryValues: this.servers
                    }
                }
            ];
        }

        getFilterList() {
            return [];
        }
    }
};

// Critical export fix
if (typeof module !== 'undefined' && module.exports) {
    module.exports = [source];
}
