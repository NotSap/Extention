const BASE_URL = "https://bestdubbedanime.com";

function fetchPopular(page) {
  const url = `${BASE_URL}/anime-list?page=${page}`;
  const res = fetch(url);
  const doc = res.html();

  const animeList = doc.select(".anime-card").map(el => {
    const anchor = el.selectFirst("a");
    return {
      title: el.selectFirst(".anime-title").text(),
      url: anchor.attr("href"),
      thumbnail: el.selectFirst("img")?.attr("src")
    };
  });

  const hasNextPage = !!doc.selectFirst(".pagination .next");

  return {
    results: animeList,
    hasNextPage
  };
}

function fetchAnimeInfo(url) {
  const res = fetch(url);
  const doc = res.html();

  const episodes = doc.select(".episode-list a").map(el => ({
    name: el.text(),
    url: el.attr("href")
  }));

  return {
    title: doc.selectFirst("h1").text(),
    description: doc.selectFirst(".anime-desc")?.text(),
    genres: doc.select(".genres a").map(el => el.text()),
    episodes
  };
}

function fetchEpisodeList(url) {
  const res = fetch(url);
  const doc = res.html();

  return doc.select(".episode-list a").map(el => ({
    name: el.text(),
    url: el.attr("href")
  }));
}

function loadEpisodeSources(url) {
  const res = fetch(url);
  const doc = res.html();

  const iframe = doc.selectFirst("iframe");
  const videoUrl = iframe ? iframe.attr("src") : null;

  if (!videoUrl) throw new Error("No video found");

  return [
    {
      url: videoUrl,
      quality: "default",
      isM3U8: videoUrl.includes(".m3u8")
    }
  ];
}

function search(query, page) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}&page=${page}`;
  const res = fetch(url);
  const doc = res.html();

  const results = doc.select(".anime-card").map(el => ({
    title: el.selectFirst(".anime-title").text(),
    url: el.selectFirst("a").attr("href"),
    thumbnail: el.selectFirst("img").attr("src")
  }));

  const hasNextPage = !!doc.selectFirst(".pagination .next");

  return {
    results,
    hasNextPage
  };
}
