// https://raw.githubusercontent.com/NotSap/Extention/main/en/Anix.js
const mangayomiSources = [{
    "name": "Anix",
    "id": 558217180,
    "baseUrl": "https://anix.to",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://anix.to/favicon.ico",
    "isNsfw": false,
    "version": "1.0.7",
    "itemType": 1,
    "hasCloudflare": true
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.retryCount = 3;
        this.cfCookies = "";
        this.searchCache = new Map();
    }

    async request(url) {
        for (let i = 0; i <= this.retryCount; i++) {
            try {
                const client = new Client();
                const response = await client.get(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                        "Referer": this.source.baseUrl,
                        "Cookie": this.cfCookies,
                        "Accept-Language": "en-US,en;q=0.9"
                    }
                });

                // Update Cloudflare cookies
                if (response.headers["set-cookie"]) {
                    this.cfCookies = response.headers["set-cookie"].join('; ');
                }

                return response;
            } catch (error) {
                if (i === this.retryCount) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
    }

    async search(query, page = 1) {
        const cacheKey = `${query}:${page}`;
        if (this.searchCache.has(cacheKey)) {
            return this.searchCache.get(cacheKey);
        }

        try {
            // Current Anix search format (verified 2024-07-20)
            const searchUrl = new URL(`${this.source.baseUrl}/filter`);
            searchUrl.searchParams.set("keyword", query);
            searchUrl.searchParams.set("page", page);

            const response = await this.request(searchUrl.toString());
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            const items = Array.from(doc.querySelectorAll('.flw-item')).map(item => {
                const titleEl = item.querySelector('.film-name a');
                const isDub = item.querySelector('.tick-dub') !== null;

                return {
                    name: `${titleEl.textContent.trim()}${isDub ? ' (Dub)' : ''}`,
                    url: titleEl.href,
                    imageUrl: item.querySelector('img[data-src]')?.dataset.src || item.querySelector('img').src,
                    language: isDub ? 'dub' : 'sub'
                };
            });

            const result = {
                list: items.filter(i => i.url.includes('/anime/')),
                hasNextPage: !!doc.querySelector('.pagination li.active + li:not(.disabled)')
            };

            this.searchCache.set(cacheKey, result);
            return result;

        } catch (error) {
            console.error(`Search failed for "${query}":`, error);
            return { list: [], hasNextPage: false };
        }
    }

    async getDetail(url) {
        try {
            const response = await this.request(url);
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Extract episodes with proper dub detection
            const episodes = Array.from(doc.querySelectorAll('.ssl-item')).map(ep => {
                const isDub = ep.querySelector('.dub') !== null;
                return {
                    num: parseInt(ep.dataset.number),
                    name: `Episode ${ep.dataset.number}${isDub ? ' (Dub)' : ''}`,
                    url: ep.href,
                    scanlator: isDub ? 'Anix-Dub' : 'Anix-Sub'
                };
            }).sort((a, b) => b.num - a.num);

            return {
                description: doc.querySelector('.description').textContent.trim(),
                status: doc.querySelector('.status').textContent.includes('Ongoing') ? 0 : 1,
                genre: Array.from(doc.querySelectorAll('.genre a')).map(g => g.textContent.trim()),
                episodes
            };
        } catch (error) {
            console.error(`Detail fetch failed for ${url}:`, error);
            return {
                description: "Failed to load details",
                status: 5,
                genre: [],
                episodes: []
            };
        }
    }

    async getVideoList(url) {
        try {
            const response = await this.request(url);
            const html = response.body;

            // Current video extraction method
            const match = html.match(/var\s+videoUrl\s*=\s*'([^']+)'/);
            if (!match) throw new Error("No video URL found");

            return [{
                url: match[1],
                quality: "1080p",
                isM3U8: match[1].includes('.m3u8'),
                headers: {
                    "Referer": url,
                    "Origin": this.source.baseUrl
                }
            }];
        } catch (error) {
            console.error(`Video load failed for ${url}:`, error);
            return [];
        }
    }

    // Required methods
    async getPopular(page) {
        return this.search("", page);
    }

    async getLatestUpdates(page) {
        const response = await this.request(`${this.source.baseUrl}/recently-added?page=${page}`);
        const doc = new DOMParser().parseFromString(response.body, "text/html");
        return this.search("", page);
    }

    getSourcePreferences() {
        return [];
    }
}
