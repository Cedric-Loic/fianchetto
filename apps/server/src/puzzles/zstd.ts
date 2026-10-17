import { Readable } from 'node:stream';
import * as zlib from 'node:zlib';

/*
 * Décompression zstd en flux, trame par trame. Le fichier Lichess est au format « pzstd » : chaque
 * trame compressée est précédée d'une trame « skippable » de 12 octets qui donne sa taille. Le
 * décompresseur en flux de Node s'arrête à la fin de la PREMIÈRE trame (0 octet si c'est une
 * trame skippable) : on lit donc les trames nous-mêmes et on décompresse chacune séparément.
 */

interface ZstdApi {
  createZstdDecompress?: () => NodeJS.ReadWriteStream;
  zstdDecompressSync?: (buffer: Buffer) => Buffer;
}

const api = zlib as unknown as ZstdApi;
const UNAVAILABLE =
  'Décompression zstd indisponible : Node ≥ 22.15 requis (ou décompresse le fichier et passe ' +
  'le .csv avec --file).';

/** Trames « skippable » : nombres magiques 0x184D2A50 à 0x184D2A5F. */
const isSkippable = (magic: number) => magic >>> 4 === 0x184d2a5;

/** File d'octets reçus, consommée par morceaux de taille connue. */
class ByteQueue {
  #chunks: Buffer[] = [];
  length = 0;

  push(chunk: Buffer): void {
    this.#chunks.push(chunk);
    this.length += chunk.length;
  }

  peek(n: number): Buffer {
    const all = Buffer.concat(this.#chunks);
    this.#chunks = [all];
    return all.subarray(0, n);
  }

  take(n: number): Buffer {
    const all = Buffer.concat(this.#chunks);
    this.#chunks = [all.subarray(n)];
    this.length -= n;
    return all.subarray(0, n);
  }

  rest(): Buffer[] {
    const chunks = this.#chunks;
    this.#chunks = [];
    this.length = 0;
    return chunks;
  }
}

async function* frames(source: AsyncIterable<Buffer>): AsyncGenerator<Buffer> {
  const decompressSync = api.zstdDecompressSync;
  const createStream = api.createZstdDecompress;
  if (!decompressSync || !createStream) throw new Error(UNAVAILABLE);
  const input = source[Symbol.asyncIterator]();
  const queue = new ByteQueue();
  const need = async (n: number) => {
    while (queue.length < n) {
      const next = await input.next();
      if (next.done) return false;
      queue.push(next.value);
    }
    return true;
  };

  while (await need(8)) {
    const header = queue.peek(8);
    const magic = header.readUInt32LE(0);
    if (!isSkippable(magic)) {
      // Trame ordinaire sans taille annoncée (fichier zstd classique, une seule trame) : on
      // confie le reste du flux au décompresseur de Node.
      const rest = queue.rest();
      const remaining = Readable.from(
        (async function* () {
          yield* rest;
          for (let next = await input.next(); !next.done; next = await input.next()) {
            yield next.value;
          }
        })(),
      );
      for await (const chunk of remaining.pipe(createStream())) yield chunk as Buffer;
      return;
    }
    const size = header.readUInt32LE(4);
    if (!(await need(8 + size))) return;
    const content = queue.take(8 + size).subarray(8);
    // pzstd : 4 octets = taille de la trame compressée qui suit.
    if (size !== 4) continue;
    const frameSize = content.readUInt32LE(0);
    if (!(await need(frameSize))) throw new Error('Fichier zstd tronqué.');
    yield decompressSync(queue.take(frameSize));
  }
}

/** Flux décompressé d'un flux zstd (formats pzstd et zstd à une trame). */
export function zstdStream(source: Readable): Readable {
  return Readable.from(frames(source));
}
