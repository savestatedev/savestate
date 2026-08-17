import { describe, it, expect } from 'vitest';
import { gzipSync } from 'node:zlib';
import { Header } from 'tar';
import { packToArchive, unpackFromArchive } from '../format.js';

function encodeEntry(path: string, data: Buffer, type: 'File' | 'SymbolicLink' | 'Link' = 'File', linkpath?: string): Buffer {
  const headerBuf = Buffer.alloc(512);
  const header = new Header();
  header.path = path;
  header.size = type === 'File' ? data.length : 0;
  header.type = type;
  header.mode = 0o644;
  header.mtime = new Date(0);
  header.uid = 0;
  header.gid = 0;
  header.uname = 'savestate';
  header.gname = 'savestate';
  if (linkpath) {
    header.linkpath = linkpath;
  }
  header.encode(headerBuf, 0);

  const blocks: Buffer[] = [headerBuf];
  if (type === 'File') {
    blocks.push(data);
    const remainder = data.length % 512;
    if (remainder > 0) {
      blocks.push(Buffer.alloc(512 - remainder));
    }
  }
  return Buffer.concat(blocks);
}

function gzipTar(entries: Buffer[]): Buffer {
  return gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]));
}

describe('archive pack/unpack', () => {
  it('round-trips a valid relative file map', async () => {
    const files = new Map<string, Buffer>([
      ['manifest.json', Buffer.from('{"ok":true}')],
      ['identity/personality.md', Buffer.from('keep this')],
    ]);

    const unpacked = await unpackFromArchive(packToArchive(files));

    expect(unpacked.get('manifest.json')?.toString()).toBe('{"ok":true}');
    expect(unpacked.get('identity/personality.md')?.toString()).toBe('keep this');
    expect([...unpacked.keys()]).toEqual(['manifest.json', 'identity/personality.md']);
  });

  it('drops path-traversal, absolute, and link entries from a crafted archive', async () => {
    const archive = gzipTar([
      encodeEntry('manifest.json', Buffer.from('{"ok":true}')),
      encodeEntry('../escape.txt', Buffer.from('nope')),
      encodeEntry('/tmp/absolute.txt', Buffer.from('nope')),
      encodeEntry('C:windows.txt', Buffer.from('nope')),
      encodeEntry('nested/../../outside.txt', Buffer.from('nope')),
      encodeEntry('link-out', Buffer.alloc(0), 'SymbolicLink', '../escape.txt'),
      encodeEntry('hard-out', Buffer.alloc(0), 'Link', 'manifest.json'),
    ]);

    const unpacked = await unpackFromArchive(archive);

    expect(unpacked.get('manifest.json')?.toString()).toBe('{"ok":true}');
    expect(unpacked.has('../escape.txt')).toBe(false);
    expect(unpacked.has('/tmp/absolute.txt')).toBe(false);
    expect(unpacked.has('C:windows.txt')).toBe(false);
    expect(unpacked.has('nested/../../outside.txt')).toBe(false);
    expect(unpacked.has('link-out')).toBe(false);
    expect(unpacked.has('hard-out')).toBe(false);
    expect([...unpacked.keys()]).toEqual(['manifest.json']);
  });
});
