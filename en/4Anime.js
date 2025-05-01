// mangayomi-extensions/src/anime/en/anix.js
const mangayomiSources = [{
    "name": "Anix",
    "lang": "en",
    "baseUrl": "https://anix.to",
    "apiUrl": "",
    "iconUrl": "https://anix.to/assets/img/logo.png",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": false,
    "version": "1.0.0",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "anime/src/en/anix.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.cache = new Map();
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Referer": "https://anix.to/"
        };
    }

    async search(query, page, filters) {
        try {
            const searchUrl = new URL(`${this.source.baseUrl}/filter`);
            searchUrl.searchParams.set("keyword", query);
            searchUrl.searchParams.set("page", page);
            
            const response = await new Client().get(searchUrl.toString(), { headers: this.headers });
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            const items = Array.from(doc.querySelectorAll('.film_list-wrap .film-detail')).map(item => {
                const dubBadge = item.querySelector('.tick.ltr')?.textContent.toLowerCase() === 'dub';
                return {
                    name: item.querySelector('h3.film-name a')?.textContent.trim() + (dubBadge ? ' (Dub)' : ''),
                    url: item.querySelector('h3.film-name a')?.href,
                    imageUrl: item.closest('.flw-item').querySelector('.film-poster img')?.dataset.src,
                    language: dubBadge ? 'dub' : 'sub'
                };
            });

            return {
                list: items.filter(i => i.url && i.name.includes('Dub')), // Force dub results
                hasNextPage: !!doc.querySelector('.pagination .next')
            };
        } catch (error) {
            console.error("Search failed:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getDetail(url) {
        try {
            const response = await new Client().get(url, { headers: this.headers });
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Get dub episodes specifically
            const dubEpisodes = Array.from(doc.querySelectorAll('#episodes-content .ss-list a')).filter(a => 
                a.querySelector('.ssl-item.ep-name')?.textContent.toLowerCase().includes('dub')
            );

            return {
                description: doc.querySelector('.description')?.textContent.trim() || "No description",
                episodes: dubEpisodes.map((ep, index) => ({
                    num: index + 1,
                    name: `Episode ${index + 1} (Dub)`,
                    url: ep.href,
                    scanlator: "Anix-Dub"
                })),
                status: doc.querySelector('.item.heading')?.textContent.includes('Ongoing') ? 0 : 1,
                genre: Array.from(doc.querySelectorAll('.anime-info .genre a')).map(g => g.textContent.trim())
            };
        } catch (error) {
            console.error("Detail fetch failed:", error);
            return this.emptyDetail();
        }
    }

    async getVideoList(url) {
        try {
            const response = await new Client().get(url, { headers: this.headers });
            const html = response.body;

            // Extract from iframe or script
            const videoUrlMatch = html.match(/(https:\/\/[^"]*\.(?:mp4|m3u8))/);
            if (!videoUrlMatch) throw new Error("No video found");

            return [{
                url: videoUrlMatch[0],
                quality: "1080p",
                isM3U8: videoUrlMatch[0].includes('m3u8'),
                headers: {
                    "Referer": "https://anix.to/",
                    "Origin": "https://anix.to"
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
            episodes: [],
            status: 5,
            genre: []
        };
    }

    // Required methods
    async getPopular(page) {
        return this.search("", page, []);
    }

    async getLatestUpdates(page) {
        const response = await new Client().get(`${this.source.baseUrl}/latest-updates?page=${page}`, { headers: this.headers });
        const doc = new DOMParser().parseFromString(response.body, "text/html");
        
        const items = Array.from(doc.querySelectorAll('.film_list-wrap .film-detail')).map(item => ({
            name: item.querySelector('h3.film-name a')?.textContent.trim(),
            url: item.querySelector('h3.film-name a')?.href,
            imageUrl: item.closest('.flw-item').querySelector('.film-poster img')?.dataset.src
        }));

        return { 
            list: items.filter(i => i.name.toLowerCase().includes('dub')),
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
