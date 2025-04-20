const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "0.2.3",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    getPreference(key) {
        return new SharedPreferences().get(key) || "";
    }

    getBaseUrl() {
        return this.getPreference("animekai_base_url") || "https://animekai.to";
    }

    async request(url) {
        try {
            const fullUrl = url.startsWith("http") ? url : this.getBaseUrl() + url;
            const res = await this.client.get(fullUrl);
            return res.body;
        } catch (error) {
            console.error("Request failed:", error);
            return null;
        }
    }

    async getPage(url) {
        const content = await this.request(url);
        return content ? new Document(content) : null;
    }

    async searchPage({ 
        query = "", 
        type = [], 
        genre = [], 
        status = [], 
        sort = "updated_date", 
        season = [], 
        year = [], 
        rating = [], 
        country = [], 
        language = [], 
        page = 1 
    } = {}) {
        
        function bundleParams(category, items) {
            return items.map(item => `&${category}[]=${encodeURIComponent(item)}`).join("");
        }

        let slug = "/browser?keyword=" + encodeURIComponent(query);
        slug += bundleParams("type", type);
        slug += bundleParams("genre", genre);
        slug += bundleParams("status", status);
        slug += bundleParams("season", season);
        slug += bundleParams("year", year);
        slug += bundleParams("rating", rating);
        slug += bundleParams("country", country);
        slug += bundleParams("language", language);
        slug += `&sort=${sort}&page=${page}`;

        const body = await this.getPage(slug);
        if (!body) return { list: [], hasNextPage: false };

        const paginations = body.select(".pagination > li");
        const hasNextPage = paginations.length > 0 
            ? !paginations.last().className.includes("active") 
            : false;

        const titlePref = this.getPreference("animekai_title_lang") || "title";
        const animeItems = body.select(".aitem-wrapper .aitem");
        const list = animeItems.map(anime => ({
            name: anime.selectFirst(`a.title`).attr(titlePref) || 
                 anime.selectFirst(`a.title`).text,
            link: anime.selectFirst("a").getHref,
            imageUrl: anime.selectFirst("img").attr("data-src")
        }));

        return { list, hasNextPage };
    }

    async getPopular(page) {
        const types = this.getPreference("animekai_popular_latest_type") || ["tv"];
        return this.searchPage({ 
            sort: "trending", 
            type: Array.isArray(types) ? types : [types], 
            page 
        });
    }

    async getLatestUpdates(page) {
        const types = this.getPreference("animekai_popular_latest_type") || ["tv"];
        return this.searchPage({ 
            sort: "updated_date", 
            type: Array.isArray(types) ? types : [types], 
            page 
        });
    }

    async search(query, page, filters) {
        const getActiveFilters = filter => 
            filter.state.filter(f => f.state).map(f => f.value);

        return this.searchPage({
            query,
            page,
            type: getActiveFilters(filters[0]),
            genre: getActiveFilters(filters[1]),
            status: getActiveFilters(filters[2]),
            sort: filters[3].values[filters[3].state].value,
            season: getActiveFilters(filters[4]),
            year: getActiveFilters(filters[5]),
            rating: getActiveFilters(filters[6]),
            country: getActiveFilters(filters[7]),
            language: getActiveFilters(filters[8])
        });
    }

    async getDetail(url) {
        const statusMap = {
            "Releasing": 0,
            "Completed": 1,
            "Not Yet Aired": 4
        };

        const body = await this.getPage(url);
        if (!body) throw new Error("Failed to load anime details");

        const mainSection = body.selectFirst(".watch-section");
        if (!mainSection) throw new Error("Invalid anime page structure");

        // Extract basic info
        const titlePref = this.getPreference("animekai_title_lang") || "title";
        const name = mainSection.selectFirst(".title")?.attr(titlePref) || 
                   mainSection.selectFirst(".title")?.text || "Unknown Title";
        
        const imageUrl = mainSection.selectFirst(".poster img")?.getSrc;
        const description = mainSection.selectFirst(".desc")?.text || "No description available";

        // Extract metadata
        let genre = [];
        let status = 5;
        mainSection.select(".detail > div").forEach(item => {
            const text = item.text.trim();
            if (text.startsWith("Genres:")) {
                genre = text.replace("Genres:", "").trim().split(", ");
            } else if (text.startsWith("Status:")) {
                status = statusMap[item.selectFirst("span").text] || 5;
            }
        });

        // Extract episodes
        const animeId = body.selectFirst("#anime-rating")?.attr("data-id");
        if (!animeId) throw new Error("Failed to get anime ID");

        const token = await this.kaiEncrypt(animeId);
        const res = await this.request(`/ajax/episodes/list?ani_id=${animeId}&_=${token}`);
        if (!res) throw new Error("Failed to load episodes");

        const episodesData = JSON.parse(res);
        if (episodesData.status !== 200) throw new Error("Invalid episodes response");

        const doc = new Document(episodesData.result);
        const episodes = doc.select(".eplist.titles li");
        const showUncenEp = this.getPreference("animekai_show_uncen_epsiodes") !== "false";

        const chapters = [];
        const processedEps = new Set();

        for (const item of episodes) {
            const aTag = item.selectFirst("a");
            if (!aTag) continue;

            const num = parseInt(aTag.attr("num")) || 0;
            if (processedEps.has(num)) continue;

            const title = aTag.selectFirst("span")?.text || "";
            const epName = title.includes("Episode") ? `Episode ${num}` : `Episode ${num}: ${title}`;
            const langs = aTag.attr("langs");
            const scanlator = langs === "1" ? "SUB" : "SUB, DUB";
            const token = aTag.attr("token");
            const isUncensored = aTag.attr("slug").includes("uncen");

            if (isUncensored && !showUncenEp) continue;

            const epData = {
                name: isUncensored ? `${epName} (Uncensored)` : epName,
                url: token,
                scanlator: isUncensored ? `${scanlator}, UNCENSORED` : scanlator
            };

            chapters.push(epData);
            processedEps.add(num);
        }

        return {
            name,
            imageUrl,
            link: this.getBaseUrl() + url,
            description,
            genre,
            status,
            chapters: chapters.reverse()
        };
    }

    async getVideoList(url) {
        const streams = [];
        const prefServer = this.getPreference("animekai_pref_stream_server") || ["1"];
        const prefDubType = this.getPreference("animekai_pref_stream_subdub_type") || ["sub"];
        const epSlugs = url.split("||");

        for (let i = 0; i < epSlugs.length; i++) {
            const epId = epSlugs[i];
            const isUncensored = i > 0;

            const token = await this.kaiEncrypt(epId);
            const res = await this.request(`/ajax/links/list?token=${epId}&_=${token}`);
            if (!res) continue;

            const body = JSON.parse(res);
            if (body.status !== 200) continue;

            const serverResult = new Document(body.result);
            const serverItems = serverResult.select(".server-items");

            for (const dubSection of serverItems) {
                const dubType = dubSection.attr("data-id");
                if (!prefDubType.includes(dubType)) continue;

                for (const server of dubSection.select("span.server")) {
                    const serverName = server.text;
                    const serverNum = serverName.replace("Server ", "");
                    if (!prefServer.includes(serverNum)) continue;

                    const dataId = server.attr("data-lid");
                    const megaUrl = await this.getMegaUrl(dataId);
                    if (!megaUrl) continue;

                    const serverStreams = await this.decryptMegaEmbed(
                        megaUrl, 
                        serverName, 
                        dubType.toUpperCase() + (isUncensored ? " [Uncensored]" : "")
                    );
                    
                    streams.push(...serverStreams);
                }
            }
        }

        return streams;
    }

    // [Rest of the code remains the same...]
    // (Keep all the existing filter, preference, and encryption methods)
}

// Export the extension
if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
