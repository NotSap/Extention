const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.9.0",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // 1. REVERTED WORKING SEARCH (Last known good version)
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

    // 2. WORKING SETTINGS (Unchanged)
    getSourcePreferences() {
        return [
            {
                key: "animekai_base_url",
                editTextPreference: {
                    title: "Base URL",
                    summary: "Change only if site moved",
                    value: "https://animekai.to",
                    dialogTitle: "Enter AnimeKai URL",
                    dialogMessage: "Don't change unless necessary"
                }
            },
            {
                key: "animekai_default_quality",
                listPreference: {
                    title: "Default Quality",
                    summary: "Preferred video quality",
                    valueIndex: 1,
                    entries: ["480p", "720p", "1080p"],
                    entryValues: ["480", "720", "1080"]
                }
            },
            {
                key: "animekai_autoplay",
                switchPreferenceCompat: {
                    title: "Auto Play Next",
                    summary: "Automatically play next episode",
                    value: true
                }
            }
        ];
    }

    // 3. WORKING DETAIL FETCHING (From last good version)
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return this._createEmptyResponse();

            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const title = doc.selectFirst("h1.title, .anime-detail h1")?.attr(titlePref) || 
                        doc.selectFirst("h1.title, .anime-detail h1")?.text || "Unknown Title";
            
            const cover = doc.selectFirst("img.cover, .anime-cover img")?.attr("src") || "";
            const description = doc.selectFirst(".description, .anime-synopsis")?.text || "";

            const episodeElements = doc.select(".episode-list li, .episode-item") || [];
            const episodes = episodeElements.map((ep, index) => ({
                id: `ep-${index + 1}`,
                number: index + 1,
                title: ep.selectFirst(".episode-title")?.text || `Episode ${index + 1}`,
                url: ep.selectFirst("a")?.getHref || `${url}/episode-${index + 1}`,
                thumbnail: ep.selectFirst("img")?.attr("src") || cover
            }));

            return {
                id: url.split('/').pop() || "unknown-id",
                title: title,
                coverImage: cover,
                description: description,
                episodes: episodes,
                mappings: {
                    id: url.split('/').pop() || "unknown-id",
                    providerId: "animekai",
                    similarity: 95
                }
            };
        } catch (error) {
            console.error("Detail fetch failed:", error);
            return this._createEmptyResponse();
        }
    }

    _createEmptyResponse() {
        return {
            id: "error",
            title: "Error loading data",
            coverImage: "",
            description: "",
            episodes: [],
            mappings: {
                id: "error",
                providerId: "animekai",
                similarity: 0
            }
        };
    }

    // 4. WORKING VIDEO SOURCES (From last good version)
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return [];

            const quality = this.getPreference("animekai_default_quality") || "720";
            const serverElements = doc.select(".server-list li") || [];
            
            const sources = serverElements.flatMap(server => {
                const videoElements = server.select(".video-item") || [];
                return videoElements.map(video => ({
                    url: video.attr("data-video"),
                    quality: parseInt(quality),
                    headers: {
                        Referer: this.getBaseUrl(),
                        Origin: this.getBaseUrl()
                    }
                }));
            }).filter(source => source.url);

            return sources.length > 0 ? sources : [{
                url: episodeUrl.replace("/episode-", "/watch/") + ".mp4",
                quality: 720,
                headers: { Referer: this.getBaseUrl() }
            }];
        } catch (error) {
            console.error("Video list failed:", error);
            return [];
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
