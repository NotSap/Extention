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

    // WORKING SEARCH FUNCTION (FROM YOUR SECOND CODE)
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

    // DETAIL FETCHING FROM YOUR FIRST 700+ LINE CODE
    async getDetail(url) {
        function statusCode(status) {
            return {
                "Releasing": 0,
                "Completed": 1,
                "Not Yet Aired": 4,
            }[status] ?? 5;
        }

        try {
            var slug = url;
            var link = this.getBaseUrl() + slug;
            var body = await this.getPage(slug);
            if (!body) return null;

            var mainSection = body.selectFirst(".watch-section");
            if (!mainSection) return null;

            var imageUrl = mainSection.selectFirst("div.poster")?.selectFirst("img")?.getSrc;

            var namePref = this.getPreference("animekai_title_lang") || "title";
            var nameSection = mainSection.selectFirst("div.title");
            var name = namePref.includes("jp") ? nameSection?.attr(namePref) : nameSection?.text;

            var description = mainSection.selectFirst("div.desc")?.text;

            var detailSection = mainSection.select("div.detail > div") || [];

            var genre = [];
            var status = 5;
            detailSection.forEach(item => {
                var itemText = item.text.trim();
                if (itemText.includes("Genres")) {
                    genre = itemText.replace("Genres:  ", "").split(", ");
                }
                if (itemText.includes("Status")) {
                    var statusText = item.selectFirst("span")?.text;
                    status = statusCode(statusText);
                }
            });

            var chapters = [];
            var animeId = body.selectFirst("#anime-rating")?.attr("data-id");
            if (animeId) {
                var token = await this.kaiEncrypt(animeId);
                var res = await this.request(`/ajax/episodes/list?ani_id=${animeId}&_=${token}`);
                if (res) {
                    body = JSON.parse(res);
                    if (body.status == 200) {
                        var doc = new Document(body["result"]);
                        var episodes = doc.selectFirst("div.eplist.titles")?.select("li") || [];
                        var showUncenEp = this.getPreference("animekai_show_uncen_epsiodes");

                        for (var item of episodes) {
                            var aTag = item.selectFirst("a");
                            if (!aTag) continue;

                            var num = parseInt(aTag.attr("num"));
                            var title = aTag.selectFirst("span")?.text;
                            title = title?.includes("Episode") ? "" : `: ${title}`;
                            var epName = `Episode ${num}${title}`;

                            var langs = aTag.attr("langs");
                            var scanlator = langs === "1" ? "SUB" : "SUB, DUB";
                            var token = aTag.attr("token");

                            var epData = {
                                name: epName,
                                url: token,
                                scanlator
                            };

                            var slug = aTag.attr("slug");
                            if (slug?.includes("uncen")) {
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
            }
            chapters.reverse();
            
            return { 
                name, 
                imageUrl, 
                link, 
                description, 
                genre, 
                status, 
                chapters 
            };
        } catch (error) {
            console.error("Failed to get detail:", error);
            return null;
        }
    }

    // VIDEO LIST FETCHING FROM YOUR FIRST 700+ LINE CODE
    async getVideoList(url) {
        try {
            var streams = [];
            var prefServer = this.getPreference("animekai_pref_stream_server") || ["1"];
            var prefDubType = this.getPreference("animekai_pref_stream_subdub_type") || ["sub"];

            var epSlug = url.split("||");

            var isUncensoredVersion = false;
            for (var epId of epSlug) {
                var token = await this.kaiEncrypt(epId);
                var res = await this.request(`/ajax/links/list?token=${epId}&_=${token}`);
                if (!res) continue;

                var body = JSON.parse(res);
                if (body.status != 200) continue;

                var serverResult = new Document(body.result);
                var SERVERDATA = [];
                var server_items = serverResult.select("div.server-items") || [];

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
                    if (!megaUrl) continue;

                    var serverStreams = await this.decryptMegaEmbed(megaUrl, serverName, dubType);
                    streams = [...streams, ...serverStreams];

                    if (dubType.includes("DUB")) {
                        if (!megaUrl.includes("sub.list=")) continue;
                        var subList = megaUrl.split("sub.list=")[1];

                        var subres = await this.client.get(subList);
                        var subtitles = JSON.parse(subres.body);
                        var subs = this.formatSubtitles(subtitles, dubType);
                        if (streams.length > 0) {
                            streams[streams.length - 1].subtitles = subs;
                        }
                    }
                }
                isUncensoredVersion = true;
            }

            return streams;
        } catch (error) {
            console.error("Failed to get video list:", error);
            return [];
        }
    }

    // REMAINING UTILITY FUNCTIONS FROM YOUR FIRST 700+ LINE CODE
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
        if (!res) return null;
        var body = JSON.parse(res);
        if (body.status != 200) return null;
        var outEnc = body.result;
        var out = await this.kaiDecrypt(outEnc);
        var o = JSON.parse(out);
        return decodeURIComponent(o.url);
    }

    async decryptMegaEmbed(megaUrl, serverName, dubType) {
        megaUrl = megaUrl.replace("/e/", "/media/");
        var res = await this.client.get(megaUrl);
        if (!res) return [];
        var body = JSON.parse(res.body);
        if (body.status != 200) return [];
        var outEnc = body.result;
        var streamData = await this.megaDecrypt(outEnc);
        var url = streamData.sources[0].file;

        return await this.formatStreams(url, serverName, dubType);
    }

    // DECODER FUNCTIONS FROM YOUR FIRST 700+ LINE CODE
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
        return await this.patternExecutor("kai", "encrypt", id);
    }

    async kaiDecrypt(id) {
        return await this.patternExecutor("kai", "decrypt", id);
    }

    async megaDecrypt(data) {
        var streamData = await this.patternExecutor("megaup", "decrypt", data);
        return JSON.parse(streamData);
    }

    // FILTER LIST FROM YOUR FIRST 700+ LINE CODE
    getFilterList() {
        function formateState(type_name, items, values) {
            var state = [];
            for (var i = 0; i < items.length; i++) {
                state.push({ type_name: type_name, name: items[i], value: values[i] });
            }
            return state;
        }

        var filters = [];

        // Types
        var items = ["TV", "Special", "OVA", "ONA", "Music", "Movie"];
        var values = ["tv", "special", "ova", "ona", "music", "movie"];
        filters.push({
            type_name: "GroupFilter",
            name: "Types",
            state: formateState("CheckBox", items, values)
        });

        // Genre
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

        // Status
        items = ["Not Yet Aired", "Releasing", "Completed"];
        values = ["info", "releasing", "completed"];
        filters.push({
            type_name: "GroupFilter",
            name: "Status",
            state: formateState("CheckBox", items, values)
        });

        // Sort
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

        // Season
        items = ["Fall", "Summer", "Spring", "Winter", "Unknown"];
        values = ["fall", "summer", "spring", "winter", "unknown"];
        filters.push({
            type_name: "GroupFilter",
            name: "Season",
            state: formateState("CheckBox", items, values)
        });

        // Years
        const currentYear = new Date().getFullYear();
        var years = Array.from({ length: currentYear - 1999 }, (_, i) => (2000 + i).toString()).reverse();
        items = [...years, "1990s", "1980s", "1970s", "1960s", "1950s", "1940s", "1930s", "1920s", "1910s", "1900s"];
        filters.push({
            type_name: "GroupFilter",
            name: "Years",
            state: formateState("CheckBox", items, items)
        });

        // Ratings
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

        // Country
        items = ["Japan", "China"];
        values = ["11", "2"];
        filters.push({
            type_name: "GroupFilter",
            name: "Country",
            state: formateState("CheckBox", items, items)
        });

        // Language
        items = ["Hard Sub", "Soft Sub", "Dub", "Sub & Dub"];
        values = ["sub", "softsub", "dub", "subdub"];
        filters.push({
            type_name: "GroupFilter",
            name: "Language",
            state: formateState("CheckBox", items, items)
        });

        return filters;
    }

    // SETTINGS FROM YOUR FIRST 700+ LINE CODE
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
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
