import test from 'node:test';
import assert from 'node:assert/strict';
import { filterMovies, sortMovies } from '../movie-utils.js';

const movies = [
  { id: 1, title: 'Arrival', category: 'Sci-Fi', watchedDate: '2024-03-09', releaseDate: '2016-11-11' },
  { id: 2, title: 'Moonlight', category: 'Drama', watchedDate: '2024-01-14', releaseDate: '2016-10-21' },
  { id: 3, title: 'Mad Max', category: 'Action', watchedDate: '2024-05-27', releaseDate: '2015-05-15' }
];

test('filterMovies returns only matching category', () => {
  const filtered = filterMovies(movies, 'Drama');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, 'Moonlight');
});

test('sortMovies sorts by watched date descending by default', () => {
  const sorted = sortMovies(movies, 'watchedDate');
  assert.deepEqual(sorted.map((movie) => movie.title), ['Mad Max', 'Arrival', 'Moonlight']);
});

test('sortMovies sorts by category alphabetically', () => {
  const sorted = sortMovies(movies, 'category');
  assert.deepEqual(sorted.map((movie) => movie.title), ['Mad Max', 'Moonlight', 'Arrival']);
});
