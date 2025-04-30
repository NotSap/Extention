const mangayomiSources = [{
    "name": "4AnimeGG",
    "lang": "en",
    "baseUrl": "https://4anime.gg",
    "iconUrl": "",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": false,
    "version": "1.0.2",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "anime/src/en/4animegg.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.cache = new Map();
        this.retryCount = 3;
        this.timeout = 20000;
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
                        ...options.headers
                    }
                });

                if (response.statusCode === 404) {
                    throw new Error("Page not found");
                }
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

            // Properly encode and format the search URL
            const searchUrl = new URL(`${this.source.baseUrl}/search`);
            searchUrl.searchParams.set("keyword", query.trim());
            
            const response = await this.request(searchUrl.toString());
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Check if search results container exists
            const resultsContainer = doc.querySelector(".items") || doc.querySelector(".list-updates") || doc.querySelector(".anime-list");
            if (!resultsContainer) {
                throw new Error("Search results container not found");
            }

            // Multiple possible selectors for items
            const itemSelectors = [
                ".items .item", 
                ".list-updates .anime", 
                ".anime-list .anime",
                ".film-list .film"
            ];

            let items = [];
            for (const selector of itemSelectors) {
                items = Array.from(doc.querySelectorAll(selector));
                if (items.length > 0) break;
            }

            if (items.length === 0) {
                // Check for "no results" message
                const noResultsMsg = doc.querySelector(".notfound") || 
                                    doc.querySelector(".nothing") ||
                                    doc.body.textContent.match(/no results|not found/i);
                if (noResultsMsg) {
                    return { list: [], hasNextPage: false };
                }
                throw new Error("No items found in search results");
            }

            const list = items.map((el) => {
                // Multiple possible selectors for each element
                const titleEl = el.querySelector("h3") || el.querySelector(".title") || el.querySelector(".name");
                const linkEl = el.querySelector("a[href]");
                const imgEl = el.querySelector("img[src]");

                if (!titleEl || !linkEl) return null;

                return {
                    name: titleEl.textContent.trim(),
                    url: linkEl.href,
                    imageUrl: imgEl?.src || this.getFallbackImage()
                };
            }).filter(item => item !== null);

            if (list.length === 0) {
                throw new Error("All search results were invalid");
            }

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

    checkNextPage(doc) {
        // Check various pagination indicators
        const pagination = doc.querySelector(".pagination");
        if (!pagination) return false;
        
        const nextPageBtn = pagination.querySelector("a.next") || 
                           pagination.querySelector("a:contains('Next')");
        return nextPageBtn !== null;
    }

    async getDetail(url) {
        try {
            if (this.cache.has(url)) {
                return this.cache.get(url);
            }

            const response = await this.request(url);
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Multiple possible title selectors
            const titleEl = doc.querySelector("h1.title") || 
                          doc.querySelector("h1") || 
                          doc.querySelector(".detail h1");
            if (!titleEl) {
                throw new Error("Title element not found");
            }

            // Multiple possible episode containers
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

    parseStatus(doc) {
        // Multiple ways to find status
        const statusEl = doc.querySelector(".status") || 
                        doc.querySelector(".info:contains('Status')") ||
                        doc.querySelector("span:contains('Status')");
        
        if (!statusEl) return 5; // Unknown
        
        const statusText = statusEl.textContent.toLowerCase().trim();
        if (statusText.includes("ongoing")) return 0;
        if (statusText.includes("complete")) return 1;
        if (statusText.includes("upcoming")) return 2;
        return 5;
    }

    parseGenres(doc) {
        try {
            // Multiple possible genre containers
            const genreContainer = doc.querySelector(".genre") || 
                                 doc.querySelector(".info:contains('Genre')") ||
                                 doc.querySelector(".tags");
            
            if (!genreContainer) return [];
            
            const genreElements = genreContainer.querySelectorAll("a") || 
                                genreContainer.querySelectorAll("span");
            
            return Array.from(genreElements)
                .map(el => el.textContent.trim())
                .filter(text => text.length > 0);
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

            // Multiple video extraction methods
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
        // Multiple patterns to try
        const patterns = [
            /"file":"(https:[^"]+\.(?:mp4|m3u8))"/,
            /src="([^"]+\.(?:mp4|m3u8))"/,
            /video src="([^"]+)"/,
            /player\.setup\({\s*file:\s*"([^"]+)"/,
            /sources:\s*\[\s*{\s*file:\s*"([^"]+)"/,
            /var\s+videoSrc\s*=\s*"([^"]+)"/,
            /loadVideo\("([^"]+)"\)/,
            /<iframe[^>]+src="([^"]+)"/,
            /data-video="([^"]+)"/
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let url = match[1];
                if (url.startsWith("//")) {
                    url = "https:" + url;
                }
                if (url.includes("\\/")) {
                    url = url.replace(/\\\//g, "/");
                }
                if (this.validateVideoUrl(url)) {
                    return url;
                }
            }
        }
        return null;
    }

    validateVideoUrl(url) {
        if (!url) return false;
        try {
            new URL(url);
            return url.match(/\.(mp4|m3u8|mkv|avi|mov|webm|stream)/i) !== null;
        } catch {
            return false;
        }
    }

    getFallbackImage() {
        return "https://via.placeholder.com/210x300/2D2D3D/FFFFFF/?text=No+Image";
    }

    async getPopular(page) {
        try {
            const response = await this.request(`${this.source.baseUrl}/popular`);
            const doc = new DOMParser().parseFromString(response.body, "text/html");
            
            const itemSelectors = [
                ".items .item", 
                ".list-updates .anime", 
                ".anime-list .anime",
                ".film-list .film"
            ];

            let items = [];
            for (const selector of itemSelectors) {
                items = Array.from(doc.querySelectorAll(selector));
                if (items.length > 0) break;
            }

            const list = items.map((el) => {
                const titleEl = el.querySelector("h3") || el.querySelector(".title") || el.querySelector(".name");
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
            
            const itemSelectors = [
                ".items .item", 
                ".list-updates .anime", 
                ".anime-list .anime",
                ".film-list .film"
            ];

            let items = [];
            for (const selector of itemSelectors) {
                items = Array.from(doc.querySelectorAll(selector));
                if (items.length > 0) break;
            }

            const list = items.map((el) => {
                const titleEl = el.querySelector("h3") || el.querySelector(".title") || el.querySelector(".name");
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
            },
            {
                key: "timeout",
                listPreference: {
                    title: "Request Timeout (seconds)",
                    summary: "",
                    valueIndex: 2,
                    entries: ["10", "20", "30"],
                    entryValues: ["10000", "20000", "30000"]
                }
            }
        ];
    }
}
