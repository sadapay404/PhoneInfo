"""End-to-end: fetch (with photo) -> import a second source -> merged export. No network."""
import io
import json
import pathlib
import sys
import tempfile
import types
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

import crawl  # noqa: E402

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "synthetic_device.html"


def _png_bytes() -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (1200, 900), (30, 60, 200)).save(buf, "PNG")
    return buf.getvalue()


class FakeHTTP:
    def __init__(self, html: str):
        self.html = html

    def get(self, url):
        return 200, self.html

    def get_bytes(self, url):
        return _png_bytes()


class PipelineTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        crawl.DATA = self.tmp
        crawl.DB_PATH = self.tmp / "t.sqlite"
        crawl.RAW_DIR = self.tmp / "raw"
        crawl.IMAGE_DIR = self.tmp / "images"
        crawl.EXPORT_DIR = self.tmp / "export"
        base = FIXTURE.read_text(encoding="utf-8")
        photo = '<div class="specs-photo-main"><img src="https://example.invalid/acme-nova-9.jpg"></div>'
        self.html = base.replace("<h1", photo + "<h1", 1)
        self.conn = crawl.connect()
        self.conn.execute("INSERT INTO brands(slug,name,url) VALUES('acme','Acme','x')")
        self.conn.execute(
            "INSERT INTO devices(gsm_id,url,brand_slug,discovered_at) VALUES(1,'https://example.invalid/acme-nova-9-1.php','acme',?)",
            (crawl.now_iso(),),
        )
        self.conn.commit()

    def test_fetch_downloads_photo_and_export_merges_sources(self):
        args = types.SimpleNamespace(limit=10, max_age_days=30, no_images=False)
        crawl.cmd_fetch(self.conn, FakeHTTP(self.html), args)

        row = self.conn.execute("SELECT image_path, parse_ok FROM devices").fetchone()
        self.assertEqual(row["parse_ok"], 1)
        self.assertEqual(row["image_path"], "images/1.webp")
        self.assertTrue((self.tmp / "images" / "1.webp").exists())

        # A licensed dump fills a field GSMArena lacks, and does not override one it has.
        dump = self.tmp / "dump.json"
        dump.write_text(json.dumps([{
            "brand": "Acme", "model": "Nova 9 Pro Max", "year": 2024,
            "battery": {"capacity_mah": 4990, "wired_w": 65},
            "display": {"refresh_hz_max": 144},
            "connectivity": {"uwb": True},  # the synthetic GSMArena page has no UWB row
        }]), encoding="utf-8")
        crawl.cmd_import(self.conn, None, types.SimpleNamespace(source="licensed-test", file=str(dump)))

        crawl.cmd_export(self.conn, None, types.SimpleNamespace(priority=""))
        devices = json.loads((self.tmp / "export" / "devices.json").read_text(encoding="utf-8"))
        self.assertEqual(len(devices), 1)
        d = devices[0]
        self.assertEqual(d["id"], "acme-nova-9-pro-max-1")
        self.assertEqual(d["battery"]["capacity_mah"], 5000)   # GSMArena wins over licensed 4990
        self.assertEqual(d["connectivity"]["uwb"], True)       # only the licensed source has this
        self.assertEqual(d["display"]["refresh_hz_max"], 120)  # GSMArena (120 Hz) wins over licensed (144 Hz)
        self.assertEqual(d["image"], "img/1.webp")
        self.assertTrue((self.tmp / "export" / "img" / "1.webp").exists())
        self.assertIn("gsmarena", d["source_note"])
        self.assertIn("licensed-test", d["source_note"])

    def test_no_images_flag_skips_download(self):
        args = types.SimpleNamespace(limit=10, max_age_days=30, no_images=True)
        crawl.cmd_fetch(self.conn, FakeHTTP(self.html), args)
        self.assertIsNone(self.conn.execute("SELECT image_path FROM devices").fetchone()["image_path"])

    def test_import_rejects_incomplete_entries(self):
        dump = self.tmp / "bad.json"
        dump.write_text(json.dumps([{"brand": "X"}]), encoding="utf-8")
        crawl.cmd_import(self.conn, None, types.SimpleNamespace(source="s", file=str(dump)))
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM records").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
