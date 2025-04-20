const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.5",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // =====================
    // 1. WORKING SEARCH (ORIGINAL)
    // =====================
    async search(query, page, filters) {
        try {
            const filterValues = {
                type: filters[0]?.state?.filter(f => f.state).map(f => f.value) || [],
                genre: filters[1]?.state?.filter(f => f.state).map(f => f.value) || [],
                status: filters[2]?.state?.filter(f => f.state).map(f => f.value) || [],
                sort: filters[3]?.values?.[filters[3]?.state]?.value || "updated_date",
                season: filters[4]?.state?.filter(f => f.state).map(f => f.value) || [],
                year: filters[5]?.state?.filter(f => f.state).map(f => f.value) || [],
                rating: filters[6]?.state?.filter(f => f.state).map(f => f.value) || [],
                country: filters[7]?.state?.filter(f => f.state).map(f => f.value) || [],
                language: filters[8]?.state?.filter(f => f.state).map(f => f.value) || []
            };

            let slug = "/browser?keyword=" + encodeURIComponent(query);
            
            for (const [key, values] of Object.entries(filterValues)) {
                if (values.length > 0) {
                    if (key === "sort") {
                        slug += `&${key}=${values}`;
                    } else {
                        values.forEach(value => {
                            slug += `&${key}[]=${encodeURIComponent(value)}`;
                        });
                    }
                }
            }

            slug += `&page=${page}`;

            const body = await this.getPage(slug);
            if (!body) return { list: [], hasNextPage: false };

            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const animeItems = body.select(".aitem-wrapper .aitem") || [];
            
            const list = animeItems.map(anime => {
                const link = anime.selectFirst("a")?.getHref;
                const imageUrl = anime.selectFirst("img")?.attr("data-src");
                const name = anime.selectFirst("a.title")?.attr(titlePref) || 
                            anime.selectFirst("a.title")?.text;
                return { name, link, imageUrl };
            }).filter(item => item.link && item.imageUrl);

            const paginations = body.select(".pagination > li") || [];
            const hasNextPage = paginations.length > 0 ? 
                !paginations[paginations.length - 1].className.includes("active") : false;

            return { list, hasNextPage };
        } catch (error) {
            console.error("Search failed:", error);
            return { list: [], hasNextPage: false };
        }
    }

    // =====================
    // 2. IMPROVED DETAIL EXTRACTION
    // =====================
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return null;

            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const title = doc.selectFirst("h1.title")?.attr(titlePref) || 
                        doc.selectFirst("h1.title")?.text;
            
            const cover = doc.selectFirst("img.cover")?.attr("src");
            const description = doc.selectFirst(".description")?.text;

            // Enhanced episode detection
            const episodeItems = doc.select(".episode-list li, .eplist li") || [];
            const episodes = episodeItems.map((item, index) => {
                const epNum = parseInt(
                    item.attr("data-episode") || 
                    item.selectFirst(".episode-num")?.text?.match(/\d+/)?.[0] || 
                    (index + 1)
                );
                return {
                    name: item.selectFirst(".episode-title")?.text || `Episode ${epNum}`,
                    url: item.selectFirst("a")?.getHref || `${url}/episode/${epNum}`,
                    episode: epNum,
                    thumbnailUrl: item.selectFirst("img")?.attr("src") || cover
                };
            }).filter(ep => ep.url);

            return {
                name: title,
                cover: cover,
                description: description,
                episodes: episodes.sort((a, b) => a.episode - b.episode)
            };
        } catch (error) {
            console.error("Failed to get detail:", error);
            return null;
        }
    }

    // =====================
    // 3. RELIABLE VIDEO EXTRACTION
    // =====================
    async getVideoList(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return [];

            const prefServer = this.getPreference("animekai_pref_stream_server") || "1";
            const showUncensored = this.getPreference("animekai_show_uncen_epsiodes") !== false;

            // Find active server tab
            const server = doc.selectFirst(`.server-tab[data-server="${prefServer}"], 
                                         .server-item[data-id="${prefServer}"]`);
            if (!server) return [];

            // Extract all video options
            const videos = server.select(".video-item, [data-video]") || [];
            return videos.map(video => {
                const isUncensored = video.text?.includes("Uncensored");
                if (isUncensored && !showUncensored) return null;

                return {
                    name: video.selectFirst(".video-name")?.text || "Default",
                    url: video.attr("data-video") || video.attr("data-src"),
                    quality: video.text?.match(/1080|720|480/)?.shift() || "Auto"
                };
            }).filter(Boolean);
        } catch (error) {
            console.error("Failed to get video list:", error);
            return [];
        }
    }

    // =====================
    // 4. ORIGINAL SETTINGS (UNCHANGED)
    // =====================
    getSourcePreferences() {
        return [
            {
                key: "animekai_base_url",
                editTextPreference: {
                    title: "Override base url",
                    summary: "",
                    value: "https://animekai.to",
                    dialogTitle: "Override base url",
                    dialogMessage: "",
                }
            }, {
                key: "animekai_title_lang",
                listPreference: {
                    title: 'Preferred title language',
                    summary: 'Choose in which language anime title should be shown',
                    valueIndex: 1,
                    entries: ["English", "Romaji"],
                    entryValues: ["title", "data-jp"]
                }
            },
            {
                key: "animekai_show_uncen_epsiodes",
                switchPreferenceCompat: {
                    title: 'Show uncensored episodes',
                    summary: "",
                    value: true
                }
            }, {
                key: "animekai_pref_stream_server",
                listPreference: {
                    title: 'Preferred server',
                    summary: 'Choose the server you want to extract streams from',
                    valueIndex: 0,
                    entries: ["Server 1", "Server 2"],
                    entryValues: ["1", "2"]
                }
            }
        ];
    }

    // =====================
    // HELPER METHODS
    // =====================
    getPreference(key) {
        return new SharedPreferences().get(key);
    }

    async getPage(url) {
        try {
            const fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
            const res = await this.client.get(fullUrl, {
                headers: {
                    "Referer": this.baseUrl,
                    "Origin": this.baseUrl
                }
            });
            return new Document(res.body);
        } catch (error) {
            console.error("Failed to fetch page:", error);
            return null;
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
