const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "0.2.4",
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
        return this.getPreference("animekai_base_url");
    }

    async request(slug) {
        var url = slug;
        var baseUrl = this.getBaseUrl();
        if (!slug.includes(baseUrl)) url = baseUrl + slug;
        var res = await this.client.get(url);
        return res.body;
    }

    async getPage(slug) {
        var res = await this.request(slug);
        return new Document(res);
    }

    async searchPage({ query = "", type = [], genre = [], status = [], sort = "", season = [], year = [], rating = [], country = [], language = [], page = 1 } = {}) {
        function bundleSlug(category, items) {
            var rd = "";
            for (var item of items) {
                rd += `&${category}[]=${encodeURIComponent(item.toLowerCase())}`;
            }
            return rd;
        }

        var slug = "/browser?";
        if (query && query.trim() !== "") {
            slug += "keyword=" + encodeURIComponent(query.trim());
        }

        if (type.length > 0) slug += bundleSlug("type", type);
        if (genre.length > 0) slug += bundleSlug("genre", genre);
        if (status.length > 0) slug += bundleSlug("status", status);
        if (season.length > 0) slug += bundleSlug("season", season);
        if (year.length > 0) slug += bundleSlug("year", year);
        if (rating.length > 0) slug += bundleSlug("rating", rating);
        if (country.length > 0) slug += bundleSlug("country", country);
        if (language.length > 0) slug += bundleSlug("language", language);
        
        sort = sort.length < 1 ? "updated_date" : sort;
        slug += "&sort=" + sort;
        slug += "&page=" + page;

        var list = [];
        var body = await this.getPage(slug);

        // Try multiple container selectors
        var animeContainers = [
            ".aitem-wrapper",
            ".list-update",
            ".anime-list",
            ".items",
            ".film-list",
            ".list-items"
        ];

        var animeContainer = null;
        for (var container of animeContainers) {
            animeContainer = body.selectFirst(container);
            if (animeContainer) break;
        }

        if (animeContainer) {
            // Try multiple item selectors
            var animeSelectors = [
                ".aitem",
                ".anime-item",
                ".list-item",
                ".item",
                ".film-item",
                ".list-item"
            ];

            var animes = [];
            for (var selector of animeSelectors) {
                var found = animeContainer.select(selector);
                if (found.length > 0) {
                    animes = found;
                    break;
                }
            }

            animes.forEach(anime => {
                try {
                    // Try multiple link selectors
                    var linkElement = anime.selectFirst("a");
                    if (!linkElement) return;
                    
                    var link = linkElement.getHref;
                    if (!link) return;
                    
                    // Try multiple image selectors
                    var imageElement = anime.selectFirst("img");
                    var imageUrl = imageElement?.attr("data-src") || 
                                 imageElement?.getSrc || 
                                 "";
                    
                    // Try multiple title selectors
                    var titleElement = anime.selectFirst("a.title, .name, .title, .film-name");
                    var name = titleElement?.text?.trim();
                    if (!name) {
                        name = titleElement?.attr("title") || 
                              titleElement?.attr("data-title") || 
                              "";
                    }
                    
                    if (name && link) {
                        list.push({ 
                            name, 
                            link, 
                            imageUrl 
                        });
                    }
                } catch (e) {
                    console.log("Error parsing anime item: " + e);
                }
            });
        }

        // Check pagination
        var paginations = body.select(".pagination > li, .pagination a, .page-links a");
        var hasNextPage = false;
        
        if (paginations.length > 0) {
            var lastPageItem = paginations[paginations.length - 1];
            hasNextPage = !lastPageItem.className?.includes("active") && 
                         !lastPageItem.className?.includes("disabled") &&
                         lastPageItem.text?.toLowerCase().includes("next");
        }

        return { 
            list, 
            hasNextPage 
        };
    }

    async getPopular(page) {
        var types = this.getPreference("animekai_popular_latest_type");
        return await this.searchPage({ 
            sort: "trending", 
            type: types, 
            page: page 
        });
    }

    async getLatestUpdates(page) {
        var types = this.getPreference("animekai_popular_latest_type");
        return await this.searchPage({ 
            sort: "updated_date", 
            type: types, 
            page: page 
        });
    }

    async search(query, page, filters) {
        function getFilter(state) {
            var rd = [];
            if (state) {
                state.forEach(item => {
                    if (item.state) {
                        rd.push(item.value);
                    }
                });
            }
            return rd;
        }
        
        var type = filters && filters.length > 0 ? getFilter(filters[0].state) : [];
        var genre = filters && filters.length > 1 ? getFilter(filters[1].state) : [];
        var status = filters && filters.length > 2 ? getFilter(filters[2].state) : [];
        var sort = filters && filters.length > 3 ? filters[3].values[filters[3].state].value : "";
        var season = filters && filters.length > 4 ? getFilter(filters[4].state) : [];
        var year = filters && filters.length > 5 ? getFilter(filters[5].state) : [];
        var rating = filters && filters.length > 6 ? getFilter(filters[6].state) : [];
        var country = filters && filters.length > 7 ? getFilter(filters[7].state) : [];
        var language = filters && filters.length > 8 ? getFilter(filters[8].state) : [];
        
        return await this.searchPage({ 
            query, 
            type, 
            genre, 
            status, 
            sort, 
            season, 
            year, 
            rating, 
            country, 
            language, 
            page 
        });
    }

    async getDetail(url) {
        function statusCode(status) {
            return {
                "Releasing": 0,
                "Completed": 1,
                "Not Yet Aired": 4,
            }[status] ?? 5;
        }

        var slug = url;
        var link = this.getBaseUrl() + slug;
        var body = await this.getPage(slug);

        // Try multiple main section selectors
        var mainSectionSelectors = [
            ".watch-section",
            ".anime-detail",
            ".detail",
            ".main-content",
            ".anime-info"
        ];

        var mainSection = null;
        for (var selector of mainSectionSelectors) {
            mainSection = body.selectFirst(selector);
            if (mainSection) break;
        }

        if (!mainSection) return null;

        // Try multiple image selectors
        var imageElement = null;
        var imageSelectors = [
            "div.poster img",
            ".thumb img",
            "img.poster",
            ".cover img",
            "img.cover"
        ];

        for (var selector of imageSelectors) {
            imageElement = mainSection.selectFirst(selector);
            if (imageElement) break;
        }

        var imageUrl = imageElement?.getSrc || 
                     imageElement?.attr("data-src") || 
                     "";

        // Get title
        var namePref = this.getPreference("animekai_title_lang");
        var nameSection = null;
        var nameSelectors = [
            "div.title",
            ".info h1",
            "h1.title",
            ".anime-title",
            "h1.name"
        ];

        for (var selector of nameSelectors) {
            nameSection = mainSection.selectFirst(selector);
            if (nameSection) break;
        }

        var name = namePref.includes("jp") ? 
            (nameSection?.attr(namePref) || nameSection?.text) : 
            (nameSection?.text || "No title");

        // Get description
        var descriptionSelectors = [
            "div.desc",
            ".description",
            ".synopsis",
            ".summary",
            ".plot"
        ];

        var description = "No description";
        for (var selector of descriptionSelectors) {
            var descElement = mainSection.selectFirst(selector);
            if (descElement) {
                description = descElement.text || description;
                break;
            }
        }

        // Get details
        var detailSelectors = [
            "div.detail > div",
            ".meta div",
            ".info div",
            ".details div",
            ".anime-meta"
        ];

        var detailSection = [];
        for (var selector of detailSelectors) {
            var found = mainSection.select(selector);
            if (found.length > 0) {
                detailSection = found;
                break;
            }
        }

        var genre = [];
        var status = 5;
        detailSection.forEach(item => {
            var itemText = item.text.trim();
            if (itemText.match(/Genres?:?/i)) {
                genre = itemText.replace(/Genres?:?\s*/i, "")
                               .split(/,| /)
                               .filter(g => g.trim());
            }
            if (itemText.includes("Status")) {
                var statusText = item.selectFirst("span")?.text;
                if (statusText) status = statusCode(statusText);
            }
        });

        // Get Anify information
        var anifyInfo = {};
        try {
            var anifySectionSelectors = [
                ".anify-info",
                "[data-mal-id]",
                ".anime-external"
            ];

            var anifySection = null;
            for (var selector of anifySectionSelectors) {
                anifySection = body.selectFirst(selector);
                if (anifySection) break;
            }

            if (anifySection) {
                anifyInfo = {
                    malId: anifySection.attr("data-mal-id") || "",
                    anilistId: anifySection.attr("data-anilist-id") || "",
                    kitsuId: anifySection.attr("data-kitsu-id") || "",
                    type: anifySection.attr("data-type") || "",
                    format: anifySection.attr("data-format") || "",
                    season: anifySection.attr("data-season") || "",
                    year: anifySection.attr("data-year") || "",
                    status: anifySection.attr("data-status") || "",
                    episodes: anifySection.attr("data-episodes") || "",
                    duration: anifySection.attr("data-duration") || "",
                    countryOfOrigin: anifySection.attr("data-country-of-origin") || "",
                    source: anifySection.attr("data-source") || "",
                    coverImage: anifySection.attr("data-cover-image") || "",
                    bannerImage: anifySection.attr("data-banner-image") || "",
                    popularity: anifySection.attr("data-popularity") || "",
                    averageScore: anifySection.attr("data-average-score") || "",
                    meanScore: anifySection.attr("data-mean-score") || "",
                    synonyms: anifySection.attr("data-synonyms") || ""
                };
            }
        } catch (e) {
            console.log("Error getting Anify info: " + e);
        }

        // Get episodes
        var chapters = [];
        var animeRatingSelectors = [
            "#anime-rating",
            "[data-id]",
            ".anime-id"
        ];

        var animeRating = null;
        for (var selector of animeRatingSelectors) {
            animeRating = body.selectFirst(selector);
            if (animeRating) break;
        }

        if (!animeRating) {
            return { 
                name, 
                imageUrl, 
                link, 
                description, 
                genre, 
                status, 
                chapters,
                anifyInfo 
            };
        }

        var animeId = animeRating.attr("data-id");
        if (!animeId) {
            return { 
                name, 
                imageUrl, 
                link, 
                description, 
                genre, 
                status, 
                chapters,
                anifyInfo 
            };
        }

        var token = await this.kaiEncrypt(animeId);
        var res = await this.request(`/ajax/episodes/list?ani_id=${animeId}&_=${token}`);
        var episodeData = JSON.parse(res);
        
        if (episodeData.status == 200) {
            var doc = new Document(episodeData["result"]);
            
            var episodesListSelectors = [
                "div.eplist.titles",
                ".episode-list",
                ".episodes",
                ".server-list"
            ];

            var episodesList = null;
            for (var selector of episodesListSelectors) {
                episodesList = doc.selectFirst(selector);
                if (episodesList) break;
            }

            if (episodesList) {
                var episodeSelectors = [
                    "li",
                    ".episode-item",
                    ".episode"
                ];

                var episodes = [];
                for (var selector of episodeSelectors) {
                    var found = episodesList.select(selector);
                    if (found.length > 0) {
                        episodes = found;
                        break;
                    }
                }

                var showUncenEp = this.getPreference("animekai_show_uncen_epsiodes");

                for (var item of episodes) {
                    var aTag = item.selectFirst("a");
                    if (!aTag) continue;

                    var num = parseInt(aTag.attr("num") || 
                              aTag.text.match(/\d+/)?.[0] || 
                              0);
                    var title = aTag.selectFirst("span")?.text || "";
                    title = title.includes("Episode") ? "" : `: ${title}`;
                    var epName = `Episode ${num}${title}`;

                    var langs = aTag.attr("langs") || "1";
                    var scanlator = langs === "1" ? "SUB" : "SUB, DUB";

                    var token = aTag.attr("token") || aTag.attr("data-id") || "";
                    if (!token) continue;

                    var epData = {
                        name: epName,
                        url: token,
                        scanlator
                    };

                    var slug = aTag.attr("slug") || "";
                    if (slug.includes("uncen")) {
                        if (!showUncenEp) continue;

                        scanlator += ", UNCENSORED";
                        epName = `Episode ${num}: (Uncensored)`;
                        epData = {
                            name: epName,
                            url: token,
                            scanlator
                        };

                        var exData = chapters[num - 1];
                        if (exData) {
                            exData.url += "||" + epData.url;
                            exData.scanlator += ", " + epData.scanlator;
                            chapters[num - 1] = exData;
                            continue;
                        }
                    }
                    chapters.push(epData);
                }
            }
        }
        
        chapters.reverse();
        return { 
            name, 
            imageUrl, 
            link, 
            description, 
            genre, 
            status, 
            chapters,
            anifyInfo 
        };
    }

    async getVideoList(url) {
        var streams = [];
        var prefServer = this.getPreference("animekai_pref_stream_server");
        if (prefServer.length < 1) prefServer.push("1");

        var prefDubType = this.getPreference("animekai_pref_stream_subdub_type");
        if (prefDubType.length < 1) prefDubType.push("sub");

        var epSlug = url.split("||");

        var isUncensoredVersion = false;
        for (var epId of epSlug) {
            var token = await this.kaiEncrypt(epId);
            var res = await this.request(`/ajax/links/list?token=${epId}&_=${token}`);
            var body = JSON.parse(res);
            if (body.status != 200) continue;

            var serverResult = new Document(body.result);

            var SERVERDATA = [];
            var server_items = serverResult.select("div.server-items");

            for (var dubSection of server_items) {
                var dubType = dubSection.attr("data-id");
                if (!prefDubType.includes(dubType)) continue;

                for (var ser of dubSection.select("span.server")) {
                    var serverName = ser.text;
                    if (!prefServer.includes(serverName.replace("Server ", ""))) continue;

                    var dataId = ser.attr("data-lid");
                    SERVERDATA.push({
                        serverName,
                        dataId,
                        dubType
                    });
                }
            }

            for (var serverData of SERVERDATA) {
                var serverName = serverData.serverName;
                var dataId = serverData.dataId;
                var dubType = serverData.dubType.toUpperCase();
                dubType = dubType == "SUB" ? "HARDSUB" : dubType;
                dubType = isUncensoredVersion ? `${dubType} [Uncensored]` : dubType;

                var megaUrl = await this.getMegaUrl(dataId);
                var serverStreams = await this.decryptMegaEmbed(megaUrl, serverName, dubType);
                streams = [...streams, ...serverStreams];

                if (dubType.includes("DUB")) {
                    if (!megaUrl.includes("sub.list=")) continue;
                    var subList = megaUrl.split("sub.list=")[1];

                    var subres = await this.client.get(subList);
                    var subtitles = JSON.parse(subres.body);
                    var subs = this.formatSubtitles(subtitles, dubType);
                    streams[streams.length - 1].subtitles = subs;
                }
            }
            isUncensoredVersion = true;
        }

        return streams;
    }

    getFilterList() {
        function formateState(type_name, items, values) {
            var state = [];
            for (var i = 0; i < items.length; i++) {
                state.push({ type_name: type_name, name: items[i], value: values[i] });
            }
            return state;
        }

        var filters = [];

        var items = ["TV", "Special", "OVA", "ONA", "Music", "Movie"];
        var values = ["tv", "special", "ova", "ona", "music", "movie"];
        filters.push({
            type_name: "GroupFilter",
            name: "Types",
            state: formateState("CheckBox", items, values)
        });

        items = [
            "Action", "Adventure", "Avant Garde", "Boys Love", "Comedy", "Demons", "Drama", "Ecchi", "Fantasy",
            "Girls Love", "Gourmet", "Harem", "Horror", "Isekai", "Iyashikei", "Josei", "Kids", "Magic",
            "Mahou Shoujo", "Martial Arts", "Mecha", "Military", "Music", "Mystery", "Parody", "Psychological",
            "Reverse Harem", "Romance", "School", "Sci-Fi", "Seinen", "Shoujo", "Shounen", "Slice of Life",
            "Space", "Sports", "Super Power", "Supernatural", "Suspense", "Thriller", "Vampire"
        ];

        values = [
            "47", "1", "235", "184", "7", "127", "66", "8", "34", "926", "436", "196", "421", "77", "225",
            "555", "35", "78", "857", "92", "219", "134", "27", "48", "356", "240", "798", "145", "9", "36",
            "189", "183", "37", "125", "220", "10", "350", "49", "322", "241", "126"
        ];

        filters.push({
            type_name: "GroupFilter",
            name: "Genres",
            state: formateState("CheckBox", items, values)
        });

        items = ["Not Yet Aired", "Releasing", "Completed"];
        values = ["info", "releasing", "completed"];
        filters.push({
            type_name: "GroupFilter",
            name: "Status",
            state: formateState("CheckBox", items, values)
        });

        items = [
            "All", "Updated date", "Released date", "End date", "Added date", "Trending",
            "Name A-Z", "Average score", "MAL score", "Total views", "Total bookmarks", "Total episodes"
        ];

        values = [
            "", "updated_date", "released_date", "end_date", "added_date", "trending",
            "title_az", "avg_score", "mal_score", "total_views", "total_bookmarks", "total_episodes"
        ];
        filters.push({
            type_name: "SelectFilter",
            name: "Sort by",
            state: 0,
            values: formateState("SelectOption", items, values)
        });

        items = ["Fall", "Summer", "Spring", "Winter", "Unknown"];
        values = ["fall", "summer", "spring", "winter", "unknown"];
        filters.push({
            type_name: "GroupFilter",
            name: "Season",
            state: formateState("CheckBox", items, values)
        });

        const currentYear = new Date().getFullYear();
        var years = Array.from({ length: currentYear - 1999 }, (_, i) => (2000 + i).toString()).reverse();
        items = [...years, "1990s", "1980s", "1970s", "1960s", "1950s", "1940s", "1930s", "1920s", "1910s", "1900s"];
        filters.push({
            type_name: "GroupFilter",
            name: "Years",
            state: formateState("CheckBox", items, items)
        });

        items = [
            "G - All Ages",
            "PG - Children",
            "PG 13 - Teens 13 and Older",
            "R - 17+, Violence & Profanity",
            "R+ - Profanity & Mild Nudity",
            "Rx - Hentai"
        ];

        values = ["g", "pg", "pg_13", "r", "r+", "rx"];
        filters.push({
            type_name: "GroupFilter",
            name: "Ratings",
            state: formateState("CheckBox", items, items)
        });

        items = ["Japan", "China"];
        values = ["11", "2"];
        filters.push({
            type_name: "GroupFilter",
            name: "Country",
            state: formateState("CheckBox", items, items)
        });

        items = ["Hard Sub", "Soft Sub", "Dub", "Sub & Dub"];
        values = ["sub", "softsub", "dub", "subdub"];
        filters.push({
            type_name: "GroupFilter",
            name: "Language",
            state: formateState("CheckBox", items, items)
        });

        return filters;
    }

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
                    summary: 'Choose which type of anime you want to see in the popular &latest section',
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

    formatSubtitles(subtitles, dubType) {
        var subs = [];
        subtitles.forEach(sub => {
            if (!sub.kind.includes("thumbnail")) {
                subs.push({
                    file: sub.file,
                    label: `${sub.label} - ${dubType}`
                });
            }
        });
        return subs;
    }

    async formatStreams(sUrl, serverName, dubType) {
        function streamNamer(res) {
            return `${res} - ${dubType} : ${serverName}`;
        }

        var streams = [{
            url: sUrl,
            originalUrl: sUrl,
            quality: streamNamer("Auto")
        }];

        var pref = this.getPreference("animekai_pref_extract_streams");
        if (!pref) return streams;

        var baseUrl = sUrl.split("/list.m3u8")[0].split("/list,")[0];

        const response = await new Client().get(sUrl);
        const body = response.body;
        const lines = body.split('\n');

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
                var resolution = lines[i].match(/RESOLUTION=(\d+x\d+)/)[1];
                var qUrl = lines[i + 1].trim();
                var m3u8Url = `${baseUrl}/${qUrl}`;
                streams.push({
                    url: m3u8Url,
                    originalUrl: m3u8Url,
                    quality: streamNamer(resolution)
                });
            }
        }
        return streams;
    }

    async getMegaUrl(vidId) {
        var token = await this.kaiEncrypt(vidId);
        var res = await this.request(`/ajax/links/view?id=${vidId}&_=${token}`);
        var body = JSON.parse(res);
        if (body.status != 200) return;
        var outEnc = body.result;
        var out = await this.kaiDecrypt(outEnc);
        var o = JSON.parse(out);
        return decodeURIComponent(o.url);
    }

    async decryptMegaEmbed(megaUrl, serverName, dubType) {
        var streams = [];
        megaUrl = megaUrl.replace("/e/", "/media/");
        var res = await this.client.get(megaUrl);
        var body = JSON.parse(res.body);
        if (body.status != 200) return;
        var outEnc = body.result;
        var streamData = await this.megaDecrypt(outEnc);
        var url = streamData.sources[0].file;

        var streams = await this.formatStreams(url, serverName, dubType);

        var subtitles = streamData.tracks;
        streams[0].subtitles = this.formatSubtitles(subtitles, dubType);
        return streams;
    }

    base64UrlDecode(input) {
        let base64 = input
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        while (base64.length % 4 !== 0) {
            base64 += "=";
        }

        const base64abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        const outputBytes = [];

        for (let i = 0; i < base64.length; i += 4) {
            const c1 = base64abc.indexOf(base64[i]);
            const c2 = base64abc.indexOf(base64[i + 1]);
            const c3 = base64abc.indexOf(base64[i + 2]);
            const c4 = base64abc.indexOf(base64[i + 3]);

            const triplet = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);

            outputBytes.push((triplet >> 16) & 0xFF);
            if (base64[i + 2] !== "=") outputBytes.push((triplet >> 8) & 0xFF);
            if (base64[i + 3] !== "=") outputBytes.push(triplet & 0xFF);
        }

        return String.fromCharCode(...outputBytes);
    }

    base64UrlEncode(str) {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i) & 0xFF);
        }

        const base64abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

        let base64 = "";
        for (let i = 0; i < bytes.length; i += 3) {
            const b1 = bytes[i];
            const b2 = bytes[i + 1] ?? 0;
            const b3 = bytes[i + 2] ?? 0;

            const triplet = (b1 << 16) | (b2 << 8) | b3;

            base64 += base64abc[(triplet >> 18) & 0x3F];
            base64 += base64abc[(triplet >> 12) & 0x3F];
            base64 += i + 1 < bytes.length ? base64abc[(triplet >> 6) & 0x3F] : "=";
            base64 += i + 2 < bytes.length ? base64abc[triplet & 0x3F] : "=";
        }

        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    transform(key, text) {
        const v = Array.from({ length: 256 }, (_, i) => i);
        let c = 0;
        const f = [];

        for (let w = 0; w < 256; w++) {
            c = (c + v[w] + key.charCodeAt(w % key.length)) % 256;
            [v[w], v[c]] = [v[c], v[w]];
        }

        let a = 0, w = 0, sum = 0;
        while (a < text.length) {
            w = (w + 1) % 256;
            sum = (sum + v[w]) % 256;
            [v[w], v[sum]] = [v[sum], v[w]];
            f.push(String.fromCharCode(text.charCodeAt(a) ^ v[(v[w] + v[sum]) % 256]));
            a++;
        }
        return f.join('');
    }

    reverseString(input) {
        return input.split('').reverse().join('');
    }

    substitute(input, keys, values) {
        const map = {};
        for (let i = 0; i < keys.length; i++) {
            map[keys[i]] = values[i] || keys[i];
        }
        return input.split('').map(char => map[char] || char).join('');
    }

    async getDecoderPattern() {
        const preferences = new SharedPreferences();
        let pattern = preferences.getString("anime_kai_decoder_pattern", "");
        var pattern_ts = parseInt(preferences.getString("anime_kai_decoder_pattern_ts", "0"));
        var now_ts = parseInt(new Date().getTime() / 1000);

        if (now_ts - pattern_ts > 30 * 60) {
            var res = await this.client.get("https://raw.githubusercontent.com/amarullz/kaicodex/refs/heads/main/generated/kai_codex.json");
            pattern = res.body;
            preferences.setString("anime_kai_decoder_pattern", pattern);
            preferences.setString("anime_kai_decoder_pattern_ts", `${now_ts}`);
        }

        return JSON.parse(pattern);
    }

    async patternExecutor(key, type, id) {
        var result = id;
        var pattern = await this.getDecoderPattern();
        var logic = pattern[key][type];
        logic.forEach(step => {
            var method = step[0];
            if (method == "urlencode") result = encodeURIComponent(result);
            else if (method == "urldecode") result = decodeURIComponent(result);
            else if (method == "rc4") result = this.transform(step[1], result);
            else if (method == "reverse") result = this.reverseString(result);
            else if (method == "substitute") result = this.substitute(result, step[1], step[2]);
            else if (method == "safeb64_decode") result = this.base64UrlDecode(result);
            else if (method == "safeb64_encode") result = this.base64UrlEncode(result);
        });
        return result;
    }

    async kaiEncrypt(id) {
        var token = await this.patternExecutor("kai", "encrypt", id);
        return token;
    }

    async kaiDecrypt(id) {
        var token = await this.patternExecutor("kai", "decrypt", id);
        return token;
    }

    async megaDecrypt(data) {
        var streamData = await this.patternExecutor("megaup", "decrypt", data);
        return JSON.parse(streamData);
    }
}
