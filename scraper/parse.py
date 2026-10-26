"""
Parse a GSMArena device page into (a) every spec row as raw data and (b) a
normalized record matching catalog/types (src/data/types.ts).

Anything not confidently recognised is left out of the normalized record;
the raw rows are always kept, so nothing is lost when the parser improves.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from bs4 import BeautifulSoup, Tag

DEVICE_URL_RE = re.compile(r"^[a-z0-9_]+-(\d+)\.php$")


def _clean(text: str) -> str:
    text = text.replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def _cell_text(td: Tag) -> str:
    for br in td.find_all("br"):
        br.replace_with("\n")
    return _clean(td.get_text())


@dataclass
class SpecRow:
    category: str
    label: str
    value: str


@dataclass
class ParsedDevice:
    name: str | None
    raw: list[SpecRow] = field(default_factory=list)
    normalized: dict[str, Any] = field(default_factory=dict)

    def get(self, category: str, label: str) -> str | None:
        """First value for an exact category/label pair, or None."""
        for row in self.raw:
            if row.category.lower() == category.lower() and row.label.lower() == label.lower():
                return row.value
        return None

    def get_label(self, label: str) -> str | None:
        """First value for a label regardless of category (labels are mostly unique)."""
        for row in self.raw:
            if row.label.lower() == label.lower():
                return row.value
        return None

    def all_values(self) -> str:
        return "\n".join(r.value for r in self.raw)


def extract_rows(soup: BeautifulSoup) -> list[SpecRow]:
    rows: list[SpecRow] = []
    category = ""
    for tr in soup.find_all("tr"):
        tds = tr.find_all("td", recursive=False)
        th = tr.find("th", recursive=False)
        if th is not None:
            category = _clean(th.get_text())
        if len(tds) < 2:
            # Header-only rows (e.g. a bare category) carry no spec.
            continue
        label = _cell_text(tds[0])
        value = _cell_text(tds[1])
        if not label:
            # Continuation row (e.g. a second camera): append to the previous row.
            if rows and value:
                rows[-1].value = f"{rows[-1].value}\n{value}"
            continue
        if value:
            rows.append(SpecRow(category=category, label=label, value=value))
    return rows


def _first(pattern: str, text: str | None, flags: int = 0) -> re.Match[str] | None:
    return re.search(pattern, text, flags) if text else None


def _num(s: str | None) -> float | None:
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _set(d: dict[str, Any], key: str, value: Any) -> None:
    if value is not None and value != "" and value != []:
        d[key] = value


def normalize(p: ParsedDevice, brand: str | None) -> dict[str, Any]:
    out: dict[str, Any] = {}
    g = p.get

    # --- Launch / status / year ---
    status_text = g("Launch", "Status") or ""
    announced = g("Launch", "Announced") or ""
    released_year = _first(r"Released\s+(\d{4})", status_text)
    announced_year = _first(r"(\d{4})", announced)
    year = int(released_year.group(1)) if released_year else (int(announced_year.group(1)) if announced_year else None)
    _set(out, "year", year)
    if re.search(r"discontinued", status_text, re.I):
        out["status"] = "discontinued"
    elif re.search(r"available|released", status_text, re.I):
        out["status"] = "released"
    elif status_text:
        out["status"] = "announced"

    # --- Body ---
    body: dict[str, Any] = {}
    dims = _first(r"([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*mm", g("Body", "Dimensions"))
    if dims:
        body["dimensions_mm"] = [float(dims.group(1)), float(dims.group(2)), float(dims.group(3))]
    weight = _first(r"([\d.]+)\s*g\b", g("Body", "Weight"))
    if weight:
        body["weight_g"] = float(weight.group(1))
    ip = _first(r"\bIP\d{2}[A-Z0-9]*\b", p.all_values())
    if ip:
        body["ip_rating"] = ip.group(0)
    if re.search(r"\bS Pen\b", p.all_values()):
        body["stylus"] = True
    if body:
        out["body"] = body

    # --- Display ---
    display: dict[str, Any] = {}
    dtype = g("Display", "Type") or ""
    if dtype:
        _set(display, "type", dtype.split(",")[0].strip())
    size = _first(r"([\d.]+)\s*inches", g("Display", "Size"))
    if size:
        display["size_in"] = float(size.group(1))
    res = _first(r"(\d+)\s*x\s*(\d+)\s*pixels", g("Display", "Resolution"))
    if res:
        display["resolution"] = [int(res.group(1)), int(res.group(2))]
    ppi = _first(r"~?(\d+)\s*ppi", g("Display", "Resolution"))
    if ppi:
        display["ppi"] = int(ppi.group(1))
    hz = _first(r"(\d+)\s*Hz", dtype)
    if hz:
        display["refresh_hz_max"] = int(hz.group(1))
    nits = [int(n) for n in re.findall(r"(\d+)\s*nits", dtype)]
    if nits:
        display["peak_nits"] = max(nits)
    hbm = _first(r"(\d+)\s*nits\s*\(HBM\)", dtype)
    if hbm:
        display["outdoor_nits"] = int(hbm.group(1))
    protection = g("Display", "Protection")
    if protection:
        display["glass"] = protection
    if display:
        out["display"] = display

    # --- SoC & memory ---
    soc: dict[str, Any] = {}
    chipset = g("Platform", "Chipset")
    if chipset:
        nm = _first(r"(\d+)\s*nm", chipset)
        if nm:
            soc["process_nm"] = int(nm.group(1))
        soc["chipset"] = chipset.split("(")[0].strip()
    _set(soc, "cpu", g("Platform", "CPU"))
    _set(soc, "gpu", g("Platform", "GPU"))
    internal = g("Memory", "Internal") or ""
    storage: list[int] = []
    rams: set[int] = set()
    for size_v, unit, ram in re.findall(r"(\d+)\s*(GB|TB)\s+(\d+)\s*GB RAM", internal):
        storage.append(int(size_v) * (1024 if unit == "TB" else 1))
        rams.add(int(ram))
    if not rams:
        for ram in re.findall(r"(\d+)\s*GB RAM", internal):
            rams.add(int(ram))
    if len(rams) == 1:
        soc["ram_gb"] = rams.pop()
    if storage:
        soc["storage_gb"] = sorted(set(storage))
    if soc:
        out["soc"] = soc

    # --- Cameras ---
    cameras: dict[str, Any] = {}
    main_lines = [ln for ln in (g("Main Camera", "Triple") or g("Main Camera", "Dual") or g("Main Camera", "Single") or "").split("\n") if ln and "* * *" not in ln]
    for line in main_lines:
        spec = _parse_camera_line(line)
        if spec is None:
            continue
        if "ultrawide" in line.lower() and "ultrawide" not in cameras:
            cameras["ultrawide"] = {k: v for k, v in spec.items() if k != "zoom_x"}
        elif ("telephoto" in line.lower() or "periscope" in line.lower()) and "telephoto" not in cameras:
            cameras["telephoto"] = spec
        elif "main" not in cameras and "ultrawide" not in line.lower():
            cameras["main"] = {k: v for k, v in spec.items() if k != "zoom_x"}
    selfie = _first_line(g("Selfie camera", "Single") or g("Selfie camera", "Dual"))
    if selfie:
        spec = _parse_camera_line(selfie)
        if spec:
            cameras["front"] = {k: v for k, v in spec.items() if k != "zoom_x"}
    if cameras:
        out["camera"] = cameras

    # --- Audio ---
    audio: dict[str, Any] = {}
    loud = g("Sound", "Loudspeaker") or ""
    if loud:
        audio["stereo_speakers"] = bool(re.search(r"stereo", loud, re.I))
    if audio:
        out["audio"] = audio

    # --- Connectivity ---
    conn: dict[str, Any] = {}
    wlan = g("Comms", "WLAN") or ""
    if wlan:
        conn_wifi = _wifi_generation(wlan)
        if conn_wifi:
            conn["wifi"] = conn_wifi
    bt = _first(r"^(\d+\.\d+)", g("Comms", "Bluetooth"))
    if bt:
        conn["bluetooth"] = bt.group(1)
    nfc = g("Comms", "NFC")
    if nfc:
        conn["nfc"] = nfc.strip().lower().startswith("yes")
    features = p.all_values()
    if re.search(r"ultra\s*wideband|\bUWB\b", features, re.I):
        conn["uwb"] = True
    if re.search(r"infrared|ir blaster", features, re.I):
        conn["ir_blaster"] = True
    if conn:
        out["connectivity"] = conn

    # --- Battery ---
    battery: dict[str, Any] = {}
    btype = g("Battery", "Type") or ""
    mah = _first(r"(\d{3,5})\s*mAh", btype)
    if mah:
        battery["capacity_mah"] = int(mah.group(1))
    chem = _first(r"(Li-?Ion|Li-?Po|Si-?C|Silicon[- ]carbon)", btype, re.I)
    if chem:
        battery["chemistry"] = chem.group(1)
    charging = g("Battery", "Charging") or ""
    wireless = [float(w) for w in re.findall(r"(\d+(?:\.\d+)?)\s*W\s*wireless", charging, re.I)]
    if wireless:
        battery["wireless_w"] = max(wireless)
    reverse = [float(w) for w in re.findall(r"(\d+(?:\.\d+)?)\s*W\s*reverse", charging, re.I)]
    if reverse:
        battery["reverse_w"] = max(reverse)
    wired = []
    for line in charging.split("\n"):
        if re.search(r"wireless|reverse", line, re.I):
            continue
        wired += [float(w) for w in re.findall(r"(\d+(?:\.\d+)?)\s*W\b", line)]
    if wired:
        battery["wired_w"] = max(wired)
    if battery:
        out["battery"] = battery

    # --- Software ---
    os_text = g("Platform", "OS")
    if os_text:
        out["software"] = {"launch_os": os_text.split(",")[0].strip()}

    # --- Repair / SAR (values are W/kg) ---
    repair: dict[str, Any] = {}
    sar_us = g("Misc", "SAR")
    sar_eu = g("Misc", "SAR EU")
    for prefix, val in (("us", sar_us), ("eu", sar_eu)):
        if not val:
            continue
        head = _first(r"([\d.]+)\s*W/kg\s*\(head\)", val)
        body_m = _first(r"([\d.]+)\s*W/kg\s*\(body\)", val)
        if head:
            repair[f"sar_head_{prefix}_wkg"] = float(head.group(1))
        if body_m:
            repair[f"sar_body_{prefix}_wkg"] = float(body_m.group(1))
    if repair:
        out["repair"] = repair

    if brand:
        out["brand"] = brand
    return out


def _wifi_generation(wlan: str) -> str | None:
    """Map GSMArena's Wi-Fi standard list (e.g. '802.11 a/b/g/n/ac/ax') to a marketing generation."""
    m = re.search(r"802\.11\s*([a-z0-9/ ]+?)(?:,|$)", wlan, re.I | re.M)
    tokens = {t.strip().lower() for t in m.group(1).split("/")} if m else set()
    if re.search(r"Wi-?Fi 7\b", wlan, re.I) or "be" in tokens:
        return "Wi-Fi 7"
    if re.search(r"6e", wlan, re.I) or "6e" in tokens:
        return "Wi-Fi 6E"
    if re.search(r"Wi-?Fi 6\b", wlan, re.I) or "ax" in tokens:
        return "Wi-Fi 6"
    if "ac" in tokens:
        return "Wi-Fi 5"
    return None


def _first_line(text: str | None) -> str | None:
    if not text:
        return None
    for ln in text.split("\n"):
        if ln and "* * *" not in ln:
            return ln
    return None


def _parse_camera_line(line: str) -> dict[str, Any] | None:
    mp = _first(r"(\d+(?:\.\d+)?)\s*MP", line)
    if not mp:
        return None
    spec: dict[str, Any] = {"mp": float(mp.group(1))}
    ap = _first(r"f/(\d+(?:\.\d+)?)", line)
    if ap:
        spec["aperture"] = f"f/{ap.group(1)}"
    focal = _first(r"(\d+(?:\.\d+)?)\s*mm\b", line)
    if focal:
        spec["focal_mm"] = float(focal.group(1))
    fmt = _first(r"1/(\d+(?:\.\d+)?)\"", line)
    if fmt:
        spec["sensor_format"] = f"1/{fmt.group(1)}in"
    if re.search(r"sensor[- ]shift", line, re.I):
        spec["ois"] = "sensor-shift"
    elif re.search(r"\bOIS\b", line):
        spec["ois"] = "optical"
    zoom = _first(r"(\d+(?:\.\d+)?)x optical zoom", line)
    if zoom:
        spec["zoom_x"] = float(zoom.group(1))
    return spec


def parse_device_html(html: str, url: str, brand: str | None = None) -> ParsedDevice:
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    name = _clean(h1.get_text()) if h1 else None
    parsed = ParsedDevice(name=name, raw=extract_rows(soup))
    normalized = normalize(parsed, brand)
    model = name
    if name and brand and name.lower().startswith(brand.lower() + " "):
        model = name[len(brand) + 1 :]
    _set(normalized, "model", model)
    parsed.normalized = normalized
    return parsed
