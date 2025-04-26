const BASE_URL = "https://bestdubbedanime.com";

async function search(query, metadata) {
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const res = await request(searchUrl);
    const doc = new DOMParser().parseFromString(res, "text/html");

    const animeList = [];
    const cards = doc.querySelectorAll(".result-item");

    for (const card of cards) {
        const titleElement = card.querySelector(".post-title a");
        const imgElement = card.querySelector("img");

        if (!titleElement || !imgElement) continue;

        const title = titleElement.textContent.trim();
        const url = titleElement.getAttribute("href");
        const thumbnail = imgElement.getAttribute("src");

        animeList.push({
            title,
            url,
            thumbnail,
        });
    }

    return animeList;
}

async function fetchPopular(page) {
    const res = await request(`${BASE_URL}/series/`);
    const doc = new DOMParser().parseFromString(res, "text/html");

    const animeList = [];
    const cards = doc.querySelectorAll(".series-boxes a");

    for (const card of cards) {
        const title = card.querySelector(".series-title")?.textContent?.trim();
        const url = card.getAttribute("href");
        const thumbnail = card.querySelector("img")?.getAttribute("src");

        if (!title || !url) continue;

        animeList.push({
            title,
            url,
            thumbnail,
        });
    }

    return {
        list: animeList,
        hasNextPage: false,
    };
}

async function fetchLatest(page) {
    const res = await request(`${BASE_URL}/latest-episodes/`);
    const doc = new DOMParser().parseFromString(res, "text/html");

    const animeList = [];
    const cards = doc.querySelectorAll(".episode-box a");

    for (const card of cards) {
        const title = card.querySelector(".episode-title")?.textContent?.trim();
        const url = card.getAttribute("href");
        const thumbnail = card.querySelector("img")?.getAttribute("src");

        if (!title || !url) continue;

        animeList.push({
            title,
            url,
            thumbnail,
        });
    }

    return {
        list: animeList,
        hasNextPage: false,
    };
}

async function fetchAnimeInfo(url) {
    const res = await request(url);
    const doc = new DOMParser().parseFromString(res, "text/html");

    const title = doc.querySelector("h1")?.textContent?.trim();
    const thumbnail = doc.querySelector(".series-thumb img")?.getAttribute("src");

    const descriptionElement = doc.querySelector(".series-description p");
    const description = descriptionElement ? descriptionElement.textContent.trim() : "";

    const genres = [];
    const genreElements = doc.querySelectorAll(".series-genres a");
    genreElements.forEach((el) => genres.push(el.textContent.trim()));

    return {
        title,
        thumbnail,
        description,
        genres,
    };
}

async function fetchEpisodes(url) {
    const res = await request(url);
    const doc = new DOMParser().parseFromString(res, "text/html");

    const episodeList = [];
    const episodes = doc.querySelectorAll(".episode-list a");

    for (const episode of episodes) {
        const name = episode.querySelector(".episode-title")?.textContent?.trim();
        const epUrl = episode.getAttribute("href");

        if (!name || !epUrl) continue;

        episodeList.push({
            name,
            url: epUrl,
        });
    }

    return episodeList.reverse();
}

async function loadEpisodeSources(episodeUrl) {
    const res = await request(episodeUrl);
    const doc = new DOMParser().parseFromString(res, "text/html");

    const videoList = [];
    const iframe = doc.querySelector("iframe");

    if (iframe) {
        const src = iframe.getAttribute("src");
        if (src) {
            videoList.push({
                url: src,
                quality: "Unknown",
            });
        }
    }

    return videoList;
}

module.exports = {
    search,
    fetchPopular,
    fetchLatest,
    fetchAnimeInfo,
    fetchEpisodes,
    loadEpisodeSources,
};
