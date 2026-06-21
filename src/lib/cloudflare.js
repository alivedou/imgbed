import { getRequestContext } from '@cloudflare/next-on-pages';

// 巧妙使用内存作为基础，并在 Node 环境可读写时自动支持本地 JSON 文件持久化
// 如果全局对象上没有 __d1Store，则初始化一个空的存储结构，包含图片信息 (imginfo) 与 tg图片日志 (tgimglog)
if (!globalThis.__d1Store) {
  globalThis.__d1Store = { imginfo: [], tgimglog: [] };
}

// 本地模拟的 D1 数据库类，兼容 Cloudflare D1 驱动的方法签名
class LocalD1Database {
  constructor() {
    let fsModule = null;
    let pathModule = null;
    try {
      // 通过 eval('require') 绕过 Webpack/Vite 静态分析，防止在 Edge Runtime 或前端浏览器运行时因加载 node 原生模块而报错进不去
      fsModule = eval("require('fs')");
      pathModule = eval("require('path')");
    } catch (_) {}

    this.fs = fsModule;
    this.path = pathModule;
    // 自动在项目根目录下创建一个本地 JSON 作为数据持久化媒介
    this.filePath = (this.path && typeof process !== 'undefined') ? this.path.join(process.cwd(), '.local_d1.json') : null;
  }

  // 读取本地 JSON 文件中的最新状态并更新到全局内存 __d1Store
  _read() {
    if (this.fs && this.filePath) {
      try {
        if (this.fs.existsSync(this.filePath)) {
          const data = this.fs.readFileSync(this.filePath, 'utf8');
          globalThis.__d1Store = JSON.parse(data);
          return globalThis.__d1Store;
        }
      } catch (e) {
        console.error("Local D1 Read Error:", e);
      }
    }

    if (!globalThis.__d1Store) {
      globalThis.__d1Store = { imginfo: [], tgimglog: [] };
    }
    return globalThis.__d1Store;
  }

  // 将数据同步写入内存和本地物理磁盘，完成类似 commit 的持久化操作
  _write(data) {
    globalThis.__d1Store = data;
    if (this.fs && this.filePath) {
      try {
        this.fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
      } catch (e) {
        console.error("Local D1 Write Error:", e);
      }
    }
  }

  // 预编译 SQL 语句，返回预编译包装类的实例
  prepare(sql) {
    return new LocalD1PreparedStatement(sql, this);
  }
}

// 模拟 D1 数据库预编译语句执行逻辑，实现基本的 SQL 解析与结果操作
class LocalD1PreparedStatement {
  constructor(sql, db) {
    this.sql = sql;
    this.db = db;
    this.bindings = []; // 存储 SQL 参数绑定的具体值
  }

  // 绑定参数
  bind(...args) {
    this.bindings = args;
    return this;
  }

  // 执行写操作或对结构有改变的操作（如 INSERT、UPDATE、DELETE）
  async run() {
    const data = this.db._read();
    const result = this._executeRaw(data, true);
    this.db._write(data);
    return result || { success: true };
  }

  // 获取多行查询结果
  async all() {
    const data = this.db._read();
    const results = this._executeRaw(data, false);
    return { results: results || [] };
  }

  // 获取第一行记录，或特定的一列
  async first(colName) {
    const data = this.db._read();
    const results = this._executeRaw(data, false);
    if (!results || results.length === 0) return null;
    if (colName) {
      return results[0][colName];
    }
    return results[0];
  }

  // SQL 查询的核心分发匹配引擎，负责解析并对 mock 的内存数据库执行操作
  _executeRaw(dbData, isWrite) {
    const sql = this.sql.trim();

    if (!dbData.tgimglog) dbData.tgimglog = [];
    if (!dbData.imginfo) dbData.imginfo = [];

    // 1. 插入流量访问日志
    if (sql.startsWith('INSERT INTO tgimglog')) {
      let url, referer, ip, time;
      if (this.bindings.length >= 4) {
        [url, referer, ip, time] = this.bindings;
      } else {
        // SQL 语法正则回退抓取
        const match = sql.match(/VALUES\s*\(([^)]+)\)/i);
        if (match) {
          const vals = match[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
          [url, referer, ip, time] = vals;
        }
      }

      const nextId = dbData.tgimglog.length > 0 ? Math.max(...dbData.tgimglog.map(x => x.id || 0)) + 1 : 1;
      const newRecord = {
        id: nextId,
        url: url || "",
        referer: referer || "",
        ip: ip || "",
        time: time || new Date().toISOString()
      };
      dbData.tgimglog.push(newRecord);
      return { success: true, results: [newRecord] };
    }

    // 2. 插入图片元数据与审查评级信息
    if (sql.startsWith('INSERT INTO imginfo')) {
      let url = "", referer = "", ip = "", rating = 0, total = 1, time = "";

      const match = sql.match(/VALUES\s*\(([^)]+)\)/i);
      if (match) {
        const rawVals = match[1];
        const vals = [];
        let cur = '';
        let inQuote = false;
        // 单引号内部空格与逗号防分裂状态机
        for (let i = 0; i < rawVals.length; i++) {
          const char = rawVals[i];
          if (char === "'") {
            inQuote = !inQuote;
          } else if (char === ',' && !inQuote) {
            vals.push(cur.trim().replace(/^'|'$/g, ''));
            cur = '';
          } else {
            cur += char;
          }
        }
        vals.push(cur.trim().replace(/^'|'$/g, ''));

        if (vals.length >= 6) {
          [url, referer, ip, rating, total, time] = vals;
          rating = Number(rating) || 0;
          total = Number(total) || 1;
        }
      }

      const nextId = dbData.imginfo.length > 0 ? Math.max(...dbData.imginfo.map(x => x.id || 0)) + 1 : 1;
      const newRecord = {
        id: nextId,
        url: url,
        referer: referer,
        ip: ip,
        rating: Number(rating) || 0,
        total: Number(total) || 1,
        time: time || new Date().toISOString()
      };
      dbData.imginfo.push(newRecord);
      return { success: true, results: [newRecord] };
    }

    // 3. 统计计数查询
    if (sql.match(/SELECT\s+COUNT\(\*\)\s+as\s+total\s+FROM\s+(\w+)/i)) {
      const match = sql.match(/SELECT\s+COUNT\(\*\)\s+as\s+total\s+FROM\s+(\w+)/i);
      const tableName = match[1].toLowerCase();
      const list = dbData[tableName] || [];

      let count = list.length;
      const likeMatch = sql.match(/url\s+LIKE\s+'%([^%']+)%'/i);
      if (likeMatch) {
        const query = likeMatch[1];
        count = list.filter(item => (item.url || '').toLowerCase().includes(query.toLowerCase())).length;
      }
      return [{ total: count }];
    }

    // 4. 查询单张图片的成人审查等评级值
    if (sql.match(/SELECT\s+rating\s+FROM\s+imginfo\s+WHERE\s+url\s*=\s*'([^']+)'/i)) {
      const urlMatch = sql.match(/SELECT\s+rating\s+FROM\s+imginfo\s+WHERE\s+url\s*=\s*'([^']+)'/i);
      const url = urlMatch[1];
      const found = dbData.imginfo.find(item => item.url === url);
      return found ? [{ rating: found.rating }] : [];
    }

    // 5. 更新图片的评级等级（黑名单 3，白名单等）
    if (sql.match(/UPDATE\s+imginfo\s+SET\s+rating\s*=\s*(-?\d+)\s+WHERE\s+url\s*=\s*'([^']+)'/i)) {
      const updateMatch = sql.match(/UPDATE\s+imginfo\s+SET\s+rating\s*=\s*(-?\d+)\s+WHERE\s+url\s*=\s*'([^']+)'/i);
      const rating = Number(updateMatch[1]);
      const url = updateMatch[2];
      let updated = false;
      dbData.imginfo.forEach(item => {
        if (item.url === url) {
          item.rating = rating;
          updated = true;
        }
      });
      return { success: true, updated };
    }

    // 6. 累加访问量累计器
    if (sql.match(/UPDATE\s+imginfo\s+SET\s+total\s*=\s*total\s*\+\s*1\s+WHERE\s+url\s*=\s*'([^']+)'/i)) {
      const updateMatch = sql.match(/UPDATE\s+imginfo\s+SET\s+total\s*=\s*total\s*\+\s*1\s+WHERE\s+url\s*=\s*'([^']+)'/i);
      const url = updateMatch[1];
      let updated = false;

      // 提取纯粹的文件后缀名称以使关联匹配更为鲁棒
      const getBaseName = (p) => {
        if (!p) return "";
        const parts = p.split('/');
        return parts[parts.length - 1];
      };
      const baseNameTarget = getBaseName(url);

      dbData.imginfo.forEach(item => {
        if (item.url === url || getBaseName(item.url) === baseNameTarget) {
          item.total = (item.total || 0) + 1;
          updated = true;
        }
      });
      return { success: true, updated };
    }

    // 7. 删除单条图片关联信息
    if (sql.match(/DELETE\s+FROM\s+imginfo\s+WHERE\s+url\s*=\s*'([^']+)'/i)) {
      const deleteMatch = sql.match(/DELETE\s+FROM\s+imginfo\s+WHERE\s+url\s*=\s*'([^']+)'/i);
      const url = deleteMatch[1];
      const initialLen = dbData.imginfo.length;
      dbData.imginfo = dbData.imginfo.filter(item => item.url !== url);
      return { success: true, deleted: initialLen - dbData.imginfo.length };
    }

    if (sql.match(/DELETE\s+FROM\s+tgimglog\s+WHERE\s+url\s*=\s*'([^']+)'/i)) {
      const deleteMatch = sql.match(/DELETE\s+FROM\s+tgimglog\s+WHERE\s+url\s*=\s*'([^']+)'/i);
      const url = deleteMatch[1];
      const initialLen = dbData.tgimglog.length;
      dbData.tgimglog = dbData.tgimglog.filter(item => item.url !== url);
      return { success: true, deleted: initialLen - dbData.tgimglog.length };
    }

    // 8. 多表联查 (tgimglog 与 imginfo 的关联查询实现)
    if (sql.includes('tgimglog JOIN imginfo')) {
      let list = [];
      dbData.tgimglog.forEach(log => {
        const info = dbData.imginfo.find(i => i.url === log.url);
        if (info) {
          list.push({
            id: log.id,
            url: log.url,
            referer: log.referer,
            ip: log.ip,
            time: log.time,
            rating: info.rating,
            total: info.total
          });
        }
      });

      const likeMatch = sql.match(/tgimglog\.url\s+LIKE\s+'%([^%']+)%'/i) || sql.match(/url\s+LIKE\s+'%([^%']+)%'/i);
      if (likeMatch) {
        const query = likeMatch[1].toLowerCase();
        list = list.filter(item => (item.url || '').toLowerCase().includes(query));
      }

      list.sort((a, b) => b.id - a.id);

      let offset = 0;
      const exprMatch = sql.match(/OFFSET\s+(\d+)\s*\*\s*(\d+)/i);
      if (exprMatch) {
        offset = Number(exprMatch[1]) * Number(exprMatch[2]);
      } else {
        const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
        if (offsetMatch) offset = Number(offsetMatch[1]);
      }
      return list.slice(offset, offset + 10);
    }

    // 9. 查询 imginfo 主表
    if (sql.startsWith('SELECT * FROM imginfo')) {
      let list = [...dbData.imginfo];

      const likeMatch = sql.match(/url\s+LIKE\s+'%([^%']+)%'/i);
      if (likeMatch) {
        const query = likeMatch[1].toLowerCase();
        list = list.filter(item => (item.url || '').toLowerCase().includes(query));
      }

      if (sql.match(/ORDER\s+BY\s+id\s+DESC/i)) {
        list.sort((a, b) => b.id - a.id);
      }

      let offset = 0;
      const exprMatch = sql.match(/OFFSET\s+(\d+)\s*\*\s*(\d+)/i);
      if (exprMatch) {
        offset = Number(exprMatch[1]) * Number(exprMatch[2]);
      } else {
        const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
        if (offsetMatch) offset = Number(offsetMatch[1]);
      }
      return list.slice(offset, offset + 10);
    }

    return [];
  }
}

// 兼容 Cloudflare R2 对象存储的本地内存及文件模拟器
class LocalR2Bucket {
  constructor() {
    // 确保 globalThis 上存在 Map，以便在 Edge Sandbox 下正常保活
    if (!globalThis.__r2Store) {
      globalThis.__r2Store = new Map();
    }

    let fsModule = null;
    let pathModule = null;
    try {
      fsModule = eval("require('fs')");
      pathModule = eval("require('path')");
    } catch (_) {}

    this.fs = fsModule;
    this.path = pathModule;
    this.dirPath = (this.path && typeof process !== 'undefined') ? this.path.join(process.cwd(), '.local_r2') : null;

    // 创建本地磁盘 R2 物理文件夹
    if (this.fs && this.dirPath && !this.fs.existsSync(this.dirPath)) {
      try {
        this.fs.mkdirSync(this.dirPath, { recursive: true });
      } catch (e) {
        console.error("Local R2 mkdir error:", e);
      }
    }
  }

  // 上传/写入文件
  async put(key, body, options = {}) {
    let content;
    try {
      if (body && typeof body.arrayBuffer === 'function') {
        const ab = await body.arrayBuffer();
        content = new Uint8Array(ab);
      } else if (body && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) {
        content = new Uint8Array(body.buffer || body);
      } else if (body && typeof body === 'string') {
        content = new TextEncoder().encode(body);
      } else if (body) {
        content = new Uint8Array(body);
      } else {
        content = new Uint8Array(0);
      }
    } catch (e) {
      console.error("Local R2 serialize put body error:", e);
      content = new Uint8Array(0);
    }

    const size = content.length;
    const httpMetadata = {};
    if (options.httpMetadata) {
      if (typeof options.httpMetadata.forEach === 'function') {
        options.httpMetadata.forEach((value, headerName) => {
          httpMetadata[headerName] = value;
        });
      } else if (typeof options.httpMetadata === 'object') {
        Object.entries(options.httpMetadata).forEach(([k, v]) => {
          httpMetadata[k.toLowerCase()] = v;
        });
      }
    }

    const item = {
      key,
      size,
      etag: `"${Math.random().toString(36).substring(2)}"`,
      uploaded: new Date().toISOString(),
      httpMetadata,
    };

    // 保留在内存缓存
    globalThis.__r2Store.set(key, {
      meta: item,
      body: content
    });

    // 持久化到本地磁盘
    if (this.fs && this.dirPath) {
      try {
        const metadataPath = this.path.join(this.dirPath, `${key}.meta.json`);
        const contentPath = this.path.join(this.dirPath, key);

        this.fs.writeFileSync(metadataPath, JSON.stringify(item, null, 2), 'utf8');
        this.fs.writeFileSync(contentPath, Buffer.from(content));
      } catch (e) {
        console.error("Local R2 Put to disk Error:", e);
      }
    }

    return item;
  }

  // 下载/读取文件
  async get(key, options = {}) {
    // 优先加载内存
    if (globalThis.__r2Store && globalThis.__r2Store.has(key)) {
      const stored = globalThis.__r2Store.get(key);
      const meta = stored.meta;
      const content = stored.body;

      return {
        ...meta,
        httpEtag: meta.etag,
        body: content,
        writeHttpMetadata(headers) {
          if (meta.httpMetadata && headers) {
            Object.entries(meta.httpMetadata).forEach(([h, v]) => {
              headers.set(h, v);
            });
          }
        }
      };
    }

    // 回退到冷盘机制
    if (this.fs && this.dirPath) {
      try {
        const metadataPath = this.path.join(this.dirPath, `${key}.meta.json`);
        const contentPath = this.path.join(this.dirPath, key);

        if (this.fs.existsSync(metadataPath) && this.fs.existsSync(contentPath)) {
          const meta = JSON.parse(this.fs.readFileSync(metadataPath, 'utf8'));
          const fileBuffer = this.fs.readFileSync(contentPath);
          const uint8Array = new Uint8Array(fileBuffer);

          if (globalThis.__r2Store) {
            globalThis.__r2Store.set(key, {
              meta,
              body: uint8Array
            });
          }

          return {
            ...meta,
            httpEtag: meta.etag,
            body: uint8Array,
            writeHttpMetadata(headers) {
              if (meta.httpMetadata && headers) {
                Object.entries(meta.httpMetadata).forEach(([h, v]) => {
                  headers.set(h, v);
                });
              }
            }
          };
        }
      } catch (e) {
        console.error("Local R2 Get from disk Error:", e);
      }
    }

    return null;
  }

  // 删除指定的冷对象/热对象
  async delete(key) {
    if (globalThis.__r2Store) {
      globalThis.__r2Store.delete(key);
    }
    if (this.fs && this.dirPath) {
      try {
        const metadataPath = this.path.join(this.dirPath, `${key}.meta.json`);
        const contentPath = this.path.join(this.dirPath, key);
        if (this.fs.existsSync(metadataPath)) {
          this.fs.unlinkSync(metadataPath);
        }
        if (this.fs.existsSync(contentPath)) {
          this.fs.unlinkSync(contentPath);
        }
      } catch (error) {
        console.error("Local R2 Delete Error:", error);
      }
    }
  }
}

// 获取安全的环境上下文变量 binding 拦截挂载代理
export function getSafeRequestContext() {
  try {
    const context = getRequestContext();
    if (context && context.env) {
      const activeEnv = { ...context.env };
      if (!activeEnv.IMG) {
        try {
          activeEnv.IMG = new LocalD1Database();
        } catch (_) {}
      }
      if (!activeEnv.IMGRS) {
        try {
          activeEnv.IMGRS = new LocalR2Bucket();
        } catch (_) {}
      }
      const envProxy = new Proxy(activeEnv, {
        get(target, prop) {
          if (prop in target) {
            return target[prop];
          }
          return process.env[prop];
        }
      });
      return {
        ...context,
        env: envProxy
      };
    }
  } catch (e) {
    // 优雅捕捉潜在的边界异常
  }

  // 本地沙盒环境兼容降级与代理挂载
  const mockD1 = new LocalD1Database();
  const mockR2 = new LocalR2Bucket();
  const envHandler = {
    get(target, prop) {
      if (prop === 'IMG') {
        return mockD1;
      }
      if (prop === 'IMGRS') {
        return mockR2;
      }
      if (prop in target) {
        return target[prop];
      }
      return process.env[prop];
    }
  };

  return {
    env: new Proxy(process.env, envHandler),
    cf: {},
    ctx: {
      waitUntil: (promise) => {
        if (promise && typeof promise.then === 'function') {
          promise.catch((err) => {
            console.error('Asynchronous task in waitUntil failed:', err);
          });
        }
      }
    }
  };
}
