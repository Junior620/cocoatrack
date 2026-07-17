/**
 * Obtain a DOMParser for KML/GPX parsing.
 * Browser and Node (after ensureDOMParser) expose globalThis.DOMParser.
 */
export function createDOMParser(): DOMParser {
  if (typeof globalThis.DOMParser === 'undefined') {
    throw new Error(
      'DOMParser is unavailable. On the server, call ensureDOMParser() before parsing KML/GPX.'
    );
  }
  return new globalThis.DOMParser();
}

/**
 * Decode an ArrayBuffer as UTF-8 text.
 * Prefer this over Blob.text() after Blob.arrayBuffer() has already been used.
 */
export function decodeArrayBufferAsText(buffer: ArrayBuffer): string {
  return new TextDecoder('utf-8').decode(buffer);
}
