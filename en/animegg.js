/**
* AnimeGG - English
*/
async function getAnimeGGStreams({ fetch, cheerio, html, episodeId }) {
    const $ = cheerio.load(html);
    const script = $("script").toArray().find((el) => $(el).text().includes("sources"));
    const { sources } = JSON.parse($(script).text().match(/{[^]*}/)[0]);
    
    const streams = sources.map((source) => ({
        file: source.file,
        type: source.type || "hls",
        quality: source.label,
    }));

    return { streams };
}

async function getAnimeGGInfo({ fetch, cheerio, html }) {
    const $ = cheerio.load(html);
    const title = $(".single-anime-desktop h1").text().trim();
    const description = $(".anime-synopsis").text().trim();
    const poster = $(".anime-poster img").attr("src");
    
    const episodes = [];
    $(".episodes-range li a").each((i, el) => {
        episodes.push({
            id: $(el).attr("href").split("/").pop(),
            number: parseInt($(el).text().trim()),
            title: `Episode ${$(el).text().trim()}`,
        });
    });
    
    return { title, description, poster, episodes };
}

async function getAnimeGGEpisodeList({ fetch, cheerio, baseUrl, id }) {
    const url = `${baseUrl}/anime/${id}`;
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const episodes = [];
    $(".episodes-range li a").each((i, el) => {
        episodes.push({
            id: $(el).attr("href").split("/").pop(),
            number: parseInt($(el).text().trim()),
            title: `Episode ${$(el).text().trim()}`,
        });
    });
    
    return { episodes };
}

async function getAnimeGGSearch({ fetch, cheerio, keyword, baseUrl }) {
    const url = `${baseUrl}/?s=${encodeURIComponent(keyword)}`;
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const results = [];
    $(".anime-card").each((i, el) => {
        results.push({
            id: $(el).find("a").attr("href").split("/").pop(),
            title: $(el).find(".anime-title").text().trim(),
            poster: $(el).find("img").attr("src"),
        });
    });
    
    return { results };
}

module.exports = {
    getAnimeGGStreams,
    getAnimeGGInfo,
    getAnimeGGEpisodeList,
    getAnimeGGSearch,
    version: "0.0.1",
    lang: "en",
    name: "animegg",
    icon: "https://animegg.org/wp-content/uploads/2021/06/cropped-favicon-32x32.png",
    class: "anime",
};
