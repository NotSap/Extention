const source = {
    name: "Gogoanime (Dub)",
    lang: "en",
    baseUrl: "https://api.consumet.org",
    iconUrl: "https://gogoanime3.co/favicon.ico",
    typeSource: "api",
    itemType: 1,
    version: "4.2.1",
    class: {
        initialize: function() {
            this.client = new Client({ timeout: 5000 });
            this.dubProvider = "gogoanime";
        },

        search: function(query, page) {
            page = page || 1;
            try {
                var response = this.client.get(
                    this.baseUrl + "/anime/" + this.dubProvider + "/" + 
                    encodeURIComponent(query) + "?page=" + page
                );
                var data = JSON.parse(response.body);
                
                return {
                    list: data.results.filter(function(show) {
                        return show.title.toLowerCase().includes("dub");
                    }).map(function(show) {
                        return {
                            name: show.title.replace("(Dub)", "").trim(),
                            link: show.url,
                            imageUrl: show.image,
                            isDub: true
                        };
                    }),
                    hasNextPage: data.hasNextPage || false
                };
            } catch (error) {
                console.log("Search error:", error);
                return { list: [], hasNextPage: false };
            }
        },

        getLatestUpdates: function(page) {
            page = page || 1;
            try {
                var response = this.client.get(
                    this.baseUrl + "/anime/" + this.dubProvider + 
                    "/recent-episodes?type=2&page=" + page
                );
                return JSON.parse(response.body).results.map(function(ep) {
                    return {
                        name: ep.title.replace("(Dub)", "").trim() + " - Ep " + ep.episodeNumber,
                        link: ep.url,
                        imageUrl: ep.image,
                        isDub: true
                    };
                });
            } catch (error) {
                console.log("Latest episodes error:", error);
                return [];
            }
        },

        getVideoList: function(episodeUrl) {
            try {
                var episodeId = episodeUrl.split('/').pop();
                var response = this.client.get(
                    this.baseUrl + "/anime/" + this.dubProvider + 
                    "/watch/" + episodeId
                );
                var data = JSON.parse(response.body);
                
                return data.sources.map(function(source) {
                    return {
                        server: source.quality.includes("720") ? "GogoServer HD" : "GogoServer",
                        quality: source.quality,
                        url: source.url,
                        isDub: true
                    };
                });
            } catch (error) {
                console.log("Stream error:", error);
                return [];
            }
        },

        getSourcePreferences: function() {
            return [{
                key: "preferred_quality",
                listPreference: {
                    title: "Video Quality",
                    summary: "720p recommended",
                    valueIndex: 1,
                    entries: ["1080p", "720p", "480p"],
                    entryValues: ["1080", "720", "480"]
                }
            }];
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = [source];
}
