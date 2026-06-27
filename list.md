# 项目优化清单：Cloudflare Pages + D1 + R2 适配

> 4 个梯队，**由易到难**逐步推进。每项均保证现有功能不受影响。

---

## 第 1 梯队：极简修复（8 项，仅改 env / 配置 / 1 行代码）

### 1.1 硬编码 AUTH_SECRET 回退值 → 改为运行时检查
- **文件**: `src/auth.js:95`
- **现状**: `secret: process.env.AUTH_SECRET || process.env.SECRET || '00Fv/YUm0enwy04IgP4KoNOWLODe2iJ1tvBzr+4kEZ8='`
- **问题**: 未配置环境变量时使用公开密钥，会话可被伪造
- **方案**: 回退值改为仅在 `NODE_ENV !== 'production'` 时使用；生产环境缺少 AUTH_SECRET 时抛出错误

### 1.2 `.env.example` 默认密码增加风险警告
- **文件**: `.env.example:12-16`
- **方案**: 在 `ADMIN_PASS=admin` 和 `BASIC_PASS=user` 上方追加注释 `# ⚠️ 生产环境务必修改为强密码`

### 1.3 GA-ID 硬编码 → 环境变量
- **文件**: `src/app/layout.js:22`
- **现状**: `<GoogleAnalytics gaId="G-JVKEXR5XSG" />`
- **方案**: 改为 `{process.env.NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />}`

### 1.4 `useSecureCookies` 同时检查 Cloudflare Pages 环境
- **文件**: `src/auth.js:96`
- **现状**: `useSecureCookies: process.env.NODE_ENV === 'production'`
- **方案**: `useSecureCookies: process.env.NODE_ENV === 'production' || process.env.CF_PAGES === '1'`

### 1.5 SameSite / secure 按环境区分
- **文件**: `src/auth.js:103,111,119`
- **现状**: `sameSite: 'none'` + `secure: true` 导致本地 `http://localhost:3000` 无法设置 cookie
- **方案**: 生产环境保持 `none` + `true`，本地开发用 `lax` + `false`

### 1.6 `@next/third-parties` 版本对齐
- **文件**: `package.json:22`
- **现状**: `"@next/third-parties": "14.2.21"`，但 next 已是 `14.2.29`
- **方案**: 改为 `"@next/third-parties": "14.2.29"`

### 1.7 同步 `docs/architecture.md` 的 `runtime=edge` 文档
- **文件**: `docs/architecture.md:70-73`
- **现状**: 仍要求 API 路由显式声明 `export const runtime = 'edge'`
- **方案**: 更新说明 v2 已移除，由 `open-next.config.ts` 的 `converter: "edge"` 接管

### 1.8 构建命令更新说明
- **文件**: `README.md:106`
- **现状**: 长链命令串 `npx ... && mv ... && cp -r ... && cp ...`
- **方案**: 保持当前命令不变（已稳定），后续可按 4.1 封装为 npm script

---

## 第 2 梯队：代码清理（9 项）

### 2.1 local-store 路由加 Cloudflare 守卫
- **文件**: `src/app/api/local-store/route.js:1`
- **问题**: 生产环境每次调用都尝试 `import('fs')` → 必定失败 → 返回错误响应，浪费 CPU
- **方案**: 顶部增加 `if (process.env.CF_PAGES === '1') return Response.json({ success: false, error: 'Local-store is not available in production' }, { status: 400 });`

### 2.2 移除 Worker 中无效的 `request.socket?.remoteAddress`
- **文件**: `src/app/api/[[...slug]]/route.js:194,538`
- **现状**: `request.socket?.remoteAddress` — Workers 无 socket 属性
- **方案**: 保留可选链不报错，但移除死代码，改为仅从 headers 获取

### 2.3 `http://localhost` base URL 替换
- **文件**: `src/app/api/[[...slug]]/route.js:1063`
- **现状**: `new URL(name, 'http://localhost')` 用于提取 URL 参数
- **方案**: 改为 `new URL('http://x/' + name)` 或 `new URL(name, 'http://x')`

### 2.4 重命名混淆变量 `isDisabled` → `isTrackedPath`
- **文件**: `src/components/index.js:356-378`
- **现状**: `isDisabled` 语义与实际逻辑相反（true 时反而正常工作）
- **方案**: 重命名为 `isTrackedPath` 并反转 disabled 逻辑，使代码意图清晰

### 2.5 `suppressHydrationWarning` 添加原因注释
- **文件**: `src/app/layout.js:20`
- **方案**: 上方加注释说明 suppressing 的原因（如浏览器扩展修改 DOM）

### 2.6 D1 `time` 列从 `DATE` 改为 `TEXT`
- **文件**: `tgimglog.sql:7,17`
- **问题**: SQLite 的 `DATE` 类型不保存时间部分，但代码写入完整日期时间字符串
- **方案**: `time DATE` → `time TEXT`，确保不丢失时间信息

### 2.7 `system_config` 表补入迁移脚本
- **文件**: `tgimglog.sql`
- **问题**: 运行时 `CREATE TABLE IF NOT EXISTS system_config` 动态建表，但 SQL 脚本中缺少
- **方案**: 追加 `CREATE TABLE IF NOT EXISTS system_config (key TEXT PRIMARY KEY, value TEXT);`

### 2.8 `docs/manage.md` 修正 rating 类型
- **文件**: `docs/manage.md:24`
- **现状**: 标注 `rating` 为 `text`，实际为 `integer`
- **方案**: 改为 `integer`

### 2.9 第三方 API 硬编码凭证 → 环境变量
- **文件**: `src/app/api/[[...slug]]/route.js:643-667`
- **问题**: `Token`, `Sign`, `Timestamp` 硬编码且时间戳已过期（2024年9月）
- **方案**: 迁移至环境变量 `VVIP_TOKEN` / `VVIP_SIGN` 等；无配置时返回 `503 Service Unavailable`

---

## 第 3 梯队：安全加固（4 项）

### 3.1 SQL 查询全部改用参数化 `.bind()` → 防注入
- **文件**: `src/app/api/[[...slug]]/route.js`（15+ 处）
- **问题**: 所有 SQL 使用模板字符串拼接用户输入，存在注入风险
- **方案**: 
  - 将 `prepare(\`SELECT ... WHERE url='${src}'\`)` 改为 `prepare('SELECT ... WHERE url=?').bind(src)`
  - 同步更新 `src/lib/cloudflare.js` 中 `LocalD1PreparedStatement` 的 regex 匹配（若 mock 仍使用）
- **风险**: 中等，需逐条测试

### 3.2 登录锁从内存 `Map` 迁移到 D1 持久化
- **文件**: `src/lib/lockout.js`（全文件） + `tgimglog.sql`
- **问题**: Cloudflare Workers 无状态，`globalThis.__lockoutStore` 不跨实例共享，暴力破解防护失效
- **方案**: 
  - 新建 `failed_attempts` 表（用户名/IP、失败次数、首次失败时间、锁定截止时间）
  - 每次登录失败写入 D1，成功时清理
  - 查询时检查 `COUNT` 和 `MAX(failed_at)` 判定锁定

### 3.3 Admin 配置表单闭包陈旧值修复
- **文件**: `src/app/admin/page.js:36-75`
- **问题**: `handleConfigChange` 发送 `enableAuthapi` 等旧闭包值
- **方案**: 使用 `useCallback` + 正确的依赖项，或 `useRef` 持有最新状态引用

### 3.4 首页轮询间隔降频
- **文件**: `src/app/page.js:58`
- **现状**: `setInterval(getTotal, 10000)` — 每 10 秒查询 D1
- **方案**: 改为 60 秒，减少 D1 写/读消耗

---

## 第 4 梯队：架构优化（4 项）

### 4.1 构建命令封装为 npm script
- **文件**: `package.json` + `README.md`
- **现状**: 一行超长 `&& && &&` 构建命令
- **方案**: 新增 npm script `"cf-build": "npx @opennextjs/cloudflare && mv .open-next/worker.js .open-next/_worker.js && cp -r .open-next/assets/_next .open-next/_next && cp _routes.json .open-next/_routes.json"`，README 改为 `npm run cf-build`

### 4.2 移除未使用的 `lucide-react` 依赖
- **文件**: `package.json:24`
- **现状**: `lucide-react` 已安装但项目中无任何 import
- **方案**: 移除依赖；如将来使用则重新安装

### 4.3 `eval('require')` 替代为运行时检测
- **文件**: `src/lib/cloudflare.js:16-17,402-403`
- **问题**: `eval` 触发安全扫描告警，且已是 `CF_PAGES` 守卫下的死代码
- **方案**: 
  - 改为 `typeof process !== 'undefined' && process.versions?.node` 检测
  - 或直接移除（仅本地 Node 环境使用，可通过 `process.versions` 判定）

### 4.4 本地 D1/R2 mock 增加文档说明
- **文件**: `docs/architecture.md`
- **方案**: 追加一段说明 `LocalD1Database` / `LocalR2Bucket` 仅用于本地开发，生产环境走 Cloudflare 原生绑定

---

## 执行顺序建议

```
第 1 梯队 → 第 2 梯队 → 第 3 梯队 → 第 4 梯队
（每完成一个梯队提交一次，部署验证后再推进）
```
