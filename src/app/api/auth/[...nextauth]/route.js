import { handlers } from "@/auth"
export const runtime = 'edge';

// 动态提取当前请求的绝对源地址，针对 Cloudflare Edge、容器代理和分发环境提供自动回退
const handleRequest = async (req) => {
  if (!process.env.AUTH_URL) {
    try {
      const url = new URL(req.url);
      // 动态将 AUTH_URL 设为当前请求的高层源 API 路径
      process.env.AUTH_URL = `${url.origin}/api/auth`;
    } catch (e) {
      console.warn('[Auth Link Debug] Failed to compute dynamic origin:', e);
    }
  }

  if (req.method === 'GET') {
    return handlers.GET(req);
  }
  return handlers.POST(req);
};

export { handleRequest as GET, handleRequest as POST };