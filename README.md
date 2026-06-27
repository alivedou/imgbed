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

## ☁️ Cloudflare Pages 极速傻瓜式部署与数据库初始化教程

跟随以下步骤，你可以在 5 分钟内将本项目完整、免费地部署到 Cloudflare Pages，并完成 D1 数据库、Telegram 机器人接口及管理员账户的初始化。

---

### 第一步：前期准备工作
在开始部署前，请确保你已经准备好以下信息：
1. **Cloudflare 账号**：拥有一个免费的 Cloudflare 账户。
2. **GitHub 仓库**：将本项目代码克隆（Fork）或上传到你自己的 GitHub 私有/公开仓库。
3. **Telegram 机器人（可选但推荐）**：
   - 在 Telegram 中关注 [@BotFather](https://t.me/BotFather)，发送 `/newbot` 创建一个机器人，获取 **`TG_BOT_TOKEN`**。
   - 关注 [@userinfobot](https://t.me/userinfobot) 获取你的 Telegram User ID，或创建一个频道/群组并获取其 **`Chat ID`**，以便后续配置接收通知或作存储通道。

---

### 第二步：创建并初始化 Cloudflare D1 数据库
由于 D1 是 Serverless SQL 数据库，需要先在云端创建它并运行项目自带的 `tgimglog.sql` 脚本来生成表结构：

#### 1. 创建数据库：
- 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
- 点击左侧导航栏的 **"Workers & Pages" (Workers 和 Pages) -> "D1"**。
- 点击 **"Create database" (创建数据库)** -> 选择 **"Create empty database" (创建空白数据库)**。
- 数据库名称填入：**`img`**，然后点击 **"Create" (创建)** 按钮。

#### 2. 初始化表结构（导入 SQL 脚本）：
- **方法 A：在 Cloudflare 网页后台直接导入（最方便、无需命令行）**
  1. 点击刚刚创建的 `img` 数据库，进入它的管理界面。
  2. 切换到 **"Console" (控制台)** 选项卡。
  3. 用文本编辑器打开本项目根目录下的 **`tgimglog.sql`** 文件，**复制里面的全部内容**。
  4. 将复制的内容粘贴进 D1 控制台的输入框中，点击 **"Execute" (执行)**。
  5. 看到执行成功提示即代表 `imginfo` 和 `tgimglog` 两个数据表已成功建好！
- **方法 B：通过 Wrangler 命令行导入**
  在本地终端运行：
  ```bash
  # 登录你的 Cloudflare 账号
  npx wrangler login
  # 导入本地 SQL 脚本到远程 D1 数据库
  npx wrangler d1 execute img --remote --file=./tgimglog.sql
  ```

---

### 第三步：在 Cloudflare Pages 部署项目
1. 登录 Cloudflare 控制台，点击左侧导航栏的 **"Workers & Pages" -> "Overview" (概述)**。
2. 点击 **"Create" (创建) -> "Pages" -> "Connect to Git" (连接到 Git)**。
3. 选择你存放本项目代码的 **GitHub 仓库**，点击 **"Begin setup" (开始设置)**。
4. 在 **Build settings (构建设置)** 页面中进行如下配置：
   - **Project name (项目名称)**：任意填写（例如 `my-imgbed`）。
   - **Production branch (生产分支)**：选择你的主分支（通常为 `main` 或 `master`）。
   - **Framework preset (框架预设)**：选择 **`None`**（不使用预设，避免 Cloudflare 自动猜测错误），或选择 **`Next.js`**。
   - **Build command (构建命令)**：填入 **`npm run cf-build`**
   - **Build output directory (构建输出目录)**：填入 **`.open-next`**。
5. 展开下方 **"Environment variables (advanced)" (环境变量 - 高级)** 栏目，在此处一次性添加项目所需的配置变量（**极其重要，防止编译失败**）：
   - **`NODE_VERSION`**：**无需配置**（项目已配置 `.node-version`、`.nvmrc` 和 `package.json`，Cloudflare Pages 将自动采用 Node.js 22 稳定版编译）。
   - **`ADMIN_PASS`**：设置你的管理员后台登录密码（用于 `/login`；管理员用户名固定为 `admin`）。
   - **`NEXTAUTH_SECRET`**：一串随机长字符串，用于登录 Session 加密（可随意输入 32 位以上字母数字组合）。
   - **`TG_BOT_TOKEN`**（可选）：你的 Telegram 机器人 Token。
6. 点击 **"Save and Deploy" (保存并部署)**。由于此时还没进行 D1 绑定，首次构建可能会提示警告或部署完成后访问会报 500 错误，这很正常。请继续进行第四步。

---

### 第四步：绑定 D1 数据库与配置环境

#### 1. 绑定 D1 数据库：
1. 在 Pages 项目管理页面中，切换到 **"Settings" (设置)** 选项卡。
2. 点击左侧的 **"Functions" (函数)** 菜单。
3. 往下滚动，找到 **"D1 database bindings" (D1 数据库绑定)**。
4. 在 **Production (生产环境)** 和 **Preview (预览环境)** 中，分别点击 **"Add binding" (添加绑定)**：
   - **Variable name (变量名称/绑定名称)**：**必须严格填写大写 `IMG`**。
   - **D1 database (选择数据库)**：选择你在第二步中创建的 D1 数据库（如 `img`）。
5. 点击 **"Save" (保存)**。

#### 2. 配置兼容的 Node.js 运行环境：
1. 仍在 **"Settings" (设置)** -> **"Functions" (函数)** 中。
2. 往下滚动找到 **"Compatibility flags" (兼容性标志)**。
3. 在 Production 和 Preview 栏目中，分别添加以下兼容标志：
   - **`nodejs_compat`** （在输入框中打勾或添加该标志，以允许 Next.js 在 edge 侧安全调用 node API）。
4. 点击 **"Save" (保存)**。

---

### 第五步：重新部署上线 (Redeploy)
由于刚刚修改了绑定 and 配置，需要让它们生效：
1. 切换到项目的 **"Deployments" (部署)** 选项卡。
2. 找到最近的一次构建记录，点击右侧的三个小点，选择 **"Retry deployment" (重新尝试部署)**，或者向你的 GitHub 仓库推送一次提交（git commit）来自动触发新一轮部署。
3. 构建完成后，点击 Cloudflare Pages 给你分配的专属域名（如 `https://my-imgbed.pages.dev`），即可看到图床主页！

---

### 🎉 部署成功与常见故障排查
* **构建时报错 `Error: Output directory ".vercel/output" not found`？**
  1. **最主要原因：没有在环境中声明现代 Node.js 版本**。Cloudflare Pages 默认构建环境的 Node 版本较低（如 Node 12/16），无法编译 Next.js 14。虽然我们已经在项目中配置了 `.node-version`、`.nvmrc` 和 `package.json` 中的 `engines` 字段（均指向 **Node 22**），部分旧的部署流如未自动读取，建议在项目的 **Settings (设置) -> Environment variables (环境变量)** 中手动添加 `NODE_VERSION` 值为 `22` 或 `24`，然后重新触发部署。
  2. 确认 **Build command** 确实是 `npx @opennextjs/cloudflare build`，且 **Build output directory** 是 `.open-next`。
* **部署日志里有大量的 `npm warn deprecated ...` 警告？**
  * **风险等级**：**无风险 / 极其安全**。
  * **原因与影响**：这些警告（例如 `sourcemap-codec`, `inflight` 等提示弃用）是 npm 包管理工具的标准提示，因为三方依赖项或 ESLint 的深层子依赖使用了较旧的包。它们是**非阻塞的**，不会对编译、部署或线上运行产生任何负面影响，直接忽略即可。
* **构建时报错 `npm error code EUSAGE ... npm ci can only install packages when your package.json and package-lock.json are in sync`？**
  * **原因**：这是因为我们在 AI Studio 中升级了 `package.json` 中的多项高版本依赖。在 AI Studio 环境中 `package-lock.json` 已经由包管理工具自动更新同步好了，但当您拉取代码到本地或推送至 GitHub 时，**可能只推送了 `package.json` 而漏掉了 `package-lock.json`**，导致 Cloudflare Pages 运行 `npm ci` 校验版本不一致而报错。
  * **解决方案**：
    1. **最推荐的做法**：确保您在同步或导出代码到您的 GitHub 仓库时，**将 `package.json` 和 `package-lock.json` 两个文件一并提交（commit）并推送（push）**。
    2. **备用临时方案**：在 Cloudflare Pages 的项目后台 **Settings (设置) -> Environment variables (环境变量)** 中，添加环境变量 **`NPM_FLAGS`**，其值设为 **`--legacy-peer-deps`**，或者设置环境变量 **`NPM_CONFIG_LEGACY_PEER_DEPS=true`**，可以跳过部分过于严苛的对等依赖校验。
* **访问后台 `/admin` 或 `/list` 提示密码错误？**
  确保你在 Pages 的环境变量中正确配置了 `ADMIN_PASS`，并且修改后必须重新部署（Redeploy）一次应用使环境变量载入。
* **上传媒体文件失败，一直显示 Loading 或报错？**
  1. 请检查 D1 绑定名称是否为大写 **`IMG`**（不可填错）。
  2. 请检查第一步中 D1 数据库中的表是否成功通过 `tgimglog.sql` 导入成功（可以去 D1 控制台的 "Tables" 选项卡看看有没有 `imginfo` 这个表）。
  3. 检查兼容性标志中是否添加了 **`nodejs_compat`**。


