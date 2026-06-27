import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOmdbPosterUrl, extractPosterUrl } from '../server.js';

test('buildOmdbPosterUrl uses the OMDb API endpoint', () => {
  assert.equal(
    buildOmdbPosterUrl('Mad Max: Fury Road'),
    'https://www.omdbapi.com/?apikey=trilogy&t=Mad%20Max%3A%20Fury%20Road&type=movie'
  );
});

test('extractPosterUrl returns the IMDb poster from page metadata', () => {
  const html = '<html><head><meta property="og:image" content="https://m.media-amazon.com/images/MV5BMTYzNjE2NDQ5OF5BMl5BanBnXkFtZTcwNjg4ODc0NA@@._V1_.jpg" /></head></html>';

  assert.equal(
    extractPosterUrl(html),
    'https://m.media-amazon.com/images/MV5BMTYzNjE2NDQ5OF5BMl5BanBnXkFtZTcwNjg4ODc0NA@@._V1_.jpg'
  );
});
