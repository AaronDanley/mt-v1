export function sortMovies(movies, sortKey) {
  const sorted = [...movies];

  sorted.sort((a, b) => {
    if (sortKey === 'category') {
      return a.category.localeCompare(b.category);
    }

    if (sortKey === 'releaseDate') {
      return new Date(a.releaseDate) - new Date(b.releaseDate);
    }

    return new Date(b.watchedDate) - new Date(a.watchedDate);
  });

  return sorted;
}

export function filterMovies(movies, category) {
  if (!category || category === 'all') {
    return movies;
  }

  return movies.filter((movie) => movie.category === category);
}
