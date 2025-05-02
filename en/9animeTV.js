// https://raw.githubusercontent.com/NotSap/Extention/main/en/9animeTV.js
class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.cookies = "";
        this.retryCount = 3;
    }

    async request(url) {
        for (let i = 0; i <= this.retryCount; i++) {
            try {
                const client = new Client();
                const response = await client.get(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                        "Referer": this.source.baseUrl,
                        "Cookie": this.cookies
                    }
                });

                // Update cookies if Cloudflare challenge appears
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
            const searchUrl = `${this.source.baseUrl}/filter?keyword=${encodeURIComponent(query)}&page=${page || 1}`;
            const response = await this.request(searchUrl);
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            const items = Array.from(doc.querySelectorAll('.film-list .item')).map(item => {
                const isDub = item.querySelector('.dub') !== null;
                return {
                    name: `${item.querySelector('.name').textContent.trim()}${isDub ? ' (Dub)' : ''}`,
                    url: item.querySelector('a').href,
                    imageUrl: item.querySelector('img').dataset.src,
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

            const episodes = Array.from(doc.querySelectorAll('.episode-list a')).map(ep => {
                const isDub = ep.querySelector('.dub') !== null;
                return {
                    num: parseInt(ep.dataset.number),
                    name: `Episode ${ep.dataset.number}${isDub ? ' (Dub)' : ''}`,
                    url: ep.href,
                    scanlator: isDub ? '9Anime-Dub' : '9Anime-Sub'
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

            // Extract from Vidstream player
            const videoUrl = html.match(/sources:\s*\[[^\]]*"file":"([^"]+\.mp4)"/)[1];
            return [{
                url: videoUrl,
                quality: "1080p",
                isM3U8: false,
                headers: {
                    "Referer": this.source.baseUrl,
                    "Origin": "https://9animetv.to"
                }
            }];
        } catch (error) {
            console.error("Video load failed:", error);
            return [];
        }
    }

    // Required methods
    async getPopular(page) {
        return this.search("", page);
    }

    async getLatestUpdates(page) {
        const response = await this.request(`${this.source.baseUrl}/latest?page=${page}`);
        return this.search("", page);
    }

    getSourcePreferences() {
        return [{
            key: "preferred_server",
            listPreference: {
                title: "Video Server",
                entries: ["Vidstream", "MyCloud", "StreamSB"],
                entryValues: ["vidstream", "mycloud", "streamsb"],
                valueIndex: 0
            }
        }];
    }
}
