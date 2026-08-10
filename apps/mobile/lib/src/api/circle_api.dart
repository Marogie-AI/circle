import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/feed_page.dart';
import '../models/group.dart';
import 'api_exception.dart';

/// The only thing in this app that knows about HTTP.
///
/// Auth is a bearer token, not a cookie: better-auth returns the raw session token in the
/// sign-in body, and the `bearer` plugin on the server re-signs it. That keeps the client
/// free of a cookie jar and free of the origin/CSRF check a cookie would trigger.
///
/// The token is held in memory only — there is no stay-signed-in requirement yet, so there
/// is nothing to persist and nothing to leak from disk.
class CircleApi {
  CircleApi(this.baseUrl, {http.Client? client}) : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  String? _token;

  bool get isSignedIn => _token != null;

  Future<void> signIn(String email, String password) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/api/auth/sign-in/email'),
      headers: const {'content-type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    // The server rate-limits sign-in to 3 per 60s. Say so rather than showing
    // "invalid password" for what is really a cooldown.
    if (response.statusCode == 429) {
      throw const ApiException(429, 'Too many attempts. Wait a minute, then try again.');
    }
    if (response.statusCode != 200) {
      throw const ApiException(401, 'Invalid email or password');
    }

    final token = (jsonDecode(response.body) as Map<String, dynamic>)['token'] as String?;
    if (token == null) {
      throw const ApiException(500, 'Sign-in returned no session token');
    }
    _token = token;
  }

  Future<void> signOut() async {
    final token = _token;
    // Local sign-out must succeed even if the revocation request cannot reach the server.
    _token = null;
    if (token == null) return;

    final response = await _client.post(
      Uri.parse('$baseUrl/api/auth/sign-out'),
      headers: {'authorization': 'Bearer $token'},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(response.statusCode, 'Could not revoke the session');
    }
  }

  Future<List<Group>> groups() async {
    final body = await _get(Uri.parse('$baseUrl/api/mobile/groups'));
    return (body['groups'] as List<dynamic>)
        .map((group) => Group.fromJson(group as Map<String, dynamic>))
        .toList(growable: false);
  }

  Future<FeedPage> feed(String slug, {String? cursor, String? tag}) async {
    final uri = Uri.parse('$baseUrl/api/mobile/groups/$slug/feed').replace(
      queryParameters: {'cursor': ?cursor, 'tag': ?tag},
    );
    return FeedPage.fromJson(await _get(uri));
  }

  Future<Map<String, dynamic>> _get(Uri uri) async {
    final response = await _client.get(
      uri,
      headers: _token == null ? const {} : {'authorization': 'Bearer $_token'},
    );

    switch (response.statusCode) {
      case 200:
        return jsonDecode(response.body) as Map<String, dynamic>;
      case 401:
        throw const ApiException(401, 'Session expired. Sign in again.');
      // The server returns 404 for both "no such group" and "not a member" on purpose.
      // Do not try to tell them apart here either.
      case 404:
        throw const ApiException(404, 'Not found');
      default:
        throw ApiException(response.statusCode, 'Request failed (${response.statusCode})');
    }
  }
}
