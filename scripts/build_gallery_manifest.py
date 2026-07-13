#!/usr/bin/env python3
"""Build the photography gallery manifest and thumbnails.

Scans PHOTO_DIR for images, writes downscaled thumbnails into PHOTO_DIR/thumb,
and emits gallery.json describing each photo (full src, thumb, dimensions).

Used both for the initial local seed (existing photos) and by the Drive sync
GitHub Action after it has downloaded the latest photos from Google Drive.

Ordering: natural sort by filename, so photos can be ordered by naming them
01.jpg, 02.jpg, ... in the Drive folder.
"""
import json
import os
import re

from PIL import Image, ImageOps

PHOTO_DIR = "assets/photo"
THUMB_SUBDIR = "thumb"
MANIFEST = os.path.join(PHOTO_DIR, "gallery.json")
MAX_THUMB = 720          # longest side of a thumbnail, px
THUMB_QUALITY = 82
EXTS = (".jpg", ".jpeg", ".png", ".webp")


def natural_key(name):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", name)]


def build():
    thumb_dir = os.path.join(PHOTO_DIR, THUMB_SUBDIR)
    os.makedirs(thumb_dir, exist_ok=True)

    files = [
        f for f in os.listdir(PHOTO_DIR)
        if f.lower().endswith(EXTS) and os.path.isfile(os.path.join(PHOTO_DIR, f))
    ]
    files.sort(key=natural_key)

    photos = []
    kept_thumbs = set()
    for name in files:
        path = os.path.join(PHOTO_DIR, name)
        try:
            im = Image.open(path)
            im = ImageOps.exif_transpose(im)   # honour camera orientation
            im.load()
        except Exception as e:
            print("skip (cannot read):", name, e)
            continue
        w, h = im.size

        thumb_name = os.path.splitext(name)[0] + ".jpg"
        thumb_path = os.path.join(thumb_dir, thumb_name)
        # only build a thumbnail if it does not already exist, so re-runs are
        # byte-stable across machines (no needless commits from the sync Action)
        if not os.path.exists(thumb_path):
            thumb = im.copy()
            thumb.thumbnail((MAX_THUMB, MAX_THUMB))
            thumb.convert("RGB").save(thumb_path, "JPEG", quality=THUMB_QUALITY, optimize=True)
        kept_thumbs.add(thumb_name)

        photos.append({
            "src": "/%s/%s" % (PHOTO_DIR, name),
            "thumb": "/%s/%s/%s" % (PHOTO_DIR, THUMB_SUBDIR, thumb_name),
            "w": w,
            "h": h,
        })

    # remove orphaned thumbnails whose source photo is gone
    for t in os.listdir(thumb_dir):
        if t.lower().endswith(EXTS) and t not in kept_thumbs:
            os.remove(os.path.join(thumb_dir, t))

    data = {
        "count": len(photos),
        "photos": photos,
    }
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("wrote %s with %d photos" % (MANIFEST, len(photos)))


if __name__ == "__main__":
    build()
