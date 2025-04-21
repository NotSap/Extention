const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.4",
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
        return res ? new Document(res) : null;
    }

    // WORKING SEARCH FUNCTION (KEEPING ORIGINAL VERSION)
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

    // IMPROVED DETAIL FETCHING FOR ANIFY COMPATIBILITY
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return null;

            // Extract basic info
            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const title = doc.selectFirst(".anime-detail h1, h1.title")?.attr(titlePref) || 
                        doc.selectFirst(".anime-detail h1, h1.title")?.text;
            
            const cover = doc.selectFirst(".anime-cover img, img.cover")?.attr("src") ||
                         doc.selectFirst(".poster img")?.attr("src");
            
            const description = doc.selectFirst(".anime-synopsis, .description")?.text?.trim();
            
            // Extract metadata
            const metadata = {};
            const detailItems = doc.select(".anime-detail .detail-item, .detail > div") || [];
            detailItems.forEach(item => {
                const label = item.selectFirst(".label, dt")?.text?.toLowerCase()?.replace(":", "").trim();
                const value = item.selectFirst(".value, dd")?.text?.trim();
                if (label && value) {
                    metadata[label] = value;
                }
            });

            // Extract episodes
            const episodes = [];
            const episodeContainer = doc.selectFirst(".episode-list, .eplist");
            if (episodeContainer) {
                const episodeItems = episodeContainer.select(".episode-item, li");
                episodeItems.forEach(item => {
                    const episodeNum = parseInt(item.attr("data-number") || 
                                        item.selectFirst(".episode-num")?.text?.match(/\d+/)?.[0] || 
                                        (episodes.length + 1));
                    
                    const episodeUrl = item.selectFirst("a")?.getHref || 
                                     `${url}/episode/${episodeNum}`;
                    
                    const episodeTitle = item.selectFirst(".episode-title")?.text || 
                                       `Episode ${episodeNum}`;
                    
                    const thumbnail = item.selectFirst("img")?.attr("src") || 
                                    item.selectFirst("img")?.attr("data-src") || 
                                    cover;

                    if (episodeUrl) {
                        episodes.push({
                            number: episodeNum,
                            title: episodeTitle,
                            url: episodeUrl,
                            thumbnail: thumbnail,
                            isFiller: false
                        });
                    }
                });
            }

            // Format for Anify
            return {
                id: url.split('/').pop(),
                title: title,
                coverImage: cover,
                bannerImage: cover, // Can be replaced if banner is available
                description: description,
                status: metadata.status || "UNKNOWN",
                type: metadata.type || "TV",
                genres: metadata.genres?.split(", ") || [],
                episodes: episodes.sort((a, b) => a.number - b.number),
                year: parseInt(metadata.year) || 0,
                season: metadata.season?.toUpperCase() || "UNKNOWN",
                studios: metadata.studio?.split(", ") || [],
                rating: parseFloat(metadata.rating) || 0,
                duration: metadata.duration || "24 min",
                trailer: null // Can be added if available
            };
        } catch (error) {
            console.error("Failed to get detail:", error);
            return null;
        }
    }

    // IMPROVED VIDEO SOURCE EXTRACTION
    async getVideoList(episodeUrl) {
        try {
            const doc = await this.getPage(episodeUrl);
            if (!doc) return [];

            // Extract available servers
            const servers = [];
            const serverContainer = doc.selectFirst(".server-list, .server-selector");
            if (serverContainer) {
                const serverItems = serverContainer.select(".server-item, li");
                serverItems.forEach(item => {
                    const serverId = item.attr("data-id") || item.attr("id")?.replace("server-", "");
                    const serverName = item.selectFirst(".server-name")?.text?.trim() || `Server ${servers.length + 1}`;
                    if (serverId) {
                        servers.push({
                            id: serverId,
                            name: serverName,
                            element: item
                        });
                    }
                });
            }

            // Get preferred servers and types from settings
            const prefServers = this.getPreference("animekai_pref_stream_server") || ["1"];
            const prefTypes = this.getPreference("animekai_pref_stream_subdub_type") || ["sub"];
            const splitQuality = this.getPreference("animekai_pref_extract_streams") !== false;

            // Extract streams from preferred servers
            const streams = [];
            for (const server of servers.filter(s => prefServers.includes(s.id))) {
                const videoItems = server.element.select(".video-item, [data-video]");
                for (const video of videoItems) {
                    const type = (video.attr("data-type") || "sub").toLowerCase();
                    if (!prefTypes.includes(type)) continue;

                    const videoUrl = video.attr("data-video") || 
                                    video.attr("data-src") || 
                                    video.selectFirst("iframe")?.attr("src");
                    
                    if (videoUrl) {
                        if (splitQuality) {
                            // Add multiple quality options if splitting is enabled
                            [360, 480, 720, 1080].forEach(quality => {
                                streams.push({
                                    url: videoUrl,
                                    quality: quality,
                                    server: server.name,
                                    type: type.toUpperCase(),
                                    name: `${server.name} (${type.toUpperCase()}) - ${quality}p`
                                });
                            });
                        } else {
                            streams.push({
                                url: videoUrl,
                                quality: 0, // Auto quality
                                server: server.name,
                                type: type.toUpperCase(),
                                name: `${server.name} (${type.toUpperCase()})`
                            });
                        }
                    }
                }
            }

            return streams.sort((a, b) => {
                // Sort by preferred server first, then by quality
                const serverOrder = prefServers.indexOf(a.server) - prefServers.indexOf(b.server);
                return serverOrder !== 0 ? serverOrder : (b.quality - a.quality);
            });
        } catch (error) {
            console.error("Failed to get video list:", error);
            return [];
        }
    }

    // FILTER LIST (ORIGINAL VERSION)
    getFilterList() {
        function formatState(type_name, items, values) {
            return items.map((name, i) => ({
                type_name: type_name,
                name: name,
                value: values[i]
            }));
        }

        return [
            // Types filter
            {
                type_name: "GroupFilter",
                name: "Types",
                state: formatState("CheckBox", 
                    ["TV", "Special", "OVA", "ONA", "Music", "Movie"],
                    ["tv", "special", "ova", "ona", "music", "movie"])
            },
            // Genre filter
            {
                type_name: "GroupFilter",
                name: "Genres",
                state: formatState("CheckBox", [
                    "Action", "Adventure", "Comedy", "Drama", "Fantasy", 
                    "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life"
                ], [
                    "action", "adventure", "comedy", "drama", "fantasy",
                    "horror", "mystery", "romance", "sci-fi", "slice-of-life"
                ])
            },
            // Status filter
            {
                type_name: "GroupFilter",
                name: "Status",
                state: formatState("CheckBox", 
                    ["Airing", "Completed", "Upcoming"],
                    ["airing", "completed", "upcoming"])
            },
            // Sort filter
            {
                type_name: "SelectFilter",
                name: "Sort by",
                state: 0,
                values: formatState("SelectOption", 
                    ["Default", "Title", "Rating", "Popularity", "Date Added"],
                    ["default", "title", "rating", "popularity", "date"])
            }
        ];
    }

    // SETTINGS (ORIGINAL VERSION WITH IMPROVEMENTS)
    getSourcePreferences() {
        return [
            {
                key: "animekai_base_url",
                editTextPreference: {
                    title: "Base URL",
                    summary: "Override the default base URL if needed",
                    value: "https://animekai.to",
                    dialogTitle: "Enter Base URL",
                    dialogMessage: "Change only if the site has moved"
                }
            },
            {
                key: "animekai_title_lang",
                listPreference: {
                    title: "Title Language",
                    summary: "Preferred language for anime titles",
                    valueIndex: 0,
                    entries: ["English", "Romaji"],
                    entryValues: ["title", "data-jp"]
                }
            },
            {
                key: "animekai_pref_stream_server",
                multiSelectListPreference: {
                    title: "Preferred Servers",
                    summary: "Select which servers to use for streaming",
                    values: ["1"],
                    entries: ["Server 1", "Server 2"],
                    entryValues: ["1", "2"]
                }
            },
            {
                key: "animekai_pref_stream_subdub_type",
                multiSelectListPreference: {
                    title: "Audio Type",
                    summary: "Preferred audio language",
                    values: ["sub"],
                    entries: ["Subtitled", "Dubbed"],
                    entryValues: ["sub", "dub"]
                }
            },
            {
                key: "animekai_pref_extract_streams",
                switchPreferenceCompat: {
                    title: "Extract Multiple Qualities",
                    summary: "Extract different quality streams when available",
                    value: true
                }
            }
        ];
    }
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
