const mangayomiSources = [{
    "name": "4AnimeGG",
    "lang": "en",
    "baseUrl": "https://4anime.gg",
    "iconUrl": "",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": false,
    "version": "1.0.3",
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
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
    }

    async request(url, options = {}) {
        for (let i = 0; i <= this.retryCount; i++) {
            try {
                const client = new Client();
                const response = await client.get(url, {
                    ...options,
                    timeout: this.timeout,
                    headers: {
                        "User-Agent": this.userAgent,
                        "Referer": this.source.baseUrl,
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                        ...options.headers
                    }
                });

                if (response.statusCode === 404) return null;
                if (response.statusCode >= 400) {
                    throw new Error(`HTTP ${response.statusCode}`);
                }

                return response;
            } catch (error) {
                if (i === this.retryCount) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    async search(query, page, filters) {
        try {
            const cacheKey = `search:${query}:${page}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const searchUrl = `${this.source.baseUrl}/?s=${encodeURIComponent(query)}`;
            const response = await this.request(searchUrl);
            if (!response) return { list: [], hasNextPage: false };

            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Check for maintenance or blocking
            if (doc.querySelector(".maintenance") || doc.body.textContent.includes("Cloudflare")) {
                throw new Error("Site is under maintenance or blocking requests");
            }

            // Multiple possible selectors for search results
            const resultsContainer = doc.querySelector(".items") || 
                                   doc.querySelector(".list-updates") || 
                                   doc.querySelector(".anime-list") ||
                                   doc.querySelector(".film-list");

            if (!resultsContainer) {
                return { list: [], hasNextPage: false };
            }

            const items = Array.from(resultsContainer.querySelectorAll(".item, .anime, .film"));
            if (items.length === 0) {
                return { list: [], hasNextPage: false };
            }

            const list = items.map((el) => {
                const titleEl = el.querySelector("h3, .title, .name");
                const linkEl = el.querySelector("a[href]");
                const imgEl = el.querySelector("img[src]");

                if (!titleEl || !linkEl) return null;

                return {
                    name: titleEl.textContent.trim(),
                    url: linkEl.href,
                    imageUrl: imgEl?.src || this.getFallbackImage()
                };
            }).filter(item => item !== null);

            const result = { 
                list, 
                hasNextPage: this.checkNextPage(doc)
            };

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error(`Search failed for "${query}":`, error);
            return { 
                list: [], 
                hasNextPage: false,
                error: "Failed to load search results" 
            };
        }
    }

    async getDetail(url) {
        try {
            if (this.cache.has(url)) {
                return this.cache.get(url);
            }

            const response = await this.request(url);
            if (!response) return this.emptyDetailResponse("Anime not found");

            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Get title
            const titleEl = doc.querySelector("h1.title") || 
                          doc.querySelector("h1") || 
                          doc.querySelector(".detail h1");
            if (!titleEl) {
                throw new Error("Title element not found");
            }

            // Get episodes
            const episodesContainer = doc.querySelector(".episodes") || 
                                    doc.querySelector(".episode-list") ||
                                    doc.querySelector(".server");
            if (!episodesContainer) {
                throw new Error("Episodes container not found");
            }

            const title = titleEl.textContent.trim();
            const description = doc.querySelector(".description")?.textContent.trim() || 
                              doc.querySelector(".info")?.textContent.trim() || 
                              title;

            const episodeLinks = Array.from(episodesContainer.querySelectorAll("a[href]"))
                .filter(a => a.href && a.href.includes("episode"))
                .reverse();

            const episodes = episodeLinks.map((a, index) => ({
                num: index + 1,
                name: a.textContent.trim() || `Episode ${index + 1}`,
                url: a.href,
                scanlator: "4anime"
            }));

            const result = {
                description,
                author: "",
                status: this.parseStatus(doc),
                genre: this.parseGenres(doc),
                episodes
            };

            this.cache.set(url, result);
            return result;
        } catch (error) {
            console.error(`Failed to get details for ${url}:`, error);
            return this.emptyDetailResponse("Failed to load anime details");
        }
    }

    async getVideoList(url) {
        try {
            const cacheKey = `video:${url}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const response = await this.request(url);
            if (!response) return [];

            const html = response.body;
            const videoUrl = this.extractVideoUrl(html);
            if (!videoUrl) {
                throw new Error("Video source not found in page");
            }

            const result = [{
                url: videoUrl,
                quality: "default",
                isM3U8: videoUrl.includes(".m3u8"),
                headers: {
                    "Referer": this.source.baseUrl,
                    "Origin": this.source.baseUrl
                }
            }];

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error(`Failed to get video list for ${url}:`, error);
            return [];
        }
    }

    // Helper methods
    checkNextPage(doc) {
        const pagination = doc.querySelector(".pagination");
        if (!pagination) return false;
        return pagination.querySelector("a.next, a:contains('Next')") !== null;
    }

    parseStatus(doc) {
        const statusEl = doc.querySelector(".status") || 
                        doc.querySelector(".info:contains('Status')");
        if (!statusEl) return 5;
        
        const statusText = statusEl.textContent.toLowerCase().trim();
        if (statusText.includes("ongoing")) return 0;
        if (statusText.includes("complete")) return 1;
        return 5;
    }

    parseGenres(doc) {
        const genreContainer = doc.querySelector(".genre") || 
                             doc.querySelector(".info:contains('Genre')");
        if (!genreContainer) return [];
        
        return Array.from(genreContainer.querySelectorAll("a, span"))
            .map(el => el.textContent.trim())
            .filter(text => text.length > 0);
    }

    extractVideoUrl(html) {
        const patterns = [
            /"file":"(https:[^"]+\.(?:mp4|m3u8))"/,
            /src="([^"]+\.(?:mp4|m3u8))"/,
            /video src="([^"]+)"/,
            /player\.setup\({\s*file:\s*"([^"]+)"/,
            /<iframe[^>]+src="([^"]+)"/,
            /data-video="([^"]+)"/
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let url = match[1];
                if (url.startsWith("//")) url = "https:" + url;
                if (url.includes("\\/")) url = url.replace(/\\\//g, "/");
                if (this.validateVideoUrl(url)) return url;
            }
        }
        return null;
    }

    validateVideoUrl(url) {
        return url && /\.(mp4|m3u8|mkv|avi|mov|webm|stream)/i.test(url);
    }

    getFallbackImage() {
        return "https://via.placeholder.com/210x300/2D2D3D/FFFFFF/?text=No+Image";
    }

    emptyDetailResponse(error = "") {
        return {
            description: error || "Error loading details",
            author: "",
            status: 5,
            genre: [],
            episodes: []
        };
    }

    // Required methods
    async getPopular(page) {
        try {
            const response = await this.request(`${this.source.baseUrl}/popular`);
            if (!response) return { list: [], hasNextPage: false };

            const doc = new DOMParser().parseFromString(response.body, "text/html");
            const items = Array.from(doc.querySelectorAll(".item, .anime, .film"));

            const list = items.map((el) => {
                const titleEl = el.querySelector("h3, .title, .name");
                const linkEl = el.querySelector("a[href]");
                const imgEl = el.querySelector("img[src]");

                if (!titleEl || !linkEl) return null;

                return {
                    name: titleEl.textContent.trim(),
                    url: linkEl.href,
                    imageUrl: imgEl?.src || this.getFallbackImage()
                };
            }).filter(item => item !== null);

            return { 
                list, 
                hasNextPage: this.checkNextPage(doc)
            };
        } catch (error) {
            console.error("Failed to get popular anime:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getLatestUpdates(page) {
        try {
            const response = await this.request(`${this.source.baseUrl}/latest`);
            if (!response) return { list: [], hasNextPage: false };

            const doc = new DOMParser().parseFromString(response.body, "text/html");
            const items = Array.from(doc.querySelectorAll(".item, .anime, .film"));

            const list = items.map((el) => {
                const titleEl = el.querySelector("h3, .title, .name");
                const linkEl = el.querySelector("a[href]");
                const imgEl = el.querySelector("img[src]");

                if (!titleEl || !linkEl) return null;

                return {
                    name: titleEl.textContent.trim(),
                    url: linkEl.href,
                    imageUrl: imgEl?.src || this.getFallbackImage()
                };
            }).filter(item => item !== null);

            return { 
                list, 
                hasNextPage: this.checkNextPage(doc)
            };
        } catch (error) {
            console.error("Failed to get latest updates:", error);
            return { list: [], hasNextPage: false };
        }
    }

    getSourcePreferences() {
        return [
            {
                key: "preferred_quality",
                listPreference: {
                    title: "Preferred Quality",
                    summary: "",
                    valueIndex: 0,
                    entries: ["Auto", "1080p", "720p", "480p"],
                    entryValues: ["auto", "1080", "720", "480"]
                }
            }
        ];
    }
}
