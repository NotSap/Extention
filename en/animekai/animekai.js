function Animekai() {
  return {
    name: "Animekai",
    lang: "en",
    type: "anime",

    search: async (query, page) => {
      const res = await fetch(`https://animekai.to/search?keyword=${encodeURIComponent(query)}&page=${page}`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const elements = doc.querySelectorAll('.film_list-wrap .flw-item');

      return Array.from(elements).map(el => ({
        title: el.querySelector('.film-name a')?.textContent.trim(),
        url: el.querySelector('.film-name a')?.href,
        thumbnailUrl: el.querySelector('img')?.getAttribute('data-src') || el.querySelector('img')?.src
      }));
    },

    loadEpisodeList: async (animeUrl) => {
      const res = await fetch(animeUrl);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const episodes = doc.querySelectorAll('.eps_ul > li a');

      return Array.from(episodes).map(el => ({
        title: el.textContent.trim(),
        url: el.href
      }));
    },

    loadEpisodeSources: async (episodeUrl) => {
      const res = await fetch(episodeUrl);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const iframe = doc.querySelector('iframe');

      if (!iframe) return [];

      const embedUrl = iframe.src;

      if (embedUrl.includes("wish")) {
        const id = embedUrl.split("/").pop().split("?")[0];
        const apiUrl = `https://wishfast.top/api/video/${id}`;

        const headers = {
          "X-Requested-With": "XMLHttpRequest",
          "Referer": embedUrl
        };

        const res = await fetch(apiUrl, { headers });
        const data = await res.json();

        const sources = [];

        if (data?.data?.file) {
          sources.push({
            url: data.data.file,
            quality: "StreamWish",
            isM3U8: data.data.file.includes(".m3u8")
          });
        }

        return sources;
      }

      return [
        {
          url: embedUrl,
          quality: "Embed",
          isM3U8: false
        }
      ];
    }
  };
}

globalThis.Animekai = Animekai;
