import pathlib
import unittest

from parse import parse_device_html

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "synthetic_device.html"


class ParseSyntheticDevice(unittest.TestCase):
    """Runs against an invented device with GSMArena's table layout (no third-party text)."""

    @classmethod
    def setUpClass(cls):
        html = FIXTURE.read_text(encoding="utf-8")
        cls.parsed = parse_device_html(html, "https://example.invalid/acme-nova-9-1.php", brand="Acme")
        cls.n = cls.parsed.normalized

    def test_identity_and_launch(self):
        self.assertEqual(self.n["brand"], "Acme")
        self.assertEqual(self.n["model"], "Nova 9 Pro Max")
        self.assertEqual(self.n["year"], 2024)
        self.assertEqual(self.n["status"], "released")

    def test_body(self):
        self.assertEqual(self.n["body"]["dimensions_mm"], [180.5, 80.2, 8.1])
        self.assertEqual(self.n["body"]["weight_g"], 205.0)
        self.assertEqual(self.n["body"]["ip_rating"], "IP68")

    def test_display(self):
        d = self.n["display"]
        self.assertEqual(d["type"], "AMOLED")
        self.assertEqual(d["size_in"], 6.6)
        self.assertEqual(d["resolution"], [1080, 2400])
        self.assertEqual(d["ppi"], 400)
        self.assertEqual(d["refresh_hz_max"], 120)
        self.assertEqual(d["peak_nits"], 2400)
        self.assertEqual(d["outdoor_nits"], 2400)
        self.assertEqual(d["glass"], "Armor glass")

    def test_soc_and_memory(self):
        s = self.n["soc"]
        self.assertEqual(s["chipset"], "Acme Silicon X2")
        self.assertEqual(s["process_nm"], 4)
        self.assertEqual(s["storage_gb"], [128, 256, 512])
        # Three RAM options: ambiguous, so no single ram_gb is recorded.
        self.assertNotIn("ram_gb", s)

    def test_cameras(self):
        c = self.n["camera"]
        self.assertEqual(c["main"]["mp"], 50.0)
        self.assertEqual(c["main"]["aperture"], "f/1.7")
        self.assertEqual(c["main"]["focal_mm"], 24.0)
        self.assertEqual(c["main"]["sensor_format"], "1/1.56in")
        self.assertEqual(c["main"]["ois"], "sensor-shift")
        self.assertEqual(c["telephoto"]["mp"], 64.0)
        self.assertEqual(c["telephoto"]["zoom_x"], 3.0)
        self.assertEqual(c["ultrawide"]["mp"], 12.0)
        self.assertEqual(c["front"]["aperture"], "f/2.0")

    def test_connectivity(self):
        c = self.n["connectivity"]
        self.assertEqual(c["wifi"], "Wi-Fi 6")
        self.assertEqual(c["bluetooth"], "5.4")
        self.assertTrue(c["nfc"])
        self.assertTrue(c["ir_blaster"])
        self.assertNotIn("uwb", c)

    def test_battery_and_charging(self):
        b = self.n["battery"]
        self.assertEqual(b["capacity_mah"], 5000)
        self.assertEqual(b["chemistry"], "Li-Po")
        self.assertEqual(b["wired_w"], 65.0)
        self.assertEqual(b["wireless_w"], 50.0)
        self.assertEqual(b["reverse_w"], 5.0)

    def test_software_and_sar(self):
        self.assertEqual(self.n["software"]["launch_os"], "Android 14")
        r = self.n["repair"]
        self.assertEqual(r["sar_head_eu_wkg"], 0.45)
        self.assertEqual(r["sar_body_us_wkg"], 1.10)

    def test_price_is_not_mapped(self):
        # GSMArena's listed price is not an MSRP, so it must not become price_usd.
        self.assertNotIn("price_usd", self.n)

    def test_raw_rows_are_kept(self):
        self.assertEqual(self.parsed.get("Display", "Protection"), "Armor glass")
        self.assertIn("Charging", [r.label for r in self.parsed.raw])

    def test_empty_document_does_not_crash(self):
        p = parse_device_html("<html></html>", "https://example.invalid/x-1.php")
        self.assertIsNone(p.name)
        self.assertEqual(p.raw, [])


if __name__ == "__main__":
    unittest.main()


class DerivedFields(unittest.TestCase):
    def setUp(self):
        html = FIXTURE.read_text(encoding="utf-8")
        self.n = parse_device_html(html, "https://example.invalid/x-1.php", brand="Acme").normalized

    def test_filter_fields(self):
        self.assertEqual(self.n["display"]["panel_tech"], "OLED")
        self.assertNotIn("brand", self.n["soc"])  # "Acme Silicon" is not a known SoC brand, so left unset
        self.assertEqual(self.n["software"]["os_family"], "Android")
        self.assertFalse(self.n["memory"]["expandable"])
        self.assertTrue(self.n["audio"]["stereo_speakers"])
        self.assertNotIn("headphone_jack", self.n["audio"])  # not stated in the synthetic page
        self.assertNotIn("five_g", self.n["connectivity"])  # no Network table in the synthetic page

    def test_soc_brand_mapping(self):
        from parse import soc_brand
        self.assertEqual(soc_brand("Snapdragon 8 Gen 3"), "Snapdragon")
        self.assertEqual(soc_brand("MediaTek Dimensity 9300"), "Dimensity")
        self.assertEqual(soc_brand("Apple A17 Pro (3 nm)"), "Apple")
        self.assertEqual(soc_brand("Google Tensor G3"), "Tensor")
        self.assertIsNone(soc_brand("Mystery chip"))

    def test_panel_mapping(self):
        from parse import panel_tech
        self.assertEqual(panel_tech("IPS LCD, 120Hz"), "LCD")
        self.assertEqual(panel_tech("Dynamic AMOLED 2X, 120Hz"), "OLED")
        self.assertIsNone(panel_tech(""))
