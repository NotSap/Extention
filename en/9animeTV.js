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
    "hasCloudflare": false
}];

function DefaultExtension() {
    MProvider.call(this);
    this.cookies = "";
    this.retryCount = 3;
}

DefaultExtension.prototype = Object.create(MProvider.prototype);
DefaultExtension.prototype.constructor = DefaultExtension;

DefaultExtension.prototype.request = function(url) {
    var self = this;
    return new Promise(function(resolve, reject) {
        function attempt(i) {
            try {
                var client = new Client();
                client.get(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0",
                        "Referer": self.source.baseUrl,
                        "Cookie": self.cookies
                    }
                }).then(function(response) {
                    if (response.headers["set-cookie"]) {
                        self.cookies = response.headers["set-cookie"].toString();
                    }
                    resolve(response);
                }).catch(function(error) {
                    if (i >= self.retryCount) {
                        reject(error);
                    } else {
                        setTimeout(function() {
                            attempt(i + 1);
                        }, 2000);
                    }
                });
            } catch (error) {
                reject(error);
            }
        }
        attempt(0);
    });
};

DefaultExtension.prototype.search = function(query, page, filters) {
    var self = this;
    return new Promise(function(resolve) {
        self.request(self.source.baseUrl + "/filter?keyword=" + encodeURIComponent(query) + "&page=" + (page || 1))
            .then(function(response) {
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
                resolve({
                    list: results,
                    hasNextPage: doc.querySelector('.pagination .next') != null
                });
            })
            .catch(function(error) {
                console.log("Search error:", error);
                resolve({ list: [], hasNextPage: false });
            });
    });
};

DefaultExtension.prototype.getDetail = function(url) {
    var self = this;
    return new Promise(function(resolve) {
        self.request(url).then(function(response) {
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
            }).reverse();

            resolve({
                description: doc.querySelector('.description').textContent.trim(),
                status: doc.querySelector('.status').textContent.indexOf('Ongoing') >= 0 ? 0 : 1,
                genre: Array.from(doc.querySelectorAll('.genre a')).map(function(g) {
                    return g.textContent.trim();
                }),
                episodes: episodes
            });
        }).catch(function(error) {
            console.log("Detail error:", error);
            resolve({
                description: "Failed to load details",
                status: 5,
                genre: [],
                episodes: []
            });
        });
    });
};

DefaultExtension.prototype.getVideoList = function(url) {
    var self = this;
    return new Promise(function(resolve) {
        self.request(url).then(function(response) {
            var html = response.body;
            var videoMatch = html.match(/sources:\s*\[[^\]]*"file":"([^"]+\.mp4)"/);
            if (videoMatch && videoMatch[1]) {
                resolve([{
                    url: videoMatch[1],
                    quality: "1080p",
                    isM3U8: false,
                    headers: {
                        "Referer": self.source.baseUrl
                    }
                }]);
            } else {
                resolve([]);
            }
        }).catch(function(error) {
            console.log("Video error:", error);
            resolve([]);
        });
    });
};

DefaultExtension.prototype.getPopular = function(page) {
    return this.search("", page);
};

DefaultExtension.prototype.getLatestUpdates = function(page) {
    var self = this;
    return new Promise(function(resolve) {
        self.request(self.source.baseUrl + "/latest?page=" + page).then(function() {
            resolve(self.search("", page));
        });
    });
};

DefaultExtension.prototype.getSourcePreferences = function() {
    return [{
        key: "preferred_server",
        listPreference: {
            title: "Video Server",
            entries: ["Vidstream", "MyCloud", "StreamSB"],
            entryValues: ["vidstream", "mycloud", "streamsb"],
            valueIndex: 0
        }
    }];
};
