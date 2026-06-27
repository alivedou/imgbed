# 管理员控制面板：上传媒体信息详解

本文件详细说明了管理员登录后的管理面板中，已上传图片及媒体文件的表格信息项含义。管理员可以通过该表格对所有托管文件进行全面的可视化审计与精细化管理。

---

## 📋 媒体数据表格项详细说明

表格共包含 **Name**、**Preview**、**Time**、**IP**、**PV**、**R** 以及 **Actions** 七个核心信息维度：

| 字段名称 | 中文解释 | 实际包含内容与核心功能 | 主流应用场景与设计意图 |
| :--- | :--- | :--- | :--- |
| **Name** | **文件名称/链接** | • 显示上传文件在存储端或网关中的唯一路径标识。<br>• **核心交互**：点击名称可触发**“分享格式分发面板”**，提供预格式化的 HTML 标签、Markdown 插入语法、Raw URL（原始链接）及 BB-Code 论坛代码，支持一键复制。 | 方便管理员快速获取各种格式的引用外链并进行分发。 |
| **Preview** | **媒体内容预览** | • **媒体自适应**：智能识别文件后缀，自动适配渲染**普通图片**、**动图（GIF）**或**视频播放器（Video）**。<br>• **核心交互**：点击缩略图调用灯箱插件，支持全屏预览、手势滑动、放大缩小、90度旋转。 | 供管理员免跳转、零侵入地快速审查媒体内容是否合规。 |
| **Time** | **上传时间** | • 记录并显示该媒体文件被上传到服务器的精确时刻。<br>• 日期与时间分两行独立精致排版，大幅提升大屏幕下的可读性。 | 用于追踪文件的上传足迹和按时间跨度进行日常审计。 |
| **IP** | **上传者 IP** | • 记录上传者发起请求时的客户端公网 IP 地址。<br>• **核心交互**：支持 IP 地址智能截断防溢出，鼠标悬浮（Tooltip）可显示完整、无删减的 IP 地址。 | 发现异常上传行为时进行来源定位、审计与封禁限制。 |
| **PV (Page Views)**| **访问量/阅读数** | • 统计并记录该文件在全网累计被请求、预览或下载的总体次数（由数据库计数器动态更新）。 | 衡量特定资源的热度，帮助管理员评估带宽消耗和热门资源。 |
| **R (Rating)** | **内容评级与状态** | • **安全审核**：原第三方自动审查鉴黄服务（ModerateContent）因接口不稳已停用，系统默认设定所有新上传文件为 `1`（安全大众级）。<br>• **评级说明**：<br>&nbsp;&nbsp;- `1`：大众级（Safe / Clean），正常展示。<br>&nbsp;&nbsp;- `2`：青少年级（Mild / Warning），敏感警告。<br>&nbsp;&nbsp;- `3`：成人级/拉黑（Explicit / Blocked），触发系统阻断，禁止外链访问并重定向至挂起/封禁占位图。<br>&nbsp;&nbsp;- `-1`/`0`：未评级或未处理。<br>• **安全阻断**：对于 `Rating === 3` 的文件，系统会在网关（`/file`、`/rfile`、`/cfile`）层级进行物理拦截，只允许管理员面板（Referer 匹配）加载，全网其它外链引用将直接返回 `blocked.png`。 | 手动图像内容风控，防止因恶意/违规内容导致存储服务或域名被封禁。 |
| **Actions** | **管理动作控制** | • **快捷状态开关 (Switcher)**：一键切换或修改该图片的 R (Rating) 状态，实现实时拉黑、解锁或评级变更，无须刷新页面。<br>• **物理删除 (Delete)**：点击垃圾桶按钮，弹出安全二次确认，确认后将永久删除物理存储介质（如 Cloudflare R2 / Telegram 渠道中）及 D1 数据库中的对应记录。 | 实现全生命周期的即时管理。 |

---

## 🛠️ 技术实现要点

1. **自适应视听预览**：采用专有扩展名匹配算法，支持对 `mp4`、`mkv`、`avi`、`mov` 等视频格式进行原生 `<video>` 渲染预览，对 `jpg`、`png`、`webp`、`svg` 等进行 `<img />` 渲染预览。
2. **数据双向状态响应**：在 **Actions** 列切换 Switch 状态时，会静默向后端发送 `/api/admin/block` 请求，无需刷新页面即可实现内存状态与持久化数据库（D1 / 外部 SQL）的数据同步。
3. **安全介质清除**：物理删除操作是不可逆的。点击删除后会依次触发服务端逻辑，在擦除数据库索引的同时，向远端存储媒介（R2 / 存储服务）发送对应销毁指令，避免产生存储碎片或孤立垃圾文件。

---

## 🛡️ R (Rating) 内容审核与过滤机制详解

系统的内容安全评级采用**默认大众安全级 + 管理员手动精细审计**的高效、零延迟风控方案：

### 1. 默认大众安全评级 (1 - Safe)
由于外部第三方鉴黄 API 服务不稳，系统已停用自动发送第三方 API 请求的逻辑，从而实现了：
- **零网络延迟**：新上传的图片直接设为评级 `1` (Safe)，不经历外部网络请求，上传更迅速。
- **高可用性**：避免因第三方 API 宕机导致图片上传错误。
- **免密钥配置**：无需在环境变量中配置 `ModerateContentApiKey`。

### 2. 管理员手动审计与动态封禁
管理员可以通过极简后台面板（Admin Dashboard）对托管的所有图片进行可视化审查，并利用以下控制链进行精准风控：
- **即时拉黑**：点击 Actions 列的评级开关，即可通过无刷新 API（`/api/admin/block`）把特定违法或违规图片的 `Rating` 一键修改为 `3` (Explicit)。
- **即时解锁**：管理员可以随时将已被封禁图片的评级重新调回 `1`。

### 3. 动态路由过滤与安全阻断逻辑
系统在获取文件的分发路由（如 `/file/*`、`/rfile/*`、`/cfile/*`）时，会在服务端执行一层安全过滤器拦截：
- **实时查询**：每次外链请求通过数据库获取该文件的最新 `Rating` 值。
- **定向阻断**：若查询到该文件的评级为 `3`（拉黑状态）：
  - **普通访客**：直接阻断原始数据返回，强制 302 重定向到配置的封禁占位图（`/img/blocked.png`）。
  - **白名单绕过**：如果请求头中的 `Referer` 匹配管理员后台地址（`/admin`、`/list`、`/`），则绕过阻断规则，允许管理员照常预览与复审，以便通过 Switcher 手动将非违规内容解封（设回 `1`）。

---

## ☁️ Cloudflare Pages + D1 + R2 部署教程

按照以下步骤将项目完整部署到 Cloudflare Pages，包含 D1 数据库、R2 存储及管理员账户初始化。

> **项目已内置 `wrangler.toml`、`_routes.json`、`open-next.config.ts` 等配置文件，无需手动创建。**

---

### 前提准备

1. **Cloudflare 账号**：注册免费 [Cloudflare](https://dash.cloudflare.com/) 账户
2. **GitHub 仓库**：将本项目 Fork 或上传到你的 GitHub 仓库
3. **Telegram 机器人（可选）**：
   - 在 Telegram 中关注 [@BotFather](https://t.me/BotFather)，发送 `/newbot` 创建机器人，获取 **`TG_BOT_TOKEN`**
   - 创建一个频道/群组，获取 **`Chat ID`**（频道 ID 前缀带 `-100`）

---

### 第一步：创建 Cloudflare D1 数据库 & R2 存储桶

#### 1.1 创建 D1 数据库
1. 登录 Cloudflare 控制台 → **Workers & Pages** → **D1**
2. 点击 **Create database** → 选择 **Create empty database**
3. 名称填入 **`imgbed`**，点击 **Create**
4. 记下右侧面板的 **Database ID**（UUID），后续需填入 `wrangler.toml`

#### 1.2 创建 R2 存储桶（可选，用于本地文件存储）
1. Cloudflare 控制台 → **R2**
2. 点击 **Create bucket**
3. 名称填入 **`imgbed`**，点击 **Create bucket**

---

### 第二步：修改 `wrangler.toml` 配置文件

打开项目根目录的 `wrangler.toml`，将占位的 `database_id` 替换为你的 D1 UUID：

```toml
name = "imgbed"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".open-next"

[[d1_databases]]
binding = "IMG"
database_name = "imgbed"
database_id = "替换为你的 D1 UUID"    # ← 改这里

[[r2_buckets]]
binding = "IMGRS"
bucket_name = "imgbed"                # ← 如果 R2 名不同则改这里
```

> `wrangler.toml` 中的 `database_id` 不是密钥，仅用于 Cloudflare 内部关联绑定。Dashboard 中的 D1/R2 绑定按钮会灰掉，由该文件统一管理。

---

### 第三步：Cloudflare Pages 部署

1. Cloudflare 控制台 → **Workers & Pages** → **Overview** → **Create** → **Pages** → **Connect to Git**
2. 选择你的 GitHub 仓库，点击 **Begin setup**
3. 构建设置：

| 配置项 | 值 |
|:---|:---|
| **Project name** | 任意（如 `imgbed`） |
| **Production branch** | `v2`（或你使用的主分支） |
| **Framework preset** | `None` |
| **Build command** | `npm run cf-build` |
| **Build output directory** | `.open-next` |

4. 展开 **Environment variables (advanced)**，添加以下变量：

| 变量名 | 必填 | 说明 |
|:---|:---|:---|
| `AUTH_SECRET` | ✅ 必填 | 32 位以上随机字符串，用于加密会话 Token |
| `ADMIN_PASS` | ✅ 必填 | 管理员密码（用户名固定 `admin`） |
| `BASIC_PASS` | 建议 | 普通用户密码（用户名固定 `user`），留空默认为 `user` |
| `TG_BOT_TOKEN` | 可选 | Telegram 机器人 Token |
| `TG_CHAT_ID` | 可选 | Telegram 频道/群组 Chat ID |

5. 点击 **Save and Deploy**

> 首次部署会 404 或 500，属于正常现象——D1 表尚未创建。

---

### 第四步：初始化 D1 数据库表

部署完成后，进入 D1 控制台 Console 执行表结构迁移：

1. Cloudflare 控制台 → **Workers & Pages** → **D1** → 点击 `imgbed` 数据库
2. 切换到 **Console** 选项卡
3. 打开项目根目录的 `tgimglog.sql`，**只复制以下 `CREATE TABLE` 语句**（跳过 `DROP TABLE`）：

```sql
CREATE TABLE IF NOT EXISTS tgimglog (
    `id` integer PRIMARY KEY NOT NULL,
    `url` text,
    `referer` text,
    `ip` varchar(255),
    `time` TEXT
);

CREATE TABLE IF NOT EXISTS imginfo (
    `id` integer PRIMARY KEY NOT NULL,
    `url` text,
    `referer` text,
    `ip` varchar(255),
    `rating` integer,
    `total` integer,
    `time` TEXT
);

CREATE TABLE IF NOT EXISTS system_config (
    `key` TEXT PRIMARY KEY NOT NULL,
    `value` TEXT
);

CREATE TABLE IF NOT EXISTS failed_attempts (
    `identifier` TEXT PRIMARY KEY NOT NULL,
    `count` integer DEFAULT 1,
    `first_failed_at` TEXT,
    `locked_until` TEXT
);
```

4. 粘贴到 Console 输入框，点击 **Execute**
5. 进入 **Tables** 选项卡确认 4 张表已创建（`tgimglog`、`imginfo`、`system_config`、`failed_attempts`）

---

### 第五步：重新部署

1. 切换到 Pages 项目的 **Deployments** 选项卡
2. 点击最新构建右侧的 **⋮** → **Retry deployment**
3. 部署完成后访问 Cloudflare 分配的 `*.pages.dev` 域名，看到图床首页即部署成功

---

### 常见故障排查

| 现象 | 原因 | 解决 |
|:---|:---|:---|
| 页面 404 | `_worker.js` / `_routes.json` / 静态文件未正确部署 | 确认构建命令为 `npm run cf-build`（不是 `npx @opennextjs/cloudflare`） |
| 样式乱 / CSS/JS 404 | `_next/static/` 文件路径错位 | 同上一行，确认构建命令包含 `cp -r assets/_next _next` |
| 上传成功但刷新后消失 | D1 绑定未生效 | 确认 `wrangler.toml` 中 `database_id` 已替换；D1 表已通过 Console 创建 |
| 删除闪现成功又恢复 | 同上 | 同上 |
| 缩略图裂开 | R2 绑定未生效 | 确认 `wrangler.toml` 中 `[[r2_buckets]]` 配置正确 |
| 登录后 cookie 丢失 | 本地 `http` 下 `SameSite=None; Secure` 策略不兼容 | 仅在本地开发出现，生产环境 HTTPS 正常 |
| `npm error EUSAGE ... lock file not in sync` | `package.json` 更新但 `package-lock.json` 未同步 | 本地运行 `npm install` 后重新 commit 两个文件 |
| `npm warn deprecated` 警告 | 传递依赖过时 | 非阻塞警告，不影响部署，可忽略 |
| `Could not resolve "crypto" / "fs"` 等 44 个错误 | `wrangler.toml` 缺少 `nodejs_compat` 标志 | 项目已内置，如手动创建 wrangler.toml 则需自行添加 |
| Pages 绑定按钮灰色 | `wrangler.toml` 已接管绑定管理 | 正常现象，绑定由 `wrangler.toml` 管理，无需 Dashboard 操作


