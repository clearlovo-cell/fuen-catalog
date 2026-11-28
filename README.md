# 斐恩官周图鉴

《茉莉花之炯》角色斐恩的中文官方周边静态图鉴。站长通过 Decap CMS 维护 JSON 数据与图片。

## 1. 目录与数据

- `data/series.json`：柄图系列数组，`order` 越小越靠前。
- `data/goods.json`：谷子数组，`series` 保存对应系列的 `slug`。
- `data/site.json`：设置页的站长信息、联系方式和版权声明。
- `data/guide.json`：设置页结构化说明板块与独立 QA 条目，可在 CMS 中新增、删除和排序。
- `data/meta.json`：部署时根据谷子与系列数据的最近 Git 修改时间自动生成，无需手工维护。
- `js/filter.js`：材质拆分与 `filterGoods(allData, filters)` 纯函数。
- `js/render.js`：`imgUrl`、`renderImage`、卡片与详情渲染；`CARD_FIELDS` 集中控制卡面字段。
- `assets/img/`：本地演示图与兜底图；正式图片建议全部托管到 Cloudinary。
- `functions/oauth/`：腾讯云 SCF 的 GitHub OAuth 授权函数。

前台每次加载 JSON 都附加时间戳并使用 `cache: "no-cache"`，避免 CDN 或浏览器长期保留旧数据。COS 如另外配置了强缓存，请给 `data/*.json` 设置较短的缓存时间。

### 访客本地记录与备份

- `js/storage.js` 保存仓库和心愿单，个人列表数据结构保持不变。
- `js/prices.js` 使用独立存储键保存访客自行填写的人民币单价和数量，并负责跨标签页同步。
- `js/backup.js` 与 `js/archive.js` 导出包含个人列表、金额数量、Nickname、Slogan、标题连接样式和声音设置的 ZIP 备份；自定义照片默认包含，背景音乐与菜单语音由访客选择是否纳入。旧版 JSON、无金额、无 Nickname 备份及纯数字金额记录均可导入。
- 金额为空时不参与合计，取消入库或移出心愿单会清除对应金额数量。所有访客记录与媒体仅保存在当前浏览器，不会上传服务器。
- Nickname、标题连接样式和图鉴页 Slogan 统一在 Special 页维护；Slogan 留空时显示默认日文。
- 清空个人数据会清除仓库、心愿单、金额、数量、Nickname、Slogan 和标题连接样式，但保留显示模式与声音设置。收藏卡照片、背景音乐和菜单语音由访客另行勾选是否删除，默认保留。
- `js/theme.js` 管理浅色、深色和跟随系统三种显示模式，首次访问默认浅色；标题页插画会跟随实际生效的模式切换。
- `js/title.js` 在每次打开或刷新首页时播放可从右上向左下柔和清晰化的演出，点击空白处或 Esc 可跳过，站内返回标题页不重播，不再保存首访标记。
- `js/screenshot.js` 仅在访客填写了自定义 Slogan 时将其导出到标题与分隔线之间，空白时不保留占位；设置页复用图鉴页的返回顶部和前往底部按钮。
- `js/local-media.js` 使用 IndexedDB 保存自定义照片、背景音乐和六条菜单语音；`js/sound.js` 管理默认开启的全站声音总开关及独立音量、菜单语音开关。
- `js/audio-engine.js` 复用同一个 AudioContext，通过 GainNode 控制背景音乐与菜单语音音量，兼容不支持直接设置 `HTMLMediaElement.volume` 的 iOS 浏览器；菜单语音复用同一播放器，首次用户交互时才初始化音频上下文。
- `js/music.js` 管理本地背景音乐导入、播放／暂停、音量与移除，刷新后保留文件但不自动播放；`js/menu-voice.js` 管理六槽位语音、空槽位随机回退和实际菜单跳转播放。
- `js/profile-photo.js` 管理档案页照片裁剪与恢复默认，图鉴页和档案页同步显示同一自定义照片，只有档案页可以编辑。

## 2. GitHub Actions 同步 COS

工作流位于 `.github/workflows/deploy.yml`，使用腾讯云官方 COS Python SDK。脚本只发布 `index.html`、`CNAME`、`favicon.png`、`assets/`、`css/`、`js/`、`data/` 和 `admin/`，不会上传工作流、云函数或项目文档；`assets/audio/` 不发布，成功后会清理 COS 上的旧音频。

1. 在腾讯云创建 COS 存储桶，开启“静态网站”，首页设为 `index.html`。存储桶需允许公开读取、私有写入。
2. 建议在访问管理（CAM）创建仅拥有目标存储桶所需权限的子用户 API 密钥，不要使用主账号密钥。
3. 在 GitHub 仓库进入 **Settings → Secrets and variables → Actions → New repository secret**，依次添加：
   - `TENCENT_CLOUD_SECRET_ID`：腾讯云 API 密钥 SecretId。
   - `TENCENT_CLOUD_SECRET_KEY`：腾讯云 API 密钥 SecretKey。
   - `COS_BUCKET`：完整存储桶名，例如 `your-bucket-1250000000`。
   - `COS_REGION`：存储桶地域，例如 `ap-guangzhou`。
4. 推送 `main` 分支后，Actions 会读取 COS 文件列表，仅上传新增或内容变化的文件，未变化文件直接跳过；也可在 Actions 页手动运行。临时网络错误会退避重试，整个上传步骤最长运行 20 分钟。
5. 直接使用 COS 默认静态网站域名通常不要求为该域名另行备案；若绑定中国大陆自定义域名与 CDN，需按腾讯云要求完成 ICP 备案后再接入。

## 3. 腾讯云 SCF OAuth 部署

1. 在腾讯云云函数（SCF）新建 **Node.js 18 或更高版本** 的空白函数，将 `functions/oauth/index.js` 与 `package.json` 上传。函数不依赖第三方 npm 包。
2. 配置环境变量：
   - `GITHUB_CLIENT_ID`：GitHub OAuth App 的 Client ID。
   - `GITHUB_CLIENT_SECRET`：GitHub OAuth App 的 Client Secret，仅保存在云函数环境变量中。
   - `GITHUB_CALLBACK_URL`：完整回调地址，例如 `https://service-xxx.ap-guangzhou.apigw.tencentcs.com/release/callback`。
   - `SITE_ORIGIN`：CMS 站点源，例如 `https://your-bucket-1250000000.cos-website.ap-guangzhou.myqcloud.com`，不要带末尾斜杠。
3. 创建 API 网关触发器，将 `/auth` 与 `/callback` 两个 GET 路径都指向此函数，并开启响应集成，使函数返回的 302、Cookie 与 HTML 能原样传给浏览器。
4. 验证 `https://网关根地址/auth` 会跳转 GitHub。若网关切分路径后函数收到的 `path` 不含 `/callback`，代码也会根据 `code` 参数识别回调。
5. 切勿在日志中记录 Client Secret、授权码或访问令牌。

## 4. GitHub OAuth App

在 GitHub 进入 **Settings → Developer settings → OAuth Apps → New OAuth App**：

- **Application name**：任意可识别名称，例如 `Finn Catalog CMS`。
- **Homepage URL**：填写 CMS 所在站点地址。
- **Authorization callback URL**：必须与云函数环境变量 `GITHUB_CALLBACK_URL` 完全一致，包括协议、域名、路径与大小写。

创建后把 Client ID 和新生成的 Client Secret 写入 SCF 环境变量。Decap 的 `base_url` 是网关根地址，`auth_endpoint: auth` 会访问其 `/auth` 路径。

## 5. 日常维护

### 新增一条谷子

1. 打开 `/admin/` 并通过 GitHub 授权。
2. 进入 **谷子 → 谷子列表**，在列表中添加一项。
3. 填写名称、系列、类型、平台、年份、状态等字段；上传建议不低于 800×800px、单张不超过 5MB 的图片。
4. 保存并提交。 CMS 会更新 `data/goods.json`，推送后由 GitHub Actions 同步到 COS。

### 替换兜底图

默认兜底为 `assets/img/fallback.svg`，同时提供 `assets/img/fallback.png`。替换 SVG 可直接保持文件名覆盖；若要改用 PNG，覆盖 PNG 后把 `js/render.js` 顶部的 `FALLBACK_IMAGE` 改为 `./assets/img/fallback.png`。建议保持 800×800px，浅金底并保留“图片待补”字样。

### 替换标题页素材

将终稿放入 `assets/img/` 并保持以下文件名，无需修改代码：

- `title-mobile.webp`：移动端竖版底图，建议 1080×1920，顶部对齐，需要裁切时优先裁去下半部分。
- `title-desktop.webp`：桌面端横版底图，建议 1920×1080、500KB 以内，文字标题位于左侧留白区域。

素材未放入时，标题页显示奶油纸底与文字站名，不影响其他页面使用。

### 本地媒体与声音

网站不随包提供背景音乐或菜单语音。访客在设置页自行导入本地音频，文件仅写入当前浏览器的 IndexedDB，不会经过 CMS 或服务器。背景音乐最大 40MB，单条菜单语音最大 10MB；实际可播放格式取决于访客浏览器。

收藏卡照片在档案页本地裁剪，原图最大 15MB，处理后的 WebP 图片保存在 IndexedDB。默认图片仍为 `assets/img/uploads/series-stand.png`，恢复默认时会删除自定义图片，不删除默认素材。

新备份为 ZIP 格式，内含 `manifest.json` 与可选媒体文件。自定义照片默认包含，音频由访客在导出前勾选；导入旧版 JSON 时不要求媒体文件。媒体与当前设备重复时需确认后才会替换。

### 新增筛选维度

1. **CMS**：在 `admin/config.yml` 的谷子字段中新增字段，例如 `collection` 或 `shop_limit`。
2. **前端**：在 `index.html` 增加对应控件，在 `js/app.js` 的 `emptyFilters`、事件绑定与重置逻辑中接入；在 `js/filter.js` 的 `filterGoods` 中添加纯过滤判断。若维度可能为空，按现有字段方式在没有数据时隐藏控件。

### 新增柄图系列

直接在 CMS 的 **柄图系列 → 系列列表** 添加名称、slug、封面和排序权重即可。前台横滑条与谷子表单的系列选项会自动读取，无需修改前端代码。

## 8. 发布边界

公开浏览部分完全静态，无用户系统、订单或跨设备个人数据；收藏等轻量记录保存在浏览器 localStorage，照片和音频保存在 IndexedDB。只有站长使用 CMS 时需要 GitHub 授权。

2026-11-07：更新仓库、心愿单与备份功能。
<!-- 重新触发 GitHub Pages 部署 -->
