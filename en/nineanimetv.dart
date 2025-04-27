import 'dart:convert';
import 'package:mangayomi/bridge_lib.dart';

class NineAnimeTv extends MProvider {
  NineAnimeTv() {
    name = "9animeTV";
    lang = "en";
    type = "anime";
    homepage = "https://9animetv.to";
    supportsLatest = true;
  }

  @override
  Future<List<MManga>> getPopular(int page) async {
    final res = await fetchText(
      "$homepage/filter?type=series&sort=views&page=$page",
      headers: {"referer": homepage},
    );
    final document = parseHtml(res);
    final list = document.select("div.flw-item").map((e) {
      final url = e.selectFirst("a.film-poster")?.getAttribute("href") ?? "";
      final title = e.selectFirst("div.film-detail > h3")?.text ?? "";
      final thumbnail = e.selectFirst("img")?.getAttribute("data-src") ?? "";
      return MManga(
        title: title,
        url: url,
        thumbnailUrl: thumbnail,
      );
    }).toList();
    return list;
  }

  @override
  Future<List<MManga>> search(String query, int page) async {
    final res = await fetchText(
      "$homepage/filter?keyword=${Uri.encodeComponent(query)}&page=$page",
      headers: {"referer": homepage},
    );
    final document = parseHtml(res);
    final list = document.select("div.flw-item").map((e) {
      final url = e.selectFirst("a.film-poster")?.getAttribute("href") ?? "";
      final title = e.selectFirst("div.film-detail > h3")?.text ?? "";
      final thumbnail = e.selectFirst("img")?.getAttribute("data-src") ?? "";
      return MManga(
        title: title,
        url: url,
        thumbnailUrl: thumbnail,
      );
    }).toList();
    return list;
  }

  @override
  Future<List<MChapter>> getChapterList(String url) async {
    final res = await fetchText(
      "$homepage$url",
      headers: {"referer": homepage},
    );
    final document = parseHtml(res);
    final list = document.select("div.episodes-list > div.eps-item").reversed.map((e) {
      final epUrl = e.selectFirst("a")?.getAttribute("href") ?? "";
      final epNum = e.selectFirst("a")?.text.trim() ?? "";
      return MChapter(
        name: "Episode $epNum",
        url: epUrl,
      );
    }).toList();
    return list;
  }

  @override
  Future<List<MVideo>> getVideoList(String url) async {
    final res = await fetchText(
      "$homepage$url",
      headers: {"referer": homepage},
    );
    final document = parseHtml(res);
    final serverElements = document.select("div.anime_muti_link > ul > li");
    List<MVideo> videos = [];

    for (var server in serverElements) {
      final serverUrl = server.selectFirst("a")?.getAttribute("data-video") ?? "";
      if (serverUrl.contains("rapid-cloud")) {
        videos.addAll(await _rapidCloudExtractor(serverUrl));
      }
    }

    return videos;
  }

  Future<List<MVideo>> _rapidCloudExtractor(String url) async {
    final res = await fetchText(
      url,
      headers: {"referer": homepage},
    );
    final document = parseHtml(res);
    final scriptTag = document.selectFirst('script:contains("sources")')?.text ?? "";
    final sourcesJsonMatch = RegExp(r'sources\s*:\s*(\[{.*?}\])').firstMatch(scriptTag);
    if (sourcesJsonMatch == null) return [];

    final sourcesJson = sourcesJsonMatch.group(1);
    final sources = json.decode(sourcesJson!);

    List<MVideo> videos = [];
    for (final source in sources) {
      final file = source['file'];
      final label = source['label'];
      videos.add(MVideo(
        url: file,
        quality: label,
      ));
    }

    return videos;
  }

  @override
  Future<List<MManga>> getLatestUpdates(int page) async {
    final res = await fetchText(
      "$homepage/?page=$page",
      headers: {"referer": homepage},
    );
    final document = parseHtml(res);
    final list = document.select("div.flw-item").map((e) {
      final url = e.selectFirst("a.film-poster")?.getAttribute("href") ?? "";
      final title = e.selectFirst("div.film-detail > h3")?.text ?? "";
      final thumbnail = e.selectFirst("img")?.getAttribute("data-src") ?? "";
      return MManga(
        title: title,
        url: url,
        thumbnailUrl: thumbnail,
      );
    }).toList();
    return list;
  }
}
