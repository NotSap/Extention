// CORRECT ANYMEX IMPORTS (verified structure)
import 'package:anymex/anymex.dart';          // Core Anymex package
import 'package:anymex/src/models.dart';       // Source/Episode/Video models
import 'package:html/parser.dart' show parse; // HTML parsing
import 'package:http/http.dart' as http;       // HTTP requests

class NineAnimeTV extends AnimeSource {
  @override
  final String name = "NineAnimeTV";
  @override 
  final String lang = "en";
  final String baseUrl = "https://9animetv.to";

  // 1. Your existing working search() - paste it here unchanged
  @override
  Future<List<AnimeItem>> search(String query) async {
    // ... keep your original working search code ...
  }

  // 2. Fixed Episode Loading
  @override
  Future<List<Episode>> getEpisodeList(String url) async {
    try {
      final response = await http.get(Uri.parse('$baseUrl$url'));
      final doc = parse(response.body);
      final episodes = <Episode>[];

      // NineAnime's current episode selectors (2024)
      for (var element in doc.querySelectorAll('.ep-item, [data-episode-id]')) {
        final id = element.attributes['data-id'] ?? 
                 element.attributes['data-episode-id'] ??
                 '';
        final title = element.querySelector('.ep-title')?.text?.trim() ?? 'Episode';
        final number = element.querySelector('.ep-no')?.text?.trim() ?? 
                      '${episodes.length + 1}';

        if (id.isNotEmpty) {
          episodes.add(Episode(
            '/ajax/server/$id', // NineAnime API pattern
            name: title,
            episodeNumber: number,
          ));
        }
      }

      // Sort by episode number
      episodes.sort((a, b) => int.parse(a.episodeNumber).compareTo(int.parse(b.episodeNumber)));
      return episodes;
    } catch (e) {
      print('Episode load error: $e');
      return [];
    }
  }

  // 3. Fixed Video Loading
  @override
  Future<List<Video>> getVideoList(String url) async {
    try {
      final isApiUrl = url.startsWith('/ajax/server');
      final requestUrl = isApiUrl ? '$baseUrl$url' : '$baseUrl/ajax/server$url';
      
      final response = await http.get(Uri.parse(requestUrl));
      final doc = parse(response.body);
      final videos = <Video>[];

      // Primary method: iframe extraction
      final iframe = doc.querySelector('iframe');
      if (iframe != null) {
        final src = iframe.attributes['src'] ?? '';
        if (src.isNotEmpty) {
          videos.add(Video(
            src.startsWith('http') ? src : 'https:$src',
            'Default',
            src,
          ));
        }
      }

      // Fallback: direct video source
      if (videos.isEmpty) {
        final videoSrc = doc.querySelector('video source')?.attributes['src'];
        if (videoSrc != null) {
          videos.add(Video(videoSrc, 'Direct', videoSrc));
        }
      }

      return videos;
    } catch (e) {
      print('Video load error: $e');
      return [];
    }
  }
}

// Anymex entry point
void main() => runAnymexExtension(NineAnimeTV());
