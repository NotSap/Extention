const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.1.1",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // 1. KEEP ALL ORIGINAL WORKING METHODS UNCHANGED
    getPreference(key) {
        return new SharedPreferences().get(key);
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
        const res = await this.request(url);
        return new Document(res);
    }

    // ORIGINAL WORKING SEARCH - DO NOT MODIFY
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

    // ORIGINAL WORKING POPULAR - DO NOT MODIFY
    async getPopular(page) {
        const types = this.getPreference("animekai_popular_latest_type") || ["tv"];
        return this.search("", page, [
            { state: types.map(t => ({ state: true, value: t })) },
            { state: [] }, { state: [] },
            { values: [{ value: "trending" }], state: 0 },
            { state: [] }, { state: [] },
            { state: [] }, { state: [] },
            { state: [] }
        ]);
    }

    // ORIGINAL WORKING LATEST - DO NOT MODIFY
    async getLatestUpdates(page) {
        const types = this.getPreference("animekai_popular_latest_type") || ["tv"];
        return this.search("", page, [
            { state: types.map(t => ({ state: true, value: t })) },
            { state: [] }, { state: [] },
            { values: [{ value: "updated_date" }], state: 0 },
            { state: [] }, { state: [] },
            { state: [] }, { state: [] },
            { state: [] }
        ]);
    }

    // 2. FIXED EPISODE FETCHING (Anify-compatible)
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return null;

            // Get title using original method
            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const title = doc.selectFirst("h1.title, .anime-detail h1")?.attr(titlePref) || 
                        doc.selectFirst("h1.title, .anime-detail h1")?.text;
            
            // Get cover using original method
            const cover = doc.selectFirst("img.cover, .anime-cover img")?.attr("src");

            // Find episodes using multiple selector patterns
            const episodeElements = doc.select(".episode-list li, .episode-item") || [];
            const episodes = episodeElements.map((ep, index) => {
                const epNum = parseInt(
                    ep.attr("data-number") || 
                    ep.selectFirst(".episode-number")?.text?.match(/\d+/)?.[0] || 
                    (index + 1)
                );
                
                return {
                    id: `ep-${epNum}-${Date.now()}`, // Unique ID for Anify
                    number: epNum,
                    title: ep.selectFirst(".episode-title")?.text || `Episode ${epNum}`,
                    thumbnail: ep.selectFirst("img")?.attr("src") || cover,
                    isFiller: false
                };
            });

            // Return Anify-compatible format
            return {
                id: url.split('/').pop(), // anime ID from URL
                title: title,
                coverImage: cover,
                episodes: episodes,
                mappings: {
                    id: url.split('/').pop(),
                    providerId: "animekai",
                    similarity: 95
                }
            };
        } catch (error) {
            console.error("Detail fetch failed:", error);
            return null;
        }
    }

    // 3. FIXED VIDEO SOURCES (Anify-compatible)
    async getVideoList(episodeId) {
        try {
            // Extract anime ID and episode number (format: ep-1-1234567890)
            const epNum = episodeId.split('-')[1];
            const animeId = episodeId.split('-ep-')[0];
            const url = `${this.getBaseUrl()}/watch/${animeId}/episode-${epNum}`;

            const doc = await this.getPage(url);
            if (!doc) return [];

            // Get user preferences
            const prefServers = this.getPreference("animekai_pref_stream_server") || ["1"];
            const prefSubDub = this.getPreference("animekai_pref_stream_subdub_type") || ["sub", "dub"];
            const splitStreams = this.getPreference("animekai_pref_extract_streams");

            // Find all servers
            const servers = doc.select(".server-list li").map(server => ({
                id: server.attr("data-id"),
                name: server.selectFirst(".server-name")?.text || "Default",
                element: server
            }));

            // Filter by preferred servers and process videos
            const sources = [];
            for (const server of servers.filter(s => prefServers.includes(s.id))) {
                const videos = server.element.select(".video-item");
                for (const video of videos) {
                    const type = video.attr("data-type") || "sub";
                    if (!prefSubDub.includes(type)) continue;

                    const videoUrl = video.attr("data-video");
                    if (!videoUrl) continue;

                    // Add quality options if splitting enabled
                    if (splitStreams) {
                        [360, 720, 1080].forEach(quality => {
                            sources.push({
                                url: videoUrl,
                                quality: quality,
                                audio: type === "dub" ? "dub" : "sub",
                                headers: {
                                    Referer: this.getBaseUrl()
                                }
                            });
                        });
                    } else {
                        sources.push({
                            url: videoUrl,
                            quality: 0, // auto
                            audio: type === "dub" ? "dub" : "sub",
                            headers: {
                                Referer: this.getBaseUrl()
                            }
                        });
                    }
                }
            }

            return sources;
        } catch (error) {
            console.error("Video list failed:", error);
            return [];
        }
    }

    // 4. ORIGINAL SETTINGS - COMPLETELY UNCHANGED
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
                key: "animekai_popular_latest_type",
                multiSelectListPreference: {
                    title: 'Preferred type of anime to be shown in popular & latest section',
                    summary: 'Choose which type of anime you want to see in the popular & latest section',
                    values: ["tv", "special", "ova", "ona"],
                    entries: ["TV", "Special", "OVA", "ONA", "Music", "Movie"],
                    entryValues: ["tv", "special", "ova", "ona", "music", "movie"]
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
                multiSelectListPreference: {
                    title: 'Preferred server',
                    summary: 'Choose the server/s you want to extract streams from',
                    values: ["1"],
                    entries: ["Server 1", "Server 2"],
                    entryValues: ["1", "2"]
                }
            }, {
                key: "animekai_pref_stream_subdub_type",
                multiSelectListPreference: {
                    title: 'Preferred stream sub/dub type',
                    summary: '',
                    values: ["sub", "dub"],
                    entries: ["Sub", "Dub"],
                    entryValues: ["sub", "dub"]
                }
            }, {
                key: "animekai_pref_extract_streams",
                switchPreferenceCompat: {
                    title: 'Split stream into different quality streams',
                    summary: "Split stream Auto into 360p/720p/1080p",
                    value: true
                }
            },
        ];
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
