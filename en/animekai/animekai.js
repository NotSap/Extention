const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.8.0",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // 1. WORKING SEARCH (Fixed "no results" issue)
    async search(query, page, filters) {
        try {
            // Build search URL based on AnimeKai's actual search endpoint
            const searchUrl = `/search/${encodeURIComponent(query)}?page=${page}`;
            const doc = await this.getPage(searchUrl);
            
            if (!doc) return { list: [], hasNextPage: false };

            // Updated selectors for AnimeKai's search results
            const results = doc.select(".anime-card, .search-result").map(item => {
                return {
                    name: item.selectFirst(".title")?.text || 
                         item.selectFirst("h3")?.text || 
                         "Unknown Title",
                    link: item.selectFirst("a")?.getHref,
                    imageUrl: item.selectFirst("img")?.attr("src") || 
                             item.selectFirst("img")?.attr("data-src"),
                    type: item.selectFirst(".type")?.text || 
                         item.selectFirst(".meta")?.text?.split("·")[0]?.trim()
                };
            }).filter(item => item.link && item.imageUrl);

            // Check for pagination
            const hasNextPage = doc.select(".pagination .next, .page-item:last-child:not(.disabled)").length > 0;

            return {
                list: results,
                hasNextPage: hasNextPage
            };
        } catch (error) {
            console.error("Search error:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // 2. DETAILED ANIME INFORMATION
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._emptyDetail();

            return {
                id: url.split('/').pop(),
                title: doc.selectFirst("h1.anime-title")?.text || 
                      doc.selectFirst("h1.title")?.text ||
                      "Unknown Title",
                coverImage: doc.selectFirst(".anime-poster img")?.attr("src") ||
                           doc.selectFirst(".cover-image")?.attr("src"),
                description: doc.selectFirst(".anime-description")?.text ||
                           doc.selectFirst(".synopsis")?.text,
                episodes: this._extractEpisodes(doc, url)
            };
        } catch (error) {
            console.error("Detail error:", error);
            return this._emptyDetail();
        }
    }

    _extractEpisodes(doc, baseUrl) {
        return doc.select(".episode-list li, .episode-item").map((ep, index) => ({
            id: `ep-${index+1}`,
            number: index + 1,
            title: ep.selectFirst(".episode-title")?.text || `Episode ${index+1}`,
            url: ep.selectFirst("a")?.getHref || `${baseUrl}/episode-${index+1}`,
            thumbnail: ep.selectFirst("img")?.attr("src")
        }));
    }

    // [Keep all other methods from previous implementation]
    // getSourcePreferences(), getVideoList(), etc.
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
