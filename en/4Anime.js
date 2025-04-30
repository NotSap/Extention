const mangayomiSources = [{
    "name": "4AnimeGG",
    "lang": "en",
    "baseUrl": "https://4anime.gg",
    "iconUrl": "",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": false,
    "version": "1.0.1",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "anime/src/en/4animegg.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.cache = new Map();
        this.retryCount = 2;
        this.timeout = 15000;
    }

    async request(url, options = {}) {
        for (let i = 0; i <= this.retryCount; i++) {
            try {
                const client = new Client();
                const response = await client.get(url, {
                    ...options,
                    timeout: this.timeout,
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                        "Referer": this.source.baseUrl,
                        ...options.headers
                    }
                });

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

            const searchUrl = `${this.source.baseUrl}/search?keyword=${encodeURIComponent(query)}`;
            const response = await this.request(searchUrl);
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Check for maintenance or blocking
            if (doc.querySelector(".maintenance") || doc.body.textContent.includes("Cloudflare")) {
                throw new Error("Site is under maintenance or blocking requests");
            }

            const items = Array.from(doc.querySelectorAll(".items .item")).filter(el => 
                el.querySelector("a")?.href && 
                el.querySelector("h3")?.textContent
            );

            const list = items.map((el) => ({
                name: el.querySelector("h3").textContent.trim(),
                url: el.querySelector("a").href,
                imageUrl: el.querySelector("img")?.src || this.getFallbackImage(),
            }));

            const result = { 
                list, 
                hasNextPage: false // 4anime doesn't support pagination
            };

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error(`Search failed for query "${query}":`, error);
            return { 
                list: [], 
                hasNextPage: false,
                error: error.message 
            };
        }
    }

    async getDetail(url) {
        try {
            if (this.cache.has(url)) {
                return this.cache.get(url);
            }

            const response = await this.request(url);
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Check if anime page is valid
            if (!doc.querySelector("h1") || !doc.querySelector(".episodes")) {
                throw new Error("Invalid anime page structure");
            }

            const title = doc.querySelector("h1").textContent.trim();
            const description = doc.querySelector(".description")?.textContent.trim() || title;
            
            const episodeLinks = Array.from(doc.querySelectorAll(".episodes a"))
                .filter(a => a.href)
                .reverse(); // Usually episodes are in reverse order

            const episodes = episodeLinks.map((a, index) => ({
                num: index + 1,
                name: a.textContent.trim() || `Episode ${index + 1}`,
                url: a.href,
                scanlator: "4anime"
            }));

            const result = {
                description,
                author: "",
                status: this.parseStatus(doc.querySelector(".status")?.textContent),
                genre: this.parseGenres(doc),
                episodes
            };

            this.cache.set(url, result);
            return result;
        } catch (error) {
            console.error(`Failed to get details for ${url}:`, error);
            return this.emptyDetailResponse(error.message);
        }
    }

    parseStatus(statusText) {
        if (!statusText) return 5; // Unknown
        const text = statusText.toLowerCase().trim();
        if (text.includes("ongoing")) return 0;
        if (text.includes("completed")) return 1;
        return 5;
    }

    parseGenres(doc) {
        try {
            const genreElements = doc.querySelectorAll(".genre a");
            return Array.from(genreElements).map(el => el.textContent.trim()).filter(Boolean);
        } catch {
            return [];
        }
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

    async getVideoList(url) {
        try {
            const cacheKey = `video:${url}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            const response = await this.request(url);
            const html = response.body;

            // Multiple extraction methods as fallback
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

    extractVideoUrl(html) {
        // Try multiple extraction methods
        const methods = [
            // Method 1: Standard JSON pattern
            () => {
                const match = html.match(/"file":"(https:[^"]+\.(?:mp4|m3u8))"/);
                return match?.[1].replace(/\\\//g, "/");
            },
            // Method 2: Iframe src
            () => {
                const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/);
                if (iframeMatch) {
                    return iframeMatch[1].startsWith("http") ? iframeMatch[1] : null;
                }
                return null;
            },
            // Method 3: Data-video attribute
            () => {
                const videoMatch = html.match(/data-video="([^"]+)"/);
                return videoMatch?.[1] || null;
            }
        ];

        for (const method of methods) {
            try {
                const url = method();
                if (url && this.validateVideoUrl(url)) {
                    return url;
                }
            } catch (e) {
                continue;
            }
        }
        return null;
    }

    validateVideoUrl(url) {
        return url && (
            url.includes("mp4") || 
            url.includes("m3u8") ||
            url.includes("stream")
        );
    }

    getFallbackImage() {
        return "https://via.placeholder.com/210x300/2D2D3D/FFFFFF/?text=No+Image";
    }

    // Required methods with improved implementations
    async getPopular(page) {
        try {
            const response = await this.request(`${this.source.baseUrl}/popular`);
            const doc = new DOMParser().parseFromString(response.body, "text/html");
            const items = Array.from(doc.querySelectorAll(".items .item")).filter(el => 
                el.querySelector("a")?.href && 
                el.querySelector("h3")?.textContent
            );

            const list = items.map((el) => ({
                name: el.querySelector("h3").textContent.trim(),
                url: el.querySelector("a").href,
                imageUrl: el.querySelector("img")?.src || this.getFallbackImage(),
            }));

            return { 
                list, 
                hasNextPage: false 
            };
        } catch (error) {
            console.error("Failed to get popular anime:", error);
            return { 
                list: [], 
                hasNextPage: false 
            };
        }
    }

    async getLatestUpdates(page) {
        try {
            const response = await this.request(`${this.source.baseUrl}/latest`);
            const doc = new DOMParser().parseFromString(response.body, "text/html");
            const items = Array.from(doc.querySelectorAll(".items .item")).filter(el => 
                el.querySelector("a")?.href && 
                el.querySelector("h3")?.textContent
            );

            const list = items.map((el) => ({
                name: el.querySelector("h3").textContent.trim(),
                url: el.querySelector("a").href,
                imageUrl: el.querySelector("img")?.src || this.getFallbackImage(),
            }));

            return { 
                list, 
                hasNextPage: false 
            };
        } catch (error) {
            console.error("Failed to get latest updates:", error);
            return { 
                list: [], 
                hasNextPage: false 
            };
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
            },
            {
                key: "retry_count",
                listPreference: {
                    title: "Retry Attempts",
                    summary: "Number of retries for failed requests",
                    valueIndex: 1,
                    entries: ["1", "2", "3"],
                    entryValues: ["1", "2", "3"]
                }
            }
        ];
    }
}
