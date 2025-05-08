const mangayomiSources = [{
    "name": "Gojo",
    "id": 558217199,
    "baseUrl": "https://gojo.wtf",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://gojo.wtf/favicon.ico",
    "isNsfw": false,
    "version": "1.0.0",
    "itemType": 1,
    "hasCloudflare": true
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.cookies = "";
        this.retryCount = 3;
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Referer": "https://gojo.wtf/"
        };
    }

    async request(url) {
        for (let i = 0; i <= this.retryCount; i++) {
            try {
                const client = new Client();
                const response = await client.get(url, {
                    headers: this.headers,
                    cookies: this.cookies
                });

                // Update Cloudflare cookies
                if (response.headers["set-cookie"]) {
                    this.cookies = response.headers["set-cookie"].join('; ');
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
            const searchUrl = new URL(`${this.source.baseUrl}/search`);
            searchUrl.searchParams.set("q", query);
            searchUrl.searchParams.set("page", page || 1);

            const response = await this.request(searchUrl.toString());
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            const items = Array.from(doc.querySelectorAll('.anime-card')).map(item => {
                const isDub = item.querySelector('.dub-tag') !== null;
                return {
                    name: `${item.querySelector('.title').textContent.trim()}${isDub ? ' (Dub)' : ''}`,
                    url: item.querySelector('a').href,
                    imageUrl: item.querySelector('img').dataset.src,
                    language: isDub ? 'dub' : 'sub'
                };
            });

            return {
                list: items,
                hasNextPage: !!doc.querySelector('.pagination-next')
            };
        } catch (error) {
            console.error("Search failed:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getDetail(url) {
        try {
            const response = await this.request(url);
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            const episodes = Array.from(doc.querySelectorAll('.episode-list a')).map((ep, index) => ({
                num: index + 1,
                name: `Episode ${index + 1}${ep.querySelector('.dub') ? ' (Dub)' : ''}`,
                url: ep.href,
                scanlator: ep.querySelector('.dub') ? 'Gojo-Dub' : 'Gojo-Sub'
            }));

            return {
                description: doc.querySelector('.synopsis').textContent.trim(),
                status: doc.querySelector('.status').textContent.includes('Ongoing') ? 0 : 1,
                genre: Array.from(doc.querySelectorAll('.genre')).map(g => g.textContent.trim()),
                episodes: episodes.reverse() // Newest first
            };
        } catch (error) {
            console.error("Detail error:", error);
            return this.emptyDetail();
        }
    }

    async getVideoList(url) {
        try {
            const response = await this.request(url);
            const html = response.body;
            const videoUrl = html.match(/"file":"(https:\/\/[^"]+\.(?:mp4|m3u8))"/)[1];

            return [{
                url: videoUrl,
                quality: "1080p",
                isM3U8: videoUrl.includes('.m3u8'),
                headers: { "Referer": this.source.baseUrl }
            }];
        } catch (error) {
            console.error("Video error:", error);
            return [];
        }
    }

    emptyDetail() {
        return {
            description: "Failed to load details",
            status: 5,
            genre: [],
            episodes: []
        };
    }

    // Required methods
    async getPopular(page) {
        return this.search("trending", page);
    }

    async getLatestUpdates(page) {
        return this.search("recent", page);
    }
}
