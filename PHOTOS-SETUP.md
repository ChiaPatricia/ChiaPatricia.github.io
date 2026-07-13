# 摄影画廊：从 Google Drive 自动更新

网站「摄影」画廊会从一个你自己的 Google Drive 文件夹自动同步：
**往文件夹里传照片 / 删照片，网站就会自动更新**。

- 图片由网站自己托管（GitHub Pages），加载快、稳定。
- 不需要 API key、不需要 service account、不需要任何密钥——只要文件夹保持「知道链接的人可查看」即可。
- 同步由 GitHub Action 完成：每 6 小时自动跑一次，也可在 Actions 页手动点「Run workflow」立即更新。
- 照片顺序 = 文件名顺序。想排序就把文件命名成 `01.jpg`、`02.jpg`、`03.jpg` ……

当前绑定的文件夹：
`https://drive.google.com/drive/folders/1R90Kzhmzo6cGszoh3xjm_19aw4_uZj-X`

---

## 日常使用（这就是全部了）

1. 打开那个 Drive 文件夹。
2. 传照片进去（想排序就在文件名前加编号）；想删就删，想换就换。
3. 等最多 6 小时自动更新，或去仓库 **Actions → Sync photos from Google Drive → Run workflow** 立刻更新。

就这么简单。

## 换一个文件夹（可选）

如果以后想换成另一个 Drive 文件夹，两种方式二选一：
- 改 `scripts/sync_drive_photos.py` 里 `FOLDER_ID` 那一行的默认值；或
- 在仓库 **Settings → Secrets and variables → Actions → Variables** 里加一个变量 `GDRIVE_FOLDER_ID`，值为新文件夹 ID（地址栏 `/folders/` 后面那串）。

新文件夹同样要设成「知道链接的人可查看」。

## 注意

- 文件夹必须是「知道链接的人可查看」。里面的照片本来就会公开展示在网站上，所以这不会额外泄露隐私；但别把不想公开的东西放进去。
- 一旦同步跑起来，画廊就是这个 Drive 文件夹的**镜像**：Drive 里有什么，网站就显示什么。
- gdown 抓取公开文件夹一次约支持 50 张以内；超过就把照片拆到多个文件夹，或改用 API key / service account 方案（需要时再说）。

## 原理（给好奇的你）

- `scripts/sync_drive_photos.py`：用 gdown 把公开文件夹里的图片下载到 `assets/photo/`，Drive 里没有的会被删掉。
- `scripts/build_gallery_manifest.py`：用 Pillow 生成缩略图（`assets/photo/thumb/`）和 `assets/photo/gallery.json`，前端读这个清单渲染画廊。
- `.github/workflows/sync-photos.yml`：把上面两步串起来，定时 + 手动触发，有变化就自动提交。
