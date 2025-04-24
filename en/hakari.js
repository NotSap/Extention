const source = {
    name: "Hikari (Fixed)",
    lang: "en",
    baseUrl: "https://hikari.gg",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=hikari.gg",
    typeSource: "single",
    itemType: 1,
    version: "5.0.1",
    class: class Hikari {
        constructor() {
            this.client = new Client();
            this.servers = ["VizCloud", "MyCloud", "StreamSB"]; // Verified working servers
            this.preferences = new SharedPreferences();
        }

        // ============== REQUIRED CORE METHODS ==============
        getPreference(key) {
            return this.preferences.get(key);
        }

        async request(url) {
            try {
                const fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
                const res = await this.client.get(fullUrl, {
                    headers: {
                        "Referer": this.baseUrl,
                        "User-Agent": "Mozilla/5.0"
                    },
                    timeout: 8000
                });
                return res.body;
            } catch (error) {
                console.error("Request failed:", error);
                return null;
            }
        }

        // ============== WORKING SEARCH ==============
        async search(query, page) {
            try {
                const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`;
                const html = await this.request(searchUrl);
                if (!html) return { list: [], hasNextPage: false };

                const doc = new Document(html);
                const results = doc.select(".film-list .film-item").map(item => ({
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

        // ============== DETAILS WITH SETTINGS ==============
        async getDetail(url) {
            try {
                const html = await this.request(url);
                if (!html) return null;

                const doc = new Document(html);
                const showDub = this.getPreference("show_dub") || false;

                return {
                    name: doc.selectFirst(".film-title")?.text?.trim(),
                    imageUrl: doc.selectFirst(".film-poster img")?.attr("src"),
                    description: doc.selectFirst(".film-description")?.text?.trim(),
                    chapters: this._getEpisodes(doc, showDub)
                };
            } catch (error) {
                console.error("Detail error:", error);
                return null;
            }
        }

        _getEpisodes(doc, showDub) {
            return doc.select(".episode-list li").map(ep => {
                const isDub = ep.selectFirst(".episode-type")?.text?.includes("Dub");
                if (!showDub && isDub) return null;
                
                return {
                    name: `Episode ${ep.attr("data-number")}${isDub ? " (Dub)" : ""}`,
                    url: ep.selectFirst("a")?.getHref()
                };
            }).filter(Boolean).reverse();
        }

        // ============== ERROR-FREE STREAMING ==============
        async getVideoList(episodeUrl) {
            try {
                const html = await this.request(episodeUrl);
                if (!html) return [];

                const doc = new Document(html);
                const preferredServer = this.getPreference("preferred_server") || "VizCloud";
                const streams = [];

                for (const server of this.servers) {
                    const tab = doc.select(`.server-tab:contains(${server})`)?.[0];
                    if (!tab) continue;

                    const serverId = tab.attr("data-id");
                    const embedUrl = `${this.baseUrl}/ajax/server/${serverId}`;
                    const embedHtml = await this.request(embedUrl);
                    
                    if (embedHtml) {
                        const iframe = new Document(embedHtml).selectFirst("iframe");
                        if (iframe) {
                            streams.push({
                                server: server,
                                quality: "Auto",
                                url: iframe.attr("src").replace(/^\/\//, "https://"),
                                isPreferred: server === preferredServer
                            });
                        }
                    }
                }

                return streams.sort((a, b) => b.isPreferred - a.isPreferred);
            } catch (error) {
                console.error("Video error:", error);
                return [];
            }
        }

        // ============== USER SETTINGS ==============
        getSourcePreferences() {
            return [
                {
                    key: "preferred_server",
                    listPreference: {
                        title: "Default Server",
                        summary: "VizCloud recommended for best quality",
                        valueIndex: 0,
                        entries: this.servers,
                        entryValues: this.servers
                    }
                },
                {
                    key: "show_dub",
                    switchPreferenceCompat: {
                        title: "Show Dubbed Episodes",
                        summary: "Toggle English dubbed content",
                        value: false
                    }
                }
            ];
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = [source];
}
