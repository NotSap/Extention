const mangayomiSources = [{
    "name": "4AnimeGG",
    "lang": "en",
    "baseUrl": "https://4anime.gg",
    "iconUrl": "",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": false,
    "version": "1.0.4",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "anime/src/en/4animegg.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.cache = new Map();
        this.retryCount = 3;
        this.timeout = 15000;
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Referer": "https://4anime.gg/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        };
    }

    async request(url) {
        for (let i = 0; i <= this.retryCount; i++) {
            try {
                const client = new Client();
                const response = await client.get(url, {
                    timeout: this.timeout,
                    headers: this.headers
                });

                // Detect Cloudflare challenge
                if (response.body.includes("Cloudflare") || response.statusCode === 503) {
                    throw new Error("Cloudflare protection triggered");
                }

                return response;
            } catch (error) {
                if (i === this.retryCount) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
    }

    async search(query, page, filters) {
        try {
            const searchUrl = new URL(`${this.source.baseUrl}/`);
            searchUrl.searchParams.set("s", query.trim());
            
            const response = await this.request(searchUrl.toString());
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Current search results container (verified 2023-11-21)
            const results = doc.querySelectorAll(".film_list-wrap .film-detail");
            if (results.length === 0) return { list: [], hasNextPage: false };

            const list = Array.from(results).map(item => {
                const title = item.querySelector("h3.film-name a")?.textContent.trim();
                const path = item.querySelector("h3.film-name a")?.getAttribute("href");
                const image = item.closest(".film_list-wrap").querySelector(".film-poster img")?.src;

                return {
                    name: title || "Untitled",
                    url: `${this.source.baseUrl}${path}`,
                    imageUrl: image || this.getFallbackImage()
                };
            }).filter(item => item.url);

            return {
                list,
                hasNextPage: this.checkNextPage(doc)
            };
        } catch (error) {
            console.error(`Search failed: ${error.message}`);
            return { list: [], hasNextPage: false };
        }
    }

    async getDetail(url) {
        try {
            const response = await this.request(url);
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Current episode list selector (verified 2023-11-21)
            const episodes = Array.from(doc.querySelectorAll(".ss-list a.ss-item"))
                .reverse() // Newest first
                .map((ep, index) => ({
                    num: index + 1,
                    name: ep.textContent.trim(),
                    url: ep.href,
                    scanlator: "4anime"
                }));

            return {
                description: doc.querySelector(".description")?.textContent.trim() || "",
                status: this.parseStatus(doc),
                genre: Array.from(doc.querySelectorAll(".anime-info .genre a")).map(g => g.textContent.trim()),
                episodes
            };
        } catch (error) {
            console.error(`Details failed: ${error.message}`);
            return this.emptyDetailResponse();
        }
    }

    async getVideoList(url) {
        try {
            const response = await this.request(url);
            const html = response.body;
            
            // Current video extraction method (verified 2023-11-21)
            const videoUrl = html.match(/(https:\/\/[^"]+\.(mp4|m3u8))/)?.[0];
            if (!videoUrl) throw new Error("No video source found");

            return [{
                url: videoUrl,
                quality: "Auto",
                isM3U8: videoUrl.includes(".m3u8"),
                headers: {
                    "Referer": url,
                    "Origin": this.source.baseUrl
                }
            }];
        } catch (error) {
            console.error(`Video load failed: ${error.message}`);
            return [];
        }
    }

    // Helper methods
    checkNextPage(doc) {
        return !!doc.querySelector(".pagination a.next");
    }

    parseStatus(doc) {
        const statusText = doc.querySelector(".anime-info .type:contains('Status')")?.nextSibling?.textContent.toLowerCase();
        return statusText?.includes("ongoing") ? 0 : 1;
    }

    getFallbackImage() {
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }

    emptyDetailResponse() {
        return {
            description: "Information unavailable",
            status: 5,
            genre: [],
            episodes: []
        };
    }

    // Required methods
    async getPopular(page) {
        return this.search("", page, []);
    }

    async getLatestUpdates(page) {
        return this.search("", page, []);
    }

    getSourcePreferences() {
        return [];
    }
}
