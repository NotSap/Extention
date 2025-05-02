const mangayomiSources = [{
    "name": "9Anime",
    "id": 957331416,
    "baseUrl": "https://9animetv.to",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://9animetv.to/favicon.ico",
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
    }

    async request(url) {
        for (var i = 0; i <= this.retryCount; i++) {
            try {
                var client = new Client();
                var response = await client.get(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                        "Referer": this.source.baseUrl,
                        "Cookie": this.cookies
                    }
                });

                if (typeof response.headers["set-cookie"] != "undefined") {
                    this.cookies = response.headers["set-cookie"].toString();
                }

                return response;
            } catch (error) {
                if (i == this.retryCount) throw error;
                await new Promise(function(resolve) { 
                    setTimeout(resolve, 2000 * (i + 1)); 
                });
            }
        }
    }

    async search(query, page, filters) {
        try {
            var searchUrl = this.source.baseUrl + "/filter?keyword=" + encodeURIComponent(query) + "&page=" + (page || 1);
            var response = await this.request(searchUrl);
            var doc = new DOMParser().parseFromString(response.body, "text/html");
            var items = Array.from(doc.querySelectorAll('.film-list .item'));

            var results = items.map(function(item) {
                var isDub = item.querySelector('.dub') != null;
                return {
                    name: item.querySelector('.name').textContent.trim() + (isDub ? ' (Dub)' : ''),
                    url: item.querySelector('a').href,
                    imageUrl: item.querySelector('img').getAttribute('data-src'),
                    language: isDub ? 'dub' : 'sub'
                };
            });

            return {
                list: results,
                hasNextPage: doc.querySelector('.pagination .next') != null
            };
        } catch (error) {
            console.log("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getDetail(url) {
        try {
            var response = await this.request(url);
            var doc = new DOMParser().parseFromString(response.body, "text/html");
            var episodeItems = Array.from(doc.querySelectorAll('.episode-list a'));

            var episodes = episodeItems.map(function(ep, index) {
                var isDub = ep.querySelector('.dub') != null;
                return {
                    num: index + 1,
                    name: 'Episode ' + (index + 1) + (isDub ? ' (Dub)' : ''),
                    url: ep.href,
                    scanlator: isDub ? '9Anime-Dub' : '9Anime-Sub'
                };
            }).reverse(); // Newest first

            return {
                description: doc.querySelector('.description').textContent.trim(),
                status: doc.querySelector('.status').textContent.indexOf('Ongoing') >= 0 ? 0 : 1,
                genre: Array.from(doc.querySelectorAll('.genre a')).map(function(g) { 
                    return g.textContent.trim(); 
                }),
                episodes: episodes
            };
        } catch (error) {
            console.log("Detail error:", error);
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
            var response = await this.request(url);
            var html = response.body;
            var videoMatch = html.match(/sources:\s*\[[^\]]*"file":"([^"]+\.mp4)"/);

            if (videoMatch && videoMatch[1]) {
                return [{
                    url: videoMatch[1],
                    quality: "1080p",
                    isM3U8: false,
                    headers: {
                        "Referer": this.source.baseUrl
                    }
                }];
            }
            throw new Error("No video found");
        } catch (error) {
            console.log("Video error:", error);
            return [];
        }
    }

    async getPopular(page) {
        return this.search("", page);
    }

    async getLatestUpdates(page) {
        var response = await this.request(this.source.baseUrl + "/latest?page=" + page);
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
