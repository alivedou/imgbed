import { auth } from "@/auth"

// 基础路由常量定义
const ROOT = '/';
const PUBLIC_ROUTES = ['/'];
const DEFAULT_REDIRECT = '/login';
const LOGIN = '/login'
const API_ADMIN = "/api/admin"
const ADMIN_PAGE = "/admin"
const AUTH_API = "/api/enableauthapi"

// 判断是否开启了用户授权 API
const enableAuthapi = process.env.ENABLE_AUTH_API === 'true';

// 导出带有自定义中间件行为的 auth 方法作为 default
export default auth(async (req) => {
    const { nextUrl } = req;
    const role = req?.auth?.user?.role;

    // 是否已登录认证
    const isAuthenticated = !!req.auth;

    // 当前请求路径属性匹配
    const isAPI_ADMIN = nextUrl.pathname.startsWith(API_ADMIN);
    const isADMIN_PAGE = nextUrl.pathname.startsWith(ADMIN_PAGE);
    const isAuthAPI = nextUrl.pathname.startsWith(AUTH_API);

    // 1. 未登录情况处理
    if (!isAuthenticated) {
        const isAuthServicePath = nextUrl.pathname.startsWith('/api/auth') || nextUrl.pathname === '/api/local-store';

        // 如果开启了上传鉴权，则所有涉及写入、上传或修改参数的请求(包括 POST 上传文件到 R2 / Telegram 通道 / TG等)，未登录的 Visitor 身份一律拦截拒绝
        if (enableAuthapi && (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') && !isAuthServicePath && !isAPI_ADMIN) {
            return Response.json(
                { status: "fail", message: "Visitors have no upload or modification permissions. Please login first !", success: false },
                { status: 401 }
            );
        }
        // 对于未开启强制认证的情况，防范游客调用 admin 或未知危险接口，应当保持 isAPI_ADMIN 下 POST 等请求拦截
        if (isAPI_ADMIN && (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE')) {
             return Response.json(
                 { status: "fail", message: "You are not logged in by admin !", success: false },
                 { status: 401 }
             );
        }

        // 请求管理员 API 却未登录，返回 401 失败信息
        if (isAPI_ADMIN) {
            return Response.json(
                { status: "fail", message: "You are not logged in by admin !", success: false },
                { status: 401 },
            )
        }
        // 请求管理员页面却未登录，重定向至登录页
        else if (isADMIN_PAGE) {
            return Response.redirect(new URL(LOGIN, nextUrl));
        }
        // 请求用户认证 API，若全局开启了强制认证，则拦截并返回 401
        else if (isAuthAPI) {
            if (enableAuthapi) {
                return Response.json(
                    { status: "fail", message: "You are not logged in by user !", success: false },
                    { status: 401 }
                );
            }
            else {
                return // 未开启强制认证，普通读请求(GET)直接放行
            }
        }
        // 访问根目录，若开启了强制认证，未登录下重定向到登录页
        else if (nextUrl.pathname === ROOT) {
            if (enableAuthapi) {
                return Response.redirect(new URL(LOGIN, nextUrl));
            }
            else {
                return // 否则放行
            }
        }
        else {
            return
        }
    }

    // 2. 已登录，属于管理员角色
    if (role === 'admin') {
        return; // 管理员拥有完全的畅行权限
    }

    // 3. 已登录，属于普通用户角色
    if (role === 'user') {
        // 普通用户不允许访问管理员 API 或管理员控制面板页面
        if (isAPI_ADMIN) {
            return Response.json(
                { status: "fail", message: "You do not have admin permissions!", success: false },
                { status: 403 }
            );
        }
        if (isADMIN_PAGE) {
            return Response.redirect(new URL(ROOT, nextUrl));
        }
    }

})

// 使用静态 matcher 配置，定义需要让中间件处理的目标路径
export const config = {
    matcher: [
        "/",
        "/admin/:path*",
        "/api/:path*"
    ],
};