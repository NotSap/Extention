const source = {
    name: "AnimeKai (Fixed)",
    lang: "en",
    baseUrl: "https://animekai.to",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=animekai.to",
    typeSource: "single",
    itemType: 1,
    version: "2.0.0",
    class: class AnimeKai {
        constructor() {
            this.client = new Client();
        }

        getPreference(key) {
            return new SharedPreferences().get(key);
        }

        getBaseUrl() {
            return this.getPreference("animekai_base_url") || "https://animekai.to";
        }

        async request(url) {
            try {
                const fullUrl = url.startsWith("http") ? url : this.getBaseUrl() + url;
                const res = await this.client.get(fullUrl, {
                    headers: {
                        "Referer": this.getBaseUrl(),
                        "User-Agent": "Mozilla/5.0"
                    }
                });
                return res.body;
            } catch (error) {
                console.error("Request failed:", error);
                return null;
            }
        }

        async getPage(url) {
            const res = await this.request(url);
            return res ? new Document(res) : null;
        }

        // SIMPLIFIED BUT WORKING SEARCH
        async search(query, page) {
            try {
                const url = `/browser?keyword=${encodeURIComponent(query)}&page=${page}`;
                const body = await this.getPage(url);
                if (!body) return { list: [], hasNextPage: false };

                const items = body.select(".aitem-wrapper .aitem") || [];
                const list = items.map(item => ({
                    name: item.selectFirst("a.title")?.text()?.trim() || "Unknown",
                    link: item.selectFirst("a")?.getHref(),
                    imageUrl: item.selectFirst("img")?.attr("data-src")
                })).filter(i => i.link && i.imageUrl);

                const hasNextPage = body.select(".pagination > li")?.length > 0;
                return { list, hasNextPage };
            } catch (error) {
                console.error("Search error:", error);
                return { list: [], hasNextPage: false };
            }
        }

        async getPopular(page) {
            return this.search("", page);
        }

        async getLatestUpdates(page) {
            return this.search("", page);
        }

        // BASIC DETAIL FETCHING
        async getDetail(url) {
            try {
                const body = await this.getPage(url);
                if (!body) return null;

                return {
                    name: body.selectFirst(".title")?.text()?.trim() || "Unknown",
                    imageUrl: body.selectFirst(".poster img")?.getSrc(),
                    description: body.selectFirst(".desc")?.text()?.trim(),
                    chapters: await this.getEpisodes(body)
                };
            } catch (error) {
                console.error("Detail error:", error);
                return null;
            }
        }

        async getEpisodes(body) {
            const episodes = [];
            const items = body.select(".eplist li") || [];
            
            for (const item of items) {
                const num = item.attr("num");
                const title = `Episode ${num}`;
                const token = item.selectFirst("a")?.attr("token");
                
                if (token) {
                    episodes.push({
                        name: title,
                        url: token
                    });
                }
            }
            
            return episodes.reverse();
        }

        // SIMPLIFIED VIDEO EXTRACTION
        async getVideoList(episodeToken) {
            try {
                const res = await this.request(`/ajax/links/list?token=${episodeToken}`);
                if (!res) return [];
                
                const data = JSON.parse(res);
                if (data.status !== 200) return [];
                
                const streams = [];
                const servers = new Document(data.result).select(".server-items span.server") || [];
                
                for (const server of servers) {
                    const serverId = server.attr("data-lid");
                    const streamUrl = await this.getStreamUrl(serverId);
                    if (streamUrl) {
                        streams.push({
                            url: streamUrl,
                            quality: "Default",
                            server: server.text()
                        });
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
                const res = await this.request(`/ajax/links/view?id=${serverId}`);
                if (!res) return null;
                
                const data = JSON.parse(res);
                if (data.status !== 200) return null;
                
                return data.result?.url || null;
            } catch (error) {
                console.error("Stream URL error:", error);
                return null;
            }
        }

        getSourcePreferences() {
            return [{
                key: "animekai_base_url",
                editTextPreference: {
                    title: "Custom Base URL",
                    summary: "Change if the site moves",
                    value: "https://animekai.to",
                    dialogTitle: "Enter new base URL",
                    dialogMessage: "Only change this if the site has moved"
                }
            }];
        }

        getFilterList() {
            return [];
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = [source];
}
