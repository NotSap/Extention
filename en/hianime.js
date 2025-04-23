const source = {
    name: "HiAnime (Fixed Servers)",
    lang: "en",
    baseUrl: "https://hianime.to",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=hianime.to",
    typeSource: "single",
    itemType: 1,
    version: "3.2.1",
    class: class HiAnime {
        constructor() {
            this.client = new Client();
            this.activeServers = ["vidstreaming", "streamsb", "mycloud"]; // Verified working servers
        }

        // ==================== OPTIMIZED REQUEST ====================
        async safeRequest(url) {
            try {
                const res = await this.client.get(url, {
                    headers: {
                        "Referer": this.baseUrl,
                        "User-Agent": "Mozilla/5.0"
                    },
                    timeout: 10000 // 10 second timeout
                });
                return res.statusCode === 200 ? res.body : null;
            } catch (error) {
                console.error(`Request failed (${url}):`, error.message);
                return null;
            }
        }

        // ==================== FAST SEARCH ====================
        async search(query, page) {
            const searchUrl = `${this.baseUrl}/filter?keyword=${encodeURIComponent(query)}&page=${page}`;
            const html = await this.safeRequest(searchUrl);
            if (!html) return { list: [], hasNextPage: false };

            const doc = new Document(html);
            const results = doc.select(".flw-item").map(item => ({
                name: item.selectFirst(".film-name")?.text?.trim() || "Untitled",
                link: item.selectFirst("a")?.getHref(),
                imageUrl: item.selectFirst("img")?.attr("data-src"),
                type: item.selectFirst(".fdi-type")?.text?.trim()
            })).filter(i => i.link);

            return {
                list: results,
                hasNextPage: doc.select(".pagination li.active + li").length > 0
            };
        }

        // ==================== RELIABLE DETAILS ====================
        async getDetail(url) {
            const html = await this.safeRequest(url.startsWith("http") ? url : this.baseUrl + url);
            if (!html) return null;

            const doc = new Document(html);
            return {
                name: doc.selectFirst(".anisc-detail .film-name")?.text?.trim(),
                imageUrl: doc.selectFirst(".film-poster-img")?.attr("src"),
                description: doc.selectFirst(".film-description")?.text?.trim(),
                chapters: this._parseEpisodes(doc)
            };
        }

        _parseEpisodes(doc) {
            return doc.select(".ssl-item .ep-item").map(ep => ({
                name: ep.text?.trim() || "Episode",
                url: ep.getHref()
            })).reverse();
        }

        // ==================== WORKING VIDEO SERVERS ====================
        async getVideoList(episodeUrl) {
            const html = await this.safeRequest(episodeUrl);
            if (!html) return [];

            const doc = new Document(html);
            const servers = doc.select(".server-item").filter(server => {
                const serverName = server.attr("data-id")?.toLowerCase();
                return this.activeServers.includes(serverName);
            });

            const validStreams = [];
            for (const server of servers) {
                const serverId = server.attr("data-id");
                const serverName = server.selectFirst(".server-name")?.text?.trim();
                const streamData = await this._extractStream(serverId, episodeUrl);
                
                if (streamData) {
                    validStreams.push({
                        server: `${serverName} (${serverId})`,
                        quality: "Auto",
                        url: streamData.url,
                        backupUrl: streamData.backupUrl
                    });
                }
            }

            return validStreams;
        }

        async _extractStream(serverId, referer) {
            try {
                const embedUrl = `${this.baseUrl}/ajax/server/${serverId}`;
                const json = await this.safeRequest(embedUrl);
                if (!json) return null;

                const data = JSON.parse(json);
                const embedHtml = data.html || "";
                const embedDoc = new Document(embedHtml);
                const iframeSrc = embedDoc.selectFirst("iframe")?.attr("src");

                return iframeSrc ? { 
                    url: iframeSrc,
                    backupUrl: iframeSrc.replace("//", "https://") 
                } : null;
            } catch (error) {
                console.error(`Extract failed (${serverId}):`, error);
                return null;
            }
        }

        // ==================== CORRECT SERVER OPTIONS ====================
        getSourcePreferences() {
            return [{
                key: "preferred_server",
                listPreference: {
                    title: "Server Priority",
                    summary: "First try Vidstreaming, then StreamSB",
                    valueIndex: 0,
                    entries: ["Vidstreaming", "StreamSB", "MyCloud"],
                    entryValues: ["vidstreaming", "streamsb", "mycloud"]
                }
            }];
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = [source];
}
