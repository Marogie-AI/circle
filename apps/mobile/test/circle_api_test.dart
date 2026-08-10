import 'package:circle_mobile/src/api/api_exception.dart';
import 'package:circle_mobile/src/api/circle_api.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _feedBody = '''
{"group":{"name":"Grifters","slug":"grifters"},
 "items":[{"id":"p1","title":"Hi","tags":["eng"],
           "createdAt":"2026-01-01T00:00:00.000Z","authorName":"Ada",
           "ogImage":null,"commentCount":0,"reactionCount":2}],
 "nextCursor":"2026-01-01T00:00:00.000Z_p1"}
''';

void main() {
  test('sign-in stores the token; reads send it as a bearer header', () async {
    late http.BaseRequest lastRequest;
    final api = CircleApi('http://x', client: MockClient((request) async {
      lastRequest = request;
      if (request.url.path.endsWith('/sign-in/email')) {
        return http.Response('{"token":"T","user":{"id":"u"}}', 200);
      }
      return http.Response(_feedBody, 200);
    }));

    await api.signIn('a@b.c', 'password');
    expect(api.isSignedIn, isTrue);

    final page = await api.feed('grifters', cursor: 'c0');

    expect(lastRequest.headers['authorization'], 'Bearer T');
    expect(lastRequest.url.queryParameters['cursor'], 'c0');
    expect(lastRequest.url.path, '/api/mobile/groups/grifters/feed');

    expect(page.groupName, 'Grifters');
    expect(page.items.single.title, 'Hi');
    expect(page.items.single.tags, ['eng']);
    expect(page.items.single.reactionCount, 2);
    expect(page.nextCursor, '2026-01-01T00:00:00.000Z_p1');
  });

  test('no cursor on the first page', () async {
    late Uri seen;
    final api = CircleApi('http://x', client: MockClient((request) async {
      seen = request.url;
      return http.Response(_feedBody, 200);
    }));

    await api.feed('grifters');

    expect(seen.queryParameters.containsKey('cursor'), isFalse);
  });

  test('sign-out revokes the server session and always clears the local token', () async {
    late http.Request signOutRequest;
    final api = CircleApi('http://x', client: MockClient((request) async {
      if (request.url.path.endsWith('/sign-in/email')) {
        return http.Response('{"token":"T","user":{"id":"u"}}', 200);
      }
      signOutRequest = request;
      return http.Response('{}', 204);
    }));

    await api.signIn('a@b.c', 'password');
    await api.signOut();

    expect(api.isSignedIn, isFalse);
    expect(signOutRequest.url.path, '/api/auth/sign-out');
    expect(signOutRequest.headers['authorization'], 'Bearer T');
  });

  test('failed remote sign-out still clears the local token', () async {
    final api = CircleApi('http://x', client: MockClient((request) async {
      if (request.url.path.endsWith('/sign-in/email')) {
        return http.Response('{"token":"T","user":{"id":"u"}}', 200);
      }
      return http.Response('{}', 500);
    }));

    await api.signIn('a@b.c', 'password');

    await expectLater(api.signOut(), throwsA(isA<ApiException>()));
    expect(api.isSignedIn, isFalse);
  });

  test('groups parses the list', () async {
    final api = CircleApi('http://x', client: MockClient((_) async {
      return http.Response(
        '{"groups":[{"id":"g1","name":"Grifters","slug":"grifters","role":"admin"}]}',
        200,
      );
    }));

    final groups = await api.groups();

    expect(groups.single.slug, 'grifters');
    expect(groups.single.role, 'admin');
  });

  test('401 and 404 surface as ApiException, not a parse crash', () async {
    final unauthorized = CircleApi('http://x', client: MockClient((_) async {
      return http.Response('{"error":"unauthorized"}', 401);
    }));
    final missing = CircleApi('http://x', client: MockClient((_) async {
      return http.Response('{"error":"not_found"}', 404);
    }));

    expect(
      () => unauthorized.groups(),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 401)),
    );
    expect(
      () => missing.feed('nope'),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 404)),
    );
  });

  test('the sign-in rate limit reads as a cooldown, not a bad password', () async {
    final api = CircleApi('http://x', client: MockClient((_) async {
      return http.Response('{"message":"rate limited"}', 429);
    }));

    expect(
      () => api.signIn('a@b.c', 'password'),
      throwsA(isA<ApiException>().having((e) => e.message, 'message', contains('Wait'))),
    );
  });
}
