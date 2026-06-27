const rows = document.querySelectorAll('.rating-row');

rows.forEach((row) => {
  const buttons = row.querySelectorAll('.rating-btn');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const isActive = button.classList.contains('active');
      buttons.forEach((other) => other.classList.remove('active'));

      if (!isActive) {
        button.classList.add('active');
      }
    });
  });
});
