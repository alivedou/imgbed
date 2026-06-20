import { getRequestContext } from '@cloudflare/next-on-pages';

// 巧妙使用内存作为基础，并在 Node 环境可读写时自动支持本地 JSON 文件持久化
if (!globalThis.__d1Store) {
  globalThis.__d1Store = { imginfo: [], tgimglog: [] };
}

class LocalD1Database {
  constructor() {
    let fsModule = null;
    let pathModule = null;
    try {
      fsModule = eval("require('fs')");
      pathModule = eval("require('path')");
    } catch (_) {}

    this.fs = fsModule;
    this.path = pathModule;
    this.filePath = (this.path && typeof process !== 'undefined') ? this.path.join(process.cwd(), '.local_d1.json') : null;
  }

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

  prepare(sql) {
    return new LocalD1PreparedStatement(sql, this);
  }
}

class LocalD1PreparedStatement {
  constructor(sql, db) {
    this.sql = sql;
    this.db = db;
    this.bindings = [];
  }

  bind(...args) {
    this.bindings = args;
    return this;
  }

  async run() {
    const data = this.db._read();
    const result = this._executeRaw(data, true);
    this.db._write(data);
    return result || { success: true };
  }

  async all() {
    const data = this.db._read();
    const results = this._executeRaw(data, false);
    return { results: results || [] };
  }

  async first(colName) {
    const data = this.db._read();
    const results = this._executeRaw(data, false);
    if (!results || results.length === 0) return null;
    if (colName) {
      return results[0][colName];
    }
    return results[0];
  }

  _executeRaw(dbData, isWrite) {
    const sql = this.sql.trim();

    if (!dbData.tgimglog) dbData.tgimglog = [];
    if (!dbData.imginfo) dbData.imginfo = [];

    // 1. INSERT INTO tgimglog 带有绑定 (?, ?, ?, ?)
    if (sql.startsWith('INSERT INTO tgimglog')) {
      let url, referer, ip, time;
      if (this.bindings.length >= 4) {
        [url, referer, ip, time] = this.bindings;
      } else {
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

    // 2. INSERT INTO imginfo
    if (sql.startsWith('INSERT INTO imginfo')) {
      let url = "", referer = "", ip = "", rating = 0, total = 1, time = "";

      const match = sql.match(/VALUES\s*\(([^)]+)\)/i);
      if (match) {
        const rawVals = match[1];
        const vals = [];
        let cur = '';
        let inQuote = false;
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

    // 3. SELECT COUNT(*) as total FROM imginfo 或 tgimglog 
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

    // 4. SELECT rating FROM imginfo WHERE url='...'
    if (sql.match(/SELECT\s+rating\s+FROM\s+imginfo\s+WHERE\s+url\s*=\s*'([^']+)'/i)) {
      const urlMatch = sql.match(/SELECT\s+rating\s+FROM\s+imginfo\s+WHERE\s+url\s*=\s*'([^']+)'/i);
      const url = urlMatch[1];
      const found = dbData.imginfo.find(item => item.url === url);
      return found ? [{ rating: found.rating }] : [];
    }

    // 5. UPDATE imginfo SET rating = ${rating} WHERE url='${name}'
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

    // 6. UPDATE imginfo SET total = total +1 WHERE url = ...
    if (sql.match(/UPDATE\s+imginfo\s+SET\s+total\s*=\s*total\s*\+\s*1\s+WHERE\s+url\s*=\s*'([^']+)'/i)) {
      const updateMatch = sql.match(/UPDATE\s+imginfo\s+SET\s+total\s*=\s*total\s*\+\s*1\s+WHERE\s+url\s*=\s*'([^']+)'/i);
      const url = updateMatch[1];
      let updated = false;

      // 让文件名匹配更健壮，支持带或不带 /rf 或前缀的匹配
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

    // 7. DELETE FROM imginfo WHERE url='...'
    if (sql.match(/DELETE\s+FROM\s+imginfo\s+WHERE\s+url\s*=\s*'([^']+)'/i)) {
      const deleteMatch = sql.match(/DELETE\s+FROM\s+imginfo\s+WHERE\s+url\s*=\s*'([^']+)'/i);
      const url = deleteMatch[1];
      const initialLen = dbData.imginfo.length;
      dbData.imginfo = dbData.imginfo.filter(item => item.url !== url);
      return { success: true, deleted: initialLen - dbData.imginfo.length };
    }

    // 8. SELECT tgimglog.*, imginfo.rating...
    if (sql.includes('tgimglog JOIN imginfo')) {
      let list = [];
      dbData.tgimglog.forEach(log => {
        const info = dbData.imginfo.find(i => i.url === log.url);
        list.push({
          id: log.id,
          url: log.url,
          referer: log.referer,
          ip: log.ip,
          time: log.time,
          rating: info ? info.rating : -1,
          total: info ? info.total : 1
        });
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

    // 9. SELECT * FROM imginfo (带有 LIKE, ORDER BY, LIMIT OFFSET)
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

class LocalR2Bucket {
  constructor() {
    // 确保 globalThis 上有内存存储，以便在 Edge Sandbox 下正常跨请求读写
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

    if (this.fs && this.dirPath && !this.fs.existsSync(this.dirPath)) {
      try {
        this.fs.mkdirSync(this.dirPath, { recursive: true });
      } catch (e) {
        console.error("Local R2 mkdir error:", e);
      }
    }
  }

  async put(key, body, options = {}) {
    // 先将 body 转为安全的 Uint8Array
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

    // 总是保存在全局内存存储中 (即使 Edge 模拟器编译时无法使用 fs 也照样能 100% 成功读写)
    globalThis.__r2Store.set(key, {
      meta: item,
      body: content
    });

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

  async get(key, options = {}) {
    // 优先从全局内存中读取 (Edge 模拟器的核心保障)
    if (globalThis.__r2Store && globalThis.__r2Store.has(key)) {
      const stored = globalThis.__r2Store.get(key);
      const meta = stored.meta;
      const content = stored.body; // Uint8Array

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

    // fallback 到磁盘文件读取（保持服务重启后的恢复兼容）
    if (this.fs && this.dirPath) {
      try {
        const metadataPath = this.path.join(this.dirPath, `${key}.meta.json`);
        const contentPath = this.path.join(this.dirPath, key);

        if (this.fs.existsSync(metadataPath) && this.fs.existsSync(contentPath)) {
          const meta = JSON.parse(this.fs.readFileSync(metadataPath, 'utf8'));
          const fileBuffer = this.fs.readFileSync(contentPath);
          const uint8Array = new Uint8Array(fileBuffer);

          // 保持同步热载入
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
}

export function getSafeRequestContext() {
  try {
    const context = getRequestContext();
    if (context && context.env) {
      const activeEnv = { ...context.env };
      if (!activeEnv.IMG) {
        // Fallback inside Pages context if binding is dynamically missing in staging
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
    // Gracefully catch standard environment mismatch errors
  }

  // Generate safe fallback D1 Database in development environments
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
