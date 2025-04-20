const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.3",
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

    // ORIGINAL SEARCH FUNCTION (WORKING VERSION)
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

    // ANIMEPAHE-STYLE DETAIL FETCHING ADAPTED FOR ANIMEKAI
    async getDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return null;

            const title = doc.selectFirst("h1.title")?.text || 
                         doc.selectFirst(".anime-title")?.text;
            
            const cover = doc.selectFirst("img.cover")?.attr("src") ||
                         doc.selectFirst(".anime-poster img")?.attr("src");
            
            const description = doc.selectFirst(".description")?.text || 
                             doc.selectFirst(".anime-synopsis")?.text;

            // AnimePahe-style episode list extraction
            const episodes = [];
            const episodeElements = doc.select(".episode-list li, .episode-wrap");
            
            episodeElements.forEach((element, index) => {
                const epNum = parseInt(element.attr("data-number") || 
                             element.selectFirst(".episode-num")?.text?.match(/\d+/)?.[0] || 
                             (index + 1));
                
                const epUrl = element.selectFirst("a")?.getHref || 
                            `${url}/episode/${epNum}`;
                
                const epName = element.selectFirst(".episode-title")?.text || 
                             `Episode ${epNum}`;
                
                const epThumb = element.selectFirst("img")?.attr("src") || 
                              element.selectFirst("img")?.attr("data-src") || 
                              cover;

                if (epUrl) {
                    episodes.push({
                        name: epName,
                        url: epUrl,
                        episode: epNum,
                        thumbnailUrl: epThumb
                    });
                }
            });

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

    // ANIMEPAHE-STYLE VIDEO FETCHING ADAPTED FOR ANIMEKAI
    async getVideoList(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return [];

            const servers = doc.select(".server-list li, .server-item").map(server => ({
                id: server.attr("data-id") || server.attr("id")?.replace("server-", "") || "default",
                name: server.selectFirst(".server-name")?.text?.trim() || "Default",
                element: server
            }));

            const prefServers = this.getPreference("animekai_pref_stream_server") || ["1"];
            const prefSubDub = this.getPreference("animekai_pref_stream_subdub_type") || ["sub", "dub"];
            const splitStreams = this.getPreference("animekai_pref_extract_streams") !== false;

            const streams = [];
            
            for (const server of servers) {
                if (!prefServers.includes(server.id)) continue;
                
                const videoItems = server.element.select(".video-item, .mirror_item");
                for (const video of videoItems) {
                    const type = (video.attr("data-type") || "sub").toLowerCase();
                    if (!prefSubDub.includes(type)) continue;
                    
                    const videoUrl = video.attr("data-video") || 
                                   video.attr("data-src") || 
                                   video.selectFirst("iframe")?.attr("src");
                    
                    if (videoUrl) {
                        if (splitStreams) {
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
            }

            return streams.sort((a, b) => {
                const serverCompare = prefServers.indexOf(a.server) - prefServers.indexOf(b.server);
                return serverCompare !== 0 ? serverCompare : (b.quality - a.quality);
            });
        } catch (error) {
            console.error("Failed to get video list:", error);
            return [];
        }
    }

    // ORIGINAL SETTINGS (UNCHANGED)
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
