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
        return this.getPreference("animekai_base_url") || "https://animekai.to"; // Default base URL
    }

    async request(slug) {
        let url = slug;
        const baseUrl = this.getBaseUrl();
        if (!slug.includes(baseUrl)) url = baseUrl + slug;
        const res = await this.client.get(url);
        return res.body;
    }

    async getPage(slug) {
        const res = await this.request(slug);
        return new Document(res);
    }

    async searchPage({ query = "", type = [], genre = [], status = [], sort = "", season = [], year = [], rating = [], country = [], language = [], page = 1 } = {}) {
        const bundleSlug = (category, items) => {
            return items.map(item => `&${category}[]=${item.toLowerCase()}`).join('');
        };

        let slug = "/browser?";
        slug += "keyword=" + query;
        slug += bundleSlug("type", type);
        slug += bundleSlug("genre", genre);
        slug += bundleSlug("status", status);
        slug += bundleSlug("season", season);
        slug += bundleSlug("year", year);
        slug += bundleSlug("rating", rating);
        slug += bundleSlug("country", country);
        slug += bundleSlug("language", language);
        sort = sort.length < 1 ? "updated_date" : sort; // Default sort is updated date
        slug += "&sort=" + sort;
        slug += `&page=${page}`;

        const list = [];
        const body = await this.getPage(slug);
        const paginations = body.select(".pagination > li");
        const hasNextPage = paginations.length > 0 ? !paginations[paginations.length - 1].className.includes("active") : false;

        const titlePref = this.getPreference("animekai_title_lang");
        const animes = body.selectFirst(".aitem-wrapper").select(".aitem");
        animes.forEach(anime => {
            const link = anime.selectFirst("a").getHref;
            const imageUrl = anime.selectFirst("img").attr("data-src");
            const name = anime.selectFirst("a.title").attr(titlePref);
            list.push({ name, link, imageUrl });
        });

        return { list, hasNextPage };
    }

    async getPopular(page) {
        const types = this.getPreference("animekai_popular_latest_type");
        return await this.searchPage({ sort: "trending", type: types, page: page });
    }

    async getLatestUpdates(page) {
        const types = this.getPreference("animekai_popular_latest_type");
        return await this.searchPage({ sort: "updated_date", type: types, page: page });
    }

    async search(query, page, filters) {
        const getFilter = (state) => state.filter(item => item.state).map(item => item.value);
        const isFiltersAvailable = !filters || filters.length !== 0;
        const type = isFiltersAvailable ? getFilter(filters[0].state) : [];
        const genre = isFiltersAvailable ? getFilter(filters[1].state) : [];
        const status = isFiltersAvailable ? getFilter(filters[2].state) : [];
        const sort = isFiltersAvailable ? filters[3].values[filters[3].state].value : "";
        const season = isFiltersAvailable ? getFilter(filters[4].state) : [];
        const year = isFiltersAvailable ? getFilter(filters[5].state) : [];
        const rating = isFiltersAvailable ? getFilter(filters[6].state) : [];
        const country = isFiltersAvailable ? getFilter(filters[7].state) : [];
        const language = isFiltersAvailable ? getFilter(filters[8].state) : [];
        return await this.searchPage({ query, type, genre, status, sort, season, year, rating, country, language, page });
    }

    async getDetail(url) {
        const statusCode = (status) => {
            return {
                "Releasing": 0,
                "Completed": 1,
                "Not Yet Aired": 4,
            }[status] ?? 5;
        };

        const slug = url;
        const link = this.getBaseUrl() + slug;
        const body = await this.getPage(slug);
        const mainSection = body.selectFirst(".watch-section");

        const imageUrl = mainSection.selectFirst("div.poster").selectFirst("img").getSrc;
        const namePref = this.getPreference("animekai_title_lang");
        const nameSection = mainSection.selectFirst("div.title");
        const name = namePref.includes("jp") ? nameSection.attr(namePref) : nameSection.text;
        const description = mainSection.selectFirst("div.desc").text;

        const detailSection = mainSection.select("div.detail > div");
        let genre = [];
        let status = 5;
        detailSection.forEach(item => {
            const itemText = item.text.trim();
            if (itemText.includes("Genres")) {
                genre = itemText.replace("Genres:  ", "").split(", ");
            }
            if (itemText.includes("Status")) {
                const statusText = item.selectFirst("span").text;
                status = statusCode(statusText);
            }
        });

        const chapters = [];
        const animeId = body.selectFirst("#anime-rating").attr("data-id");
        const token = await this.kaiEncrypt(animeId);
        const res = await this.request(`/ajax/episodes/list?ani_id=${animeId}&_=${token}`);
        const responseBody = JSON.parse(res);
        if (responseBody.status === 200) {
            const doc = new Document(responseBody["result"]);
            const episodes = doc.selectFirst("div.eplist.titles").select("li");
            const showUncenEp = this.getPreference("animekai_show_uncen_epsiodes");

            for (const item of episodes) {
                const aTag = item.selectFirst("a");
                const num = parseInt(aTag.attr("num"));
                let title = aTag.selectFirst("span").text;
                title = title.includes("Episode") ? "" : `: ${title}`;
                let epName = `Episode ${num}${title}`;
                const langs = aTag.attr("langs");
                let scanlator = langs === "1" ? "SUB" : "SUB, DUB";
                const token = aTag.attr("token");

                let epData = {
                    name: epName,
                    url: token,
                    scanlator
                };

                // Check if the episode is uncensored
                const slug = aTag.attr("slug");
                if (slug.includes("uncen")) {
                    // If don't show uncensored episodes, skip this episode
                    if (!showUncenEp) continue;

                    scanlator += ", UNCENSORED";
                    epName = `Episode ${num}: (Uncensored)`;
                    epData = {
                        name: epName,
                        url: token,
                        scanlator
                    };

                    // Check if the episode already exists as censored if so, add to existing data
                    const exData = chapters[num - 1];
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
        chapters.reverse();
        return { name, imageUrl, link, description, genre, status, chapters };
    }

    async getVideoList(url) {
        let streams = [];
        const prefServer = this.getPreference("animekai_pref_stream_server") || ["1"]; // Default to server 1
        const prefDubType = this.getPreference("animekai_pref_stream_subdub_type") || ["sub"]; // Default to sub

        const epSlug = url.split("||");
        let isUncensoredVersion = false;

        for (const epId of epSlug) {
            const token = await this.kaiEncrypt(epId);
            const res = await this.request(`/ajax/links/list?token=${epId}&_=${token}`);
            const body = JSON.parse(res);
            if (body.status !== 200) continue;

            const serverResult = new Document(body.result);
            const SERVERDATA = [];
            const server_items = serverResult.select("div.server-items");

            for (const dubSection of server_items) {
                const dubType = dubSection.attr("data-id");
                if (!prefDubType.includes(dubType)) continue;

                for (const ser of dubSection.select("span.server")) {
                    const serverName = ser.text;
                    if (!prefServer.includes(serverName.replace("Server ", ""))) continue;

                    const dataId = ser.attr("data-lid");
                    SERVERDATA.push({
                        serverName,
                        dataId,
                        dubType
                    });
                }
            }

            for (const serverData of SERVERDATA) {
                const serverName = serverData.serverName;
                const dataId = serverData.dataId;
                let dubType = serverData.dubType.toUpperCase();
                dubType = dubType === "SUB" ? "HARDSUB" : dubType;
                dubType = isUncensoredVersion ? `${dubType} [Uncensored]` : dubType;

                const megaUrl = await this.getMegaUrl(dataId);
                const serverStreams = await this.decryptMegaEmbed(megaUrl, serverName, dubType);
                streams = [...streams, ...serverStreams];

                // Dubs have subtitles separately, so we need to fetch them too
                if (dubType.includes("DUB")) {
                    if (!megaUrl.includes("sub.list=")) continue;
                    const subList = megaUrl.split("sub.list=")[1];
                    const subres = await this.client.get(subList);
                    const subtitles = JSON.parse(subres.body);
                    const subs = this.formatSubtitles(subtitles, dubType);
                    streams[streams.length - 1].subtitles = subs;
                }
            }
            isUncensoredVersion = true; // The 2nd time the loop runs it's for uncensored version
        }

        return streams;
    }

    getFilterList() {
        const formateState = (type_name, items, values) => {
            return items.map((item, i) => ({ type_name: type_name, name: item, value: values[i] }));
        };

        const filters = [];

        // Types
        const items = ["TV", "Special", "OVA", "ONA", "Music", "Movie"];
        const values = ["tv", "special", "ova", "ona", "music", "movie"];
        filters.push({
            type_name: "GroupFilter",
            name: "Types",
            state: formateState("CheckBox", items, values)
        });

        // Genre
        const genreItems = [
            "Action", "Adventure", "Avant Garde", "Boys Love", "Comedy", "Demons", "Drama", "Ecchi", "Fantasy",
            "Girls Love", "Gourmet", "Harem", "Horror", "Isekai", "Iyashikei", "Josei", "Kids", "Magic",
            "Mahou Shoujo", "Martial Arts", "Mecha", "Military", "Music", "Mystery", "Parody", "Psychological",
            "Reverse Harem", "Romance", "School", "Sci-Fi", "Seinen", "Shoujo", "Shounen", "Slice of Life",
            "Space", "Sports", "Super Power", "Supernatural", "Suspense", "Thriller", "Vampire"
        ];
        const genreValues = [
            "47", "1", "235", "184", "7", "127", "66", "8", "34", "926", "436", "196", "421", "77", "225",
            "555", "35", "78", "857", "92", "219", "134", "27", "48", "356", "240", "798", "145", "9", "36",
            "189", "183", "37", "125", "220", "10", "350", "49", "322", "241", "126"
        ];
        filters.push({
            type_name: "GroupFilter",
            name: "Genres",
            state: formateState("CheckBox", genreItems, genreValues)
        });

        // Status
        const statusItems = ["Not Yet Aired", "Releasing", "Completed"];
        const statusValues = ["info", "releasing", "completed"];
        filters.push({
            type_name: "GroupFilter",
            name: "Status",
            state: formateState("CheckBox", statusItems, statusValues)
        });

        // Sort
        const sortItems = [
            "All", "Updated date", "Released date", "End date", "Added date", "Trending",
            "Name A-Z", "Average score", "MAL score", "Total views", "Total bookmarks", "Total episodes"
        ];
        const sortValues = [
            "", "updated_date", "released_date", "end_date", "added_date", "trending",
            "title_az", "avg_score", "mal_score", "total_views", "total_bookmarks", "total_episodes"
        ];
        filters.push({
            type_name: "SelectFilter",
            name: "Sort by",
            state: 0,
            values: formateState("SelectOption", sortItems, sortValues)
        });

        // Season
        const seasonItems = ["Fall", "Summer", "Spring", "Winter", "Unknown"];
        const seasonValues = ["fall", "summer", "spring", "winter", "unknown"];
        filters.push({
            type_name: "GroupFilter",
            name: "Season",
            state: formateState("CheckBox", seasonItems, seasonValues)
        });

        // Years
        const currentYear = new Date().getFullYear();
        const years = Array.from({ length: currentYear - 1999 }, (_, i) => (2000 + i).toString()).reverse();
        const yearItems = [...years, "1990s", "1980s", "1970s", "1960s", "1950s", "1940s", "1930s", "1920s", "1910s", "1900s"];
        filters.push({
            type_name: "GroupFilter",
            name: "Years",
            state: formateState("CheckBox", yearItems, yearItems)
        });

        // Ratings
        const ratingItems = [
            "G - All Ages",
            "PG - Children",
            "PG 13 - Teens 13 and Older",
            "R - 17+, Violence & Profanity",
            "R+ - Profanity & Mild Nudity",
            "Rx - Hentai"
        ];
        const ratingValues = ["g", "pg", "pg_13", "r", "r+", "rx"];
        filters.push({
            type_name: "GroupFilter",
            name: "Ratings",
            state: formateState("CheckBox", ratingItems, ratingValues)
        });

        return filters;
    }
}
