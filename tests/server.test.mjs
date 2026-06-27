import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTmdbPosterUrl, extractPosterUrl } from '../server.js';

test('buildTmdbPosterUrl uses the TMDb API endpoint', () => {
  assert.equal(
    buildTmdbPosterUrl('Mad Max: Fury Road', 'demo-key'),
    'https://api.themoviedb.org/3/search/movie?api_key=demo-key&query=Mad+Max%3A+Fury+Road'
  );
});

test('extractPosterUrl returns the IMDb poster from page metadata', () => {
  const html = '<html><head><meta property="og:image" content="https://m.media-amazon.com/images/MV5BMTYzNjE2NDQ5OF5BMl5BanBnXkFtZTcwNjg4ODc0NA@@._V1_.jpg" /></head></html>';

  assert.equal(
    extractPosterUrl(html),
    'https://m.media-amazon.com/images/MV5BMTYzNjE2NDQ5OF5BMl5BanBnXkFtZTcwNjg4ODc0NA@@._V1_.jpg'
  );
});
