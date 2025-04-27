const baseUrl = "https://aniwatchtv.to";

async function fetchSearch(query) {
  const searchUrl = `${baseUrl}/search?keyword=${encodeURIComponent(query)}`;
  const res = await fetch(searchUrl);
  const text = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  const results = [];
  doc.querySelectorAll(".flw-item").forEach((el) => {
    const title = el.querySelector(".film-name a")?.textContent?.trim() || "";
    const id = el.querySelector(".film-name a")?.getAttribute("href")?.replace("/watch/", "").replace("/", "") || "";
    const image = el.querySelector("img")?.getAttribute("data-src") || "";

    if (title && id) {
      results.push({
        id: id,
        title: title,
        image: image
      });
    }
  });

  return results;
}

async function fetchAnimeInfo(id) {
  const url = `${baseUrl}/watch/${id}`;
  const res = await fetch(url);
  const text = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  const title = doc.querySelector(".film-name")?.textContent?.trim() || "";
  const description = doc.querySelector(".synopsis .text")?.textContent?.trim() || "";
  const image = doc.querySelector(".film-poster img")?.getAttribute("src") || "";

  return {
    id: id,
    title: title,
    description: description,
    genres: [],
    image: image,
    episodes: []
  };
}

async function fetchEpisodes(id) {
  const url = `${baseUrl}/ajax/v2/episode/list/${id}`;
  const res = await fetch(url);
  const json = await res.json();
  const doc = new DOMParser().parseFromString(json.html, "text/html");

  const episodes = [];
  doc.querySelectorAll("a.ep-item").forEach((el) => {
    const episodeId = el.getAttribute("href")?.replace("/watch/", "").replace("/", "") || "";
    const number = parseFloat(el.getAttribute("data-number")) || 0;
    episodes.push({
      id: episodeId,
      number: number,
      title: `Episode ${number}`,
      image: ""
    });
  });

  return episodes;
}

async function loadEpisodeSources(episodeId) {
  const url = `${baseUrl}/watch/${episodeId}`;
  const res = await fetch(url);
  const text = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  const iframe = doc.querySelector("iframe")?.getAttribute("src");
  if (!iframe) return [];

  const embedUrl = iframe.startsWith("http") ? iframe : "https:" + iframe;
  return [
    {
      url: embedUrl,
      quality: "Unknown",
      isM3U8: false
    }
  ];
}
