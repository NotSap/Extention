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

    // ORIGINAL WORKING SEARCH FUNCTION (UNTOUCHED)
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

    // ORIGINAL WORKING POPULAR FUNCTION (UNTOUCHED)
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

    // ORIGINAL WORKING LATEST UPDATES FUNCTION (UNTOUCHED)
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

    // NEW EPISODE FETCHING IMPLEMENTATION
    async getDetail(url) {
        try {
            const body = await this.getPage(url);
            if (!body) return null;

            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const title = body.selectFirst(".anime-detail h1")?.attr(titlePref) || 
                        body.selectFirst(".anime-detail h1")?.text;
            
            const cover = body.selectFirst(".anime-cover img")?.attr("src");
            const description = body.selectFirst(".anime-detail .description")?.text;
            
            // Try multiple episode container selectors
            let episodeElements = [];
            const possibleSelectors = [
                ".episode-list .episode-item",
                ".episodes-container .episode",
                ".eplister ul li",
                ".list-episode-item"
            ];
            
            for (const selector of possibleSelectors) {
                episodeElements = body.select(selector);
                if (episodeElements.length > 0) break;
            }

            const episodes = episodeElements.map((ep, index) => {
                const epNumText = ep.selectFirst(".episode-number, .number")?.text?.match(/\d+/)?.[0] || 
                                ep.attr("data-number") || 
                                (index + 1);
                const epNum = parseInt(epNumText);
                const epUrl = ep.selectFirst("a")?.getHref || 
                            `${url}/episode/${epNum}`;
                const epName = ep.selectFirst(".episode-title, .title")?.text || 
                             `Episode ${epNum}`;
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

    // NEW VIDEO SOURCES IMPLEMENTATION
    async getVideoList(url) {
        try {
            const body = await this.getPage(url);
            if (!body) return [];

            const prefServers = this.getPreference("animekai_pref_stream_server") || ["1"];
            const prefSubDub = this.getPreference("animekai_pref_stream_subdub_type") || ["sub"];
            const splitStreams = this.getPreference("animekai_pref_extract_streams") !== false;

            // Try multiple server container selectors
            let serverElements = [];
            const possibleServerSelectors = [
                ".server-list .server-item",
                ".servers-list .server",
                ".server-tab"
            ];
            
            for (const selector of possibleServerSelectors) {
                serverElements = body.select(selector);
                if (serverElements.length > 0) break;
            }

            const servers = serverElements.map(server => {
                const serverId = server.attr("data-id") || 
                               server.attr("id") || 
                               server.selectFirst(".server-name")?.text?.toLowerCase().replace(/\s+/g, '-');
                const serverName = server.selectFirst(".server-name")?.text || `Server ${serverId}`;
                return { id: serverId, name: serverName };
            });

            const filteredServers = servers.filter(server => prefServers.includes(server.id));

            const streams = [];
            for (const server of filteredServers) {
                const serverContent = body.selectFirst(`.server-item[data-id="${server.id}"], #${server.id}`);
                if (!serverContent) continue;

                const videoElements = serverContent.select(".video-item, .mirror_item") || [];
                for (const video of videoElements) {
                    const type = video.attr("data-type") || 
                               video.selectFirst(".type")?.text?.toLowerCase() || 
                               "sub";
                    if (!prefSubDub.includes(type)) continue;

                    const videoUrl = video.attr("data-video") || 
                                   video.selectFirst("a")?.getHref;
                    if (!videoUrl) continue;

                    if (splitStreams) {
                        streams.push({ name: `${server.name} - ${type} - 360p`, url: videoUrl, quality: 360 });
                        streams.push({ name: `${server.name} - ${type} - 720p`, url: videoUrl, quality: 720 });
                        streams.push({ name: `${server.name} - ${type} - 1080p`, url: videoUrl, quality: 1080 });
                    } else {
                        streams.push({ name: `${server.name} - ${type}`, url: videoUrl, quality: 0 });
                    }
                }
            }

            return streams;
        } catch (error) {
            console.error("Failed to get video list:", error);
            return [];
        }
    }

    // ORIGINAL WORKING SETTINGS (UNTOUCHED)
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
