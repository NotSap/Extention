const mangayomiSources = [{
    "name": "4AnimeGG",
    "lang": "en",
    "baseUrl": "https://4anime.gg",
    "iconUrl": "",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": false,
    "version": "1.0.0",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "anime/src/en/4animegg.js"
}];

class DefaultExtension extends MProvider {
    async search(query, page, filters) {
        try {
            const searchUrl = `${this.source.baseUrl}/search?keyword=${encodeURIComponent(query)}`;
            const response = await new Client().get(searchUrl);
            const doc = new DOMParser().parseFromString(response.body, "text/html");
            const items = Array.from(doc.querySelectorAll(".items .item"));

            const list = items.map((el) => ({
                name: el.querySelector("h3")?.textContent.trim() || "Unknown Title",
                url: el.querySelector("a")?.href || "",
                imageUrl: el.querySelector("img")?.src || ""
            }));

            return { list, hasNextPage: false };
        } catch (error) {
            console.error("Error in search:", error);
            return { list: [], hasNextPage: false };
        }
    }

    async getDetail(url) {
        try {
            const response = await new Client().get(url);
            const doc = new DOMParser().parseFromString(response.body, "text/html");

            const title = doc.querySelector("h1")?.textContent.trim() || "Unknown Title";
            const episodes = Array.from(doc.querySelectorAll(".episodes a")).map((a, index) => ({
                num: index + 1,
                name: a.textContent.trim() || `Episode ${index + 1}`,
                url: a.href || ""
            }));

            return {
                description: title,
                author: "",
                status: 5, // Unknown status
                genre: [],
                episodes
            };
        } catch (error) {
            console.error("Error in getDetail:", error);
            return this.emptyDetailResponse();
        }
    }

    emptyDetailResponse() {
        return {
            description: "Error loading details",
            author: "",
            status: 5,
            genre: [],
            episodes: []
        };
    }

    async getVideoList(url) {
        try {
            const response = await new Client().get(url);
            const html = response.body;
            const match = html.match(/"file":"(https:[^"]+\.mp4)"/);
            const videoUrl = match ? match[1].replace(/\\\//g, "/") : null;

            if (!videoUrl) {
                throw new Error("Video source not found");
            }

            return [{
                url: videoUrl,
                quality: "default",
                isM3U8: videoUrl.includes(".m3u8")
            }];
        } catch (error) {
            console.error("Error in getVideoList:", error);
            return [];
        }
    }

    // Required methods with basic implementations
    async getPopular(page) {
        return { list: [], hasNextPage: false };
    }

    async getLatestUpdates(page) {
        return this.search("", page, []);
    }

    getSourcePreferences() {
        return [];
    }
}
