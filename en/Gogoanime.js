const source = {
    name: "Gogoanime (Dub)",
    lang: "en",
    baseUrl: "https://api.consumet.org",
    iconUrl: "https://gogoanime3.co/favicon.ico",
    typeSource: "api",
    itemType: 1,
    version: "4.2.0",
    class: class GogoanimeDub {
        constructor() {
            this.client = new Client({ timeout: 5000 });
            this.dubProvider = "gogoanime"; // Consumet's most updated source
        }

        // ==================== FAST DUB SEARCH ====================
        async search(query, page = 1) {
            try {
                const { body } = await this.client.get(
                    `${this.baseUrl}/anime/${this.dubProvider}/${encodeURIComponent(query)}?page=${page}`
                );
                const data = JSON.parse(body);
                
                return {
                    list: data.results.filter(show => show.title.toLowerCase().includes("dub")).map(show => ({
                        name: show.title.replace("(Dub)", "").trim(),
                        link: show.url,
                        imageUrl: show.image,
                        isDub: true
                    })),
                    hasNextPage: data.hasNextPage || false
                };
            } catch (error) {
                console.error("Search error:", error);
                return { list: [], hasNextPage: false };
            }
        }

        // ==================== LATEST DUB EPISODES ====================
        async getLatestUpdates(page = 1) {
            try {
                const { body } = await this.client.get(
                    `${this.baseUrl}/anime/${this.dubProvider}/recent-episodes?type=2&page=${page}`
                );
                return JSON.parse(body).results.map(ep => ({
                    name: `${ep.title.replace("(Dub)", "").trim()} - Ep ${ep.episodeNumber}`,
                    link: ep.url,
                    imageUrl: ep.image,
                    isDub: true
                }));
            } catch (error) {
                console.error("Latest episodes error:", error);
                return [];
            }
        }

        // ==================== EPISODE STREAMING ====================
        async getVideoList(episodeUrl) {
            try {
                const { body } = await this.client.get(
                    `${this.baseUrl}/anime/${this.dubProvider}/watch/${episodeUrl.split('/').pop()}`
                );
                const data = JSON.parse(body);
                
                return data.sources.map(source => ({
                    server: source.quality.includes("720") ? "GogoServer HD" : "GogoServer",
                    quality: source.quality,
                    url: source.url,
                    isDub: true
                }));
            } catch (error) {
                console.error("Stream error:", error);
                return [];
            }
        }

        // ==================== USER SETTINGS ====================
        getSourcePreferences() {
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

if (typeof module !== 'undefined') {
    module.exports = [source];
}
