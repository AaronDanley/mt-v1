import { filterMovies, sortMovies } from './movie-utils.js';

const movieList = document.getElementById('movieList');
const categoryFilter = document.getElementById('categoryFilter');
const sortSelect = document.getElementById('sortSelect');
const resultsCount = document.getElementById('resultsCount');
const ratingsPanel = document.getElementById('ratingsPanel');
const ratingsContent = document.getElementById('ratingsContent');
const closeRatings = document.getElementById('closeRatings');

let allMovies = [];

function formatDate(value) {
  return new Date(value).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

function normalizeTitle(value) {
  return String(value).trim().toLowerCase();
}

function renderMovies() {
  const filtered = filterMovies(allMovies, categoryFilter.value);
  const sorted = sortMovies(filtered, sortSelect.value);

  resultsCount.textContent = `${sorted.length} titles in your watched library`;

  if (!sorted.length) {
    movieList.innerHTML = '<div class="empty">No titles match this selection.</div>';
    return;
  }

  movieList.innerHTML = sorted
    .map((movie) => `
      <article class="movie-card">
        <div class="poster-wrap">
          ${movie.poster
            ? `<img class="movie-poster" src="${movie.poster}" alt="${movie.title} poster" loading="lazy" />`
            : '<div class="poster-placeholder">No poster</div>'}
          <div class="imdb-badge">IMDb ${movie.imdbRating ?? '—'}</div>
        </div>
        <div class="card-content">
          <header>
            <div>
              <h3>${movie.title}</h3>
              <p class="meta">${movie.director} · ${movie.year}</p>
            </div>
            <span class="category-pill">${movie.category}</span>
          </header>
          <p class="meta">Watched ${formatDate(movie.watchedDate)} · Released ${formatDate(movie.releaseDate)}</p>
          <div class="actions">
            <button class="ratings-btn" data-id="${movie.id}">View Ratings</button>
          </div>
        </div>
      </article>
    `)
    .join('');

  movieList.querySelectorAll('.vote-btn').forEach((button) => {
    button.addEventListener('click', () => {
      button.classList.toggle('active');
    });
  });

  movieList.querySelectorAll('.ratings-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const movie = allMovies.find((entry) => entry.id === Number(button.dataset.id));
      if (!movie) return;

      ratingsPanel.classList.add('open');
      ratingsContent.innerHTML = '<p>Loading ratings…</p>';

      try {
        const response = await fetch(`/api/ratings?title=${encodeURIComponent(movie.title)}`);
        const data = await response.json();

        ratingsContent.innerHTML = `
          <h3>${movie.title}</h3>
          <p class="muted">${movie.category} · ${movie.year}</p>
          <div class="rating-row"><span>IMDb</span><span class="score">${data.imdb ?? '—'}</span></div>
          <div class="rating-row"><span>Rotten Tomatoes</span><span class="score">${data.rottenTomatoes ?? '—'}</span></div>
          <div class="rating-row"><span>Metacritic</span><span class="score">${data.metacritic ?? '—'}</span></div>
        `;
      } catch (error) {
        ratingsContent.innerHTML = '<p class="empty">Ratings are temporarily unavailable.</p>';
      }
    });
  });
}

async function loadMovies() {
  const response = await fetch('/movies.json');
  const movies = await response.json();

  allMovies = movies;

  const categories = ['all', ...new Set(movies.map((movie) => movie.category))];
  categoryFilter.innerHTML = categories
    .map((category) => `<option value="${category}">${category === 'all' ? 'All' : category}</option>`)
    .join('');

  categoryFilter.addEventListener('change', renderMovies);
  sortSelect.addEventListener('change', renderMovies);
  closeRatings.addEventListener('click', () => ratingsPanel.classList.remove('open'));

  renderMovies();

  try {
    const postersResponse = await fetch(`/api/posters?titles=${encodeURIComponent(movies.map((movie) => movie.title).join(','))}`);
    const posters = await postersResponse.json();
    const ratingsResponse = await fetch(`/api/ratings-bulk?titles=${encodeURIComponent(movies.map((movie) => movie.title).join(','))}`);
    const ratings = await ratingsResponse.json();

    allMovies = movies.map((movie) => ({
      ...movie,
      poster: posters[normalizeTitle(movie.title)] || null,
      imdbRating: ratings[normalizeTitle(movie.title)]?.imdb ?? null,
    }));

    renderMovies();
  } catch (error) {
    allMovies = movies;
    renderMovies();
  }
}

loadMovies();
