const mangayomiSources = [{
    "name": "AnimeKai",
    "lang": "en",
    "baseUrl": "https://animekai.to",
    "apiUrl": "",
    "iconUrl": "https://www.google.com/s2/favicons?sz=256&domain=https://animekai.to/",
    "typeSource": "single",
    "itemType": 1,
    "version": "1.0.5",
    "pkgPath": "anime/src/en/animekai.js"
}];

class DefaultExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client();
        this.anilistApi = "https://graphql.anilist.co";
        this.kitsuApi = "https://kitsu.io/api/edge";
    }

    // [KEEP ALL YOUR EXISTING METHODS UNCHANGED UNTIL getDetail]
    // getPreference(), getBaseUrl(), request(), getPage(), 
    // search(), getPopular(), getLatestUpdates() remain exactly the same

    // IMPROVED DETAIL FETCHING WITH ANILIST/KITSU FALLBACK
    async getDetail(url) {
        try {
            // First try AnimeKai's native detail page
            const kaiDetail = await this.getAnimeKaiDetail(url);
            if (kaiDetail && kaiDetail.episodes.length > 0) {
                return kaiDetail;
            }

            // If no episodes found, try AniList/Kitsu
            const title = kaiDetail?.name || url.split('/').pop().replace(/-/g, ' ');
            const anilistData = await this.getAniListData(title);
            const kitsuData = await this.getKitsuData(title);

            // Merge all available data
            return {
                name: kaiDetail?.name || anilistData?.name || kitsuData?.name || title,
                cover: kaiDetail?.cover || anilistData?.cover || kitsuData?.cover,
                description: kaiDetail?.description || anilistData?.description || kitsuData?.description,
                episodes: kaiDetail?.episodes || anilistData?.episodes || kitsuData?.episodes || []
            };
        } catch (error) {
            console.error("Failed to get detail:", error);
            return null;
        }
    }

    async getAnimeKaiDetail(url) {
        try {
            const doc = await this.getPage(url);
            if (!doc) return null;

            const titlePref = this.getPreference("animekai_title_lang") || "title";
            const title = doc.selectFirst("h1.title, .anime-detail h1")?.attr(titlePref) || 
                        doc.selectFirst("h1.title, .anime-detail h1")?.text;
            
            const cover = doc.selectFirst("img.cover, .anime-cover img")?.attr("src");
            const description = doc.selectFirst(".description, .anime-synopsis")?.text;

            const episodeItems = doc.select(".episode-list .episode-item, .episodes-wrapper .episode") || [];
            const episodes = episodeItems.map((item, index) => {
                const epNum = parseInt(
                    item.attr("data-number") || 
                    item.selectFirst(".episode-number")?.text?.match(/\d+/)?.[0] || 
                    (index + 1)
                );
                return {
                    name: item.selectFirst(".episode-title")?.text || `Episode ${epNum}`,
                    url: item.selectFirst("a")?.getHref || `${url}/episode/${epNum}`,
                    episode: epNum,
                    thumbnailUrl: item.selectFirst("img")?.attr("src") || cover
                };
            }).filter(ep => ep.url);

            return {
                name: title,
                cover: cover,
                description: description,
                episodes: episodes.sort((a, b) => a.episode - b.episode)
            };
        } catch (error) {
            console.error("AnimeKai detail fetch failed:", error);
            return null;
        }
    }

    async getAniListData(title) {
        try {
            const query = `
                query ($search: String) {
                    Media(search: $search, type: ANIME) {
                        title { romaji english }
                        description
                        coverImage { large }
                        episodes
                    }
                }
            `;
            
            const variables = { search: title };
            const response = await this.client.post(this.anilistApi, {
                body: JSON.stringify({ query, variables }),
                headers: { "Content-Type": "application/json" }
            });
            
            const data = JSON.parse(response.body).data?.Media;
            if (!data) return null;

            const episodes = Array.from({ length: data.episodes || 0 }, (_, i) => ({
                name: `Episode ${i + 1}`,
                episode: i + 1,
                url: `anilist:${data.title.romaji || data.title.english}:${i + 1}`,
                thumbnailUrl: data.coverImage?.large
            }));

            return {
                name: data.title.english || data.title.romaji,
                description: data.description,
                cover: data.coverImage?.large,
                episodes: episodes
            };
        } catch (error) {
            console.error("AniList fetch failed:", error);
            return null;
        }
    }

    async getKitsuData(title) {
        try {
            const response = await this.client.get(
                `${this.kitsuApi}/anime?filter[text]=${encodeURIComponent(title)}`
            );
            
            const data = JSON.parse(response.body).data?.[0];
            if (!data) return null;

            const episodes = Array.from({ length: data.attributes.episodeCount || 0 }, (_, i) => ({
                name: `Episode ${i + 1}`,
                episode: i + 1,
                url: `kitsu:${data.id}:${i + 1}`,
                thumbnailUrl: data.attributes.posterImage?.large
            }));

            return {
                name: data.attributes.titles.en || data.attributes.titles.en_jp,
                description: data.attributes.synopsis,
                cover: data.attributes.posterImage?.large,
                episodes: episodes
            };
        } catch (error) {
            console.error("Kitsu fetch failed:", error);
            return null;
        }
    }

    // [KEEP YOUR EXISTING getVideoList IMPLEMENTATION]
    // [KEEP YOUR EXISTING SETTINGS IMPLEMENTATION]
}

if (typeof module !== 'undefined') {
    module.exports = mangayomiSources;
}
