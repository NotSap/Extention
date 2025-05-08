import 'package:mangayomi/bridge_lib.dart';
import 'dart:convert';

class NineAnime extends MProvider {
  NineAnime({required this.source});

  final MSource source;
  final Client client = Client(source);
  final _baseHeaders = {
    "Referer": "https://9anime.pl/",
    "Origin": "https://9anime.pl"
  };

  @override
  Future<MPages> getPopular(int page) => _getAnimeList("popular", page);

  @override
  Future<MPages> getLatestUpdates(int page) => _getAnimeList("updated", page);

  Future<MPages> _getAnimeList(String sort, int page) async {
    final res = (await client.get(
      Uri.parse("${source.baseUrl}/filter?sort=$sort&page=$page"),
    )).body;

    final doc = parseHtml(res);
    final items = doc.select(".film-list > .item").map((el) {
      final isDub = el.select(".dub").isNotEmpty;
      return MManga()
        ..name = "${el.select(".name").text}${isDub ? ' (Dub)' : ''}"
        ..imageUrl = el.select("img").attr("src")
        ..link = el.select("a").attr("href")
        ..language = isDub ? "dub" : "sub";
    }).toList();

    return MPages(items, doc.select(".pagination > a").isNotEmpty);
  }

  @override
  Future<MPages> search(String query, int page, FilterList filters) async {
    final res = (await client.get(
      Uri.parse("${source.baseUrl}/filter?keyword=${Uri.encodeComponent(query)}&page=$page"),
    )).body;
    return _getAnimeList("", page); // Reuse same parser
  }

  @override
  Future<MManga> getDetail(String url) async {
    final res = (await client.get(Uri.parse("${source.baseUrl}$url"))).body;
    final doc = parseHtml(res);

    final episodes = (await client.get(
      Uri.parse("${source.baseUrl}/ajax/film/servers?id=${doc.select("[data-film-id]").attr("data-film-id")}"),
      headers: _baseHeaders,
    )).then((r) => jsonDecode(r.body)["html"])
      .then((html) => parseHtml(html).select(".server").expand((server) {
        final type = server.attr("data-type")!;
        return server.select(".episodes > a").map((ep) => MChapter()
          ..name = "Episode ${ep.text} (${type.capitalize()})"
          ..url = "${ep.attr("data-id")}|$type"
        );
      })).then((eps) => eps.toList());

    return MManga()
      ..description = doc.select(".content").text
      ..status = doc.select(".status").text.contains("Ongoing") ? 0 : 1
      ..genre = doc.select(".genre > a").map((e) => e.text).toList()
      ..chapters = await episodes;
  }

  @override
  Future<List<MVideo>> getVideoList(String url) async {
    final parts = url.split("|");
    final res = (await client.get(
      Uri.parse("${source.baseUrl}/ajax/episode/info?id=${parts[0]}&server=${parts[1]}"),
      headers: _baseHeaders,
    )).body;

    final data = jsonDecode(res);
    if (data["url"] == null) return [];

    return [MVideo()
      ..url = data["url"].toString()
      ..quality = "Default (${parts[1].capitalize()})"
      ..headers = _baseHeaders];
  }
}

NineAnime main(MSource source) => NineAnime(source: source);
