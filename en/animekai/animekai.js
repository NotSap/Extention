const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.1",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

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

    // ORIGINAL WORKING SEARCH FUNCTION (EXACTLY AS WAS)
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

    // ORIGINAL WORKING POPULAR FUNCTION (EXACTLY AS WAS)
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

    // ORIGINAL WORKING LATEST UPDATES FUNCTION (EXACTLY AS WAS)
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

    // NEW EPISODE FETCHING - USING SAME APPROACH AS SEARCH
    async getDetail(url) {
        try {
            const body = await this.getPage(url);
            if (!body) return null;

            // Get title using same method as search
            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const title = body.selectFirst("h1.title, .anime-detail h1")?.attr(titlePref) || 
                        body.selectFirst("h1.title, .anime-detail h1")?.text;
            
            // Get cover image using same pattern as search's image extraction
            const cover = body.selectFirst("img.cover, .anime-cover img")?.attr("src") ||
                        body.selectFirst("img[data-src]")?.attr("data-src");

            // Get description
            const description = body.selectFirst(".description, .anime-detail .description")?.text;

            // Fetch episodes using same document query approach as search
            const episodeContainer = body.selectFirst(".episode-list, .episodes-container");
            const episodeItems = episodeContainer?.select(".episode-item, .episode") || [];
            
            const episodes = episodeItems.map((ep, index) => {
                const epUrl = ep.selectFirst("a")?.getHref;
                const epNum = parseInt(ep.attr("data-number") || 
                             ep.selectFirst(".episode-number")?.text?.match(/\d+/)?.[0] || 
                             (index + 1));
                const epName = ep.selectFirst(".episode-title")?.text || `Episode ${epNum}`;
                const epThumb = ep.selectFirst("img")?.attr("src") || 
                              ep.selectFirst("img")?.attr("data-src") || 
                              cover;

                return {
                    name: epName,
                    url: epUrl,
                    episode: epNum,
                    thumbnailUrl: epThumb
                };
            }).filter(ep => ep.url);

            return {
                name: title,
                cover: cover,
                description: description,
                episodes: episodes
            };
        } catch (error) {
            console.error("Failed to get detail:", error);
            return null;
        }
    }

    // NEW VIDEO LIST FETCHING - USING SAME APPROACH AS SEARCH
    async getVideoList(url) {
        try {
            const body = await this.getPage(url);
            if (!body) return [];

            // Get user preferences
            const prefServers = this.getPreference("animekai_pref_stream_server") || ["1"];
            const prefSubDub = this.getPreference("animekai_pref_stream_subdub_type") || ["sub"];
            const splitStreams = this.getPreference("animekai_pref_extract_streams") !== false;

            // Find server list using same query pattern as search
            const serverItems = body.select(".server-list .server-item, .server-list .server") || [];
            const servers = serverItems.map(server => {
                return {
                    id: server.attr("data-id") || server.id || "",
                    name: server.selectFirst(".server-name")?.text || "Default"
                };
            }).filter(server => prefServers.includes(server.id));

            // Extract streams using same document processing as search
            const streams = [];
            for (const server of servers) {
                const serverContent = body.selectFirst(`[data-id="${server.id}"], #${server.id}`);
                if (!serverContent) continue;

                const videoItems = serverContent.select(".video-item, .mirror_item") || [];
                for (const video of videoItems) {
                    const type = video.attr("data-type") || "sub";
                    if (!prefSubDub.includes(type)) continue;

                    const videoUrl = video.attr("data-video") || video.attr("data-src");
                    if (!videoUrl) continue;

                    if (splitStreams) {
                        // Add multiple quality options if splitting enabled
                        [360, 720, 1080].forEach(quality => {
                            streams.push({
                                name: `${server.name} - ${type} - ${quality}p`,
                                url: videoUrl,
                                quality: quality,
                                server: server.name,
                                type: type
                            });
                        });
                    } else {
                        streams.push({
                            name: `${server.name} - ${type}`,
                            url: videoUrl,
                            quality: 0,
                            server: server.name,
                            type: type
                        });
                    }
                }
            }

            return streams;
        } catch (error) {
            console.error("Failed to get video list:", error);
            return [];
        }
    }

    // ORIGINAL SETTINGS (EXACTLY AS WAS)
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
                    values: ["sub", "softsub", "dub"],
                    entries: ["Hard Sub", "Soft Sub", "Dub"],
                    entryValues: ["sub", "softsub", "dub"]
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
