const mangayomiSources = [{
    name: "Aniwatch (via Kitsu)",
    lang: "en",
    baseUrl: "https://aniwatchtv.to",
    apiUrl: "https://kitsu.io/api/edge",
    iconUrl: "https://aniwatchtv.to/favicon.ico",
    typeSource: "single",
    itemType: 1,
    version: "1.0.1"
}];

class AniwatchKitsuProvider extends MProvider {
    constructor() {
        super();
        this.client = new Client({
            headers: {
                'Referer': 'https://aniwatchtv.to/',
                'Origin': 'https://aniwatchtv.to'
            }
        });
    }

    // 1. Get metadata from Kitsu
    async search(query, page) {
        const kitsuUrl = `${this.source.apiUrl}/anime?filter[text]=${encodeURIComponent(query)}`;
        const res = await this.client.get(kitsuUrl);
        const data = JSON.parse(res.body);
        
        return {
            list: data.data.map(anime => ({
                name: anime.attributes.canonicalTitle,
                imageUrl: anime.attributes.posterImage?.medium || "",
                link: `anime/${anime.attributes.slug}` // Using slug for Aniwatch search
            })),
            hasNextPage: data.meta.count > page * 20
        };
    }

    // 2. Find matching Aniwatch ID
    async getAniwatchId(kitsuSlug) {
        const searchUrl = `${this.source.baseUrl}/search?keyword=${kitsuSlug}`;
        const html = await this.client.get(searchUrl).then(r => r.text());
        const $ = cheerio.load(html);
        
        return $('.film_list-wrap .film-detail').first()
            .find('a').attr('href').split('/')[2];
    }

    // 3. Get episode streams from Aniwatch
    async getVideoList(aniwatchUrl) {
        const html = await this.client.get(`${this.source.baseUrl}${aniwatchUrl}`).then(r => r.text());
        const $ = cheerio.load(html);
        
        const episodeScript = $('script:contains("episodes")').html();
        const episodesData = JSON.parse(episodeScript.match(/var episodes = (\[.*?\])/)[1]);
        
        const streams = [];
        for (const ep of episodesData) {
            const embedUrl = `${this.source.baseUrl}/ajax/v2/episode/servers?episodeId=${ep.id}`;
            const servers = await this.client.get(embedUrl).then(r => JSON.parse(r.body));
            
            const vidstreamServer = servers.html.match(/data-id="([^"]+)"/)[1];
            const iframeUrl = `${this.source.baseUrl}/ajax/v2/episode/sources?id=${vidstreamServer}`;
            
            const sourceData = await this.client.get(iframeUrl).then(r => JSON.parse(r.body));
            streams.push({
                url: sourceData.link,
                quality: "Auto",
                headers: {
                    Referer: sourceData.link,
                    Origin: this.source.baseUrl
                }
            });
        }
        
        return streams;
    }

    // Implement other required methods...
}

module.exports = {
    sources: mangayomiSources,
    provider: AniwatchKitsuProvider
};
