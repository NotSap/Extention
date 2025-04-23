const source = {
    name: "HiAnime (English Only)",
    lang: "en",
    baseUrl: "https://hianime.to",
    iconUrl: "https://www.google.com/s2/favicons?sz=64&domain=hianime.to",
    typeSource: "single",
    itemType: 1,
    version: "3.3.0",
    class: class HiAnime {
        constructor() {
            this.client = new Client();
            this.activeServers = ["vidstreaming", "streamsb"]; // Verified English servers
            this.englishOnly = true; // Force English results
        }

        // ==================== ENGLISH SEARCH GUARANTEE ====================
        async search(query, page) {
            const searchUrl = `${this.baseUrl}/filter?keyword=${encodeURIComponent(query)}&language[]=english&page=${page}`;
            const html = await this._safeRequest(searchUrl);
            if (!html) return { list: [], hasNextPage: false };

            const doc = new Document(html);
            const results = [];

            doc.select(".flw-item").forEach(item => {
                // Verify English title
                const title = item.selectFirst(".film-name")?.text?.trim();
                const isEnglish = !/[一-龠]|[ぁ-ゔ]|[ァ-ヴー]/.test(title); // Blocks Japanese chars
                
                if (title && isEnglish) {
                    results.push({
                        name: title,
                        link: item.selectFirst("a")?.getHref(),
                        imageUrl: item.selectFirst("img")?.attr("data-src"),
                        type: item.selectFirst(".fdi-type")?.text?.trim() || "TV"
                    });
                }
            });

            return {
                list: results.filter(i => i.link),
                hasNextPage: doc.select(".pagination li.active + li").length > 0
            };
        }

        // ==================== OPTIMIZED CORE ====================
        async _safeRequest(url) {
            try {
                const res = await this.client.get(url, {
                    headers: {
                        "Referer": this.baseUrl,
                        "User-Agent": "Mozilla/5.0",
                        "Accept-Language": "en-US,en;q=0.9" // Force English responses
                    },
                    timeout: 8000
                });
                return res.statusCode === 200 ? res.body : null;
            } catch (error) {
                console.error(`Request failed: ${error.message}`);
                return null;
            }
        }

        // ==================== ENGLISH CONTENT VERIFICATION ====================
        async getDetail(url) {
            const html = await this._safeRequest(url);
            if (!html) return null;

            const doc = new Document(html);
            const title = doc.selectFirst(".anisc-detail .film-name")?.text?.trim();
            
            // Skip non-English content
            if (this.englishOnly && /[一-龠]|[ぁ-ゔ]|[ァ-ヴー]/.test(title)) {
                console.log("Skipping non-English title:", title);
                return null;
            }

            return {
                name: title,
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

        // ==================== ENGLISH SERVER PRIORITY ====================
        async getVideoList(episodeUrl) {
            const html = await this._safeRequest(episodeUrl);
            if (!html) return [];

            const doc = new Document(html);
            const validStreams = [];

            // Check servers in priority order
            for (const serverId of this.activeServers) {
                const server = doc.select(`.server-item[data-id="${serverId}"]`)?.[0];
                if (!server) continue;

                const embedUrl = `${this.baseUrl}/ajax/server/${serverId}`;
                const json = await this._safeRequest(embedUrl);
                if (!json) continue;

                try {
                    const embedDoc = new Document(JSON.parse(json).html);
                    const iframeSrc = embedDoc.selectFirst("iframe")?.attr("src");
                    if (iframeSrc) {
                        validStreams.push({
                            server: `Server ${serverId.toUpperCase()}`,
                            quality: "Auto (English)",
                            url: iframeSrc.startsWith("//") ? `https:${iframeSrc}` : iframeSrc
                        });
                        break; // Stop after first working English server
                    }
                } catch (error) {
                    console.error(`Server ${serverId} failed:`, error);
                }
            }

            return validStreams;
        }

        // ==================== ENGLISH-ONLY SETTINGS ====================
        getSourcePreferences() {
            return [{
                key: "server_priority",
                listPreference: {
                    title: "English Server Priority",
                    summary: "Vidstreaming (Recommended) > StreamSB",
                    valueIndex: 0,
                    entries: ["Vidstreaming", "StreamSB"],
                    entryValues: ["vidstreaming", "streamsb"]
                }
            }];
        }

        getFilterList() {
            return [{
                type_name: "GroupFilter",
                name: "Language",
                state: [{
                    type_name: "CheckBox",
                    name: "English Only",
                    value: "english",
                    state: true
                }]
            }];
        }
    }
};

if (typeof module !== 'undefined') {
    module.exports = [source];
}
