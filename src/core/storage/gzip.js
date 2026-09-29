function requireStream(name, constructor) {
  if (typeof constructor !== 'function') {
    throw new Error(`${name} is not supported by this browser.`);
  }
  return constructor;
}

async function transform(bytes, StreamType, operation) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const stream = new Blob([input]).stream().pipeThrough(new StreamType('gzip'));
  try {
    return await new Response(stream).arrayBuffer();
  } catch (problem) {
    throw new Error(`Unable to ${operation} the SQLite backup. ${problem?.message || ''}`.trim());
  }
}

export function gzipCompress(bytes) {
  return transform(bytes, requireStream('Gzip backup compression', globalThis.CompressionStream), 'compress');
}

export function gzipDecompress(bytes) {
  return transform(bytes, requireStream('Gzip backup decompression', globalThis.DecompressionStream), 'decompress');
}
