// https://raw.githubusercontent.com/NotSap/Extention/main/en/Anix.js
class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.cookies = "";
        this.retryCount = 3;
        this.timeout = 15000;
    }

    async request(url) {
        for (let i = 0; i <= this.retryCount; i++) {
            try {
                const client = new Client();
                const response = await client.get(url, {
                    timeout: this.timeout,
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                        "Referer": this.source.baseUrl,
                        "Cookie": this.cookies,
                        "X-Requested-With": "XMLHttpRequest"
                    }
                });

                // Update Cloudflare cookies if challenged
                if (response.headers["set-cookie"]) {
                    this.cookies = response.headers["set-cookie"].toString();
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
            // Current Anix search endpoint (verified working July 2024)
            const searchUrl = new URL(`${this.source.baseUrl}/filter`);
            searchUrl.searchParams.set("keyword", query);
            searchUrl.searchParams.set("page", page || 1);

            const response = await this.request(searchUrl.toString());
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Extract results with dub detection
            const items = Array.from(doc.querySelectorAll('.flw-item')).map(item => {
                const isDub = item.querySelector('.tick-dub') !== null;
                return {
                    name: `${item.querySelector('.film-name').textContent.trim()}${isDub ? ' (Dub)' : ''}`,
                    url: item.querySelector('a').href,
                    imageUrl: item.querySelector('img[data-src]')?.dataset.src || item.querySelector('img').src,
                    language: isDub ? 'dub' : 'sub'
                };
            });

            return {
                list: items,
                hasNextPage: !!doc.querySelector('.pagination .next')
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

            // Process episodes with dub detection
            const episodes = Array.from(doc.querySelectorAll('.ssl-item')).map(ep => {
                const isDub = ep.textContent.toLowerCase().includes('dub');
                return {
                    num: parseInt(ep.dataset.number),
                    name: `Episode ${ep.dataset.number}${isDub ? ' (Dub)' : ''}`,
                    url: ep.href,
                    scanlator: isDub ? 'Anix-Dub' : 'Anix-Sub'
                };
            }).sort((a, b) => b.num - a.num); // Newest first

            return {
                description: doc.querySelector('.description').textContent.trim(),
                status: doc.querySelector('.status').textContent.includes('Ongoing') ? 0 : 1,
                genre: Array.from(doc.querySelectorAll('.genre a')).map(g => g.textContent.trim()),
                episodes
            };

        } catch (error) {
            console.error("Detail fetch failed:", error);
            return this.emptyDetail();
        }
    }

    async getVideoList(url) {
        try {
            const response = await this.request(url);
            const html = response.body;

            // Current video URL extraction method
            const videoUrl = html.match(/"file":"([^"]+\.(?:mp4|m3u8))"/)[1];
            return [{
                url: videoUrl,
                quality: "1080p",
                isM3U8: videoUrl.includes('.m3u8'),
                headers: {
                    "Referer": url,
                    "Origin": this.source.baseUrl
                }
            }];
        } catch (error) {
            console.error("Video load failed:", error);
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
        return this.search("", page);
    }

    async getLatestUpdates(page) {
        return this.search("", page);
    }
}
