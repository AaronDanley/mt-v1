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
    'arrival': {'imdb': '8.0/10', 'rottenTomatoes': '94%', 'metacritic': '81'},
    'mad max: fury road': {'imdb': '8.1/10', 'rottenTomatoes': '97%', 'metacritic': '86'},
    'moonlight': {'imdb': '7.4/10', 'rottenTomatoes': '98%', 'metacritic': '99'},
    'parasite': {'imdb': '8.5/10', 'rottenTomatoes': '99%', 'metacritic': '96'},
    'la la land': {'imdb': '8.0/10', 'rottenTomatoes': '91%', 'metacritic': '93'},
    'blade runner 2049': {'imdb': '8.0/10', 'rottenTomatoes': '88%', 'metacritic': '81'},
    'knives out': {'imdb': '7.9/10', 'rottenTomatoes': '97%', 'metacritic': '82'},
    'interstellar': {'imdb': '8.7/10', 'rottenTomatoes': '72%', 'metacritic': '74'},
    'there will be blood': {'imdb': '8.2/10', 'rottenTomatoes': '91%', 'metacritic': '92'},
    'the martian': {'imdb': '8.0/10', 'rottenTomatoes': '91%', 'metacritic': '80'},
    'lady bird': {'imdb': '7.4/10', 'rottenTomatoes': '99%', 'metacritic': '94'},
    'dune': {'imdb': '8.0/10', 'rottenTomatoes': '83%', 'metacritic': '74'},
}


def fetch_url(url):
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req, timeout=8) as response:
        return response.read().decode('utf-8', errors='ignore')


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

        rt_url = f"https://www.rottentomatoes.com/search?search={urllib.parse.quote(title)}"
        rt_html = fetch_url(rt_url)
        rt_match = __import__('re').search(r'href="(/m/[^"?]+)"', rt_html)
        rotten = '—'
        if rt_match:
            rt_detail = fetch_url(f"https://www.rottentomatoes.com{rt_match.group(1)}")
            rt_rating = __import__('re').search(r'([0-9]{1,3})%', rt_detail)
            if rt_rating:
                rotten = f"{rt_rating.group(1)}%"

        mc_url = f"https://www.metacritic.com/search/movie/{urllib.parse.quote(title)}/results"
        mc_html = fetch_url(mc_url)
        mc_match = __import__('re').search(r'href="(/movie/[^"?]+)"', mc_html)
        metacritic = '—'
        if mc_match:
            mc_detail = fetch_url(f"https://www.metacritic.com{mc_match.group(1)}")
            mc_rating = __import__('re').search(r'itemprop="ratingValue" content="([0-9]{1,3})"', mc_detail)
            if mc_rating:
                metacritic = mc_rating.group(1)

        return {'imdb': imdb, 'rottenTomatoes': rotten, 'metacritic': metacritic}
    except Exception:
        return {'imdb': '—', 'rottenTomatoes': '—', 'metacritic': '—'}


def get_poster(title):
    try:
        query = title.strip().lower()
        if not query:
            return None

        suggestion_url = f"https://v2.sg.media-imdb.com/suggestion/{query[0]}/{query}.json"
        suggestion_data = fetch_url(suggestion_url)
        payload = json.loads(suggestion_data)
        results = payload.get('d', [])
        if not results:
            return None

        poster = results[0].get('i', {}).get('imageUrl')
        return poster if poster else None
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
