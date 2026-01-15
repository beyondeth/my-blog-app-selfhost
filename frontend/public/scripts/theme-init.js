(function () {
  try {
    const storedTheme = window.localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
      document.documentElement.classList.add(storedTheme);
      return;
    }

    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)')
      .matches;
    document.documentElement.classList.add(systemPrefersDark ? 'dark' : 'light');
  } catch (error) {
    document.documentElement.classList.add('light');
  }
})();
