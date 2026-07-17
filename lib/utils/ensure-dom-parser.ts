/**
 * Polyfill DOMParser for Node.js API routes (KML/GPX parsing).
 * Must only be imported from server code (app/api/**), never from Client Components.
 */
export async function ensureDOMParser(): Promise<void> {
  if (typeof globalThis.DOMParser !== 'undefined') {
    return;
  }

  const { JSDOM } = await import('jsdom');
  const { window } = new JSDOM('');
  // Expose the same API the browser provides so @tmcw/togeojson can run.
  globalThis.DOMParser = window.DOMParser as typeof DOMParser;
}
