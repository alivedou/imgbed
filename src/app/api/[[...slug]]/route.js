export const runtime = 'edge';
import { getSafeRequestContext } from '@/lib/cloudflare';
import { auth } from '@/auth';

// 统一的跨域 (CORS) 响应控制头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400', // 24小时浏览器缓存期限
  'Content-Type': 'application/json'
};

// 根据文件名后缀，获取合适的 HTTP Content-Type 内容类型，用于静态/防盗链代理输出
function getContentType(fileName) {
  const extension = fileName.split('.').pop().toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'html': 'text/html',
    'json': 'application/json',
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'mkv': 'video/x-matroska'
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

// 获取符合上海时间 (UTF+8) 格式化的当前系统时间字符串
async function get_nowTime() {
  const options = {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  return new Intl.DateTimeFormat('zh-CN', options).format(new Date());
}

// 在本地数据库 imginfo 表中插入全新的图片记录（例如初始访问频次为1，保存上传者IP等）
async function insertImageData(env, src, referer, ip, rating, time) {
  try {
    const existing = await env.prepare(`SELECT * FROM imginfo WHERE url='${src}'`).first();
    if (existing) {
      await env.prepare(`UPDATE imginfo SET total = total + 1 WHERE url='${src}'`).run();
      return;
    }
    await env.prepare(
      `INSERT INTO imginfo (url, referer, ip, rating, total, time)
       VALUES ('${src}', '${referer}', '${ip}', ${rating}, 1, '${time}')`
    ).run();
    // 自动为新插入的图片追加一条属于此刻的初始访问或上传行为日志，从而使内连接 JOIN 查询时刻立即能够在高安全性后台完整显示该图
    try {
      await insertTgImgLog(env, src, referer, ip, time);
    } catch (logErr) {
      console.error('Failed to auto-insert companion tgimglog:', logErr);
    }
  } catch (error) {
    console.error('insertImageData error:', error);
  }
}

// 插入图片被外界请求访问的原始访问日志日志记录到 tgimglog
async function insertTgImgLog(DB, url, referer, ip, time) {
  try {
    await DB.prepare('INSERT INTO tgimglog (url, referer, ip, time) VALUES (?, ?, ?, ?)')
      .bind(url, referer, ip, time)
      .run();
  } catch (error) {
    console.error('insertTgImgLog error:', error);
  }
}

// 从数据库中单条提取已经存在的图片等级判定结果
async function getRatingFromDB(DB, url) {
  try {
    const ps = DB.prepare(`SELECT rating FROM imginfo WHERE url='${url}'`);
    const result = await ps.first();
    return result;
  } catch (error) {
    return null;
  }
}

// 调用 ModerateContent 图像智能鉴黄审查 API，自动标记成人/敏感图片（3 代表阻断拦截）
// 因第三方网站功能不稳定，现已废弃自动评级，默认返回 1 (Safe) 大众级，支持管理员手动审核
async function getModerateContentRating(env, url, type = 'telegra') {
  return 1;
}

// 根据 Telegram 文件 ID，动态调用 Telegram API 换取该文件在 TG 服务端的物理相对路径
async function getFile_path(env, file_id) {
  try {
    const tgBotToken = await getDynamicConfig(env, 'TG_BOT_TOKEN', '');
    const url = `https://api.telegram.org/bot${tgBotToken}/getFile?file_id=${file_id}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        "User-Agent": " Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome"
      },
    });
    let responseData = await res.json();
    if (responseData.ok) {
      return responseData.result.file_path;
    }
    return "error";
  } catch (error) {
    return "error";
  }
}

// 解析并提取 Telegram Webhook 或者媒体上传回调中包含的最优分辨率文件项 details
const getFileDetail = async (response) => {
  try {
    if (!response.ok) return null;
    const getFileDetails = (file) => ({
      file_id: file.file_id,
      file_name: file.file_name || file.file_unique_id
    });
    if (response.result.photo) {
      const largestPhoto = response.result.photo.reduce((prev, current) =>
        (prev.file_size > current.file_size) ? prev : current
      );
      return getFileDetails(largestPhoto);
    }
    if (response.result.video) {
      return getFileDetails(response.result.video);
    }
    if (response.result.document) {
      return getFileDetails(response.result.document);
    }
    return null;
  } catch (error) {
    return null;
  }
};

// 动态读取系统配置
export async function getDynamicConfig(env, key, defaultVal = 'false') {
  try {
    if (env.IMG) {
      await env.IMG.prepare(`CREATE TABLE IF NOT EXISTS system_config (key TEXT PRIMARY KEY, value TEXT)`).run();
      const row = await env.IMG.prepare(`SELECT value FROM system_config WHERE key = '${key}'`).first();
      if (row && row.value !== undefined) {
        return row.value;
      }
    }
  } catch (e) {}
  return (env[key] !== undefined ? String(env[key]) : (process.env[key] !== undefined ? String(process.env[key]) : defaultVal));
}

// 动态设置系统配置
export async function setDynamicConfig(env, key, value) {
  try {
    if (env.IMG) {
      await env.IMG.prepare(`CREATE TABLE IF NOT EXISTS system_config (key TEXT PRIMARY KEY, value TEXT)`).run();
      await env.IMG.prepare(`INSERT INTO system_config (key, value) VALUES ('${key}', '${value}') ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run();
      return true;
    }
  } catch (e) {}
  return false;
}

// 辅助进行访问频次记录的记录更新管道
async function logRequest(env, path, name, referer, ip) {
  try {
    const nowTime = await get_nowTime();
    await insertTgImgLog(env.IMG, `${path}/${name}`, referer, ip, nowTime);
    await env.IMG.prepare(`UPDATE imginfo SET total = total +1 WHERE url = '${path}/${name}';`).run();
  } catch (error) {
    console.error('Error logging request:', error);
  }
}

// --- 统一的 GET 请求处理器 ---
export async function GET(request, { params }) {
  const { slug } = params || {};
  const path = slug ? slug.join('/') : '';
  const { env, cf, ctx } = getSafeRequestContext();

  // 从 HTTP 请求中嗅探获取最真实的客户端源 IP 
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.socket?.remoteAddress;
  const clientIp = ip ? ip.split(',')[0].trim() : 'IP not found';
  const Referer = request.headers.get('Referer') || "Referer";
  const req_url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const host = forwardedHost || request.headers.get('host');
  const actualOrigin = host ? `${forwardedProto}://${host}` : req_url.origin;
  const customDomain = env.CUSTOM_DOMAIN ? env.CUSTOM_DOMAIN.replace(/\/$/, '') : actualOrigin;

  // 1. GET /api/ip ：测试接口，返回当前客端真实 IP 地址
  if (path === 'ip') {
    return Response.json({ ip: clientIp }, { headers: corsHeaders });
  }

  // 2. GET /api/total ：获取当前数据库储存的图片总量
  if (path === 'total') {
    try {
      if (env.IMG) {
        const total = await env.IMG.prepare(`SELECT COUNT(*) as total FROM imginfo`).first();
        return Response.json({
          "code": 200,
          "success": true,
          "message": "success",
          "total": total.total
        }, { 
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          } 
        });
      } else {
        return Response.json({
          "code": 500,
          "success": true,
          "message": "no db",
          "total": "?"
        }, { status: 500, headers: corsHeaders });
      }
    } catch (error) {
      return Response.json({
        "code": 500,
        "success": false,
        "message": error.message,
      }, { status: 500, headers: corsHeaders });
    }
  }

  // 3. GET /api/admin/ip ：管理员专用的客户端 ip 测试路径
  if (path === 'admin/ip') {
    return Response.json({ ip: clientIp }, { headers: corsHeaders });
  }

  // 4. GET /api/enableauthapi/isauth ：检查当前访问用户在 session 下的权限状态与强制登陆限制是否开启
  if (path === 'enableauthapi/isauth') {
    const enableAuthapi = (await getDynamicConfig(env, 'ENABLE_AUTH_API')) === 'true';
    const session = await auth();
    const role = session?.user?.role;
    return Response.json({
      status: "success",
      "message": "You are logged in by user !",
      "success": true,
      "enableAuthapi": enableAuthapi,
      "role": role
    }, { headers: corsHeaders });
  }

  // 5. GET /api/enableauthapi/ip ：带有启用授权路径的客户端访问 IP 测试通道
  if (path === 'enableauthapi/ip') {
    return Response.json({ ip: clientIp }, { headers: corsHeaders });
  }

  // 6. GET /api/admin/config ：管理员获取系统配置
  if (path === 'admin/config') {
    const enableAuthapi = (await getDynamicConfig(env, 'ENABLE_AUTH_API')) === 'true';
    const proxyAllImg = (await getDynamicConfig(env, 'PROXYALLIMG')) === 'true';
    const tgBotToken = await getDynamicConfig(env, 'TG_BOT_TOKEN', '');
    const tgChatId = await getDynamicConfig(env, 'TG_CHAT_ID', '');
    return Response.json({
      success: true,
      data: {
        enableAuthapi,
        proxyAllImg,
        tgBotToken,
        tgChatId
      }
    }, { headers: corsHeaders });
  }

  // 7. GET /api/file/[name] ：通过反向代理将 Telegraph 的静态资源图片安全送出，并在数据库端记录统计和自动鉴黄拦截操作
  if (slug && slug[0] === 'file' && slug[1]) {
    const name = slug[1];
    try {
      const res = await fetch(`https://telegra.ph/file/${name}`);

      // 免去在控制后台以及编辑首页时由于频繁预览而导致的拦截和统计
      if (Referer === `${customDomain}/admin` || Referer === `${customDomain}/list` || Referer === `${customDomain}/`) {
        return res;
      } else if (!env.IMG) {
        return res;
      } else {
        const nowTime = await get_nowTime();
        await insertTgImgLog(env.IMG, `/file/${name}`, Referer, clientIp, nowTime);
        const ratingResult = await getRatingFromDB(env.IMG, `/file/${name}`);
        if (ratingResult) {
          try {
            await env.IMG.prepare(`UPDATE imginfo SET total = total +1 WHERE url = '/file/${name}';`).run();
          } catch (e) {
            console.error(e);
          }
          if (ratingResult.rating === 3) {
            return Response.redirect(`${customDomain}/img/blocked.png`, 302);
          } else {
            return res;
          }
        } else {
          // 如果数据库内无此图片记录，触发新图片的首次鉴黄存储机制
          const isProxyAllImg = (await getDynamicConfig(env, 'PROXYALLIMG')) === 'true';
          if (isProxyAllImg) {
            try {
              const rating_index = await getModerateContentRating(env, `/file/${name}`, 'telegra');
              const nowTimeVal = await get_nowTime();
              await insertImageData(env.IMG, `/file/${name}`, Referer, clientIp, rating_index, nowTimeVal);
              if (rating_index === 3) {
                return Response.redirect(`${customDomain}/img/blocked.png`, 302);
              } else {
                return res;
              }
            } catch (err) {
              return res;
            }
          } else {
            return Response.redirect(`https://telegra.ph/file/${name}`, 302);
          }
        }
      }
    } catch (error) {
      return Response.json({
        status: 500,
        message: ` ${error.message}`,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  }

  // 7. GET /api/rfile/[name] ：Cloudflare R2 本地/桶存储的最终下载分发及代理判定管道
  if (slug && slug[0] === 'rfile' && slug[1]) {
    let name = slug[1];
    try {
      name = decodeURIComponent(name);
    } catch (_) {}
    if (!env.IMGRS) {
      return Response.json({
        status: 500,
        message: `IMGRS is not Set`,
        success: false
      }, { status: 500, headers: corsHeaders });
    }

    const cacheKey = new Request(req_url.toString(), request);
    const cache = (typeof caches !== 'undefined' && caches) ? caches.default : null;

    try {
      const dbRating = await getRatingFromDB(env.IMG, `/rfile/${name}`);
      const ratingVal = dbRating ? dbRating.rating : null;
      if (ratingVal === 3 && !(Referer === `${customDomain}/admin` || Referer === `${customDomain}/list` || Referer === `${customDomain}/`)) {
        await logRequest(env, '/rfile', name, Referer, clientIp);
        return Response.redirect(`${customDomain}/img/blocked.png`, 302);
      }
    } catch (e) {
      console.error(e);
    }

    let cachedResponse = cache ? await cache.match(cacheKey) : null;
    if (cachedResponse) {
      if (!(Referer === `${customDomain}/admin` || Referer === `${customDomain}/list` || Referer === `${customDomain}/`)) {
        await logRequest(env, '/rfile', name, Referer, clientIp);
      }
      return cachedResponse;
    }

    try {
      const object = await env.IMGRS.get(name, {
        range: request.headers,
        onlyIf: request.headers,
      });

      if (object === null) {
        return Response.json({
          status: 404,
          message: `R2 object not found`,
          success: false
        }, { status: 404, headers: corsHeaders });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      Object.entries(corsHeaders).forEach(([k, v]) => {
        if (k.toLowerCase() !== 'content-type') {
          headers.set(k, v);
        }
      });

      if (object.range) {
        headers.set("content-range", `bytes ${object.range.offset}-${object.range.end ?? object.size - 1}/${object.size}`);
      }

      const status = object.body ? (request.headers.get("range") !== null ? 206 : 200) : 304;

      let response_img = new Response(object.body, {
        headers,
        status
      });

      if (status === 200 && cache) {
        ctx.waitUntil(cache.put(cacheKey, response_img.clone()));
      }

      if (Referer === `${customDomain}/admin` || Referer === `${customDomain}/list` || Referer === `${customDomain}/`) {
        return response_img;
      } else if (!env.IMG) {
        return response_img;
      } else {
        await logRequest(env, '/rfile', name, Referer, clientIp);
        return response_img;
      }
    } catch (error) {
      return Response.json({
        status: 500,
        message: ` ${error.message}`,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  }

  // 8. GET /api/cfile/[name] ：通过 Telegram 机器人存储通道分发生存图片
  if (slug && slug[0] === 'cfile' && slug[1]) {
    const name = slug[1];
    const tgBotToken = await getDynamicConfig(env, 'TG_BOT_TOKEN', '');
    if (!tgBotToken) {
      return Response.json({
        status: 500,
        message: `TG_BOT_TOKEN is not Set`,
        success: false
      }, { status: 500, headers: corsHeaders });
    }

    const cacheKey = new Request(req_url.toString(), request);
    const cache = (typeof caches !== 'undefined' && caches) ? caches.default : null;

    try {
      const dbRating = await getRatingFromDB(env.IMG, `/cfile/${name}`);
      const ratingVal = dbRating ? dbRating.rating : null;
      if (ratingVal === 3 && !(Referer === `${customDomain}/admin` || Referer === `${customDomain}/list` || Referer === `${customDomain}/`)) {
        await logRequest(env, '/cfile', name, Referer, clientIp);
        return Response.redirect(`${customDomain}/img/blocked.png`, 302);
      }
    } catch (e) {
      console.error(e);
    }

    let cachedResponse = cache ? await cache.match(cacheKey) : null;
    if (cachedResponse) {
      if (!(Referer === `${customDomain}/admin` || Referer === `${customDomain}/list` || Referer === `${customDomain}/`)) {
        await logRequest(env, '/cfile', name, Referer, clientIp);
      }
      return cachedResponse;
    }

    try {
      const file_path = await getFile_path(env, name);
      const fileName = file_path.split('/').pop();

      if (file_path === "error") {
        return Response.json({
          status: 500,
          message: "Failed to get file path from Telegram. Please check that the file_id is valid and your TG_BOT_TOKEN is correct.",
          success: false
        }, { status: 500, headers: corsHeaders });
      } else {
        const res = await fetch(`https://api.telegram.org/file/bot${tgBotToken}/${file_path}`);

        if (res.ok) {
          const fileBuffer = await res.arrayBuffer();
          const contentType = getContentType(fileName);
          const responseHeaders = {
            "Content-Disposition": `inline; filename=${fileName}`,
            "Access-Control-Allow-Origin": "*",
            "Content-Type": contentType
          };
          const response_img = new Response(fileBuffer, {
            headers: responseHeaders
          });

          if (cache) {
            ctx.waitUntil(cache.put(cacheKey, response_img.clone()));
          }

          if (Referer === `${customDomain}/admin` || Referer === `${customDomain}/list` || Referer === `${customDomain}/`) {
            return response_img;
          } else if (!env.IMG) {
            return response_img;
          } else {
            await logRequest(env, '/cfile', name, Referer, clientIp);
            return response_img;
          }
        } else {
          return Response.json({
            status: 500,
            message: "Telegram file download service returned an error. Please verify your TG_BOT_TOKEN is valid.",
            success: false
          }, { status: 500, headers: corsHeaders });
        }
      }
    } catch (error) {
      return Response.json({
        status: 500,
        message: ` ${error.message}`,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  }

  return Response.json({ name: "Not Found", path, success: false }, { status: 404, headers: corsHeaders });
}

export async function POST(request, { params }) {
  const { slug } = params || {};
  const path = slug ? slug.join('/') : '';
  const { env, cf, ctx } = getSafeRequestContext();

  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.socket?.remoteAddress;
  const clientIp = ip ? ip.split(',')[0].trim() : 'IP not found';
  const Referer = request.headers.get('Referer') || "Referer";
  const req_url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const host = forwardedHost || request.headers.get('host');
  const actualOrigin = host ? `${forwardedProto}://${host}` : req_url.origin;
  const customDomain = env.CUSTOM_DOMAIN ? env.CUSTOM_DOMAIN.replace(/\/$/, '') : actualOrigin;

  // 1. POST /api/tg ：Telegraph 官方图床上传服务代理
  if (path === 'tg') {
    const enableAuthapi = (await getDynamicConfig(env, 'ENABLE_AUTH_API')) === 'true';
    if (enableAuthapi) {
      // 检查当前访问用户在 session 下的权限状态是否符合普通登录角色
      const session = await auth();
      if (!session) {
        return Response.json({
          status: 401,
          message: "You are not logged in by user !",
          success: false
        }, { status: 401, headers: corsHeaders });
      }
    }

    try {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file) {
        return Response.json({
          status: 400,
          message: "No file provided in the request.",
          success: false
        }, { status: 400, headers: corsHeaders });
      }

      const telegraFormData = new FormData();
      telegraFormData.append('file', file, file.name || 'file');

      // 将文件表单转发上传至 Telegraph 官方临时上传接口
      const res = await fetch(`https://telegra.ph/upload?source=bugtracker`, {
        method: 'POST',
        body: telegraFormData,
      });

      let resdata = await res.json();
      if (Array.isArray(resdata) && resdata.length > 0) {
        resdata = resdata[0];
      }

      let data = {
        "url": `${customDomain}${resdata.src}`,
        "code": 200,
        "name": resdata.src
      };

      if (!env.IMG) {
        data.env_img = "null";
        return Response.json({ ...data, msg: "1" }, { status: 200, headers: corsHeaders });
      } else {
        let nowTime;
        try {
          const rating_index = await getModerateContentRating(env, resdata.src, 'telegra');
          nowTime = await get_nowTime();
          // 在本地数据库中安全地记录图片元数据与鉴黄状态
          await insertImageData(env.IMG, resdata.src, Referer, clientIp, rating_index, nowTime);
          return Response.json({
            ...data,
            msg: "2",
            Referer,
            clientIp,
            rating_index,
            nowTime
          }, { status: 200, headers: corsHeaders });
        } catch (error) {
          if (!nowTime) {
            try {
              nowTime = await get_nowTime();
            } catch (_) {
              nowTime = new Date().toISOString();
            }
          }
          await insertImageData(env.IMG, resdata.src, Referer, clientIp, -1, nowTime);
          return Response.json({ "msg": error.message }, { status: 200, headers: corsHeaders });
        }
      }
    } catch (error) {
      return Response.json({
        status: 500,
        message: ` ${error.message}`,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  }

  // 2. POST /api/vviptuangou ：第三方免费图床备用服务代理上传
  if (path === 'vviptuangou') {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return new Response('No file uploaded', { status: 400 });
    }
    try {
      const newFormData = new FormData();
      newFormData.append('file', file, file.name);
      const res = await fetch('https://api.vviptuangou.com/api/upload', {
        method: request.method,
        body: newFormData,
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
          'Branchid': '1002',
          'Cache-Control': 'no-cache',
          'DNT': '1',
          'Origin': 'https://mlw10086.serv00.net',
          'Pragma': 'no-cache',
          'Priority': 'u=1, i',
          'Referer': 'https://mlw10086.serv00.net/',
          'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'cross-site',
          'Sign': 'e346dedcb06bace9cd7ccc6688dd7ca1',
          'Source': 'h5',
          'Tenantid': '3',
          'Timestamp': '1725792862411',
          'Token': 'b3bc3a220db6317d4a08284c6119d136',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        }
      });
      const resdata = await res.json();
      let correctImageUrl;
      if (resdata.status === 1 && resdata.imgurl) {
        correctImageUrl = `https://assets.vviptuangou.com/${resdata.imgurl}`;
      } else {
        return Response.json({
          status: 500,
          message: ` ${resdata.message}`,
          success: false
        }, { status: 500, headers: corsHeaders });
      }

      const data = {
        "url": correctImageUrl,
        "code": 200,
        "name": resdata.imgurl
      };

      try {
        if (env.IMG) {
          const nowTime = await get_nowTime();
          await insertImageData(env.IMG, correctImageUrl, Referer, clientIp, 7, nowTime);
        }
      } catch (error) {
        console.error(error);
      }

      return Response.json(data, { status: 200, headers: corsHeaders });
    } catch (error) {
      return Response.json({
        status: 500,
        message: ` ${error.message}`,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  }

  // 3. POST /api/admin/[action] ：管理员专用的后台基础查询数据控制分配器
  if (slug && slug[0] === 'admin') {
    const action = slug[1];
    try {
      if (action === 'config') {
        const body = await request.json();
        if (body.hasOwnProperty('enableAuthapi')) {
          await setDynamicConfig(env, 'ENABLE_AUTH_API', body.enableAuthapi ? 'true' : 'false');
        }
        if (body.hasOwnProperty('proxyAllImg')) {
          await setDynamicConfig(env, 'PROXYALLIMG', body.proxyAllImg ? 'true' : 'false');
        }
        if (body.hasOwnProperty('tgBotToken')) {
          await setDynamicConfig(env, 'TG_BOT_TOKEN', body.tgBotToken || '');
        }
        if (body.hasOwnProperty('tgChatId')) {
          await setDynamicConfig(env, 'TG_CHAT_ID', body.tgChatId || '');
        }
        return Response.json({
          success: true,
          message: 'Settings updated successfully'
        }, { headers: corsHeaders });
      }

      // 获取当前数据库所有的图片主数据及关联属性列表
      if (action === 'list') {
        let { page, query } = await request.json();
        if (query) {
          const ps = env.IMG.prepare(`SELECT * FROM imginfo WHERE url LIKE '%${query}%' LIMIT 10 OFFSET ${page} * 10`);
          const { results } = await ps.all();
          const total = await env.IMG.prepare(`SELECT COUNT(*) as total FROM imginfo WHERE url LIKE '%${query}%'`).first();
          return Response.json({
            "code": 200,
            "success": true,
            "message": "success",
            "data": results,
            "page": page,
            "total": total.total
          }, { headers: corsHeaders });
        } else {
          const ps = env.IMG.prepare(`SELECT * FROM imginfo ORDER BY id DESC LIMIT 10 OFFSET ${page} * 10`);
          const { results } = await ps.all();
          const total = await env.IMG.prepare(`SELECT COUNT(*) as total FROM imginfo`).first();
          return Response.json({
            "code": 200,
            "success": true,
            "message": "success",
            "data": results,
            "page": page,
            "total": total.total
          }, { headers: corsHeaders });
        }
      }

      // 获取访客浏览日志及关联分级的日志行为
      if (action === 'log') {
        let { page, query } = await request.json();
        if (query) {
          const ps = env.IMG.prepare(`SELECT tgimglog.*, imginfo.rating,imginfo.total FROM tgimglog JOIN imginfo ON tgimglog.url = imginfo.url WHERE tgimglog.url LIKE '%${query}%' ORDER BY tgimglog.id DESC LIMIT 10 OFFSET ${page} * 10`);
          const { results } = await ps.all();
          const total = await env.IMG.prepare(`SELECT COUNT(*) as total FROM tgimglog WHERE url LIKE '%${query}%'`).first();
          return Response.json({
            "code": 200,
            "success": true,
            "message": "success",
            "data": results,
            "page": page,
            "total": total.total
          }, { headers: corsHeaders });
        } else {
          const ps = env.IMG.prepare(`SELECT tgimglog.*, imginfo.rating,imginfo.total FROM tgimglog JOIN imginfo ON tgimglog.url = imginfo.url ORDER BY tgimglog.id DESC LIMIT 10 OFFSET ${page} * 10`);
          const { results } = await ps.all();
          const total = await env.IMG.prepare(`SELECT COUNT(*) as total FROM tgimglog`).first();
          return Response.json({
            "code": 200,
            "success": true,
            "message": "success",
            "data": results,
            "page": page,
            "total": total.total
          }, { headers: corsHeaders });
        }
      }
    } catch (error) {
      return Response.json({
        "code": 500,
        "success": false,
        "message": error.message,
      }, { status: 500, headers: corsHeaders });
    }
  }

  // 4. POST /api/enableauthapi/tgchannel ：通过 Telegram Bot Token 渠道上传多媒体到指定专属频道
  if (path === 'enableauthapi/tgchannel') {
    const tgBotToken = await getDynamicConfig(env, 'TG_BOT_TOKEN', '');
    const tgChatId = await getDynamicConfig(env, 'TG_CHAT_ID', '');
    if (!tgBotToken || !tgChatId) {
      return Response.json({
        status: 500,
        message: `TG_BOT_TOKEN or TG_CHAT_ID is not Set`,
        success: false
      }, { status: 500, headers: corsHeaders });
    }

    try {
      const formData = await request.formData();
      const fileType = formData.get('file').type;

      // 自动判定所上传媒体文件的 MIME 级别，从而自动对应调取 Telegram 的指定 endpoint 方法进行承接
      const fileTypeMap = {
        'image/': { url: 'sendPhoto', type: 'photo' },
        'video/': { url: 'sendVideo', type: 'video' },
        'audio/': { url: 'sendAudio', type: 'audio' },
        'application/pdf': { url: 'sendDocument', type: 'document' }
      };

      const defaultType = { url: 'sendDocument', type: 'document' };
      const matchingKey = Object.keys(fileTypeMap).find(key => fileType.startsWith(key));
      const { url: endpoint, type: fileTypevalue } = matchingKey ? fileTypeMap[matchingKey] : defaultType;

      const up_url = `https://api.telegram.org/bot${tgBotToken}/${endpoint}`;
      let newformData = new FormData();
      newformData.append("chat_id", tgChatId);
      
      const file = formData.get('file');
      newformData.append(fileTypevalue, file, file.name || "file");

      // 正式执行上传到 Telegram 物理接口
      const res_img = await fetch(up_url, {
        method: "POST",
        headers: {
          "User-Agent": " Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0"
        },
        body: newformData,
      });

      let responseData = await res_img.json();
      if (!responseData.ok) {
        return Response.json({
          status: 500,
          message: `Telegram API Error: ${responseData.description || 'Unknown error'}. Please check configurations.`,
          success: false
        }, { status: 500, headers: corsHeaders });
      }

      const fileData = await getFileDetail(responseData);
      if (!fileData) {
        return Response.json({
          status: 500,
          message: `Failed to extract file details from Telegram response.`,
          success: false
        }, { status: 500, headers: corsHeaders });
      }

      const message_id = responseData.result.message_id;
      const data = {
        "url": `${customDomain}/api/cfile/${fileData.file_id}${message_id ? `?mid=${message_id}` : ''}`,
        "code": 200,
        "name": fileData.file_name
      };

      if (!env.IMG) {
        data.env_img = "null";
        return Response.json({ ...data, msg: "1" }, { status: 200, headers: corsHeaders });
      } else {
        let nowTime;
        try {
          const rating_index = await getModerateContentRating(env, `${fileData.file_id}`, 'tg');
          nowTime = await get_nowTime();
          await insertImageData(env.IMG, `/cfile/${fileData.file_id}${message_id ? `?mid=${message_id}` : ''}`, Referer, clientIp, rating_index, nowTime);

          return Response.json({
            ...data,
            msg: "2",
            Referer,
            clientIp,
            rating_index,
            nowTime
          }, { status: 200, headers: corsHeaders });
        } catch (error) {
          if (!nowTime) {
            try {
              nowTime = await get_nowTime();
            } catch (_) {
              nowTime = new Date().toISOString();
            }
          }
          await insertImageData(env.IMG, `/cfile/${fileData.file_id}${message_id ? `?mid=${message_id}` : ''}`, Referer, clientIp, -1, nowTime);
          return Response.json({
            ...data,
            msg: "2",
            Referer,
            clientIp,
            rating_index: -1,
            nowTime,
            warning: error.message
          }, { status: 200, headers: corsHeaders });
        }
      }
    } catch (error) {
      return Response.json({
        status: 500,
        message: ` ${error.message}`,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  }

  // 5. POST /api/enableauthapi/r2 ：将文件上传存入自定义底层 R2 桶存储内
  if (path === 'enableauthapi/r2') {
    if (!env.IMGRS) {
      return Response.json({
        status: 500,
        message: `IMGRS is not Set`,
        success: false
      }, { status: 500, headers: corsHeaders });
    }

    try {
      const formData = await request.formData();
      const file = formData.get('file');
      const fileType = file.type;
      const originalName = file.name || 'image.png';

      // 生成安全的、唯一的、无特殊字符的 R2 文件名来防止各种 SQL 嵌入与特殊字符解析及双重编码问题
      let ext = '.png';
      const lastDotIndex = originalName.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        ext = originalName.slice(lastDotIndex);
      }
      // 移除非字母数字的扩展名字符（安全过滤）
      ext = ext.replace(/[^a-zA-Z0-9.]/g, '');
      if (!ext) {
        ext = '.png';
      }
      const randomPart = Math.random().toString(36).substring(2, 8);
      const filename = `r2_${Date.now()}_${randomPart}${ext}`;

      const header = new Headers();
      header.set("content-type", fileType);
      header.set("content-length", `${file.size}`);

      // 调用 mock R2 桶的 put 方法持久化资源
      const object = await env.IMGRS.put(filename, file, {
        httpMetadata: header
      });

      if (object === null) {
        return Response.json({
          status: 404,
          message: `R2 put returned null`,
          success: false
        }, { status: 404, headers: corsHeaders });
      }

      const data = {
        "url": `${customDomain}/api/rfile/${filename}`,
        "code": 200,
        "name": filename
      };

      if (!env.IMG) {
        data.env_img = "null";
        return Response.json({ ...data, msg: "1" }, { status: 200, headers: corsHeaders });
      } else {
        let nowTime;
        try {
          const rating_index = await getModerateContentRating(env, `${req_url.origin}/api/rfile/${filename}`, 'url');
          nowTime = await get_nowTime();
          await insertImageData(env.IMG, `/rfile/${filename}`, Referer, clientIp, rating_index, nowTime);

          return Response.json({
            ...data,
            msg: "2",
            Referer,
            clientIp,
            rating_index,
            nowTime
          }, { status: 200, headers: corsHeaders });
        } catch (error) {
          if (!nowTime) {
            try {
              nowTime = await get_nowTime();
            } catch (_) {
              nowTime = new Date().toISOString();
            }
          }
          await insertImageData(env.IMG, `/rfile/${filename}`, Referer, clientIp, -1, nowTime);
          return Response.json({
            ...data,
            msg: "2",
            Referer,
            clientIp,
            rating_index: -1,
            nowTime,
            warning: error.message
          }, { status: 200, headers: corsHeaders });
        }
      }
    } catch (error) {
      return Response.json({
        status: 500,
        message: ` ${error.message}`,
        success: false
      }, { status: 500, headers: corsHeaders });
    }
  }

  return Response.json({ name: "Not Found", path, success: false }, { status: 404, headers: corsHeaders });
}

// --- 统一的 PUT 请求处理器 ---
export async function PUT(request, { params }) {
  const { slug } = params || {};
  const path = slug ? slug.join('/') : '';
  const { env } = getSafeRequestContext();

  // PUT /api/admin/block ：管理员快捷对单张图片设定拉黑/评级修改
  if (path === 'admin/block') {
    try {
      let { rating, name } = await request.json();
      const setData = await env.IMG.prepare(`UPDATE imginfo SET rating = ${rating} WHERE url='${name}'`).run();
      return Response.json({
        "code": 200,
        "success": true,
        "message": setData.success,
      }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({
        "code": 500,
        "success": false,
        "message": error.message,
      }, { status: 500, headers: corsHeaders });
    }
  }

  return Response.json({ name: "Not Found", path, success: false }, { status: 404, headers: corsHeaders });
}

// --- 统一的 DELETE 请求处理器 ---
export async function DELETE(request, { params }) {
  const { slug } = params || {};
  const path = slug ? slug.join('/') : '';
  const { env } = getSafeRequestContext();

  // DELETE /api/admin/delete ：从后台面板中永久且多通道删除物理介质图片和 D1 主记录
  if (path === 'admin/delete') {
    try {
      let { name } = await request.json();
      try {
        name = decodeURIComponent(name);
      } catch (_) {}

      // --- 远程 Telegram 指定消息撤回删除 ---
      if (name.startsWith('/cfile/')) {
        try {
          const urlObj = new URL(name, 'http://localhost');
          const mid = urlObj.searchParams.get('mid');
          const tgBotToken = await getDynamicConfig(env, 'TG_BOT_TOKEN', '');
          const tgChatId = await getDynamicConfig(env, 'TG_CHAT_ID', '');
          if (mid && tgBotToken && tgChatId) {
            await fetch(`https://api.telegram.org/bot${tgBotToken}/deleteMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: tgChatId,
                message_id: parseInt(mid)
              })
            });
          }
        } catch (tgError) {
          console.error('Telegram deletion error:', tgError);
        }
      }

      // --- 物理云/本地 R2 冷介质删除 ---
      if (name.startsWith('/rfile/')) {
        try {
          const fileName = name.split('/').pop();
          if (env.IMGRS && fileName) {
            await env.IMGRS.delete(fileName);
          }
        } catch (r2Error) {
          console.error('R2 deletion error:', r2Error);
        }
      }

      // 从数据库关联记录中永久清除该数据
      const setData = await env.IMG.prepare(`DELETE FROM imginfo WHERE url='${name}'`).run();
      try {
        await env.IMG.prepare(`DELETE FROM tgimglog WHERE url='${name}'`).run();
      } catch (logDeleteErr) {
        console.error('Failed to clean up tgimglog records:', logDeleteErr);
      }
      return Response.json({
        "code": 200,
        "success": true,
        "message": setData.success,
      }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({
        "code": 500,
        "success": false,
        "message": error.message,
      }, { status: 500, headers: corsHeaders });
    }
  }

  return Response.json({ name: "Not Found", path, success: false }, { status: 404, headers: corsHeaders });
}

// --- OPTIONS 跨域测试飞行请求应对处理器 ---
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}
