"""Headless core for EXIF Photo Printer.

Everything the desktop app does to a photo, plus the selection pipeline that decides
which photos are worth printing, callable without a GUI.

Print dimensions are taken verbatim from src/composables/usePrintSizes.ts so headless
output matches what the app produces at 300 DPI.

Photo scoring is EJ-taste v1 (github.com/ejfox/ejtaste): contrast, tonal range,
symmetry, and one visible subject as centered as possible. Embedded here rather than
imported so this package stands alone.
"""
from __future__ import annotations

import csv
import datetime
import json
import os
import plistlib
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image, ImageDraw, ImageFont

EXIFTOOL = "/opt/homebrew/bin/exiftool"
if not os.path.exists(EXIFTOOL):
    EXIFTOOL = "exiftool"

TAG_ATTR = "com.apple.metadata:_kMDItemUserTags"
TAG_INDEX = {"Gray": 1, "Green": 2, "Purple": 3, "Blue": 4,
             "Yellow": 5, "Red": 6, "Orange": 7}

# src/composables/usePrintSizes.ts
PRINT_SIZES = {
    "4x6": (1800, 1200),
    "5x7": (2100, 1500),
    "8x10": (3000, 2400),
    "8x12": (3600, 2400),
    "11x14": (4200, 3300),
    "square": (1500, 1500),
    "contact": (3000, 2400),
    "video-4k": (3840, 2800),
    "video-1080p": (1920, 1400),
}

IMAGE_EXT = (".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp")

INK = (26, 26, 26)
SUBTLE = (107, 114, 128)
FAINT = (156, 163, 175)
PAPER = (255, 255, 255)

DARK_BG = (10, 10, 10)
DARK_INK = (232, 232, 232)
DARK_MUTED = (115, 115, 115)
DARK_DIM = (74, 74, 74)
DARK_RULE = (42, 42, 42)
ACCENT = (230, 0, 103)

_FONTS = ["/System/Library/Fonts/SFNSMono.ttf",
          "/System/Library/Fonts/Menlo.ttc",
          "/System/Library/Fonts/Supplemental/Andale Mono.ttf"]


def font(size: int, bold: bool = False):
    for path in _FONTS:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size, index=1 if bold else 0)
            except Exception:
                continue
    return ImageFont.load_default()


# ---------------------------------------------------------------- files + exif

def list_images(folder: str, recursive: bool = False) -> list[str]:
    out = []
    if recursive:
        for dp, _, names in os.walk(folder):
            for n in names:
                if n.lower().endswith(IMAGE_EXT) and not n.startswith("._"):
                    out.append(os.path.join(dp, n))
    else:
        for n in os.listdir(folder):
            if n.lower().endswith(IMAGE_EXT) and not n.startswith("._"):
                out.append(os.path.join(folder, n))
    return sorted(out)


def resolve(paths: list[str] | None, folder: str | None, recursive: bool = False) -> list[str]:
    if paths:
        return [os.path.expanduser(p) for p in paths]
    if folder:
        return list_images(os.path.expanduser(folder), recursive)
    raise ValueError("pass either paths or folder")


def read_exif(files: list[str], tags: list[str] | None = None) -> list[dict]:
    if not files:
        return []
    fields = tags or ["FileName", "DateTimeOriginal", "Make", "Model", "LensModel",
                      "FocalLength", "FNumber", "ExposureTime", "ISO",
                      "ImageWidth", "ImageHeight"]
    cmd = [EXIFTOOL, "-q", "-m", "-j"] + [f"-{t}" for t in fields] + files
    r = subprocess.run(cmd, capture_output=True, text=True)
    if not r.stdout.strip():
        return []
    return json.loads(r.stdout)


def tech_line(e: dict) -> str:
    bits = []
    fl = str(e.get("FocalLength") or "").replace(".0 mm", "mm").replace(" mm", "mm")
    if fl:
        bits.append(fl)
    if e.get("FNumber"):
        bits.append(f"f/{e['FNumber']:g}" if isinstance(e["FNumber"], (int, float))
                    else f"f/{e['FNumber']}")
    if e.get("ExposureTime"):
        bits.append(f"{e['ExposureTime']}s")
    if e.get("ISO"):
        bits.append(f"ISO {e['ISO']}")
    return "  ".join(bits)


# ---------------------------------------------------------------- card import

def flatten_card(src: str, dest: str, date_prefix: bool = True,
                 extensions: list[str] | None = None, move: bool = False) -> dict:
    """Flatten a DCIM tree into one folder, optionally prefixing each name with its
    capture date (2026-08-31_DSCF3460.JPG) so a single folder sorts chronologically."""
    src, dest = os.path.expanduser(src), os.path.expanduser(dest)
    os.makedirs(dest, exist_ok=True)
    exts = tuple("." + e.lower().lstrip(".") for e in (extensions or ["jpg", "jpeg", "raf", "cr2", "nef", "arw", "dng"]))

    files = []
    for dp, _, names in os.walk(src):
        for n in names:
            if n.lower().endswith(exts) and not n.startswith("._"):
                files.append(os.path.join(dp, n))
    files.sort()
    if not files:
        return {"copied": 0, "dest": dest, "note": "no matching files"}

    listfile = os.path.join(dest, ".flatten_list.txt")
    with open(listfile, "w") as f:
        f.write("\n".join(files))
    cmd = [EXIFTOOL, "-P"] + ([] if move else ["-o"]) + [dest + "/"]
    if date_prefix:
        cmd += ["-FileName<DateTimeOriginal", "-d", "%Y-%m-%d_%%f.%%e"]
    else:
        cmd += ["-FileName<FileName"]
    cmd += ["-@", listfile]
    r = subprocess.run(cmd, capture_output=True, text=True)
    os.remove(listfile)
    copied = len([n for n in os.listdir(dest) if not n.startswith("._")])
    return {"source_files": len(files), "in_dest": copied, "dest": dest,
            "exiftool": (r.stdout or r.stderr).strip().splitlines()[-1:] or []}


# ---------------------------------------------------------------- EJ-taste v1

SIZE = 256


def _saliency(gray):
    f = np.fft.fft2(gray)
    log_amp = np.log1p(np.abs(f))
    phase = np.angle(f)
    k = 3
    pad = np.pad(log_amp, k // 2, mode="edge")
    avg = np.zeros_like(log_amp)
    for dy in range(k):
        for dx in range(k):
            avg += pad[dy:dy + SIZE, dx:dx + SIZE]
    avg /= k * k
    sr = log_amp - avg
    sal = np.abs(np.fft.ifft2(np.exp(sr + 1j * phase))) ** 2
    pad = np.pad(sal, 2, mode="edge")
    sm = np.zeros_like(sal)
    for dy in range(5):
        for dx in range(5):
            sm += pad[dy:dy + SIZE, dx:dx + SIZE]
    return sm / 25.0


def _largest_blob(mask):
    from collections import deque
    seen = np.zeros_like(mask, dtype=bool)
    total = int(mask.sum())
    if total == 0:
        return 0.0, (0.5, 0.5)
    best, centroid = 0, (0.5, 0.5)
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys[::7], xs[::7]):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        pix = []
        while q:
            y, x = q.popleft()
            pix.append((y, x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < SIZE and 0 <= nx < SIZE and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(pix) > best:
            best = len(pix)
            arr = np.array(pix)
            centroid = (arr[:, 0].mean() / SIZE, arr[:, 1].mean() / SIZE)
    return best / total, centroid


def photo_metrics(path: str) -> dict:
    im = Image.open(path)
    im.draft("L", (SIZE, SIZE))
    g = np.asarray(im.convert("L").resize((SIZE, SIZE)), dtype=np.float32) / 255.0
    contrast = float(g.std())
    p2, p98 = np.percentile(g, [2, 98])
    sym = 1.0 - float(np.abs(g - g[:, ::-1]).mean()) / (float(np.abs(g - g.mean()).mean()) * 2 + 1e-6)
    sal = _saliency(g)
    singleness, (cy, cx) = _largest_blob(sal >= np.percentile(sal, 92))
    centeredness = 1.0 - min(1.0, 2.0 * ((cy - 0.5) ** 2 + (cx - 0.5) ** 2) ** 0.5)
    mean = float(g.mean())
    p99 = float(np.percentile(g, 99))
    return {"contrast": contrast, "tonal_range": float(p98 - p2), "symmetry": sym,
            "singleness": singleness, "centeredness": centeredness,
            "mean_luma": mean, "p99_luma": p99}


def dhash(path: str) -> int:
    im = Image.open(path)
    im.draft("L", (64, 64))
    g = np.asarray(im.convert("L").resize((9, 8)), dtype=np.int16)
    v = 0
    for b in (g[:, 1:] > g[:, :-1]).flatten():
        v = (v << 1) | int(b)
    return v


def _z(a):
    a = np.asarray(a, dtype=float)
    return (a - a.mean()) / (a.std() + 1e-9)


def score_photos(files: list[str], drop_featureless: bool = True,
                 workers: int = 6) -> list[dict]:
    """EJ-taste v1. Blend weights from ejtaste/cld_taste.py.

    drop_featureless removes frames that are dark AND have no highlights anywhere —
    a camera firing inside a bag. Real night photographs keep their highlights and stay.
    """
    with ThreadPoolExecutor(max_workers=workers) as pool:
        raw = list(pool.map(lambda p: (p, _safe_metrics(p)), files))
    rows = [{"file": os.path.basename(p), "path": p, **m} for p, m in raw if m]

    for r in rows:
        r["featureless"] = bool(r["mean_luma"] < 0.06 and r["p99_luma"] < 0.08)
    pool_rows = [r for r in rows if not r["featureless"]] if drop_featureless else rows
    if not pool_rows:
        return []

    s = (0.31 * _z([r["contrast"] for r in pool_rows])
         + 0.13 * _z([r["tonal_range"] for r in pool_rows])
         + 0.28 * _z([r["symmetry"] for r in pool_rows])
         + 0.28 * _z([r["singleness"] * r["centeredness"] for r in pool_rows]))
    for r, v in zip(pool_rows, s):
        r["ejtaste"] = round(float(v), 4)
    for r in rows:
        r.setdefault("ejtaste", None)
    rows.sort(key=lambda r: (r["ejtaste"] is None, -(r["ejtaste"] or 0)))
    return rows


def _safe_metrics(p):
    try:
        return photo_metrics(p)
    except Exception:
        return None


def _capture_times(files: list[str]) -> dict:
    out = {}
    for e in read_exif(files, ["FileName", "DateTimeOriginal"]):
        v = e.get("DateTimeOriginal")
        if not v:
            continue
        try:
            out[e["FileName"]] = datetime.datetime.strptime(str(v)[:19], "%Y:%m:%d %H:%M:%S")
        except Exception:
            pass
    return out


def collapse_duplicates(rows: list[dict], within_seconds: int = 30,
                        hash_distance: int = 10) -> list[dict]:
    """Keep the best frame of each burst.

    Two frames are the same shot only if they are close in time AND look alike.
    Time alone over-collapses someone shooting steadily while walking; the hash is the
    real discriminator. Comparison is against the burst's first frame, not the previous
    one, so a long sequence cannot drift into a single cluster.

    A second pass catches same-day look-alikes outside the time window. It is
    deliberately same-day only: across different days, frames at this hash distance are
    coincidentally similar compositions, not duplicates.
    """
    scored = [r for r in rows if r.get("ejtaste") is not None]
    if not scored:
        return []
    times = _capture_times([r["path"] for r in scored])
    hashes = {}
    for r in scored:
        try:
            hashes[r["file"]] = dhash(r["path"])
        except Exception:
            pass

    seq = sorted((r for r in scored if r["file"] in times and r["file"] in hashes),
                 key=lambda r: times[r["file"]])
    if not seq:
        return scored

    ham = lambda a, b: bin(a ^ b).count("1")
    clusters, anchor = [[seq[0]]], seq[0]["file"]
    for prev, cur in zip(seq, seq[1:]):
        gap = (times[cur["file"]] - times[prev["file"]]).total_seconds()
        if gap <= within_seconds and ham(hashes[cur["file"]], hashes[anchor]) <= hash_distance:
            clusters[-1].append(cur)
        else:
            clusters.append([cur])
            anchor = cur["file"]

    keepers = []
    for c in clusters:
        best = max(c, key=lambda r: r["ejtaste"])
        best = dict(best)
        best["burst_size"] = len(c)
        best["burst_others"] = [r["file"] for r in c if r["file"] != best["file"]]
        keepers.append(best)
    keepers.sort(key=lambda r: -r["ejtaste"])

    final = []
    for r in keepers:
        day = r["file"][:10]
        if any(k["file"][:10] == day and ham(hashes[r["file"]], hashes[k["file"]]) <= hash_distance
               for k in final):
            continue
        final.append(r)
    return final


# ---------------------------------------------------------------- finder tags

def _read_tags(path: str) -> list[str]:
    r = subprocess.run(["xattr", "-px", TAG_ATTR, path], capture_output=True)
    if r.returncode != 0:
        return []
    try:
        v = plistlib.loads(bytes.fromhex(r.stdout.decode().replace("\n", "").replace(" ", "")))
        return list(v) if isinstance(v, list) else []
    except Exception:
        return []


def _write_tags(path: str, tags: list[str]) -> None:
    subprocess.run(["xattr", "-wx", TAG_ATTR,
                    plistlib.dumps(tags, fmt=plistlib.FMT_BINARY).hex(), path], check=True)


def tag_photos(files: list[str], tag: str, remove: bool = False,
               replace_same_tag: bool = False) -> dict:
    """Add or remove one Finder tag. Additive by default: other tags are left alone.

    Green is treated as a publish action in EJ's setup, so scripts should tag machine
    picks Yellow and leave Green to a person.
    """
    if tag not in TAG_INDEX:
        raise ValueError(f"unknown tag {tag}; choose from {sorted(TAG_INDEX)}")
    entry = f"{tag}\n{TAG_INDEX[tag]}"
    changed = untouched = 0
    for p in files:
        cur = _read_tags(p)
        has = any(t.split("\n")[0] == tag for t in cur)
        if remove:
            if not has:
                untouched += 1
                continue
            _write_tags(p, [t for t in cur if t.split("\n")[0] != tag])
        else:
            if has and not replace_same_tag:
                untouched += 1
                continue
            rest = [t for t in cur if t.split("\n")[0] != tag]
            _write_tags(p, rest + [entry])
        changed += 1
    return {"tag": tag, "removed" if remove else "tagged": changed,
            "unchanged": untouched, "total": len(files)}


def find_tagged(folder: str, tag: str) -> list[str]:
    """Spotlight lags a few minutes after bulk tagging, so this reads the files directly."""
    folder = os.path.expanduser(folder)
    out = []
    for p in list_images(folder):
        if any(t.split("\n")[0] == tag for t in _read_tags(p)):
            out.append(p)
    return sorted(out)


# ---------------------------------------------------------------- rendering

def _fit(path: str, w: int, h: int, cover: bool = False) -> Image.Image:
    im = Image.open(path)
    im.draft("RGB", (w * 2, h * 2))
    im = im.convert("RGB")
    sw, sh = im.size
    scale = (max if cover else min)(w / sw, h / sh)
    im = im.resize((max(1, int(sw * scale)), max(1, int(sh * scale))), Image.LANCZOS)
    if not cover:
        return im
    left, top = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((left, top, left + w, top + h))


def exif_print(path: str, out_path: str, print_size: str = "4x6",
               fit: str = "contain", caption: str | None = None,
               show_exif: bool = True) -> dict:
    """One photo on one sheet with its camera data in the border. The app's core output,
    at the same 300 DPI dimensions, without the GUI."""
    if print_size not in PRINT_SIZES:
        raise ValueError(f"unknown print size {print_size}; choose from {sorted(PRINT_SIZES)}")
    W, H = PRINT_SIZES[print_size]
    e = (read_exif([path]) or [{}])[0]

    margin = int(W * 0.055)
    cap_h = int(H * 0.13) if (show_exif or caption) else margin
    box_w, box_h = W - 2 * margin, H - margin - cap_h

    sheet = Image.new("RGB", (W, H), PAPER)
    im = _fit(path, box_w, box_h, cover=(fit == "cover"))
    if fit == "cover":
        im = _fit(path, box_w, box_h, cover=True)
    sheet.paste(im, (margin + (box_w - im.width) // 2, margin + (box_h - im.height) // 2))

    d = ImageDraw.Draw(sheet)
    base = max(18, int(W / 78))
    y = margin + box_h + int(base * 0.9)

    title = caption or os.path.splitext(os.path.basename(path))[0]
    d.text((margin, y), title, font=font(base, True), fill=INK)

    if show_exif:
        body = tech_line(e)
        d.text((margin, y + int(base * 1.5)), body, font=font(int(base * 0.82)), fill=SUBTLE)
        model = " ".join(x for x in [str(e.get("Make", "")).strip(), str(e.get("Model", "")).strip()] if x)
        lens = str(e.get("LensModel", "") or "")
        right = "  ·  ".join(x for x in [model, lens] if x)
        f2 = font(int(base * 0.72))
        if right:
            d.text((W - margin - d.textlength(right, font=f2), y + int(base * 1.55)), right,
                   font=f2, fill=FAINT)
        when = str(e.get("DateTimeOriginal", ""))[:10].replace(":", "-")
        if when:
            d.text((W - margin - d.textlength(when, font=f2), y + int(base * 0.1)),
                   when, font=f2, fill=SUBTLE)

    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
    sheet.save(out_path, quality=95, subsampling=0, dpi=(300, 300))
    return {"out": out_path, "size": f"{W}x{H}", "print_size": print_size}


def contact_sheets(files: list[str], out_dir: str, title: str = "CONTACT SHEET",
                   cols: int = 4, rows: int = 5, width: int = 2400,
                   theme: str = "dark", show_rank: bool = True,
                   make_pdf: bool = True, subtitle: str | None = None) -> dict:
    """Paginated proof sheets with EXIF under every frame, plus a single PDF.

    Unlike the in-app sheet this pages past 56 photos, prints the rank, and renders
    without a browser canvas."""
    out_dir = os.path.expanduser(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    if not files:
        return {"sheets": [], "note": "no files"}

    dark = theme != "light"
    bg = DARK_BG if dark else PAPER
    ink = DARK_INK if dark else INK
    muted = DARK_MUTED if dark else SUBTLE
    dim = DARK_DIM if dark else FAINT
    rule = DARK_RULE if dark else (229, 231, 235)

    exif = {e.get("FileName"): e for e in read_exif(files)}
    per = cols * rows
    margin, gutter, header, footer = 72, 30, 148, 78
    cell_w = (width - 2 * margin - (cols - 1) * gutter) // cols

    probe = Image.open(files[0])
    ar = probe.width / probe.height if probe.height else 1.5
    img_h = int(cell_w / ar)
    cap_h = 74
    cell_h = img_h + cap_h
    height = header + rows * cell_h + (rows - 1) * gutter + footer

    f_title, f_sub = font(38, True), font(20)
    f_rank, f_name = font(21, True), font(19)
    f_tech, f_foot = font(16), font(16)

    pages = [files[i:i + per] for i in range(0, len(files), per)]
    written = []
    for pi, page in enumerate(pages, 1):
        sheet = Image.new("RGB", (width, height), bg)
        d = ImageDraw.Draw(sheet)
        d.text((margin, 52), title.upper(), font=f_title, fill=ink)
        if subtitle:
            d.text((margin, 100), subtitle, font=f_sub, fill=muted)
        right = f"SHEET {pi:02d} / {len(pages):02d}"
        d.text((width - margin - d.textlength(right, font=f_sub), 100), right, font=f_sub, fill=muted)
        d.line([(margin, header - 24), (width - margin, header - 24)], fill=rule, width=2)

        spec = []
        for i, p in enumerate(page):
            cx = margin + (i % cols) * (cell_w + gutter)
            cy = header + (i // cols) * (cell_h + gutter)
            spec.append((p, cx, cy, (pi - 1) * per + i + 1))
        with ThreadPoolExecutor(max_workers=8) as pool:
            imgs = list(pool.map(lambda s: _fit(s[0], cell_w, img_h, cover=True), spec))

        for im, (p, cx, cy, rank) in zip(imgs, spec):
            sheet.paste(im, (cx, cy))
            d.rectangle([cx - 1, cy - 1, cx + cell_w, cy + img_h], outline=rule, width=1)
            name = os.path.basename(p)
            e = exif.get(name, {})
            ty = cy + img_h + 14
            off = 0
            if show_rank:
                rk = f"{rank:03d}"
                d.text((cx, ty), rk, font=f_rank, fill=ACCENT)
                off = d.textlength(rk + "  ", font=f_rank)
            label = os.path.splitext(name)[0]
            d.text((cx + off, ty + 1), label[-18:], font=f_name, fill=ink)
            d.text((cx, ty + 30), tech_line(e), font=f_tech, fill=muted)
            t = str(e.get("DateTimeOriginal", ""))[11:16]
            if t:
                d.text((cx + cell_w - d.textlength(t, font=f_tech), ty + 30), t, font=f_tech, fill=dim)

        fy = height - footer + 20
        d.line([(margin, fy - 16), (width - margin, fy - 16)], fill=rule, width=1)
        lenses = sorted({str(exif.get(os.path.basename(p), {}).get("LensModel", "")) for p in page} - {"", "None"})
        d.text((margin, fy), "  /  ".join(lenses) or "—", font=f_foot, fill=dim)
        tail = f"{len(files)} frames  ·  exif-photo-printer"
        d.text((width - margin - d.textlength(tail, font=f_foot), fy), tail, font=f_foot, fill=dim)

        fn = os.path.join(out_dir, f"contact-{pi:02d}.jpg")
        sheet.save(fn, quality=93, subsampling=0)
        written.append(fn)

    result = {"sheets": written, "pages": len(written), "dimensions": f"{width}x{height}"}
    if make_pdf and written:
        first = Image.open(written[0]).convert("RGB")
        rest = [Image.open(f).convert("RGB") for f in written[1:]]
        pdf = os.path.join(out_dir, "contact-sheets.pdf")
        first.save(pdf, save_all=True, append_images=rest, resolution=200.0)
        result["pdf"] = pdf
    return result


def write_csv(rows: list[dict], out_path: str, columns: list[str] | None = None) -> str:
    out_path = os.path.expanduser(out_path)
    cols = columns or ["file", "ejtaste", "burst_size", "featureless", "contrast",
                       "tonal_range", "symmetry", "singleness", "centeredness"]
    with open(out_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)
    return out_path
