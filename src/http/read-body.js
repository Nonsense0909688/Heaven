// Three ways to consume a response body, chosen by the caller. All are memory-safe:
//   outputFile -> stream straight to disk (never buffered)
//   onChunk    -> hand chunks to the caller as they arrive (SSE, NDJSON, big streams)
//   discard    -> read and count, then drop (benchmarking)
//   otherwise  -> keep at most `maxBuffer` bytes for display, cancel the rest
import fs from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

async function saveToFile(body, file) {
  let size = 0;
  const counter = new Transform({
    transform(chunk, _enc, cb) { size += chunk.length; cb(null, chunk); },
  });
  await pipeline(Readable.fromWeb(body), counter, fs.createWriteStream(file));
  return { size, saved: file };
}

async function readChunks(body, { onChunk, discard, maxBuffer }) {
  const reader = body.getReader();
  const kept = [];
  let keptBytes = 0;
  let size = 0;
  let truncated = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;

    if (onChunk) { onChunk(value); continue; }
    if (discard) continue;

    if (keptBytes + value.length > maxBuffer) {           // over the limit: keep the part that fits, stop reading
      kept.push(value.subarray(0, maxBuffer - keptBytes));
      keptBytes = maxBuffer;
      truncated = true;
      await reader.cancel();
      break;
    }
    kept.push(value);
    keptBytes += value.length;
  }
  const buffer = onChunk || discard ? null : Buffer.concat(kept);
  return { size, truncated, buffer };
}

/** Returns { size, truncated, buffer, saved } */
export async function readBody(res, opts) {
  const empty = { size: 0, truncated: false, buffer: null, saved: undefined };
  if (!res.body) return empty;
  if (opts.outputFile) return { ...empty, ...(await saveToFile(res.body, opts.outputFile)) };
  return { ...empty, ...(await readChunks(res.body, opts)) };
}
