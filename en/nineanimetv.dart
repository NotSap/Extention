// Use THESE imports instead (standard for Anymex extensions):
import 'package:anymex/anymex.dart';
import 'package:anymex/src/models.dart';
import 'package:html/parser.dart' show parse;
import 'dart:convert';
import 'package:http/http.dart';

const baseUrl = "https://9animetv.to";

class NineAnimeTV extends AnimeSource {
  @override
  String get name => "NineAnimeTV";

  @override 
  String get lang => "en";

  // 1. Keep original search() method exactly as it was
  @override
  Future<List<AnimeItem>> search(String query) async {
    // ... your existing working search code ...
  }

  // 2. Keep original getHomePage() if it exists
  @override
  Future<List<AnimeItem>> getHomePage() async {
    // ... existing home page code ...
  }

  // 3. Fixed episode list loader
  @override
  Future<List<Episode>> getEpisodeList(String url) async {
    try {
      final response = await get(Uri.parse('$baseUrl$url'));
      final doc = parse(response.body);
      final episodes = <Episode>[];
      
      // Modern NineAnime selectors
      for (var element in doc.querySelectorAll('.ep-item, [data-episode-id]')) {
        final id = element.attributes['data-id'] ?? 
                 element.attributes['data-episode-id'] ??
                 '';
        final title = element.querySelector('.ep-title, .title')?.text?.trim() ?? 'Episode';
        final number = element.querySelector('.ep-no, .number')?.text?.trim() ?? 
                      '${episodes.length + 1}';
        
        if (id.isNotEmpty) {
          episodes.add(Episode(
            '/ajax/server/list/$id', // Common NineAnime pattern
            name: title,
            episodeNumber: number,
          ));
        }
      }
      
      return episodes;
    } catch (e) {
      print('Episode Load Error: $e');
      return [];
    }
  }

  // 4. Fixed video loader
  @override
  Future<List<Video>> getVideoList(String url) async {
    try {
      // Handle both direct URLs and API endpoints
      final isApiUrl = url.contains('/ajax/server/');
      final targetUrl = isApiUrl ? '$baseUrl$url' : '$baseUrl/ajax/server$url';
      
      final response = await get(Uri.parse(targetUrl));
      final doc = parse(response.body);
      final videos = <Video>[];
      
      // Primary method: Extract from iframe
      final iframe = doc.querySelector('iframe');
      if (iframe != null) {
        final src = iframe.attributes['src'] ?? '';
        if (src.isNotEmpty) {
          videos.add(Video(
            src.startsWith('http') ? src : 'https:$src',
            'Default',
            src
          ));
        }
      }
      
      // Fallback: Direct video links
      if (videos.isEmpty) {
        final videoElement = doc.querySelector('video');
        if (videoElement != null) {
          final src = videoElement.attributes['src'] ?? '';
          if (src.isNotEmpty) {
            videos.add(Video(src, 'Direct', src));
          }
        }
      }
      
      return videos;
    } catch (e) {
      print('Video Load Error: $e');
      return [];
    }
  }
}

void main() => runApp(ExtensionRunner(source: NineAnimeTV()));
