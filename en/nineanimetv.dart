import 'dart:convert';
import 'package:mangayomi/bridge_lib.dart';

// Helper function for fetching text
Future<String> fetchText(String url, {Map<String, String>? headers}) async {
  final res = await MBridge.request(
    url: url,
    method: "GET",
    headers: headers ?? {},
  );
  return res.body;
}

// Helper function for parsing rapid-cloud links
Future<List<MVideo>> rapidCloudExtractor(String url) async {
  final res = await fetchText(url);
  final document = parseHtml(res);

  final scriptTag = document.selectFirst('script:contains("sources")')?.text ?? "";
  final match = RegExp(r'sources\s*:\s*(\[{.*?}\])').firstMatch(scriptTag);
  if (match == null) return [];

  final sources = json.decode(match.group(1)!);

  return (sources as List).map((source) {
    final file = source['file'];
    final label = source['label'];
    return MVideo(url: file, quality: label);
  }).toList();
}
class NineAnimeTv extends MProvider {
  NineAnimeTv()
      : super(
          "NineAnimeTv",
          "en",
          "https://9animetv.to",
          "https://9animetv.to/",
          "Anime",
        );

  @override
  Future<List<AnimeSearch>> search(String query) async {
    final res = await fetchText("${baseUrl}filter?keyword=$query");
    final document = parseHtml(res);
    final List<AnimeSearch> results = [];

    document.select(".flw-item").forEach((element) {
      final title = element.selectFirst(".film-name")?.text ?? "";
      final image = element.selectFirst("img")?.getAttribute("data-src") ?? "";
      final url = element.selectFirst("a")?.getAttribute("href") ?? "";

      if (title.isNotEmpty && url.isNotEmpty) {
        results.add(AnimeSearch(
          title: title,
          imageUrl: image,
          url: url,
        ));
      }
    });

    return results;
  }
  @override
  Future<AnimeDetail> animeDetail(String url) async {
    final res = await fetchText("$baseUrl$url");
    final document = parseHtml(res);

    final title = document.selectFirst(".film-name")?.text ?? "";
    final description = document.selectFirst(".film-description")?.text ?? "";
    final image = document.selectFirst(".film-poster img")?.getAttribute("data-src") ?? "";
    final genres = document.select(".item.item-genre a").map((e) => e.text).toList();

    final episodes = document.select(".eps-list > a").map((element) {
      final epUrl = element.getAttribute("href") ?? "";
      final epTitle = element.text.trim();
      return Episode(
        title: epTitle,
        url: epUrl,
      );
    }).toList();

    return AnimeDetail(
      title: title,
      description: description,
      imageUrl: image,
      genres: genres,
      episodes: episodes,
    );
  }
  @override
  Future<List<MVideo>> getVideoList(String url) async {
    final res = await fetchText("$baseUrl$url");
    final document = parseHtml(res);

    final iframeUrl = document.selectFirst("iframe")?.getAttribute("src") ?? "";
    if (iframeUrl.isEmpty) return [];

    if (iframeUrl.contains("rapid-cloud")) {
      return await rapidCloudExtractor(iframeUrl);
    }
   if (iframeUrl.contains("streamsb")) {
  return await extractStreamSB(iframeUrl);
}
if (iframeUrl.contains("vidplay")) {
  return await extractVidplay(iframeUrl);
}
if (iframeUrl.contains("streamtape")) {
  return await extractStreamtape(iframeUrl);
}


    return [];
  }
}
Future<List<MVideo>> extractStreamSB(String url) async {
  final headers = {
    "Referer": "https://streamsb.net/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  };
  final res = await fetchText(url, headers: headers);

  final fileMatch = RegExp(r'"file":"(.*?)"').firstMatch(res);
  if (fileMatch != null) {
    final videoUrl = fileMatch.group(1)!.replaceAll(r'\/', '/');
    return [MVideo(url: videoUrl, quality: "StreamSB")];
  }
  return [];
}
Future<List<MVideo>> extractVidplay(String url) async {
  final headers = {
    "Referer": "https://vidplay.net/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  };
  final res = await fetchText(url, headers: headers);

  final fileMatch = RegExp(r'"file":"(.*?)"').firstMatch(res);
  if (fileMatch != null) {
    final videoUrl = fileMatch.group(1)!.replaceAll(r'\/', '/');
    return [MVideo(url: videoUrl, quality: "Vidplay")];
  }
  return [];
}
Future<List<MVideo>> extractStreamtape(String url) async {
  final headers = {
    "Referer": "https://streamtape.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  };
  final res = await fetchText(url, headers: headers);

  final fileMatch = RegExp(r'"file":"(.*?)"').firstMatch(res);
  if (fileMatch != null) {
    final videoUrl = fileMatch.group(1)!.replaceAll(r'\/', '/');
    return [MVideo(url: videoUrl, quality: "Streamtape")];
  }
  return [];
}
Future<List<MVideo>> extractVidstream(String url) async {
  final headers = {
    "Referer": "https://vidstreaming.io/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
  };
  final res = await fetchText(url, headers: headers);

  final fileMatch = RegExp(r'"file":"(.*?)"').firstMatch(res);
  if (fileMatch != null) {
    final videoUrl = fileMatch.group(1)!.replaceAll(r'\/', '/');
    return [MVideo(url: videoUrl, quality: "Vidstream")];
  }
  return [];
}

if (iframeUrl.contains("vidstream")) {
  return await extractVidstream(iframeUrl);
}
Future<List<AnimeEpisode>> getEpisodes(String url) async {
  final res = await fetchText(url);
  final document = parseHtml(res);

  final episodes = document.select(".episode-list .episode-item").map((element) {
    final episodeTitle = element.selectFirst(".title")?.text ?? "";
    final episodeUrl = element.selectFirst("a")?.getAttribute("href") ?? "";
    return AnimeEpisode(
      title: episodeTitle,
      url: episodeUrl,
    );
  }).toList();

  return episodes;
}
  @override
  Future<List<AnimeEpisode>> getEpisodes(String url) async {
    final res = await fetchText(url);
    final document = parseHtml(res);

    final episodes = document.select(".episode-list .episode-item").map((element) {
      final episodeTitle = element.selectFirst(".title")?.text ?? "";
      final episodeUrl = element.selectFirst("a")?.getAttribute("href") ?? "";
      return AnimeEpisode(
        title: episodeTitle,
        url: episodeUrl,
      );
    }).toList();

    return episodes;
  }

  // Method for getting the video stream of a specific episode
  @override
  Future<List<MVideo>> getEpisodeVideo(String url) async {
    final res = await fetchText(url);
    final document = parseHtml(res);

    final videoUrl = document.selectFirst("iframe")?.getAttribute("src") ?? "";
    if (videoUrl.isNotEmpty) {
      return await getVideoList(videoUrl); // Use the getVideoList function
    }
    return [];
  }
}
