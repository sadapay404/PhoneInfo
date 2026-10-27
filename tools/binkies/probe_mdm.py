#!/usr/bin/env python3
"""Probe a Binkies .mdm.br file and print its structure, so a decoder can be written.

Run on YOUR OWN copy of a file you downloaded with permission. Prints only short
summaries (header bytes, which offset starts the Brotli stream, a sample of the
decompressed bytes, and the names of textures or meshes it mentions). It does not
write any model data anywhere.

Usage:
  pip install brotli
  python3 probe_mdm.py scene.mdm.br > probe.txt
"""
import re
import struct
import sys

try:
    import brotli  # pip install brotli
except ImportError:
    sys.exit('Install the brotli package first: pip install brotli')

MAX_OFFSET = 512


def try_brotli_at(raw, offset):
    """Return decompressed bytes if a Brotli stream starts at `offset`, else None."""
    try:
        d = brotli.Decompressor()
        out = d.process(raw[offset:])
        if out and d.is_finished():
            return out
    except brotli.error:
        return None
    return None


def printable_strings(data, min_len=4, limit=60):
    seen = []
    for m in re.finditer(rb'[\x20-\x7e]{%d,}' % min_len, data):
        s = m.group().decode('ascii', 'replace')
        seen.append((m.start(), s))
        if len(seen) >= limit:
            break
    return seen


def main():
    path = sys.argv[1]
    raw = open(path, 'rb').read()
    print(f'file: {path}')
    print(f'size: {len(raw)} bytes')
    print(f'first 64 bytes (hex): {raw[:64].hex(" ")}')
    print(f'first 64 bytes (ascii): {raw[:64]!r}')

    stream = None
    stream_offset = None
    for off in range(0, min(MAX_OFFSET, len(raw))):
        out = try_brotli_at(raw, off)
        if out:
            stream, stream_offset = out, off
            break
    if stream is None:
        print('No Brotli stream found in the first', MAX_OFFSET, 'bytes.')
        print('Try: python3 probe_mdm.py <file> and send this output. Do not send the file.')
        return

    print(f'Brotli stream starts at offset {stream_offset}')
    print(f'decompressed size: {len(stream)} bytes')
    print(f'header bytes before stream (hex): {raw[:stream_offset].hex(" ")}')
    print(f'decompressed first 128 bytes (hex): {stream[:128].hex(" ")}')

    # Little-endian integers near the start, often counts or sizes.
    if len(stream) >= 32:
        u32 = struct.unpack_from('<8I', stream, 0)
        print(f'first 8 uint32 (LE): {list(u32)}')

    print('\nreadable strings (offset, text), first 60:')
    for off, s in printable_strings(stream):
        print(f'  {off:8d}  {s[:120]}')

    names = sorted(set(re.findall(rb'[\w\-]+\.(?:jpe?g|png|webp|ktx2?|dds|hdr|bin)', stream, re.I)))
    print(f'\nimage/texture file names mentioned: {len(names)}')
    for n in names[:80]:
        print('  ', n.decode('ascii', 'replace'))


if __name__ == '__main__':
    main()
