#!/usr/bin/env python3
"""Mirror a public Google Drive folder of photos into assets/photo.

Uses gdown, so it needs no credentials or API keys: the Drive folder just has
to be shared "anyone with the link can view". The folder id comes from the
GDRIVE_FOLDER_ID environment variable, defaulting to the site's folder.

Downloads every image, then removes local images no longer in the folder, so
the gallery mirrors the Drive folder. Thumbnails and gallery.json are produced
afterwards by build_gallery_manifest.py. Order = filename order (name photos
01.jpg, 02.jpg, ... in Drive to control it).

Note: gdown's folder download handles up to ~50 files; for more, split into
folders or switch to an API-key/service-account approach.
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

PHOTO_DIR = "assets/photo"
FOLDER_ID = os.environ.get("GDRIVE_FOLDER_ID") or "1R90Kzhmzo6cGszoh3xjm_19aw4_uZj-X"
IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp")
KEEP = {"gallery.json"}


def sanitize(name):
    base, ext = os.path.splitext(name)
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", base).strip("-._") or "photo"
    ext = ext.lower()
    if ext == ".jpeg":
        ext = ".jpg"
    if ext not in (".jpg", ".png", ".webp"):
        ext = ".jpg"
    return base + ext


def main():
    url = "https://drive.google.com/drive/folders/%s" % FOLDER_ID
    tmp = tempfile.mkdtemp(prefix="gdrive-")
    try:
        subprocess.run(
            [sys.executable, "-m", "gdown", "--folder", url, "-O", tmp, "--quiet"],
            check=True,
        )
    except subprocess.CalledProcessError as e:
        print("gdown failed:", e)
        return 1

    downloaded = []
    for root, _, files in os.walk(tmp):
        for fn in files:
            if fn.lower().endswith(IMG_EXTS):
                downloaded.append(os.path.join(root, fn))
    if not downloaded:
        print("no images found in folder; leaving gallery unchanged")
        shutil.rmtree(tmp, ignore_errors=True)
        return 0

    os.makedirs(PHOTO_DIR, exist_ok=True)
    used, keep_names = {}, set(KEEP)
    for src in sorted(downloaded, key=lambda p: os.path.basename(p).lower()):
        name = sanitize(os.path.basename(src))
        root_, ext_ = os.path.splitext(name)
        i = 1
        while name in used:
            name = "%s-%d%s" % (root_, i, ext_)
            i += 1
        used[name] = 1
        keep_names.add(name)
        shutil.copyfile(src, os.path.join(PHOTO_DIR, name))

    for fn in os.listdir(PHOTO_DIR):
        p = os.path.join(PHOTO_DIR, fn)
        if os.path.isdir(p) or fn in keep_names:
            continue
        if fn.lower().endswith(IMG_EXTS):
            os.remove(p)

    shutil.rmtree(tmp, ignore_errors=True)
    print("synced %d image(s) from Drive folder %s" % (len(downloaded), FOLDER_ID))
    return 0


if __name__ == "__main__":
    sys.exit(main())
