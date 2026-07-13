# 摄影画廊：从 Google Drive 自动更新

网站上的「摄影」画廊会从一个你自己的 Google Drive 文件夹自动同步。
你只要往那个文件夹里传照片 / 删照片，网站就会在下一次同步时更新。

- 图片由网站自己托管（GitHub Pages），所以加载快、稳定。
- 同步由 GitHub Action 完成：每 6 小时自动跑一次，也可以在 Actions 页面手动点「Run workflow」立即跑。
- 照片顺序 = 文件名顺序。想排序就把文件命名成 `01.jpg`、`02.jpg`、`03.jpg` ……

---

## 一次性设置（大约 10 分钟，只做一次）

> 下面第 2–5 步涉及 Google 账号和一个密钥文件。**这些只能你本人操作**，密钥不要发给任何人、也不要提交进仓库；只粘贴到 GitHub 的 Secrets 里。

**1. 建 Drive 文件夹并上传照片**
- 在 Google Drive 新建一个文件夹，例如 `website-photos`，把要展示的照片传进去。
- 打开这个文件夹，看浏览器地址栏：`https://drive.google.com/drive/folders/`**`XXXXXXXX`** —— 后面那串 `XXXXXXXX` 就是**文件夹 ID**，先复制下来。

**2. 开通 Google Drive API**
- 打开 https://console.cloud.google.com/ ，随便新建一个项目（或用已有的）。
- 搜索并进入「Google Drive API」，点 **Enable / 启用**。

**3. 建 service account 并下载密钥**
- 左侧菜单 → 「IAM & Admin」→「Service Accounts」→「Create service account」。
- 名字随意（如 `photo-sync`），创建后点进去 →「Keys」→「Add key」→「Create new key」→ 选 **JSON**，会下载一个 `.json` 文件。
- 记下这个 service account 的邮箱，形如 `photo-sync@你的项目.iam.gserviceaccount.com`。

**4. 把 Drive 文件夹共享给它**
- 回到第 1 步的 Drive 文件夹 →「共享 / Share」→ 把上面那个 service account 邮箱加进去，权限 **Viewer（查看者）** 即可。

**5. 在 GitHub 仓库里加两个 Secret**
- 打开仓库 `ChiaPatricia/ChiaPatricia.github.io` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，加两条：
  - `GDRIVE_SA_KEY` —— 把第 3 步那个 `.json` 文件的**全部内容**粘进去。
  - `GDRIVE_FOLDER_ID` —— 第 1 步复制的文件夹 ID。

**6. 跑一次**
- 仓库 → **Actions** 标签页 → 左侧选「Sync photos from Google Drive」→ 右上「Run workflow」。
- 跑完后它会自动把照片、缩略图和画廊清单提交上去，网站几分钟后更新。

---

## 日常使用

- 想加照片：直接拖进那个 Drive 文件夹。
- 想删 / 换照片：在 Drive 里删或替换。
- 想调顺序：改文件名前面的编号（`01_`、`02_`……）。
- 更新时机：每 6 小时自动同步一次；想立刻看到就去 Actions 手动「Run workflow」。

## 原理（给好奇的你）

- `scripts/sync_drive_photos.py` 用 service account 列出并下载文件夹里的图片到 `assets/photo/`，Drive 里没有的会被删掉（网站 = Drive 文件夹的镜像）。
- `scripts/build_gallery_manifest.py` 生成缩略图（`assets/photo/thumb/`）和 `assets/photo/gallery.json`，网站前端读这个清单渲染画廊。
- `.github/workflows/sync-photos.yml` 把上面两步串起来，定时 + 手动触发，有变化就自动提交。
