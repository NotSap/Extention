/**
 * AniWatchTV Mangayomi Extension
 * Adapted from AnimePahe provider (kodjodevf)  [oai_citation:1‡GitHub](https://raw.githubusercontent.com/kodjodevf/mangayomi-extensions/main/dart/anime/src/en/animepahe/animepahe.dart)
 */

class AniWatchTV {
  constructor(source) {
    this.source = source;
    this.client = fetch; // or your HTTP client wrapper
  }

  // ─────── Settings ───────
  get baseUrl() {
    // user can override via a "preferred_domain" setting
    return getPreferenceValue(this.source.id, "preferred_domain")
      || "https://aniwatchtv.to";
  }

  get useHLS() {
    // if true, use <source> tags; if false, follow redirects/parsing
    return getPreferenceValue(this.source.id, "use_hls") || false;
  }

  get preferredQuality() {
    // e.g. "1080", "720", "360"
    return getPreferenceValue(this.source.id, "preferred_quality") || "1080";
  }

  get preferredAudio() {
    // e.g. "jpn", "eng"
    return getPreferenceValue(this.source.id, "preferred_audio") || "jpn";
  }

  get headers() {
    // some Aniplay sites require cookies/bypass
    return { "cookie": "__ddg1_=;__ddg2_=;" };
  }

  // ─────── Popular & Latest ───────
  async getPopular(page = 1) {
    return this.getLatestUpdates(page);
  }

  async getLatestUpdates(page = 1) {
    const url = `${this.baseUrl}/api?m=airing&page=${page}`;
    const json = await (await this.client(url, { headers: this.headers })).json();
    const hasNext = json.current_page < json.last_page;

    const list = json.data.map(item => ({
      title: item.anime_title,
      url:    `/anime/?anime_id=${item.id}&name=${encodeURIComponent(item.anime_title)}`,
      imageUrl: item.snapshot,
      fansub: item.fansub
    }));

    return { list, hasNext };
  }

  // ─────── Search ───────
  async search(query, page = 1) {
    const url = `${this.baseUrl}/api?m=search&l=12&q=${encodeURIComponent(query)}`;
    const json = await (await this.client(url, { headers: this.headers })).json();

    // no paging on search, so always hasNext = false
    const list = (json.data || []).map(item => ({
      title: item.title,
      url:   `/anime/?anime_id=${item.id}&name=${encodeURIComponent(item.title)}`,
      imageUrl: item.poster
    }));

    return { list, hasNext: false };
  }

  // ─────── Anime Details & Episode List ───────
  async getDetail(link) {
    // link comes in form "/anime/?anime_id=123&name=Foo"
    const params = new URLSearchParams(link.split("?")[1]);
    const animeId = params.get("anime_id");
    const animeName = params.get("name");
    const session = await this._getSession(animeName, animeId);

    // Detail page parse (if needed) or skip to episode API:
    const epUrl = `${this.baseUrl}/api?m=release&id=${session}&sort=episode_asc&page=1`;
    const episodes = await this._recursiveEpisodes(epUrl, session);

    return {
      title:       animeName,
      description: "",     // aniwatchtv.to doesn’t return synopsis via API
      imageUrl:    "",     // same for poster
      status:      null,
      genres:      [],
      episodes
    };
  }

  async _getSession(name, animeId) {
    // grab the internal "session" token needed for release API
    const url = `${this.baseUrl}/api?m=search&q=${encodeURIComponent(name)}`;
    const json = await (await this.client(url, { headers: this.headers })).json();
    const item = json.data.find(i => i.id.toString() === animeId);
    return item?.session || "";
  }

  async _recursiveEpisodes(url, session) {
    const json = await (await this.client(url, { headers: this.headers })).json();
    const page = json.current_page;
    const hasNext = page < json.last_page;

    const eps = json.data.map(item => ({
      name: `Episode ${item.episode}`,
      url:  `/play/${session}/${item.session}`,
      dateUpload: item.created_at
    }));

    if (hasNext) {
      const nextUrl = url.replace(/&page=\d+$/, `&page=${page + 1}`);
      return eps.concat(await this._recursiveEpisodes(nextUrl, session));
    }
    return eps;
  }

  // ─────── Video Extraction ───────
  async getVideoList(playLink) {
    // playLink = "/play/{session}/{episodeSession}"
    const url = `${this.baseUrl}${playLink}`;
    const res = await this.client(url, { headers: this.headers });
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    if (this.useHLS) {
      // Pull <source> tags from the embedded player
      const sources = [];
      doc.querySelectorAll("source").forEach(src => {
        const quality = src.getAttribute("label") || "";
        if (quality.includes(this.preferredQuality)) {
          sources.push({
            url: src.src,
            quality,
            isM3U8: src.src.includes(".m3u8")
          });
        }
      });
      return sources;
    } else {
      // Fallback: look for javascript `file: "..."` entries
      const scripts = Array.from(doc.scripts).map(s => s.textContent);
      const match = scripts.join("\n").match(/file:\s*['"]([^'"]+)['"]/);
      if (match) {
        return [{ url: match[1], quality: "default", isM3U8: match[1].includes(".m3u8") }];
      }
      return [];
    }
  }

  // ─────── Preferences UI ───────
  getSourcePreferences() {
    return [
      ListPreference({
        key:        "preferred_domain",
        title:      "Preferred Domain",
        entries:    ["https://aniwatchtv.to", "https://aniwatchtv.com"],
        entryValues:["https://aniwatchtv.to", "https://aniwatchtv.com"],
        valueIndex: 0
      }),
      SwitchPreference({
        key:   "use_hls",
        title: "Use HLS <source> tags",
        summary: "Enable if direct parsing fails",
        value: false
      }),
      ListPreference({
        key:        "preferred_quality",
        title:      "Preferred Quality",
        entries:    ["1080", "720", "360"],
        entryValues:["1080", "720", "360"],
        valueIndex: 0
      }),
      ListPreference({
        key:        "preferred_audio",
        title:      "Preferred Audio",
        entries:    ["jpn", "eng"],
        entryValues:["jpn", "eng"],
        valueIndex: 0
      })
    ];
  }
}

// Boilerplate export for Mangayomi
function main(source) {
  return new AniWatchTV(source);
}
