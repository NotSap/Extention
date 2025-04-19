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

    loadEpisodeSources: async (episodeUrl) => {
      const res = await fetch(episodeUrl);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const iframe = doc.querySelector("iframe");

      if (!iframe) return [];

      const embedUrl = iframe.src;

      // Attempt to extract sources from known hosts like StreamWish
      if (embedUrl.includes("wish") || embedUrl.includes("wishfast")) {
        const id = embedUrl.split("/").pop().split("?")[0];
        const apiUrl = `https://wishfast.top/api/video/${id}`;
        const headers = {
          "X-Requested-With": "XMLHttpRequest",
          "Referer": embedUrl
        };

        const response = await fetch(apiUrl, { headers });
        const data = await response.json();

        if (data?.data?.file) {
          return [
            {
              url: data.data.file,
              quality: "HD",
              isM3U8: data.data.file.includes(".m3u8")
            }
          ];
        }
      }

      // Fallback: extract <video> tag from embed page
      const embedRes = await fetch(embedUrl);
      const embedHtml = await embedRes.text();
      const embedDoc = new DOMParser().parseFromString(embedHtml, 'text/html');
      const video = embedDoc.querySelector("video source");

      if (video) {
        return [
          {
            url: video.src,
            quality: video.getAttribute("label") || "Unknown",
            isM3U8: video.src.includes(".m3u8")
          }
        ];
      }

      // Final fallback: just return the embed page
      return [
        {
          url: embedUrl,
          quality: "Embed Page",
          isM3U8: false
        }
      ];
    }
  };
}

globalThis.Animekai = Animekai;
