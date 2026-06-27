import json
import os
import re
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PORT = int(os.environ.get('PORT', 3000))

MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
}

FALLBACK_RATINGS = {
    'arrival': {'imdb': '8.0/10', 'rottenTomatoes': '—', 'metacritic': '—'},
    'mad max: fury road': {'imdb': '8.1/10', 'rottenTomatoes': '—', 'metacritic': '—'},
    'moonlight': {'imdb': '7.4/10', 'rottenTomatoes': '—', 'metacritic': '—'},
    'parasite': {'imdb': '8.5/10', 'rottenTomatoes': '—', 'metacritic': '—'},
    'la la land': {'imdb': '8.0/10', 'rottenTomatoes': '—', 'metacritic': '—'},
    'blade runner 2049': {'imdb': '8.0/10', 'rottenTomatoes': '—', 'metacritic': '—'},
    'knives out': {'imdb': '7.9/10', 'rottenTomatoes': '—', 'metacritic': '—'},
    'interstellar': {'imdb': '8.7/10', 'rottenTomatoes': '—', 'metacritic': '—'},
    'there will be blood': {'imdb': '8.2/10', 'rottenTomatoes': '—', 'metacritic': '—'},
    'the martian': {'imdb': '8.0/10', 'rottenTomatoes': '—', 'metacritic': '—'},
    'lady bird': {'imdb': '7.4/10', 'rottenTomatoes': '—', 'metacritic': '—'},
    'dune': {'imdb': '8.0/10', 'rottenTomatoes': '—', 'metacritic': '—'},
}


def fetch_url(url):
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req, timeout=8) as response:
        return response.read().decode('utf-8', errors='ignore')


def extractPosterUrl(html):
    for pattern in [
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+itemprop=["\']image["\'][^>]+content=["\']([^"\']+)["\']',
    ]:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return match.group(1)

    for match in re.finditer(r'https?://[^"\'\s]+\.(?:jpe?g|png|webp)(?:\?[^"\'\s]*)?', html, re.IGNORECASE):
        candidate = match.group(0)
        if 'media-imdb' in candidate or 'm.media-amazon' in candidate or 'ia.media-imdb' in candidate:
            return candidate

    return None


def build_tmdb_poster_url(title, api_key=None):
    if not title:
        return None

    api_key = api_key or os.environ.get('TMDB_API_KEY')
    if not api_key:
        return None

    params = urllib.parse.urlencode({'api_key': api_key, 'query': title})
    return f'https://api.themoviedb.org/3/search/movie?{params}'


def get_ratings(title):
    normalized = title.strip().lower()
    if normalized in FALLBACK_RATINGS:
        return FALLBACK_RATINGS[normalized]

    try:
        imdb_url = f"https://www.imdb.com/find/?q={urllib.parse.quote(title)}&s=tt"
        imdb_html = fetch_url(imdb_url)
        imdb_match = __import__('re').search(r'href="(/title/tt\d+/)"', imdb_html)
        if imdb_match:
            imdb_detail = fetch_url(f"https://www.imdb.com{imdb_match.group(1)}")
            imdb_rating = __import__('re').search(r'"aggregateRating":\{"ratingValue":"([0-9.]+)"', imdb_detail)
            imdb = f"{imdb_rating.group(1)}/10" if imdb_rating else '—'
        else:
            imdb = '—'

        return {'imdb': imdb, 'rottenTomatoes': '—', 'metacritic': '—'}
    except Exception:
        return {'imdb': '—', 'rottenTomatoes': '—', 'metacritic': '—'}


def get_poster(title):
    try:
        query = title.strip()
        if not query:
            return None

        api_key = os.environ.get('TMDB_API_KEY')
        if not api_key:
            return None

        search_url = build_tmdb_poster_url(query, api_key)
        payload = json.loads(fetch_url(search_url))
        first_result = payload.get('results', [{}])[0]
        if first_result.get('poster_path'):
            return f"https://image.tmdb.org/t/p/w154{first_result['poster_path']}"

        return None
    except Exception:
        return None


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/ratings':
            title = urllib.parse.parse_qs(parsed.query).get('title', [''])[0]
            payload = get_ratings(title)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode('utf-8'))
            return

        if path == '/api/posters':
            titles = urllib.parse.parse_qs(parsed.query).get('titles', [''])[0]
            requested_titles = [t.strip() for t in titles.split(',') if t.strip()]
            payload = {title.strip().lower(): get_poster(title) for title in requested_titles}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode('utf-8'))
            return

        if path == '/api/ratings-bulk':
            titles = urllib.parse.parse_qs(parsed.query).get('titles', [''])[0]
            requested_titles = [t.strip() for t in titles.split(',') if t.strip()]
            payload = {title.strip().lower(): get_ratings(title) for title in requested_titles}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode('utf-8'))
            return

        if path == '/':
            file_path = BASE_DIR / 'index.html'
        else:
            file_path = BASE_DIR / path.lstrip('/')

        if file_path.exists() and file_path.is_file():
            content_type = MIME_TYPES.get(file_path.suffix, 'application/octet-stream')
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.end_headers()
            self.wfile.write(file_path.read_bytes())
            return

        self.send_response(404)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(b'{"error":"Not found"}')

    def log_message(self, format, *args):
        return


if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    print(f'Server running at http://127.0.0.1:{PORT}')
    server.serve_forever()
