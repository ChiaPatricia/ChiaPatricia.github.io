#!/usr/bin/env python3
"""Mirror a Google Drive folder of photos into assets/photo.

Reads two environment variables (set as GitHub Actions secrets):
  GDRIVE_SA_KEY     the full JSON of a Google service-account key
  GDRIVE_FOLDER_ID  the id of the Drive folder to mirror

Downloads every image in the folder (skipping ones whose md5 already matches
the local copy) and removes local images that are no longer in the folder, so
the site's gallery mirrors the Drive folder exactly. Thumbnails and the
manifest are produced afterwards by build_gallery_manifest.py.

Order photos by naming them 01.jpg, 02.jpg, ... in Drive; the manifest sorts
by filename.

The service-account key is a credential: it lives only in GitHub Actions
secrets, is never printed, and is never committed.
"""
import hashlib
import io
import json
import os
import re
import sys

PHOTO_DIR = "assets/photo"
KEEP = {"gallery.json"}                     # non-image files to leave untouched
IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp")
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


def sanitize(name):
    base, ext = os.path.splitext(name)
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", base).strip("-._") or "photo"
    ext = ext.lower()
    if ext not in IMG_EXTS:
        ext = ".jpg"
    return base + ext


def local_md5(path):
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    key = os.environ.get("GDRIVE_SA_KEY")
    folder = os.environ.get("GDRIVE_FOLDER_ID")
    if not key or not folder:
        print("GDRIVE_SA_KEY / GDRIVE_FOLDER_ID not set; skipping Drive sync.")
        return 0

    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload

    creds = service_account.Credentials.from_service_account_info(
        json.loads(key), scopes=SCOPES)
    svc = build("drive", "v3", credentials=creds, cache_discovery=False)

    files, page = [], None
    q = "'%s' in parents and trashed = false" % folder
    while True:
        resp = svc.files().list(
            q=q,
            fields="nextPageToken, files(id,name,mimeType,md5Checksum)",
            pageSize=1000, orderBy="name_natural",
            supportsAllDrives=True, includeItemsFromAllDrives=True,
            pageToken=page,
        ).execute()
        files.extend(resp.get("files", []))
        page = resp.get("nextPageToken")
        if not page:
            break

    images = [f for f in files if f.get("mimeType", "").startswith("image/")]
    os.makedirs(PHOTO_DIR, exist_ok=True)

    used, desired = {}, {}
    for f in images:
        name = sanitize(f["name"])
        if name in used and used[name] != f["id"]:
            root, ext = os.path.splitext(name)
            name = "%s-%s%s" % (root, f["id"][:6], ext)
        used[name] = f["id"]
        desired[f["id"]] = name
    keep_names = set(desired.values()) | KEEP

    for f in images:
        name = desired[f["id"]]
        dest = os.path.join(PHOTO_DIR, name)
        if (os.path.exists(dest) and f.get("md5Checksum")
                and local_md5(dest) == f["md5Checksum"]):
            continue
        buf = io.BytesIO()
        dl = MediaIoBaseDownload(buf, svc.files().get_media(
            fileId=f["id"], supportsAllDrives=True))
        done = False
        while not done:
            _, done = dl.next_chunk()
        with open(dest, "wb") as out:
            out.write(buf.getvalue())
        print("downloaded", name)

    for fn in os.listdir(PHOTO_DIR):
        p = os.path.join(PHOTO_DIR, fn)
        if os.path.isdir(p) or fn in keep_names:
            continue
        if fn.lower().endswith(IMG_EXTS):
            os.remove(p)
            print("removed", fn)

    print("synced %d image(s) from Drive" % len(images))
    return 0


if __name__ == "__main__":
    sys.exit(main())
