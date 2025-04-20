const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.2",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // [Previous working methods (getPreference, getBaseUrl, request, getPage, search, getPopular, getLatestUpdates) remain exactly the same]
    
    async getDetail(url) {
        try {
            const statusMap = {
                "Releasing": 0,
                "Completed": 1,
                "Not Yet Aired": 4,
                "Hiatus": 2,
                "Cancelled": 3
            };

            const body = await this.getPage(url);
            if (!body) throw new Error("Failed to load page");

            const mainSection = body.selectFirst(".watch-section");
            if (!mainSection) throw new Error("Invalid page structure");

            // Get basic info
            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const name = mainSection.selectFirst(".title")?.attr(titlePref) || 
                       mainSection.selectFirst(".title")?.text || "Untitled";
            
            const imageUrl = mainSection.selectFirst(".poster img")?.getSrc || "";
            const description = mainSection.selectFirst(".desc")?.text || "No description available";

            // Get metadata
            let genre = [];
            let status = 5;
            mainSection.select(".detail > div").forEach(item => {
                const text = item.text.trim();
                if (text.startsWith("Genres:")) {
                    genre = text.replace("Genres:", "").trim().split(", ").filter(Boolean);
                } else if (text.startsWith("Status:")) {
                    const statusText = item.selectFirst("span")?.text;
                    status = statusMap[statusText] || 5;
                }
            });

            // Get anime ID for episode list
            const animeId = body.selectFirst("#anime-rating")?.attr("data-id");
            if (!animeId) throw new Error("Anime ID not found");

            // Fetch episodes via AJAX
            const token = await this.kaiEncrypt(animeId);
            const res = await this.request(`/ajax/episodes/list?ani_id=${animeId}&_=${token}`);
            if (!res) throw new Error("Failed to load episodes");

            const episodesData = JSON.parse(res);
            if (episodesData.status !== 200 || !episodesData.result) {
                throw new Error("Invalid episodes response");
            }

            // Parse episodes
            const doc = new Document(episodesData.result);
            const episodeElements = doc.select(".eplist.titles li");
            const showUncenEp = this.getPreference("animekai_show_uncen_epsiodes") !== "false";

            const chapters = [];
            const processedEps = new Set();

            for (const item of episodeElements) {
                const aTag = item.selectFirst("a");
                if (!aTag) continue;

                const num = parseInt(aTag.attr("num")) || 0;
                if (processedEps.has(num)) continue;

                const title = aTag.selectFirst("span")?.text || "";
                const epName = title.includes("Episode") ? `Episode ${num}` : `Episode ${num}: ${title}`;
                const langs = aTag.attr("langs");
                const scanlator = langs === "1" ? "SUB" : "SUB, DUB";
                const token = aTag.attr("token");
                const isUncensored = aTag.attr("slug")?.includes("uncen");

                if (isUncensored && !showUncenEp) continue;

                chapters.push({
                    name: isUncensored ? `${epName} (Uncensored)` : epName,
                    url: token,
                    scanlator: isUncensored ? `${scanlator}, UNCENSORED` : scanlator,
                    dateUpload: item.attr("data-date") || ""
                });
                processedEps.add(num);
            }

            return {
                name,
                imageUrl,
                link: this.getBaseUrl() + url,
                description,
                genre,
                status,
                chapters: chapters.reverse() // Show newest first
            };

        } catch (error) {
            console.error("Error in getDetail:", error);
            return {
                name: "Error Loading Content",
                imageUrl: "",
                link: this.getBaseUrl() + (url || ""),
                description: "Failed to load episodes. Please try again later.",
                genre: [],
                status: 5,
                chapters: [{
                    name: "Episodes Not Available",
                    url: "",
                    scanlator: error.message
                }]
            };
        }
    }

    // [Rest of your original methods remain unchanged]
    async getVideoList(url) {
        // ... existing working implementation ...
    }

    // [All encryption/decryption methods remain unchanged]
    async kaiEncrypt(id) {
        // ... existing implementation ...
    }
    
    // [All other methods remain exactly the same]
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
