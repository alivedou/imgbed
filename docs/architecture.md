# Web Application Architecture & Role-Based Access Control Specification

本文件定义了本项目的核心架构模型、目录组织结构、API 设计约束以及三类角色的权限控制矩阵，是后续增量开发、模块拓展的唯一规范性基准。

---

## 1. 目录结构与职责边界 (Directory Roles)

项目基于 Next.js 15+ (App Router) 配合 Cloudflare Edge Runtime 架构构建，所有关键业务分层如下：

```
├── docs/                      # 核心规范与多语言管理文档
│   ├── manage.md              # 面向运营的管理及环境配置指南
│   └── architecture.md        # [本文件] 整体架构、代码约定与角色权限矩阵
├── src/
│   ├── app/                   # App Router 路由主域
│   │   ├── admin/             # 管理员控制台页面 (管理员专属)
│   │   ├── login/             # 统一认证登录页
│   │   ├── api/               # API 服务提供域
│   │   │   ├── auth/          # NextAuth 认证回调端点 (Edge 兼容)
│   │   │   └── [[...slug]]/   # 核心 API 多路复用器 (Edge Runtime)
│   │   ├── globals.css        # 全局 Tailwind 样式定义
│   │   ├── layout.js          # 全局主排版与 Context 共享
│   │   └── page.js            # 应用主页及公共展示大厅
│   ├── components/            # UI 组件层
│   ├── lib/                   # 基础设施及云上服务适配器
│   │   └── cloudflare.js      # Cloudflare D1/R2、Telegram API 核心库
│   ├── auth.js                # NextAuth 策略及多提供商凭证定义
│   └── middleware.js          # 高速边缘计算拦截器 (认证、写请求拦截、重定向)
├── .env.example               # 环境配置模板说明
└── AGENTS.md                  # 支持 AI 编码助手的持久化提示规范
```

---

## 2. 角色与权限矩阵 (Roles & Permissions Matrix)

系统中定义了三种访问主体，在安全控制上实行“默认最严限制，逐级放行”原则。

| 访问主体 (Subject) | 鉴权证明 (Auth Info) | 允许的权限 (Allowed Actions) | 典型受限操作 (Restricted Actions) |
| :--- | :--- | :--- | :--- |
| **Visitor (游客/未登录)** | `session === null` | • 浏览主页及画廊展示<br>• 查询公开数据与统计<br>• `GET` 基础公开 API 请求 | • **禁止任何写操作**：禁止触发任何 `POST`/`PUT`/`DELETE` API（如 R2 上传、Telegram Channel 推送等，经由 Middleware 全局阻断）<br>• 禁止进入管理员后台 `/admin` |
| **User (普通用户)** | `session !== null` | • 包含所有游客权限<br>• 具备正常上传 R2 与发送 Telegram Channel 的个人写权限 (基于后台具体配额及安全限流) | • 禁止访问 `/admin` 后台及 `/api/admin/*` 管理员 API 路由 |
| **Admin (系统管理员)** | `session.user.role === 'admin'` | • 包含所有用户级权限<br>• 访问并操作 `/admin` 超级管理后台<br>• 进行系统关键参数开关配置（如 `enableAuthapi`、清除日志、全局统计等） | • 无限制，作为全局最高特权级主体 |

### 2.1 边缘拦截器 (Middleware) 核心防线
安全拦截在云端边缘层（`/src/middleware.js`）完成，安全检测逻辑如下：
1. **未登录且为写操作时阻断**：当 `!isAuthenticated` 且请求方法属于 `POST | PUT | DELETE` （且排除 `/api/auth` 登录回调）时，直接返回 `401 Unauthorized`：
   ```json
   { "status": "fail", "message": "Visitors have no upload or modification permissions. Please login first !" }
   ```
2. **管理员后台防护**：针对 `/admin` 以及 `/api/admin/*` 进行登录检测，非 Admin 角色一律进行 401 报错或重定向返回。

---

## 3. 开发规范与代码约定 (Coding Conventions)

为了避免项目不断引入“补丁”导致变成“屎山代码”，任何人在对本项目进行后续开发时均需严格遵守以下几条黄金法则：

### A. 保持现有代码和目录结构 (Architecture Preservation)
* 严禁无意义的重构或对工作正常的第三方组件、库重新封装。
* 严禁修改或删除已有模块的对外输出函数及接口契约，确保向后兼容。

### B. 增量拓展优先 (Incremental Extensions Only)
* 当有新业务到来时，应**优先新增纯函数、轻量组件或独立 Service 模块**，而非在已有组件的超长代码段 (如 `page.js` 的 700+ 行组件) 中继续叠加复杂的条件分支。
* 在复杂的主页面 (`page.js`) 中，当引入新交互时，推荐将具体的表单域、弹窗层或动画包装到 `/src/components/*` 目录下的新文件中，仅以 React Component Props 的形式在主页面中引用，保持主路由页面的逻辑高度清晰。

### C. Cloudflare Edge Runtime 兼容性守则
* 本项目 v2 已移除所有 `export const runtime = 'edge'` 声明，统一由 `open-next.config.ts` 中的 `converter: "edge"` 处理边缘兼容输出。
* 新模块无需再显式声明 `runtime = 'edge'`。如未来升级 `@opennextjs/cloudflare` 至支持该声明的版本，此项规则可恢复。

### D. API 请求一律附带健壮性错误处理 (API Integrity)
* 对 D1 数据库、R2 存储及 Telegram 等外部服务的请求，必须用完整的 `try-catch` 结构进行捕获。
* 在任何操作 D1/R2 的地方，优先重用 `/src/lib/cloudflare.js` 中的标准实例，绝对不允许在各子 API 里私自多次构建配置复杂的、碎片化的存储/数据库链接对象。

### D2. 本地 D1/R2 Mock 说明
* `/src/lib/cloudflare.js` 中的 `LocalD1Database` 和 `LocalR2Bucket` 仅用于本地开发环境（`process.versions?.node` 为 true）。
* 生产环境（Cloudflare Pages）会通过 `getCloudflareContext()` 获取真实的 D1 (`env.IMG`) 和 R2 (`env.IMGRS`) 绑定。
* 本地 mock 使用 in-memory + `.local_d1.json` / `.local_r2/` 文件持久化，不支持完整 SQL 语法。

### E. 文档协同规则
* 对环境配置文件的修改，必须在同步更新 `.env.example`，严禁上传真实私钥。
* 遇有大规模业务升级，需更新并记录到 `/docs/manage.md`。
