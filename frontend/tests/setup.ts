import '@testing-library/jest-dom/vitest';

const getComputedStyleWithoutPseudo = window.getComputedStyle;
window.getComputedStyle = (elt: Element) => getComputedStyleWithoutPseudo(elt);

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false
    })
  });
}
