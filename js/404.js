if (location.pathname.startsWith('/writeups/themes/')) {
  document.body.innerText = 'about:blank#themenotfound';
} else {
  let suffix =
    theme == 'default.css' ? '' : '?theme=' + encodeURIComponent(theme);
  location.href = 'https://ndevtk.github.io/writeups/' + suffix;
}
