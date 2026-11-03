# 斐恩官周图鉴

《茉莉花之炯》角色斐恩的中文官方周边静态图鉴。读者免登录浏览，站长通过 Decap CMS 维护 JSON 数据与 Cloudinary 图片。

> 当前仓库附带 5 条虚构示例数据与本地 SVG 示意图，用于演示完整交互，不代表真实收录数量或官方商品信息。

## 1. 本地预览

本项目无构建步骤，需要通过 HTTP 服务打开（不能直接双击 `index.html`，否则浏览器会拦截 JSON 请求）：

```bash
python3 -m http.server 8080
# 或：npx serve .
```

访问 `http://localhost:8080`。内容管理入口为 `http://localhost:8080/admin/`，但 GitHub OAuth 与 CMS 写入需要先完成后文配置。

## 2. 目录与数据

- `data/series.json`：柄图系列数组，`order` 越小越靠前。
- `data/goods.json`：谷子数组，`series` 保存对应系列的 `slug`。
- `js/filter.js`：材质拆分与 `filterGoods(allData, filters)` 纯函数。
- `js/render.js`：`imgUrl`、`renderImage`、卡片与详情渲染；`CARD_FIELDS` 集中控制卡面字段。
- `assets/img/`：本地演示图与兜底图；正式图片建议全部托管到 Cloudinary。
- `functions/oauth/`：腾讯云 SCF 的 GitHub OAuth 授权函数。

前台每次加载 JSON 都附加时间戳并使用 `cache: "no-cache"`，避免 CDN 或浏览器长期保留旧数据。COS 如另外配置了强缓存，请给 `data/*.json` 设置较短的缓存时间。

## 3. GitHub Actions 同步 COS

工作流位于 `.github/workflows/deploy.yml`，使用腾讯云官方 [`TencentCloud/cos-action`](https://github.com/TencentCloud/cos-action)。

1. 在腾讯云创建 COS 存储桶，开启“静态网站”，首页设为 `index.html`。存储桶需允许公开读取、私有写入。
2. 建议在访问管理（CAM）创建仅拥有目标存储桶所需权限的子用户 API 密钥，不要使用主账号密钥。
3. 在 GitHub 仓库进入 **Settings → Secrets and variables → Actions → New repository secret**，依次添加：
   - `TENCENT_CLOUD_SECRET_ID`：腾讯云 API 密钥 SecretId。
   - `TENCENT_CLOUD_SECRET_KEY`：腾讯云 API 密钥 SecretKey。
   - `COS_BUCKET`：完整存储桶名，例如 `your-bucket-1250000000`。
   - `COS_REGION`：存储桶地域，例如 `ap-guangzhou`。
4. 推送 `main` 分支后，Actions 会把 `index.html`、前台资源、JSON 和 `admin/` 同步到 COS 根目录；也可在 Actions 页手动运行。
5. 直接使用 COS 默认静态网站域名通常不要求为该域名另行备案；若绑定中国大陆自定义域名与 CDN，需按腾讯云要求完成 ICP 备案后再接入。

## 4. Cloudinary 与 Decap CMS

编辑 `admin/config.yml`：

- `backend.repo`：改为 `GitHub用户名/仓库名`。
- `backend.base_url`：改为 API 网关暴露的 OAuth 服务根地址，末尾不要带 `/`。
- `site_url`：改为 COS 静态网站地址。
- `media_library.config.cloud_name` 与 `api_key`：从 Cloudinary 控制台取得。公开 API Key 可出现在前端配置中；**API Secret 绝不能写入此文件或前端仓库**。

制品图片字段使用 `media_folder: "/{{fields.series}}"`，按当前记录的系列 slug 组织上传目录，例如 `/formula/`、`/chibi/`。首次正式使用时请在 CMS 中实际上传一张测试图，确认 Cloudinary 控制台中的目录符合预期；若所用 Decap/Cloudinary 版本不展开该模板，请改用自定义媒体库文件夹逻辑，不要静默把所有图片传到同一目录。

## 5. 腾讯云 SCF OAuth 部署

1. 在腾讯云云函数（SCF）新建 **Node.js 18 或更高版本** 的空白函数，将 `functions/oauth/index.js` 与 `package.json` 上传。函数不依赖第三方 npm 包。
2. 配置环境变量：
   - `GITHUB_CLIENT_ID`：GitHub OAuth App 的 Client ID。
   - `GITHUB_CLIENT_SECRET`：GitHub OAuth App 的 Client Secret，仅保存在云函数环境变量中。
   - `GITHUB_CALLBACK_URL`：完整回调地址，例如 `https://service-xxx.ap-guangzhou.apigw.tencentcs.com/release/callback`。
   - `SITE_ORIGIN`：CMS 站点源，例如 `https://your-bucket-1250000000.cos-website.ap-guangzhou.myqcloud.com`，不要带末尾斜杠。
3. 创建 API 网关触发器，将 `/auth` 与 `/callback` 两个 GET 路径都指向此函数，并开启响应集成，使函数返回的 302、Cookie 与 HTML 能原样传给浏览器。
4. 验证 `https://网关根地址/auth` 会跳转 GitHub。若网关切分路径后函数收到的 `path` 不含 `/callback`，代码也会根据 `code` 参数识别回调。
5. 切勿在日志中记录 Client Secret、授权码或访问令牌。

## 6. GitHub OAuth App

在 GitHub 进入 **Settings → Developer settings → OAuth Apps → New OAuth App**：

- **Application name**：任意可识别名称，例如 `Finn Catalog CMS`。
- **Homepage URL**：填写 CMS 所在站点地址。
- **Authorization callback URL**：必须与云函数环境变量 `GITHUB_CALLBACK_URL` 完全一致，包括协议、域名、路径与大小写。

创建后把 Client ID 和新生成的 Client Secret 写入 SCF 环境变量。Decap 的 `base_url` 是网关根地址，`auth_endpoint: auth` 会访问其 `/auth` 路径。

## 7. 日常维护

### 新增一条谷子

1. 打开 `/admin/` 并通过 GitHub 授权。
2. 进入 **谷子 → 谷子列表**，在列表中添加一项。
3. 填写名称、系列、类型、平台、年份、状态等字段；上传建议不低于 800×800px、单张不超过 5MB 的图片。
4. 保存并提交。 CMS 会更新 `data/goods.json`，推送后由 GitHub Actions 同步到 COS。

### 替换兜底图

默认兜底为 `assets/img/fallback.svg`，同时提供 `assets/img/fallback.png`。替换 SVG 可直接保持文件名覆盖；若要改用 PNG，覆盖 PNG 后把 `js/render.js` 顶部的 `FALLBACK_IMAGE` 改为 `./assets/img/fallback.png`。建议保持 800×800px，浅金底并保留“图片待补”字样。

### 新增筛选维度

1. **CMS**：在 `admin/config.yml` 的谷子字段中新增字段，例如 `collection` 或 `shop_limit`。
2. **前端**：在 `index.html` 增加对应控件，在 `js/app.js` 的 `emptyFilters`、事件绑定与重置逻辑中接入；在 `js/filter.js` 的 `filterGoods` 中添加纯过滤判断。若维度可能为空，按现有字段方式在没有数据时隐藏控件。

### 新增柄图系列

直接在 CMS 的 **柄图系列 → 系列列表** 添加名称、slug、封面和排序权重即可。前台横滑条与谷子表单的系列选项会自动读取，无需修改前端代码。

## 8. 发布边界

公开浏览部分完全静态，无用户系统、收藏、订单或跨设备个人数据。只有站长使用 CMS 时需要 GitHub 授权。Kimi 预览用于查看示例页面；正式发布按上述 COS 流程由仓库拥有者执行。
