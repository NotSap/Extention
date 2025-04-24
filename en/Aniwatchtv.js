const mangayomiSources = [{
    name: "Aniwatch",
    lang: "en",
    baseUrl: "https://aniwatchtv.to",
    apiUrl: "https://aniwatchtv.to/ajax",
    iconUrl: "https://aniwatchtv.to/favicon.ico",
    typeSource: "single",
    itemType: 1,
    version: "1.0.0"
}];

class AniwatchProvider extends MProvider {
    constructor() {
        super();
        this.client = new Client({
            headers: {
                'Referer': 'https://aniwatchtv.to/',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
    }

    async search(query, page) {
        const searchUrl = `${this.source.baseUrl}/search?keyword=${encodeURIComponent(query)}`;
        const html = await this.client.get(searchUrl).then(r => r.text());
        const $ = cheerio.load(html);

        const results = [];
        $('.film_list-wrap .film-detail').each((i, el) => {
            results.push({
                id: $(el).find('a').attr('href').split('/')[2],
                title: $(el).find('a').attr('title'),
                thumbnail: $(el).closest('.film-poster').find('img').attr('data-src'),
                year: $(el).find('.fd-infor span:nth-child(1)').text()
            });
        });

        return { results, hasNextPage: false };
    }

    async getMediaDetails(id) {
        const detailUrl = `${this.source.baseUrl}/ajax/v2/tv/info/${id}`;
        const { body } = await this.client.get(detailUrl);
        const data = JSON.parse(body);

        return {
            title: data.title,
            description: data.description,
            thumbnail: data.image,
            status: data.status === 'Ongoing' ? 0 : 1,
            genres: data.genres.map(g => g.name)
        };
    }

    async getEpisodes(id) {
        const episodesUrl = `${this.source.baseUrl}/ajax/v2/episode/list/${id}`;
        const { body } = await this.client.get(episodesUrl);
        const data = JSON.parse(body);

        return data.html.match(/data-id="(\d+)"/g).map(match => ({
            id: match.match(/"(\d+)"/)[1],
            number: match.split('"')[1],
            title: `Episode ${match.split('"')[1]}`
        }));
    }

    async getStreams(episodeId) {
        // Step 1: Get available servers
        const serversUrl = `${this.source.baseUrl}/ajax/v2/episode/servers?episodeId=${episodeId}`;
        const { body: serversBody } = await this.client.get(serversUrl);
        const serversData = JSON.parse(serversBody);

        // Step 2: Extract Vidstream server ID
        const vidstreamId = serversData.html.match(/data-id="(\d+)"/)[1];

        // Step 3: Get stream links
        const sourcesUrl = `${this.source.baseUrl}/ajax/v2/episode/sources?id=${vidstreamId}`;
        const { body: sourcesBody } = await this.client.get(sourcesUrl);
        const sourcesData = JSON.parse(sourcesBody);

        return [{
            url: sourcesData.link,
            quality: 'Auto',
            headers: {
                Referer: 'https://aniwatchtv.to/',
                Origin: 'https://aniwatchtv.to'
            }
        }];
    }

    // For Mangayomi compatibility
    async getVideoList(url) {
        const episodeId = url.split('/').pop();
        return this.getStreams(episodeId);
    }
}

module.exports = {
    sources: mangayomiSources,
    provider: AniwatchProvider,
    search: AniwatchProvider.prototype.search,
    getMediaDetails: AniwatchProvider.prototype.getMediaDetails,
    getEpisodes: AniwatchProvider.prototype.getEpisodes,
    getStreams: AniwatchProvider.prototype.getStreams,
    getVideoList: AniwatchProvider.prototype.getVideoList
};
