import http from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const FALLBACK_RATINGS = {
  arrival: { imdb: '8.0/10', rottenTomatoes: '—', metacritic: '—' },
  'mad max: fury road': { imdb: '8.1/10', rottenTomatoes: '—', metacritic: '—' },
  moonlight: { imdb: '7.4/10', rottenTomatoes: '—', metacritic: '—' },
  parasite: { imdb: '8.5/10', rottenTomatoes: '—', metacritic: '—' },
  'la la land': { imdb: '8.0/10', rottenTomatoes: '—', metacritic: '—' },
  'blade runner 2049': { imdb: '8.0/10', rottenTomatoes: '—', metacritic: '—' },
  'knives out': { imdb: '7.9/10', rottenTomatoes: '—', metacritic: '—' },
  interstellar: { imdb: '8.7/10', rottenTomatoes: '—', metacritic: '—' },
  'there will be blood': { imdb: '8.2/10', rottenTomatoes: '—', metacritic: '—' },
  'the martian': { imdb: '8.0/10', rottenTomatoes: '—', metacritic: '—' },
  'lady bird': { imdb: '7.4/10', rottenTomatoes: '—', metacritic: '—' },
  dune: { imdb: '8.0/10', rottenTomatoes: '—', metacritic: '—' },
};

function getFilePath(requestPath) {
  if (requestPath === '/') return path.join(__dirname, 'index.html');
  const safePath = requestPath.split('?')[0];
  return path.join(__dirname, safePath.replace(/^\//, ''));
}

function sendJson(res, payload, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function normalizeTitle(title) {
  return String(title || '').trim().toLowerCase();
}

export function extractPosterUrl(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  const imageMatch = html.match(/https?:\/\/[^"'\s]+\.(?:jpe?g|png|webp)(?:\?[^"'\s]*)?/i);
  if (imageMatch) {
    return imageMatch[0];
  }

  return null;
}

export function buildTmdbPosterUrl(title, apiKey = process.env.TMDB_API_KEY) {
  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle || !apiKey) {
    return null;
  }

  const url = new URL('https://api.themoviedb.org/3/search/movie');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', normalizedTitle);
  return url.toString();
}

function extractText(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

async function fetchUrl(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.text();
}

async function getPoster(title) {
  const normalized = normalizeTitle(title);
  if (!normalized) {
    return null;
  }

  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return null;
    }

    const searchUrl = buildTmdbPosterUrl(title, apiKey);
    const searchResponse = await fetchUrl(searchUrl);
    const searchPayload = JSON.parse(searchResponse);
    const firstResult = searchPayload.results?.[0];

    if (firstResult?.poster_path) {
      return `https://image.tmdb.org/t/p/w154${firstResult.poster_path}`;
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function scrapeRating(title) {
  const normalized = normalizeTitle(title);
  if (FALLBACK_RATINGS[normalized]) {
    return FALLBACK_RATINGS[normalized];
  }

  const searchQueries = {
    imdb: `https://www.imdb.com/find/?q=${encodeURIComponent(title)}&s=tt`,
  };

  try {
    const imdbSearchHtml = await fetchUrl(searchQueries.imdb);
    const imdbPath = imdbSearchHtml.match(/href="(\/title\/tt\d+\/)"/);
    let imdb = null;
    if (imdbPath) {
      const detailHtml = await fetchUrl(`https://www.imdb.com${imdbPath[1]}`);
      imdb = extractText(detailHtml, [
        /"aggregateRating":\{"ratingValue":"([0-9.]+)"/i,
        /IMDb rating:\s*([0-9.]+)\/10/i,
        /aria-label="IMDb rating: ([0-9.]+)\/10"/i,
      ]);
    }

    return {
      imdb: imdb ? `${imdb}/10` : '—',
      rottenTomatoes: '—',
      metacritic: '—',
    };
  } catch (error) {
    return {
      imdb: '—',
      rottenTomatoes: '—',
      metacritic: '—',
    };
  }
}

function serveStaticFile(res, filePath) {
  const extension = path.extname(filePath);
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';
  const stream = createReadStream(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  const { url = '/' } = req;
  const [pathname] = url.split('?');

  if (pathname === '/api/ratings') {
    const { title = '' } = Object.fromEntries(new URLSearchParams(url.split('?')[1] || ''));
    const ratings = await scrapeRating(title);
    return sendJson(res, ratings);
  }

  if (pathname === '/api/posters') {
    const { titles = '' } = Object.fromEntries(new URLSearchParams(url.split('?')[1] || ''));
    const requestedTitles = titles.split(',').map((entry) => entry.trim()).filter(Boolean);
    const posters = {};
    for (const title of requestedTitles) {
      posters[normalizeTitle(title)] = await getPoster(title);
    }
    return sendJson(res, posters);
  }

  if (pathname === '/api/ratings-bulk') {
    const { titles = '' } = Object.fromEntries(new URLSearchParams(url.split('?')[1] || ''));
    const requestedTitles = titles.split(',').map((entry) => entry.trim()).filter(Boolean);
    const ratings = {};
    for (const title of requestedTitles) {
      ratings[normalizeTitle(title)] = await scrapeRating(title);
    }
    return sendJson(res, ratings);
  }

  const filePath = getFilePath(pathname);
  if (existsSync(filePath) && !filePath.endsWith('/')) {
    return serveStaticFile(res, filePath);
  }

  if (pathname === '/') {
    return serveStaticFile(res, path.join(__dirname, 'index.html'));
  }

  return sendJson(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
