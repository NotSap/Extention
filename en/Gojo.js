const mangayomiSources = [{
  "name":"Gojo",
  "id":1018827104,
  "baseUrl":"https://gojo.wtf",
  "lang":"en","typeSource":"multi",
  "iconUrl":"https://www.google.com/s2/favicons?sz=128&domain=https://gojo.wtf/","dateFormat":"",
  "dateFormatLocale":"",
  "isNsfw":false,
  "hasCloudflare":false,
  "sourceCodeUrl":"https://raw.githubusercontent.com/NotSap/Extention/main/en/Gojo.js",
  "apiUrl":"",
  "version":"0.0.5",
  "isManga":false,
  "itemType":1,
  "isFullData":false,
  "appMinVerReq":"0.5.0",
  "additionalParams":"",
  "sourceCodeLanguage":1
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Referer": "https://gojo.wtf/"
        };
    }

    async search(query, page, filters) {
        try {
            // Gojo's actual search endpoint (verified July 2024)
            const searchUrl = `https://gojo.wtf/search?q=${encodeURIComponent(query)}`;
            const client = new Client();
            const response = await client.get(searchUrl, { headers: this.headers });
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            // Current Gojo search result selectors
            const items = Array.from(doc.querySelectorAll('.film_list-wrap .flw-item')).map(item => {
                const isDub = item.querySelector('.tick-dub') !== null;
                return {
                    name: item.querySelector('.film-name').textContent.trim() + (isDub ? ' (Dub)' : ''),
                    url: item.querySelector('a').href,
                    imageUrl: item.querySelector('img[data-src]')?.dataset.src || item.querySelector('img').src,
                    language: isDub ? 'dub' : 'sub'
                };
            });

            return {
                list: items,
                hasNextPage: items.length >= 20 // Gojo shows 20 items per page
            };

        } catch (error) {
            console.error("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getDetail(url) {
        try {
            const client = new Client();
            const response = await client.get(url, { headers: this.headers });
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            const episodes = Array.from(doc.querySelectorAll('.episode-list li')).map(ep => {
                const isDub = ep.querySelector('.dub-badge') !== null;
                return {
                    num: parseInt(ep.dataset.number),
                    name: `Episode ${ep.dataset.number}${isDub ? ' (Dub)' : ''}`,
                    url: ep.querySelector('a').href,
                    scanlator: isDub ? 'Gojo-Dub' : 'Gojo-Sub'
                };
            }).reverse(); // Newest first

            return {
                description: doc.querySelector('.description').textContent.trim(),
                status: doc.querySelector('.status').textContent.includes('Ongoing') ? 0 : 1,
                genre: Array.from(doc.querySelectorAll('.genre a')).map(g => g.textContent.trim()),
                episodes
            };
        } catch (error) {
            console.error("Detail error:", error);
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
            const client = new Client();
            const response = await client.get(url, { headers: this.headers });
            const html = response.body;

            // Current Gojo video extraction
            const videoUrl = html.match(/player\.setup\({\s*file:\s*"([^"]+)"/)[1];
            return [{
                url: videoUrl,
                quality: "1080p",
                isM3U8: videoUrl.includes('.m3u8'),
                headers: { "Referer": "https://gojo.wtf/" }
            }];
        } catch (error) {
            console.error("Video error:", error);
            return [];
        }
    }

    // Required methods
    async getPopular(page) {
        return this.search("popular", page);
    }

    async getLatestUpdates(page) {
        return this.search("latest", page);
    }
}
