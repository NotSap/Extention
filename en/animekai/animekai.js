const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.6",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
    }

    // KEEP ALL ORIGINAL METHODS UNCHANGED
    getPreference(key) {
        return new SharedPreferences().get(key);
    }

    getBaseUrl() {
        return this.getPreference("animekai_base_url") || "https://animekai.to";
    }

    async request(url, options = {}) {
        try {
            const fullUrl = url.startsWith("http") ? url : this.getBaseUrl() + url;
            const res = await this.client.get(fullUrl, options);
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

    // ORIGINAL WORKING SEARCH FUNCTION - COMPLETELY UNCHANGED
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

    // ORIGINAL WORKING POPULAR FUNCTION - UNCHANGED
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

    // ORIGINAL WORKING LATEST UPDATES FUNCTION - UNCHANGED
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

    // IMPROVED DETAIL FETCHING WITH ANIMEKAI PRIORITY
    async getDetail(url) {
        try {
            // First try AnimeKai's native detail page
            const doc = await this.getPage(url);
            if (!doc) return null;

            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const title = doc.selectFirst("h1.title, .anime-detail h1")?.attr(titlePref) || 
                        doc.selectFirst("h1.title, .anime-detail h1")?.text;
            
            const cover = doc.selectFirst("img.cover, .anime-cover img")?.attr("src");
            const description = doc.selectFirst(".description, .anime-synopsis")?.text;

            // Try to get episodes from AnimeKai first
            const episodeItems = doc.select(".episode-list .episode-item, .episodes-wrapper .episode") || [];
            let episodes = episodeItems.map((item, index) => {
                const epNum = parseInt(
                    item.attr("data-number") || 
                    item.selectFirst(".episode-number")?.text?.match(/\d+/)?.[0] || 
                    (index + 1)
                );
                return {
                    name: item.selectFirst(".episode-title")?.text || `Episode ${epNum}`,
                    url: item.selectFirst("a")?.getHref || `${url}/episode/${epNum}`,
                    episode: epNum,
                    thumbnailUrl: item.selectFirst("img")?.attr("src") || cover
                };
            }).filter(ep => ep.url);

            // If no episodes found, try to get episode count from title
            if (episodes.length === 0 && title) {
                const episodeCount = await this.getEpisodeCountFromTitle(title);
                if (episodeCount > 0) {
                    episodes = Array.from({ length: episodeCount }, (_, i) => ({
                        name: `Episode ${i + 1}`,
                        url: `${url}/episode/${i + 1}`,
                        episode: i + 1,
                        thumbnailUrl: cover
                    }));
                }
            }

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

    async getEpisodeCountFromTitle(title) {
        // This is a placeholder - implement your actual AniList/Kitsu API calls here
        // Return 0 if no data found
        return 0;
    }

    // ORIGINAL WORKING VIDEO LIST FUNCTION - UNCHANGED
    async getVideoList(url) {
        try {
            const body = await this.getPage(url);
            if (!body) return [];

            const prefServers = this.getPreference("animekai_pref_stream_server") || ["1"];
            const prefSubDub = this.getPreference("animekai_pref_stream_subdub_type") || ["sub", "dub"];
            const splitStreams = this.getPreference("animekai_pref_extract_streams") !== false;

            const serverElements = body.select(".server-list .server-item") || [];
            const servers = serverElements.map(server => {
                const serverId = server.attr("data-id");
                const serverName = server.selectFirst(".server-name")?.text || `Server ${serverId}`;
                return { id: serverId, name: serverName };
            });

            const filteredServers = servers.filter(server => prefServers.includes(server.id));

            const streams = [];
            for (const server of filteredServers) {
                const serverTab = body.selectFirst(`.server-item[data-id="${server.id}"]`);
                if (!serverTab) continue;

                const videoElements = serverTab.select(".video-item") || [];
                for (const video of videoElements) {
                    const type = video.attr("data-type");
                    if (!prefSubDub.includes(type)) continue;

                    const videoUrl = video.attr("data-video");
                    if (!videoUrl) continue;

                    if (splitStreams) {
                        streams.push({
                            name: `${server.name} - ${type} - 360p`,
                            url: videoUrl,
                            quality: 360,
                            server: server.name,
                            type: type
                        });
                        streams.push({
                            name: `${server.name} - ${type} - 720p`,
                            url: videoUrl,
                            quality: 720,
                            server: server.name,
                            type: type
                        });
                        streams.push({
                            name: `${server.name} - ${type} - 1080p`,
                            url: videoUrl,
                            quality: 1080,
                            server: server.name,
                            type: type
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

    // ORIGINAL WORKING SETTINGS WITH DUB OPTION - UNCHANGED
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
