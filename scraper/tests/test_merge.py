import unittest

from merge import device_key, merge_records


class MergeTests(unittest.TestCase):
    def test_key_is_stable_slug(self):
        self.assertEqual(device_key("Apple", "iPhone 15 Pro Max"), "apple-iphone-15-pro-max")
        self.assertEqual(device_key("Samsung", "Galaxy S24 Ultra (5G)"), "samsung-galaxy-s24-ultra-5g")

    def test_higher_priority_source_wins_per_field(self):
        gsm = ("gsmarena", {"display": {"ppi": 460, "peak_nits": 2000}, "battery": {"capacity_mah": 4441}})
        lic = ("licensed", {"display": {"ppi": 459, "refresh_hz_max": 120}, "battery": {"capacity_mah": 4400, "wired_w": 27}})
        merged, prov = merge_records([lic, gsm])
        self.assertEqual(merged["display"]["ppi"], 460)              # gsmarena wins
        self.assertEqual(merged["display"]["refresh_hz_max"], 120)   # only licensed has it: fills the gap
        self.assertEqual(merged["battery"]["wired_w"], 27)
        self.assertEqual(prov["display.ppi"], "gsmarena")
        self.assertEqual(prov["display.refresh_hz_max"], "licensed")

    def test_priority_can_be_overridden(self):
        a = ("gsmarena", {"year": 2023})
        b = ("licensed", {"year": 2024})
        merged, _ = merge_records([a, b], priority=["licensed", "gsmarena"])
        self.assertEqual(merged["year"], 2024)

    def test_lists_are_kept_whole(self):
        merged, _ = merge_records([("gsmarena", {"soc": {"storage_gb": [256, 512]}})])
        self.assertEqual(merged["soc"]["storage_gb"], [256, 512])

    def test_none_values_do_not_block_other_sources(self):
        merged, prov = merge_records([("gsmarena", {"battery": {"wired_w": None}}), ("licensed", {"battery": {"wired_w": 30}})])
        self.assertEqual(merged["battery"]["wired_w"], 30)
        self.assertEqual(prov["battery.wired_w"], "licensed")


if __name__ == "__main__":
    unittest.main()
