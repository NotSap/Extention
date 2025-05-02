const mangayomiSources = [{
    "name": "Anix",
    "lang": "en",
    "baseUrl": "https://anix.to",
    "iconUrl": "https://anix.to/favicon.ico",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": false,
    "version": "1.0.3",
    "hasCloudflare": true
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.cookies = "";
        this.retryCount = 3;
        this.timeout = 15000;
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Referer": "https://anix.to/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
        };
    }

    async request(url, options = {}) {
        for (let i = 0; i <= this.retryCount; i++) {
            try {
                const client = new Client();
                const response = await client.get(url, {
                    timeout: this.timeout,
                    headers: {
                        ...this.headers,
                        ...(this.cookies ? { "Cookie": this.cookies } : {}),
                        ...options.headers
                    }
                });

                // Handle Cloudflare challenge
                if (response.body.includes("Cloudflare") || response.statusCode === 503) {
                    const cfCookies = response.headers["set-cookie"] || "";
                    this.cookies = cfCookies.toString();
                    throw new Error("Cloudflare challenge detected");
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
        // Method 1: Try official search endpoint first
        let searchUrl = new URL(`${this.source.baseUrl}/filter`);
        searchUrl.searchParams.set("keyword", query);
        searchUrl.searchParams.set("page", page || 1);

        let response = await this.request(searchUrl.toString());
        let doc = new DOMParser().parseFromString(response.body, "text/html");
        let items = Array.from(doc.querySelectorAll('.film_list-wrap .flw-item'));

        // Method 2: If no results, try alternate search API
        if (items.length === 0) {
            console.log("Trying alternate search method...");
            const apiUrl = `${this.source.baseUrl}/ajax/search?keyword=${encodeURIComponent(query)}`;
            response = await this.request(apiUrl, {
                headers: {
                    "X-Requested-With": "XMLHttpRequest"
                }
            });
            
            const data = JSON.parse(response.body);
            doc = new DOMParser().parseFromString(data.html, "text/html");
            items = Array.from(doc.querySelectorAll('.flw-item'));
        }

        // Method 3: Fallback to scraping homepage if still no results
        if (items.length === 0 && page === 1) {
            console.log("Falling back to homepage scrape...");
            response = await this.request(this.source.baseUrl);
            doc = new DOMParser().parseFromString(response.body, "text/html");
            items = Array.from(doc.querySelectorAll('.flw-item'))
                .filter(item => {
                    const title = item.querySelector('.film-name')?.textContent.toLowerCase();
                    return title?.includes(query.toLowerCase());
                });
        }

        // Process results
        const results = items.map(item => {
            const titleEl = item.querySelector('.film-name a, h3 a');
            const isDub = item.querySelector('.tick.ltr')?.textContent.toLowerCase().includes('dub');
            
            return {
                name: `${titleEl?.textContent.trim()}${isDub ? ' (Dub)' : ''}`,
                url: titleEl?.href?.startsWith('http') ? titleEl.href : `${this.source.baseUrl}${titleEl?.href}`,
                imageUrl: item.querySelector('img')?.getAttribute('data-src') || item.querySelector('img')?.src,
                language: isDub ? 'dub' : 'sub'
            };
        }).filter(item => item.url && item.name);

        return {
            list: results,
            hasNextPage: !!doc.querySelector('.pagination .next')
        };

    } catch (error) {
        console.error("Search error:", error);
        return { list: [], hasNextPage: false };
    }
}
    async getDetail(url) {
        try {
            const response = await this.request(url);
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Title with fallbacks
            const titleEl = doc.querySelector(".anisc-detail h2, h1.title") || 
                          doc.querySelector("h1");
            if (!titleEl) throw new Error("Title element not found");

            // Episodes container with multiple selector support
            const episodesContainer = doc.querySelector(".ss-list, .episode-list, .listing");
            if (!episodesContainer) throw new Error("Episodes container not found");

            // Extract episodes (prioritize dub)
            const episodeItems = Array.from(episodesContainer.querySelectorAll("a")).reverse();
            const episodes = [];

            for (const ep of episodeItems) {
                const isDub = ep.textContent.toLowerCase().includes("dub") || 
                             ep.querySelector(".dub-badge") !== null;

                episodes.push({
                    num: episodes.length + 1,
                    name: `Episode ${episodes.length + 1}${isDub ? " (Dub)" : ""}`,
                    url: ep.href.startsWith("http") ? ep.href : `${this.source.baseUrl}${ep.href}`,
                    scanlator: isDub ? "Anix-Dub" : "Anix-Sub"
                });
            }

            return {
                description: doc.querySelector(".description, .summary")?.textContent.trim() || "No description available",
                status: doc.querySelector(".status, .anime-status")?.textContent.includes("Ongoing") ? 0 : 1,
                genre: Array.from(doc.querySelectorAll(".genre a, .tags a")).map(g => g.textContent.trim()),
                episodes
            };

        } catch (error) {
            console.error(`Failed to load details for ${url}:`, error);
            return this.emptyDetailResponse();
        }
    }

    async getVideoList(url) {
        try {
            const response = await this.request(url);
            const html = response.body;

            // Multiple video extraction methods
            const videoUrl = this.extractVideoUrl(html);
            if (!videoUrl) throw new Error("No video source found");

            return [{
                url: videoUrl,
                quality: "1080p",
                isM3U8: videoUrl.includes(".m3u8"),
                headers: {
                    "Referer": url,
                    "Origin": this.source.baseUrl,
                    "Accept": "*/*",
                    "Sec-Fetch-Dest": "video"
                }
            }];
        } catch (error) {
            console.error(`Video load failed for ${url}:`, error);
            
            // Fallback to embedded players
            try {
                const embedUrl = this.extractEmbedUrl(html);
                if (embedUrl) {
                    return [{
                        url: embedUrl,
                        quality: "720p",
                        isM3U8: embedUrl.includes(".m3u8"),
                        headers: {
                            "Referer": "https://anix.to/",
                            "Origin": "https://anix.to"
                        }
                    }];
                }
            } catch (e) {
                console.error("Embed fallback failed:", e);
            }
            
            return [];
        }
    }

    extractVideoUrl(html) {
        const patterns = [
            /(https:\/\/[^\s"']+\.(?:mp4|m3u8))/,
            /"file":"([^"]+\.(?:mp4|m3u8))"/,
            /player\.setup\([^]*?file:\s*["']([^"']+)/,
            /sources:\s*\[[^]*?file:\s*["']([^"']+)/
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let url = match[1];
                if (url.startsWith("//")) url = "https:" + url;
                if (url.includes("\\/")) url = url.replace(/\\\//g, "/");
                return url;
            }
        }
        return null;
    }

    extractEmbedUrl(html) {
        const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/);
        if (iframeMatch) {
            return iframeMatch[1].startsWith("http") ? iframeMatch[1] : null;
        }
        return null;
    }

    // Helper methods
    getFallbackImage() {
        return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjEwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMmQyZDNkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+QW5pbWUgQ292ZXI8L3RleHQ+PC9zdmc+";
    }

    emptyDetailResponse() {
        return {
            description: "Failed to load details",
            status: 5,
            genre: [],
            episodes: []
        };
    }

    // Required methods
    async getPopular(page) {
        try {
            const response = await this.request(`${this.source.baseUrl}/popular?page=${page || 1}`);
            const doc = new DOMParser().parseFromString(response.body, "text/html");
            return this.search("", page, []);
        } catch (error) {
            console.error("Failed to load popular anime:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getLatestUpdates(page) {
        try {
            const response = await this.request(`${this.source.baseUrl}/latest-updates?page=${page || 1}`);
            const doc = new DOMParser().parseFromString(response.body, "text/html");
            return this.search("", page, []);
        } catch (error) {
            console.error("Failed to load latest updates:", error);
            return { list: [], hasNextPage: false };
        }
    }

    getSourcePreferences() {
        return [
            {
                key: "preferred_server",
                listPreference: {
                    title: "Video Server",
                    entries: ["Vidstream", "MyCloud", "StreamSB"],
                    entryValues: ["vidstream", "mycloud", "streamsb"],
                    valueIndex: 0
                }
            },
            {
                key: "force_dub",
                listPreference: {
                    title: "Prioritize Dubbed",
                    summary: "Show dubbed versions first",
                    valueIndex: 0,
                    entries: ["Yes", "No"],
                    entryValues: ["true", "false"]
                }
            }
        ];
    }
}
