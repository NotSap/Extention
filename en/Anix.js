// https://raw.githubusercontent.com/NotSap/Extention/main/en/Anix.js
const mangayomiSources = [{
    "name": "Anix",
    "id": 558217179,
    "baseUrl": "https://anix.to",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://anix.to/favicon.ico",
    "isNsfw": false,
    "version": "1.0.6",
    "itemType": 1,
    "hasCloudflare": true
}];

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
                        "Referer": this.source.baseUrl,
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                        "Cookie": this.cookies
                    }
                });

                if (response.statusCode === 503) {
                    this.cookies = response.headers["set-cookie"] || "";
                    throw new Error("Cloudflare challenge");
                }

                return response;
            } catch (error) {
                if (i === this.retryCount) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    async search(query, page, filters) {
        try {
            // Method 1: Native API search
            const apiUrl = `${this.source.baseUrl}/api/search?q=${encodeURIComponent(query)}&page=${page || 1}`;
            const response = await this.request(apiUrl);
            const data = JSON.parse(response.body);

            if (data.results?.length > 0) {
                return {
                    list: data.results.map(item => ({
                        name: `${item.title}${item.isDub ? " (Dub)" : ""}`,
                        url: `${this.source.baseUrl}/anime/${item.id}`,
                        imageUrl: item.poster,
                        language: item.isDub ? "dub" : "sub"
                    })),
                    hasNextPage: data.hasNextPage
                };
            }

            // Method 2: Fallback to HTML search
            const htmlUrl = `${this.source.baseUrl}/search?q=${encodeURIComponent(query)}`;
            const htmlResponse = await this.request(htmlUrl);
            const doc = new DOMParser().parseFromString(htmlResponse.body, "text/html");
            const items = Array.from(doc.querySelectorAll('.film-list .film'));

            return {
                list: items.map(item => {
                    const isDub = !!item.querySelector('.dub-badge');
                    return {
                        name: `${item.querySelector('.film-name').textContent.trim()}${isDub ? " (Dub)" : ""}`,
                        url: item.querySelector('a').href,
                        imageUrl: item.querySelector('img').dataset.src,
                        language: isDub ? "dub" : "sub"
                    };
                }),
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

            // Dub episode filtering
            const episodes = Array.from(doc.querySelectorAll('.episode-list li')).map(ep => {
                const isDub = ep.querySelector('.dub-badge') !== null;
                return {
                    num: parseInt(ep.dataset.number),
                    name: `Episode ${ep.dataset.number}${isDub ? " (Dub)" : ""}`,
                    url: ep.querySelector('a').href,
                    scanlator: isDub ? "Anix-Dub" : "Anix-Sub"
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
            
            // Method 1: Direct MP4 extraction
            const mp4Match = html.match(/"file":"(https:\/\/[^"]+\.mp4)"/);
            if (mp4Match) {
                return [{
                    url: mp4Match[1],
                    quality: "1080p",
                    isM3U8: false,
                    headers: { "Referer": url }
                }];
            }

            // Method 2: Iframe fallback
            const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/);
            if (iframeMatch) {
                return [{
                    url: iframeMatch[1],
                    quality: "720p",
                    isM3U8: iframeMatch[1].includes('m3u8'),
                    headers: { "Referer": url }
                }];
            }

            throw new Error("No video source found");
        } catch (error) {
            console.error("Video load failed:", error);
            return [];
        }
    }

    // Required methods
    async getPopular(page) {
        const response = await this.request(`${this.source.baseUrl}/popular?page=${page || 1}`);
        const doc = new DOMParser().parseFromString(response.body, "text/html");
        const items = Array.from(doc.querySelectorAll('.film-list .film'));

        return {
            list: items.map(item => ({
                name: item.querySelector('.film-name').textContent.trim(),
                url: item.querySelector('a').href,
                imageUrl: item.querySelector('img').dataset.src
            })),
            hasNextPage: !!doc.querySelector('.pagination .next')
        };
    }

    async getLatestUpdates(page) {
        const response = await this.request(`${this.source.baseUrl}/recently-updated?page=${page || 1}`);
        const doc = new DOMParser().parseFromString(response.body, "text/html");
        const items = Array.from(doc.querySelectorAll('.film-list .film'));

        return {
            list: items.map(item => ({
                name: item.querySelector('.film-name').textContent.trim(),
                url: item.querySelector('a').href,
                imageUrl: item.querySelector('img').dataset.src
            })),
            hasNextPage: !!doc.querySelector('.pagination .next')
        };
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
