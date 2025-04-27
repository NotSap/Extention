import 'package:mangayomi/bridge_lib.dart';
import 'dart:convert';

class NineAnimeTV extends MProvider {
  NineAnimeTV();
  @override
  final String id = "nineanimetv";
  final String name = "9AnimeTV";
  final String lang = "en";
  final bool isNsfw = false;
  final String baseUrl = "https://9animetv.to";

  // Create HTTP client instance
  final client = HttpClient();

  @override
  Future<MPages> getPopular(MSource source, int page) async {
    final res = await client.get(Uri.parse("$baseUrl/filter?sort=views&page=$page"));
    final items = parse(res.body)
        .select('.film-list .film-item')
        .map((e) {
          final title = e.select('.film-name a').attr('title') ?? '';
          final url = e.select('.film-name a').attr('href') ?? '';
          final cover = e.select('.film-poster img').attr('data-src') ?? '';
          return MChapter(
              name: title,
              url: url,
              imageUrl: cover);
        })
        .toList();
    return MPages(items, true);
  }

  // [Keep all other methods the same but replace MProvider.http with client.get]
  // [Update all HTTP calls similarly]

  @override
  Future<List<String>> getPageList(MChapter chapter) async {
    final res = await client.get(Uri.parse(chapter.url));
    final script = parse(res.body).select('script:contains(ts_net)').first.text;
    
    final tsNet = script.split("var ts_net = ")[1].split(";")[0];
    final list = tsNet.replaceAll("'", "").split(',').reversed.toList();
    final serverUrl = list[0].replaceAll(RegExp(r'[^A-Za-z0-9\-_\.\/:]'), '');

    final tokenMatch = RegExp(r'var en_token\s*=\s*"([^"]+)"').firstMatch(script);
    final token = tokenMatch?.group(1) ?? '';

    final videoUrl = '$serverUrl/getvid?evid=$token';
    final videoRes = await client.get(Uri.parse(videoUrl), headers: {'Referer': chapter.url});
    final videoJson = jsonDecode(videoRes.body);
    final videoSrc = videoJson['data']['src'];

    return [videoSrc];
  }

  @override
  void dispose() {
    client.close();
    super.dispose();
  }
}
