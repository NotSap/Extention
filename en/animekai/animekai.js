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

const cheerio = require('cheerio');
const { request } = require('../utils/request');
const { getRandomUserAgent } = require('../utils/user-agents');

const AnimeKai = async (source, args) => {
    const baseUrl = "https://animek.ai";
    const headers = {
        'User-Agent': getRandomUserAgent(),
        'Referer': baseUrl,
        'Origin': baseUrl
    };

    // Homepage Data
    const getAnimeList = async () => {
        try {
            const res = await request.get(`${baseUrl}/home`, { headers });
            const $ = cheerio.load(res.data);

            // Trending Anime
            const trendingAnime = $("div.trending-item")
                .map((i, el) => {
                    return {
                        id: $(el).find("a").attr("href").split('/').pop(),
                        title: $(el).find("div.trending-item-title").text().trim(),
                        url: `${baseUrl}${$(el).find("a").attr("href")}`,
                        image: $(el).find("img").attr("src"),
                        type: 'trending'
                    };
                })
                .get();

            // Latest Episodes
            const latestEpisodes = $("div.latest-item")
                .map((i, el) => {
                    return {
                        id: $(el).find("a").attr("href").split('/').slice(-2, -1)[0],
                        title: $(el).find("div.latest-item-title").text().trim(),
                        url: `${baseUrl}${$(el).find("a").attr("href")}`,
                        image: $(el).find("img").attr("src"),
                        episode: $(el).find("div.latest-item-episode").text().trim().replace("Episode ", ""),
                        type: 'latest'
                    };
                })
                .get();

            // Popular Anime
            const popularAnime = $("div.popular-item")
                .map((i, el) => {
                    return {
                        id: $(el).find("a").attr("href").split('/').pop(),
                        title: $(el).find("div.popular-item-title").text().trim(),
                        url: `${baseUrl}${$(el).find("a").attr("href")}`,
                        image: $(el).find("img").attr("src"),
                        type: 'popular'
                    };
                })
                .get();

            return {
                trending: trendingAnime,
                latest: latestEpisodes,
                popular: popularAnime
            };
        } catch (err) {
            console.error('Error in getAnimeList:', err);
            return {
                trending: [],
                latest: [],
                popular: []
            };
        }
    };

    // Anime Details
    const getAnimeInfo = async (animeUrl) => {
        try {
            const res = await request.get(animeUrl, { headers });
            const $ = cheerio.load(res.data);

            const info = {
                title: $("h1.anime-title").text().trim(),
                image: $("img.anime-poster").attr("src"),
                description: $("div.anime-description").text().trim(),
                details: {
                    genres: $("div.anime-genres a").map((i, el) => $(el).text().trim()).get(),
                    status: $("div.anime-status").text().trim(),
                    type: $("div.anime-type").text().trim(),
                    released: $("div.anime-released").text().trim(),
                    episodes: $("div.anime-episodes").text().trim(),
                    rating: $("div.anime-rating").text().trim(),
                    duration: $("div.anime-duration").text().trim(),
                    studio: $("div.anime-studio").text().trim()
                },
                relations: [],
                episodes: []
            };

            // Related Anime
            $("div.related-item").each((i, el) => {
                info.relations.push({
                    title: $(el).find("div.related-item-title").text().trim(),
                    url: `${baseUrl}${$(el).find("a").attr("href")}`,
                    image: $(el).find("img").attr("src"),
                    type: $(el).find("div.related-item-type").text().trim()
                });
            });

            // Episodes
            $("div.episode-item").each((i, el) => {
                info.episodes.push({
                    id: $(el).find("a").attr("href").split('/').pop(),
                    title: $(el).find("div.episode-item-title").text().trim(),
                    url: `${baseUrl}${$(el).find("a").attr("href")}`,
                    episode: $(el).find("div.episode-item-number").text().trim().replace("Episode ", ""),
                    date: $(el).find("div.episode-item-date").text().trim()
                });
            });

            return info;
        } catch (err) {
            console.error('Error in getAnimeInfo:', err);
            return null;
        }
    };

    // Episode Sources
    const getEpisodeSources = async (episodeUrl) => {
        try {
            const res = await request.get(episodeUrl, { headers });
            const $ = cheerio.load(res.data);

            const sources = {
                headers: {
                    Referer: episodeUrl,
                    'User-Agent': getRandomUserAgent()
                },
                sources: [],
                subtitles: []
            };

            // Video Sources
            $("video source").each((i, el) => {
                const src = $(el).attr("src");
                if (src) {
                    sources.sources.push({
                        url: src,
                        quality: $(el).attr("size") || "auto",
                        isM3U8: src.includes(".m3u8")
                    });
                }
            });

            // Backup sources
            $("div.video-alt-sources a").each((i, el) => {
                sources.sources.push({
                    url: $(el).attr("href"),
                    quality: $(el).text().trim(),
                    isM3U8: $(el).attr("href").includes(".m3u8")
                });
            });

            // Subtitles
            $("track").each((i, el) => {
                sources.subtitles.push({
                    url: $(el).attr("src"),
                    lang: $(el).attr("label") || "Unknown",
                    isDefault: $(el).attr("default") === "default"
                });
            });

            return sources;
        } catch (err) {
            console.error('Error in getEpisodeSources:', err);
            return {
                sources: [],
                subtitles: []
            };
        }
    };

    // Search Function (REPLACED WITH FILE1 VERSION)
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

    // Advanced Search
    const advancedSearch = async (filters) => {
        try {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });

            const res = await request.get(`${baseUrl}/advanced-search?${params.toString()}`, { headers });
            const $ = cheerio.load(res.data);

            return $("div.search-item")
                .map((i, el) => ({
                    title: $(el).find("div.search-item-title").text().trim(),
                    url: `${baseUrl}${$(el).find("a").attr("href")}`,
                    image: $(el).find("img").attr("src"),
                    year: $(el).find("div.search-item-year").text().trim(),
                    type: $(el).find("div.search-item-type").text().trim()
                }))
                .get();
        } catch (err) {
            console.error('Error in advancedSearch:', err);
            return [];
        }
    };

    // Get Recent Episodes
    const getRecentEpisodes = async (page = 1) => {
        try {
            const res = await request.get(`${baseUrl}/recent-episodes?page=${page}`, { headers });
            const $ = cheerio.load(res.data);

            return $("div.latest-item")
                .map((i, el) => ({
                    id: $(el).find("a").attr("href").split('/').slice(-2, -1)[0],
                    title: $(el).find("div.latest-item-title").text().trim(),
                    url: `${baseUrl}${$(el).find("a").attr("href")}`,
                    image: $(el).find("img").attr("src"),
                    episode: $(el).find("div.latest-item-episode").text().trim().replace("Episode ", ""),
                    time: $(el).find("div.latest-item-time").text().trim()
                }))
                .get();
        } catch (err) {
            console.error('Error in getRecentEpisodes:', err);
            return [];
        }
    };

    // Get Popular Anime
    const getPopularAnime = async (page = 1) => {
        try {
            const res = await request.get(`${baseUrl}/popular?page=${page}`, { headers });
            const $ = cheerio.load(res.data);

            return $("div.popular-item")
                .map((i, el) => ({
                    id: $(el).find("a").attr("href").split('/').pop(),
                    title: $(el).find("div.popular-item-title").text().trim(),
                    url: `${baseUrl}${$(el).find("a").attr("href")}`,
                    image: $(el).find("img").attr("src"),
                    rating: $(el).find("div.popular-item-rating").text().trim()
                }))
                .get();
        } catch (err) {
            console.error('Error in getPopularAnime:', err);
            return [];
        }
    };

    // Get Seasonal Anime
    const getSeasonalAnime = async (season, year) => {
        try {
            const res = await request.get(`${baseUrl}/season/${year}/${season}`, { headers });
            const $ = cheerio.load(res.data);

            return $("div.seasonal-item")
                .map((i, el) => ({
                    id: $(el).find("a").attr("href").split('/').pop(),
                    title: $(el).find("div.seasonal-item-title").text().trim(),
                    url: `${baseUrl}${$(el).find("a").attr("href")}`,
                    image: $(el).find("img").attr("src"),
                    episodes: $(el).find("div.seasonal-item-episodes").text().trim(),
                    type: $(el).find("div.seasonal-item-type").text().trim()
                }))
                .get();
        } catch (err) {
            console.error('Error in getSeasonalAnime:', err);
            return [];
        }
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
        case "advancedSearch":
            return await advancedSearch(args.filters);
        case "getRecentEpisodes":
            return await getRecentEpisodes(args.page);
        case "getPopularAnime":
            return await getPopularAnime(args.page);
        case "getSeasonalAnime":
            return await getSeasonalAnime(args.season, args.year);
        default:
            throw new Error(`Unknown source: ${source}`);
    }
};

module.exports = AnimeKai;
