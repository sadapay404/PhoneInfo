#!/usr/bin/env python3
"""Probe a Binkies .mdm / .mdm.br file and print its structure, so a decoder can be written.

Run on YOUR OWN copy of a file you downloaded with permission. Prints short summaries only:
a hex dump of the header, where compressed sections start (Brotli, zlib, gzip, zstd, lz4),
how random each block of the file looks, and the first little-endian 32-bit values.
It does not write any model data anywhere.

Usage (Windows PowerShell or Command Prompt, not the Python >>> prompt):
  py -m pip install brotli
  py probe_mdm.py scene.mdm.br > probe.txt
"""
import math
import re
import struct
import sys
import zlib

try:
    import brotli  # pip install brotli
except ImportError:
    sys.exit('Install the brotli package first: py -m pip install brotli')

SCAN_LIMIT = 200_000  # bytes scanned for compressed-stream starts


def hexdump(data, start=0, length=256):
    lines = []
    for i in range(0, min(length, len(data)), 16):
        chunk = data[i:i + 16]
        hx = ' '.join(f'{b:02x}' for b in chunk)
        asc = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
        lines.append(f'{start + i:08x}  {hx:<47}  {asc}')
    return '\n'.join(lines)


def entropy(block):
    if not block:
        return 0.0
    counts = [0] * 256
    for b in block:
        counts[b] += 1
    n = len(block)
    return -sum((c / n) * math.log2(c / n) for c in counts if c)


def try_brotli(raw, off):
    try:
        d = brotli.Decompressor()
        out = d.process(raw[off:])
        if out and d.is_finished():
            return out
    except brotli.error:
        return None
    return None


def try_zlib(raw, off):
    try:
        d = zlib.decompressobj()
        out = d.decompress(raw[off:])
        if out and d.eof:
            return out
    except zlib.error:
        return None
    return None


def try_gzip(raw, off):
    try:
        d = zlib.decompressobj(16 + zlib.MAX_WBITS)
        out = d.decompress(raw[off:])
        if out and d.eof:
            return out
    except zlib.error:
        return None
    return None


MAGICS = [
    ('gzip', b'\x1f\x8b', try_gzip),
    ('zstd', b'\x28\xb5\x2f\xfd', None),
    ('lz4', b'\x04\x22\x4d\x18', None),
]


def scan_streams(raw):
    found = []
    limit = min(SCAN_LIMIT, len(raw))
    for off in range(limit):
        b0 = raw[off]
        # zlib starts with 0x78 and a valid check byte (CMF/FLG check).
        if b0 == 0x78 and off + 1 < len(raw) and (b0 * 256 + raw[off + 1]) % 31 == 0:
            out = try_zlib(raw, off)
            if out:
                found.append(('zlib', off, len(out)))
        for name, magic, fn in MAGICS:
            if raw.startswith(magic, off) and fn:
                out = fn(raw, off)
                if out:
                    found.append((name, off, len(out)))
            elif raw.startswith(magic, off):
                found.append((name + ' (magic only)', off, 0))
        out = try_brotli(raw, off)
        if out:
            found.append(('brotli', off, len(out)))
    return found


def main():
    path = sys.argv[1]
    raw = open(path, 'rb').read()
    print(f'file: {path}')
    print(f'size: {len(raw)} bytes\n')

    print('--- header hex dump (first 256 bytes) ---')
    print(hexdump(raw, 0, 256))

    print('\n--- first 32 little-endian uint32 values, from offset 0 ---')
    vals = [struct.unpack_from('<I', raw, i)[0] for i in range(0, min(128, len(raw)), 4)]
    print(' '.join(str(v) for v in vals))

    print('\n--- entropy per 4 KB block (about 8.0 = compressed or encrypted, under 6 = structured) ---')
    ent = []
    for i in range(0, len(raw), 4096):
        ent.append(f'{i:07x}:{entropy(raw[i:i + 4096]):.2f}')
    for i in range(0, len(ent), 8):
        print('  '.join(ent[i:i + 8]))

    print('\n--- compressed-stream starts found in the first', SCAN_LIMIT, 'bytes ---')
    streams = scan_streams(raw)
    if not streams:
        print('none found')
    for name, off, size in streams[:40]:
        print(f'  {name:<22} offset={off:<8} decompressed={size}')
    if len(streams) > 40:
        print(f'  ... {len(streams) - 40} more')

    # Length of the repeating (13, 16) record table that starts at offset 0x14.
    end = 0x14
    while end + 8 <= len(raw) and struct.unpack_from('<II', raw, end) == (13, 16):
        end += 8
    print(f'\n--- repeating (13,16) records: from 0x14 to 0x{end:x} ({(end - 0x14) // 8} records) ---')
    print('next 32 bytes after the table:', raw[end:end + 32].hex(' '))

    # Boundary where entropy changes near 0x7000 and 0x1d000.
    for start in (0x6fe0, 0x1cfe0, 0x1d000):
        print(f'\n--- hex around 0x{start:x} ---')
        print(hexdump(raw[start:start + 96], start, 96))

    # All readable strings, longer than 5 characters.
    print('\n--- ALL readable strings (offset, text) ---')
    for m in re.finditer(rb'[\x20-\x7e]{6,}', raw):
        print(f'  {m.start():8d}  {m.group()[:200].decode("ascii", "replace")}')

    # Texture-like names, anywhere in the file.
    print('\n--- texture / mesh-like names ---')
    for m in re.finditer(rb'[\w\-./]{3,}\.(?:jpe?g|png|webp|ktx2?|dds|hdr|bin|mdm|glb)', raw, re.I):
        print(f'  {m.start():8d}  {m.group().decode("ascii", "replace")}')


if __name__ == '__main__':
    main()
