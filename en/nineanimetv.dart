// Minimal working imports for Anymex extensions
import 'package:anymex/main.dart';  // Core Anymex functionality
import 'package:anymex/src/source.dart';  // Source model definitions
import 'package:html/parser.dart' show parse;  // HTML parsing
import 'dart:convert';  // JSON handling
import 'package:http/http.dart' as http;  // HTTP requests

const baseUrl = "https://9animetv.to";

class NineAnimeTV extends AnimeSource {
  @override
  String get name => "NineAnimeTV";

  @override 
  String get lang => "en";

  // 1. Keep your original working search method
  @override
  Future<List<AnimeItem>> search(String query) async {
    // ... paste your existing working search implementation here ...
    // Make sure to keep all your original search code exactly as is
  }

  // 2. Fixed episode list loader
  @override
  Future<List<Episode>> getEpisodeList(String url) async {
    try {
      final response = await http.get(Uri.parse('$baseUrl$url'));
      if (response.statusCode != 200) {
        throw Exception('Failed to load episodes: ${response.statusCode}');
      }

      final doc = parse(response.body);
      final episodes = <Episode>[];
      
      // Modern NineAnime episode selectors (multiple fallbacks)
      for (var element in doc.querySelectorAll('.ep-item, .episode-item, [data-episode-id]')) {
        try {
          final id = element.attributes['data-id'] ?? 
                   element.attributes['data-episode-id'] ??
                   element.attributes['href']?.split('/').lastWhere((e) => e.isNotEmpty) ?? '';
          
          final title = element.querySelector('.ep-title, .title')?.text?.trim() ?? 'Episode';
          final number = element.querySelector('.ep-no, .number')?.text?.trim() ?? 
                        element.attributes['data-number'] ?? 
                        '${episodes.length + 1}';
          
          if (id.isNotEmpty) {
            episodes.add(Episode(
              '/watch/$id',  // Standard NineAnime pattern
              name: title,
              episodeNumber: number,
            ));
          }
        } catch (e) {
          print('Error parsing episode element: $e');
        }
      }

      // Sort episodes by number (ascending)
      episodes.sort((a, b) => a.episodeNumber.compareTo(b.episodeNumber));

      return episodes;
    } catch (e) {
      print('Episode Load Error: $e');
      return [];
    }
  }

  // 3. Fixed video loader
  @override
  Future<List<Video>> getVideoList(String url) async {
    try {
      final response = await http.get(Uri.parse('$baseUrl$url'));
      final doc = parse(response.body);
      final videos = <Video>[];

      // Method 1: Extract from embedded script data
      final scripts = doc.querySelectorAll('script');
      for (final script in scripts) {
        try {
          final content = script.text;
          if (content.contains('sources') && content.contains('file')) {
            final match = RegExp(r'sources:\s*(\[[^\]]+\])').firstMatch(content);
            if (match != null) {
              final sources = json.decode(match.group(1)!) as List;
              for (final source in sources) {
                final url = source['file']?.toString();
                final quality = source['label']?.toString() ?? 'HD';
                if (url != null && url.isNotEmpty) {
                  videos.add(Video(url, quality, url));
                }
              }
              if (videos.isNotEmpty) return videos;
            }
          }
        } catch (e) {
          print('Script parsing error: $e');
        }
      }

      // Method 2: Iframe fallback
      final iframe = doc.querySelector('iframe');
      if (iframe != null) {
        final src = iframe.attributes['src'] ?? '';
        if (src.isNotEmpty) {
          videos.add(Video(
            src.startsWith('http') ? src : 'https:$src',
            'Default',
            src
          ));
          return videos;
        }
      }

      // Method 3: Direct video element
      final videoElement = doc.querySelector('video');
      if (videoElement != null) {
        final src = videoElement.attributes['src'] ?? '';
        if (src.isNotEmpty) {
          videos.add(Video(src, 'Direct', src));
        }
      }

      if (videos.isEmpty) {
        print('Video sources not found. Page content:');
        print(response.body.substring(0, 500)); // Print first 500 chars for debugging
      }

      return videos;
    } catch (e) {
      print('Video Load Error: $e');
      return [];
    }
  }
}

// Standard Anymex extension entry point
void main() => runAnymexExtension(NineAnimeTV());
