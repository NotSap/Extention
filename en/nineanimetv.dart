import 'package:mangayomi/bridge_lib.dart';
import 'dart:convert';

class NineAnimeTV extends MProvider {
  NineAnimeTV();
  @override
  final String id = "nineanimetv";
  final String name = "9AnimeTV";
  final String lang = "en";
  final bool isNsfw = false;
  final String baseUrl = "https://www.nineanimetv.com";

  // KEEP YOUR EXISTING METHODS (getPopular, getLatestUpdates, search, getDetail, getFilterList)
  // Only updating getPageList below:

  @override
  Future<List<String>> getPageList(MChapter chapter) async {
    try {
      final res = await MProvider.http.get(chapter.url);
      final html = parse(res.body);

      // 1. Extract the encrypted JS payload
      final script = html.select('script:contains(var ts_net)').first.text;

      // 2. Decrypt the video URL (updated logic)
      final tsNet = script.split("var ts_net = ")[1].split(";")[0];
      final reversedParts = tsNet.replaceAll("'", "").split(',').reversed.toList();
      final serverUrl = reversedParts[0].replaceAll(RegExp(r'[^A-Za-z0-9\-_\.\/:]'), '');

      final tokenMatch = RegExp(r'var en_token\s*=\s*"([^"]+)"').firstMatch(script);
      final token = tokenMatch?.group(1) ?? '';

      // 3. Fetch the final video URL
      final videoUrl = '$serverUrl/getvid?evid=$token';
      final videoRes = await MProvider.http.get(videoUrl, headers: {'Referer': chapter.url});
      final videoData = jsonDecode(videoRes.body);

      return [videoData['data']['src']]; // Direct video URL
    } catch (e) {
      throw Exception("Failed to extract video: ${e.toString()}");
    }
  }
}
