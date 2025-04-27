import 'package:anymex/anymex.dart';
import 'package:anymex/src/models.dart';
import 'package:html/parser.dart' show parse;
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'dart:math';

class NineAnimeTV extends AnimeSource {
  // ... [Keep all your original constants and variables exactly as is] ...

  @override
  Future<List<AnimeItem>> search(String query) async {
    // ... [Keep your original 150+ line search method completely unchanged] ...
  }

  @override
  Future<List<AnimeItem>> getHomePage() async {
    // ... [Keep your original 100+ line home page method] ...
  }

  @override
  Future<List<Episode>> getEpisodeList(String url) async {
    // ... [Keep your original 120+ line episode loader] ...
  }

  // ========== ONLY MODIFY THIS SECTION ==========
  @override
  Future<List<Video>> getVideoList(String url) async {
    try {
      // 1. Get the video container page
      final response = await http.get(Uri.parse('$baseUrl$url'));
      final doc = parse(response.body);

      // 2. Extract encrypted source (multiple fallbacks)
      final encryptedUrl = doc.querySelector('[data-video-src]')?.attributes['data-video-src'] ?? 
                         doc.querySelector('.video-container')?.attributes['data-src'] ??
                         doc.querySelector('iframe')?.attributes['src'];

      if (encryptedUrl == null || encryptedUrl.isEmpty) {
        throw Exception('No video source found in page HTML');
      }

      // 3. Determine server type (0=megacloud, 1=rapidcloud)
      final serverType = encryptedUrl.contains('megacloud') ? 0 : 1;

      // 4. Get decryption keys (your original method)
      final decryptionKeys = await _generateIndexPairs(serverType);

      // 5. Decrypt the URL (NineAnime-specific implementation)
      final decryptedUrl = _decryptNineAnimeUrl(encryptedUrl, decryptionKeys);

      // 6. Return as playable video with required headers
      return [
        Video(
          decryptedUrl,
          'Decrypted Source',
          decryptedUrl,
          headers: {
            'Referer': baseUrl,
            'Origin': baseUrl,
            'User-Agent': 'Mozilla/5.0'
          }
        )
      ];

    } catch (e) {
      print('[NineAnime] Video load error: $e');
      return [];
    }
  }

  // Your original key generator (keep exactly as is)
  Future<List<List<int>>> _generateIndexPairs(int serverType) async {
    final jsPlayerUrl = [
      "https://megacloud.tv/js/player/a/prod/e1-player.min.js",
      "https://rapid-cloud.co/js/player/prod/e6-player-v2.min.js",
    ];
    final scriptText = (await http.get(Uri.parse(jsPlayerUrl[serverType]))).body;

    final switchCode = scriptText.substring(
      scriptText.lastIndexOf('switch'),
      scriptText.indexOf('=partKey'),
    );

    List<int> indexes = [];
    for (var variableMatch in RegExp(r'=(\w+)').allMatches(switchCode).toList()) {
      final regex = RegExp(
        ',${(variableMatch as RegExpMatch).group(1)}=((?:0x)?([0-9a-fA-F]+))',
      );
      Match? match = regex.firstMatch(scriptText);

      if (match != null) {
        String value = match.group(1)!;
        indexes.add(value.contains("0x") 
            ? int.parse(value.substring(2), radix: 16)
            : int.parse(value));
      }
    }

    return _chunkList(indexes, 2);
  }

  // NineAnime-specific URL decryption
  String _decryptNineAnimeUrl(String encryptedUrl, List<List<int>> keys) {
    try {
      // 1. Extract the encrypted payload
      final uri = Uri.parse(encryptedUrl);
      final encrypted = uri.pathSegments.last;

      // 2. Decrypt using keys
      final decrypted = StringBuffer();
      for (int i = 0; i < encrypted.length; i += 2) {
        final hex = encrypted.substring(i, min(i + 2, encrypted.length));
        final byte = int.parse(hex, radix: 16);
        final keyIndex = (i ~/ 2) % keys.length;
        final decryptedByte = byte ^ keys[keyIndex][0] ^ keys[keyIndex][1];
        decrypted.writeCharCode(decryptedByte);
      }

      // 3. Rebuild the final URL
      return '${uri.scheme}://${uri.host}/${decrypted.toString()}';
    } catch (e) {
      throw Exception('Decryption failed: $e');
    }
  }

  List<List<int>> _chunkList(List<int> list, int chunkSize) {
    // ... [Keep your original chunk implementation] ...
  }

  // ... [Keep all other original helper methods] ...

  @override
  void dispose() {
    // ... [Original cleanup code] ...
  }
}

void main() => runAnymexExtension(NineAnimeTV());
