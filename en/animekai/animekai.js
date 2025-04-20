function Animekai() {
  const base = "https://animekai.to";

  const parseSearch = async (query, page) => {
    const res = await fetch(`${base}/search?keyword=${encodeURIComponent(query)}&page=${page}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = doc.querySelectorAll(".film_list-wrap .flw-item");

    return Array.from(items).map(item => {
      const a = item.querySelector(".film-name a");
      const img = item.querySelector("img");
      return {
        title: a?.textContent.trim(),
        url: a?.href.startsWith("http") ? a.href : base + a.getAttribute("href"),
        thumbnailUrl: img?.getAttribute("data-src") || img?.src
      };
    });
  };

  const parseEpisodes = async (animeUrl) => {
    const res = await fetch(animeUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = doc.querySelectorAll(".eps-list .eps-item");

    return Array.from(items).map(item => {
      const a = item.querySelector("a");
      return {
        name: a?.textContent.trim(),
        url: a?.href.startsWith("http") ? a.href : base + a.getAttribute("href")
      };
    }).reverse(); // Reverse for ascending order
  };

  const loadEpisodeSources = async (episodeUrl) => {
    const res = await fetch(episodeUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const iframe = doc.querySelector("iframe");

    if (!iframe) return [];

    const embedUrl = iframe.src;

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

    const embedRes = await fetch(embedUrl);
    const embedHtml = await embedRes.text();
    const embedDoc = new DOMParser().parseFromString(embedHtml, "text/html");
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

    return [
      {
        url: embedUrl,
        quality: "Embed Page",
        isM3U8: false
      }
    ];
  };

  return {
    name: "Animekai",
    lang: "en",
    type: "anime",
    search: parseSearch,
    loadEpisodes: parseEpisodes,
    loadEpisodeSources
  };
}

globalThis.Animekai = Animekai;
