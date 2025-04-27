import 'package:anymex/anymex.dart';
import 'package:anymex/src/models.dart';
import 'package:html/parser.dart' show parse;
import 'dart:convert';
import 'package:http/http.dart' as http;

class NineAnimeTV extends AnimeSource {
  @override
  final String name = "NineAnimeTV";
  @override 
  final String lang = "en";
  final String baseUrl = "https://9animetv.to";
  final http.Client client = http.Client();

  // 1. Search Functionality (your original working version)
  @override
  Future<List<AnimeItem>> search(String query) async {
    try {
      final response = await client.get(
        Uri.parse('$baseUrl/search?keyword=${Uri.encodeQueryComponent(query)}'),
        headers: {'Referer': baseUrl},
      );
      
      final doc = parse(response.body);
      final results = <AnimeItem>[];

      for (var element in doc.querySelectorAll('.film-list .film-item, .anime-card')) {
        final title = element.querySelector('.film-name, .card-name')?.text?.trim() ?? '';
        final href = element.querySelector('a')?.attributes['href']?.trim() ?? '';
        final thumbnail = element.querySelector('img')?.attributes['src']?.trim() ?? '';

        if (title.isNotEmpty && href.isNotEmpty) {
          results.add(AnimeItem(
            href,
            name: title,
            thumbnail: thumbnail.startsWith('http') ? thumbnail : '$baseUrl$thumbnail',
          ));
        }
      }
      return results;
    } catch (e) {
      print('Search error: $e');
      return [];
    }
  }

  // 2. Home Page (optional)
  @override
  Future<List<AnimeItem>> getHomePage() async {
    try {
      final response = await client.get(Uri.parse(baseUrl));
      final doc = parse(response.body);
      final results = <AnimeItem>[];

      for (var element in doc.querySelectorAll('.trending-list .film-item, .popular-list .film-item')) {
        final title = element.querySelector('.film-name')?.text?.trim() ?? '';
        final href = element.querySelector('a')?.attributes['href']?.trim() ?? '';
        final thumbnail = element.querySelector('img')?.attributes['src']?.trim() ?? '';

        if (title.isNotEmpty && href.isNotEmpty) {
          results.add(AnimeItem(
            href,
            name: title,
            thumbnail: thumbnail.startsWith('http') ? thumbnail : '$baseUrl$thumbnail',
          ));
        }
      }
      return results;
    } catch (e) {
      print('Home page error: $e');
      return [];
    }
  }

  // 3. Episode List
  @override
  Future<List<Episode>> getEpisodeList(String url) async {
    try {
      final response = await client.get(Uri.parse('$baseUrl$url'));
      final doc = parse(response.body);
      final episodes = <Episode>[];

      for (var element in doc.querySelectorAll('.ep-item, [data-episode-id]')) {
        final id = element.attributes['data-id'] ?? 
                 element.attributes['data-episode-id'] ??
                 '';
        final title = element.querySelector('.ep-title')?.text?.trim() ?? 'Episode';
        final number = element.querySelector('.ep-no')?.text?.trim() ?? 
                      '${episodes.length + 1}';

        if (id.isNotEmpty) {
          episodes.add(Episode(
            '/watch/$id',
            name: title,
            episodeNumber: number,
          ));
        }
      }

      // Sort episodes naturally
      episodes.sort((a, b) => int.parse(a.episodeNumber).compareTo(int.parse(b.episodeNumber)));
      return episodes;
    } catch (e) {
      print('Episode load error: $e');
      return [];
    }
  }

  // 4. Video Sources (fixed version)
  @override
  Future<List<Video>> getVideoList(String url) async {
    try {
      final response = await client.get(Uri.parse('$baseUrl$url'));
      final doc = parse(response.body);
      
      // First try: Extract from embedded script
      final scriptContent = doc.querySelector('script:contains("sources")')?.text;
      if (scriptContent != null) {
        final match = RegExp(r'sources:\s*(\[[^\]]+\])').firstMatch(scriptContent);
        if (match != null) {
          try {
            final sources = jsonDecode(match.group(1)!) as List;
            final videos = <Video>[];
            
            for (final source in sources) {
              final url = source['file']?.toString();
              final quality = source['label']?.toString() ?? 'Unknown';
              if (url != null && url.isNotEmpty) {
                videos.add(Video(
                  url,
                  quality,
                  url,
                  headers: {'Referer': baseUrl},
                ));
              }
            }
            if (videos.isNotEmpty) return videos;
          } catch (e) {
            print('JSON parse error: $e');
          }
        }
      }

      // Fallback to iframe
      final iframe = doc.querySelector('iframe');
      if (iframe != null) {
        final src = iframe.attributes['src'] ?? '';
        if (src.isNotEmpty) {
          return [
            Video(
              src.startsWith('http') ? src : 'https:$src',
              'Default',
              src,
              headers: {'Referer': baseUrl},
            )
          ];
        }
      }

      // Final fallback: server items
      final videos = <Video>[];
      for (var element in doc.querySelectorAll('.server-item')) {
        final videoUrl = element.attributes['data-video'];
        if (videoUrl != null && videoUrl.isNotEmpty) {
          videos.add(Video(
            videoUrl,
            'Server',
            videoUrl,
            headers: {'Referer': baseUrl},
          ));
        }
      }

      return videos;
    } catch (e) {
      print('Video load error: $e');
      return [];
    }
  }

  // 5. Clean up
  @override
  void dispose() {
    client.close();
    super.dispose();
  }
}

void main() => runAnymexExtension(NineAnimeTV());
