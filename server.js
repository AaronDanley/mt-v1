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
  arrival: { imdb: '8.0/10', rottenTomatoes: '94%', metacritic: '81' },
  'mad max: fury road': { imdb: '8.1/10', rottenTomatoes: '97%', metacritic: '86' },
  moonlight: { imdb: '7.4/10', rottenTomatoes: '98%', metacritic: '99' },
  parasite: { imdb: '8.5/10', rottenTomatoes: '99%', metacritic: '96' },
  'la la land': { imdb: '8.0/10', rottenTomatoes: '91%', metacritic: '93' },
  'blade runner 2049': { imdb: '8.0/10', rottenTomatoes: '88%', metacritic: '81' },
  'knives out': { imdb: '7.9/10', rottenTomatoes: '97%', metacritic: '82' },
  interstellar: { imdb: '8.7/10', rottenTomatoes: '72%', metacritic: '74' },
  'there will be blood': { imdb: '8.2/10', rottenTomatoes: '91%', metacritic: '92' },
  'the martian': { imdb: '8.0/10', rottenTomatoes: '91%', metacritic: '80' },
  'lady bird': { imdb: '7.4/10', rottenTomatoes: '99%', metacritic: '94' },
  dune: { imdb: '8.0/10', rottenTomatoes: '83%', metacritic: '74' },
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

async function scrapeRating(title) {
  const normalized = normalizeTitle(title);
  if (FALLBACK_RATINGS[normalized]) {
    return FALLBACK_RATINGS[normalized];
  }

  const searchQueries = {
    imdb: `https://www.imdb.com/find/?q=${encodeURIComponent(title)}&s=tt`,
    rottenTomatoes: `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`,
    metacritic: `https://www.metacritic.com/search/movie/${encodeURIComponent(title)}/results`,
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

    const rtSearchHtml = await fetchUrl(searchQueries.rottenTomatoes);
    const rtPath = rtSearchHtml.match(/href="(\/m\/[^"?]+)"/);
    let rottenTomatoes = null;
    if (rtPath) {
      const detailHtml = await fetchUrl(`https://www.rottentomatoes.com${rtPath[1]}`);
      rottenTomatoes = extractText(detailHtml, [
        /tomatometer[^>]*>([0-9]{1,3})%/i,
        /Tomatometer[^0-9]+([0-9]{1,3})%/i,
      ]);
    }

    const metacriticSearchHtml = await fetchUrl(searchQueries.metacritic);
    const mcPath = metacriticSearchHtml.match(/href="(\/movie\/[^"?]+)"/);
    let metacritic = null;
    if (mcPath) {
      const detailHtml = await fetchUrl(`https://www.metacritic.com${mcPath[1]}`);
      metacritic = extractText(detailHtml, [
        /itemprop="ratingValue" content="([0-9]{1,3})"/i,
        /Metascore[^0-9]+([0-9]{1,3})/i,
        /metascore_w[^>]*>([0-9]{1,3})</i,
      ]);
    }

    return {
      imdb: imdb ? `${imdb}/10` : '—',
      rottenTomatoes: rottenTomatoes ? `${rottenTomatoes}%` : '—',
      metacritic: metacritic ? `${metacritic}` : '—',
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
