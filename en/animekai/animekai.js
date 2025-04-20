const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.2.1",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // =====================
    // WORKING SEARCH FUNCTION (FIXED)
    // =====================
    async search(query, page = 1, filters = []) {
        try {
            // Build the proper search URL
            const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`;
            
            // Make the request with proper headers
            const response = await this.client.get(searchUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Referer": this.baseUrl,
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            // Parse the HTML response
            const doc = new Document(response.body);
            if (!doc) return { list: [], hasNextPage: false };

            // Extract anime items using current selectors
            const animeItems = doc.select(".film-list .film");
            const results = animeItems.map(item => ({
                name: item.selectFirst(".film-title")?.text?.trim() || "Unknown",
                link: item.selectFirst("a")?.getHref || "",
                imageUrl: item.selectFirst("img")?.attr("data-src") || 
                         item.selectFirst("img")?.attr("src") || ""
            })).filter(item => item.link);

            // Check for next page
            const hasNextPage = doc.select(".pagination .next:not(.disabled)").length > 0;

            return {
                list: results,
                hasNextPage
            };

        } catch (error) {
            console.error("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =====================
    // ORIGINAL DETAIL EXTRACTION (UNCHANGED)
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return null;

            const title = doc.selectFirst("h1.title")?.text?.trim() || "Unknown";
            const cover = doc.selectFirst("img.cover")?.attr("src") || "";
            
            const episodes = doc.select(".episode-list li").map((item, index) => ({
                number: index + 1,
                url: item.selectFirst("a")?.getHref || `${url}/episode-${index+1}`,
                title: item.selectFirst(".episode-title")?.text?.trim() || `Episode ${index+1}`
            }));

            return {
                title: title,
                cover: cover,
                episodes: episodes,
                description: doc.selectFirst(".description")?.text?.trim() || ""
            };
        } catch (error) {
            console.error("Detail error:", error);
            return null;
        }
    }

    // =====================
    // ORIGINAL VIDEO EXTRACTION (UNCHANGED)
    // =====================
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return [];

            return doc.select(".server-list .video-item").map(item => ({
                url: item.attr("data-video") || item.attr("data-src"),
                quality: item.text().match(/1080|720|480/)?.[0] || "Auto",
                server: item.closest(".server-item")?.attr("data-server") || "Default"
            })).filter(item => item.url);
        } catch (error) {
            console.error("Video error:", error);
            return [];
        }
    }

    // =====================
    // HELPER METHODS
    // =====================
    async getPage(url) {
        try {
            const fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
            const res = await this.client.get(fullUrl, {
                headers: {
                    "Referer": this.baseUrl,
                    "Origin": this.baseUrl
                }
            });
            return new Document(res.body);
        } catch (error) {
            console.error("Page load error:", error);
            return null;
        }
    }

    // =====================
    // ORIGINAL SETTINGS (UNCHANGED)
    // =====================
    getSourcePreferences() {
        return [
            {
                key: "animekai_primary_server",
                listPreference: {
                    title: "Primary Video Server",
                    summary: "Choose your preferred video source",
                    valueIndex: 0,
                    entries: ["Server 1", "Server 2", "Backup Server"],
                    entryValues: ["server1", "server2", "backup"]
                }
            },
            {
                key: "animekai_video_quality",
                listPreference: {
                    title: "Default Video Quality",
                    summary: "Preferred playback quality",
                    valueIndex: 1,
                    entries: ["Auto", "480p", "720p", "1080p"],
                    entryValues: ["auto", "480", "720", "1080"]
                }
            }
        ];
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
