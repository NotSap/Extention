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

    async getDetail(url) {
        try {
            const body = await this.getPage(url);
            if (!body) {
                console.error("Failed to load detail page");
                return null;
            }

            // First try standard method
            const animeId = body.selectFirst("#anime-rating")?.attr("data-id");
            if (animeId) {
                const token = await this.kaiEncrypt(animeId);
                const res = await this.request(`/ajax/episodes/list?ani_id=${animeId}&_=${token}`);
                
                if (res) {
                    const data = JSON.parse(res);
                    if (data.status === 200) {
                        const doc = new Document(data.result);
                        const episodes = doc.selectFirst("div.eplist.titles")?.select("li") || [];
                        const showUncenEp = this.getPreference("animekai_show_uncen_epsiodes");

                        const chapters = [];
                        for (const item of episodes) {
                            const aTag = item.selectFirst("a");
                            if (!aTag) continue;

                            const num = parseInt(aTag.attr("num"));
                            const title = aTag.selectFirst("span")?.text;
                            const epName = `Episode ${num}${title?.includes("Episode") ? "" : `: ${title}`}`;
                            const langs = aTag.attr("langs");
                            const scanlator = langs === "1" ? "SUB" : "SUB, DUB";
                            const token = aTag.attr("token");

                            let epData = {
                                name: epName,
                                url: token,
                                scanlator
                            };

                            const slug = aTag.attr("slug");
                            if (slug?.includes("uncen")) {
                                if (!showUncenEp) continue;

                                epData = {
                                    name: `Episode ${num}: (Uncensored)`,
                                    url: token,
                                    scanlator: scanlator + ", UNCENSORED"
                                };

                                const exData = chapters[num - 1];
                                if (exData) {
                                    exData.url += "||" + epData.url;
                                    exData.scanlator += ", " + epData.scanlator;
                                    continue;
                                }
                            }
                            chapters.push(epData);
                        }

                        const titlePref = this.getPreference("animekai_title_lang") || "title";
                        const mainSection = body.selectFirst(".watch-section") || body;
                        
                        return { 
                            name: mainSection.selectFirst("h1, .title")?.attr(titlePref) || 
                                 mainSection.selectFirst("h1, .title")?.text,
                            imageUrl: mainSection.selectFirst("img.poster, img.cover")?.attr("src"),
                            link: this.getBaseUrl() + url,
                            description: mainSection.selectFirst(".desc, .synopsis")?.text,
                            genre: mainSection.select(".genre, .tag")?.map(el => el.text.trim()) || [],
                            status: 1,
                            chapters: chapters.reverse()
                        };
                    }
                }
            }

            // Fallback to direct scraping if API fails
            console.log("Using fallback scraping method");
            const episodeContainer = body.selectFirst(".episode-list, .eplist");
            const episodes = episodeContainer ? 
                episodeContainer.select("li").map((item, i) => {
                    const aTag = item.selectFirst("a");
                    return {
                        name: aTag?.text || `Episode ${i + 1}`,
                        url: aTag?.getHref || `${url}/${i + 1}`,
                        episode: i + 1
                    };
                }).reverse() : [];

            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const mainSection = body.selectFirst(".watch-section") || body;
            
            return { 
                name: mainSection.selectFirst("h1, .title")?.attr(titlePref) || 
                     mainSection.selectFirst("h1, .title")?.text,
                imageUrl: mainSection.selectFirst("img.poster, img.cover")?.attr("src"),
                link: this.getBaseUrl() + url,
                description: mainSection.selectFirst(".desc, .synopsis")?.text,
                genre: mainSection.select(".genre, .tag")?.map(el => el.text.trim()) || [],
                status: 1,
                chapters: episodes
            };

        } catch (error) {
            console.error("getDetail error:", error);
            return null;
        }
    }

    async getVideoList(url) {
        try {
            const streams = [];
            const prefServer = this.getPreference("animekai_pref_stream_server") || ["1", "2"];
            const prefDubType = this.getPreference("animekai_pref_stream_subdub_type") || ["sub", "dub"];
            
            const epSlug = url.split("||");
            let isUncensoredVersion = false;

            for (const epId of epSlug) {
                const token = await this.kaiEncrypt(epId);
                const res = await this.request(`/ajax/links/list?token=${epId}&_=${token}`);
                if (!res) continue;

                const body = JSON.parse(res);
                if (body.status != 200) continue;

                const serverResult = new Document(body.result);
                const SERVERDATA = [];
                
                const serverItems = serverResult.select("div.server-items") || [];
                for (const dubSection of serverItems) {
                    let dubType = dubSection.attr("data-id");
                    if (!dubType) {
                        // Fallback type detection
                        if (dubSection.className.includes("dub")) {
                            dubType = "dub";
                        } else {
                            dubType = "sub"; // Default to sub
                        }
                    }

                    if (!prefDubType.includes(dubType)) continue;

                    for (const ser of dubSection.select("span.server")) {
                        const serverName = ser.text;
                        const serverNum = serverName.replace("Server ", "");
                        if (!prefServer.includes(serverNum)) continue;

                        const dataId = ser.attr("data-lid");
                        SERVERDATA.push({
                            serverName,
                            dataId,
                            dubType
                        });
                    }
                }

                for (const serverData of SERVERDATA) {
                    try {
                        const megaUrl = await this.getMegaUrl(serverData.dataId);
                        if (!megaUrl) continue;

                        let typeLabel = serverData.dubType.toUpperCase();
                        if (typeLabel === "SUB") typeLabel = "HARDSUB";
                        if (isUncensoredVersion) typeLabel += " [Uncensored]";

                        const serverStreams = await this.decryptMegaEmbed(
                            megaUrl, 
                            serverData.serverName, 
                            typeLabel
                        );

                        if (serverStreams?.length) {
                            streams.push(...serverStreams);
                            
                            if (typeLabel.includes("DUB") && megaUrl.includes("sub.list=")) {
                                try {
                                    const subList = megaUrl.split("sub.list=")[1];
                                    const subres = await this.client.get(subList);
                                    const subtitles = JSON.parse(subres.body);
                                    const subs = this.formatSubtitles(subtitles, typeLabel);
                                    if (streams.length) {
                                        streams[streams.length - 1].subtitles = subs;
                                    }
                                } catch (e) {
                                    console.error("Subtitle error:", e);
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Server processing error:", e);
                    }
                }
                isUncensoredVersion = true;
            }

            return streams.length > 0 ? streams : [{
                url: "",
                name: "No servers available - Try changing server preferences"
            }];
        } catch (error) {
            console.error("getVideoList error:", error);
            return [{
                url: "",
                name: "Error loading streams - Try again later"
            }];
        }
    }

    // [Keep all your existing utility methods below]
    // formatSubtitles(), formatStreams(), getMegaUrl(), decryptMegaEmbed()
    // base64UrlDecode(), base64UrlEncode(), transform(), reverseString()
    // substitute(), getDecoderPattern(), patternExecutor(), kaiEncrypt()
    // kaiDecrypt(), megaDecrypt(), getFilterList(), getSourcePreferences()
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
