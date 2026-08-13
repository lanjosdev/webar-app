const themeToggle = getElement<HTMLButtonElement>('theme-toggle');

themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light');
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.textContent = isLight ? 'Tema escuro' : 'Tema claro';
});

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required design system element #${id} was not found.`);
  }

  return element as T;
}
