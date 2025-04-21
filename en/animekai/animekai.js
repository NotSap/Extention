/**
 * AnimeKai
 * Copyright (C) 2023  AnimeKai
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const AnimeKai = async (source) => {
    const baseUrl = "https://animek.ai";

    const getAnimeList = async () => {
        const res = await request.get(`${baseUrl}/home`);
        const $ = cheerio.load(res.data);

        const trendingAnime = $("div.trending-item")
            .map((i, el) => {
                return {
                    title: $(el).find("div.trending-item-title").text().trim(),
                    url: `${baseUrl}${$(el).find("a").attr("href")}`,
                    image: $(el).find("img").attr("src"),
                };
            })
            .get();

        const latestEpisodes = $("div.latest-item")
            .map((i, el) => {
                return {
                    title: $(el).find("div.latest-item-title").text().trim(),
                    url: `${baseUrl}${$(el).find("a").attr("href")}`,
                    image: $(el).find("img").attr("src"),
                    episode: $(el)
                        .find("div.latest-item-episode")
                        .text()
                        .trim()
                        .replace("Episode ", ""),
                };
            })
            .get();

        return {
            trendingAnime,
            latestEpisodes,
        };
    };

    const getAnimeInfo = async (animeUrl) => {
        const res = await request.get(animeUrl);
        const $ = cheerio.load(res.data);

        const title = $("h1.anime-title").text().trim();
        const image = $("img.anime-poster").attr("src");
        const description = $("div.anime-description").text().trim();
        const genres = $("div.anime-genres a")
            .map((i, el) => $(el).text().trim())
            .get();
        const status = $("div.anime-status").text().trim();
        const type = $("div.anime-type").text().trim();
        const released = $("div.anime-released").text().trim();
        const episodes = $("div.anime-episodes").text().trim();

        const episodeList = $("div.episode-item")
            .map((i, el) => {
                return {
                    title: $(el).find("div.episode-item-title").text().trim(),
                    url: `${baseUrl}${$(el).find("a").attr("href")}`,
                    episode: $(el)
                        .find("div.episode-item-number")
                        .text()
                        .trim()
                        .replace("Episode ", ""),
                };
            })
            .get();

        return {
            title,
            image,
            description,
            genres,
            status,
            type,
            released,
            episodes,
            episodeList,
        };
    };

    const getEpisodeSources = async (episodeUrl) => {
        const res = await request.get(episodeUrl);
        const $ = cheerio.load(res.data);

        const title = $("h1.episode-title").text().trim();
        const animeTitle = $("div.episode-anime-title a").text().trim();
        const animeUrl = `${baseUrl}${$("div.episode-anime-title a").attr("href")}`;
        const episode = $("div.episode-number").text().trim().replace("Episode ", "");
        const videoUrl = $("video source").attr("src");

        return {
            title,
            animeTitle,
            animeUrl,
            episode,
            videoUrl,
        };
    };

    const searchAnime = async (query) => {
        const res = await request.get(`${baseUrl}/search?q=${query}`);
        const $ = cheerio.load(res.data);

        const searchResults = $("div.search-item")
            .map((i, el) => {
                return {
                    title: $(el).find("div.search-item-title").text().trim(),
                    url: `${baseUrl}${$(el).find("a").attr("href")}`,
                    image: $(el).find("img").attr("src"),
                };
            })
            .get();

        return searchResults;
    };

    switch (source) {
        case "getAnimeList":
            return await getAnimeList();
        case "getAnimeInfo":
            return await getAnimeInfo(args.animeUrl);
        case "getEpisodeSources":
            return await getEpisodeSources(args.episodeUrl);
        case "searchAnime":
            return await searchAnime(args.query);
        default:
            return {};
    }
};

module.exports = AnimeKai;
