#!/usr/bin/env python3
"""Add photos from a public Google Drive folder into assets/photo, alongside
any permanent photos committed directly to the repo.

Uses gdown, so no credentials or API keys are needed: the Drive folder just has
to be shared "anyone with the link can view". The folder id comes from the
GDRIVE_FOLDER_ID environment variable, defaulting to the site's folder.

Which files came from Drive is tracked in assets/photo/.drive-managed.json, so:
  * photos committed straight to the repo (e.g. p1.jpg) are never touched, and
  * Drive photos removed from the folder are cleaned up on the next run.

Thumbnails and gallery.json are produced afterwards by build_gallery_manifest.py.
Order photos by naming them 01.jpg, 02.jpg, ... ; the manifest sorts by filename.

Note: gdown's folder download handles up to ~50 files.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

PHOTO_DIR = "assets/photo"
STATE = os.path.join(PHOTO_DIR, ".drive-managed.json")
FOLDER_ID = os.environ.get("GDRIVE_FOLDER_ID") or "1R90Kzhmzo6cGszoh3xjm_19aw4_uZj-X"
IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp")


def sanitize(name):
    base, ext = os.path.splitext(name)
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", base).strip("-._") or "photo"
    ext = ext.lower()
    if ext == ".jpeg":
        ext = ".jpg"
    if ext not in (".jpg", ".png", ".webp"):
        ext = ".jpg"
    return base + ext


def load_state():
    try:
        with open(STATE) as f:
            return set(json.load(f))
    except Exception:
        return set()


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
        shutil.rmtree(tmp, ignore_errors=True)
        return 1

    downloaded = []
    for root, _, files in os.walk(tmp):
        for fn in files:
            if fn.lower().endswith(IMG_EXTS):
                downloaded.append(os.path.join(root, fn))

    if not downloaded:
        print("no images downloaded; leaving gallery unchanged")
        shutil.rmtree(tmp, ignore_errors=True)
        return 0

    os.makedirs(PHOTO_DIR, exist_ok=True)
    prev = load_state()
    current = set()
    for src in sorted(downloaded, key=lambda p: os.path.basename(p).lower()):
        name = sanitize(os.path.basename(src))
        root_, ext_ = os.path.splitext(name)
        i = 1
        while name in current:
            name = "%s-%d%s" % (root_, i, ext_)
            i += 1
        current.add(name)
        shutil.copyfile(src, os.path.join(PHOTO_DIR, name))

    # remove only Drive-sourced files that are no longer in the folder
    for stale in (prev - current):
        p = os.path.join(PHOTO_DIR, stale)
        if os.path.isfile(p):
            os.remove(p)

    with open(STATE, "w") as f:
        json.dump(sorted(current), f, indent=2)

    shutil.rmtree(tmp, ignore_errors=True)
    print("synced %d Drive photo(s) from folder %s" % (len(current), FOLDER_ID))
    return 0


if __name__ == "__main__":
    sys.exit(main())
