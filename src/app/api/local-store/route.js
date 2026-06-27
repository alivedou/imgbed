export async function POST(request) {
  if (process.env.CF_PAGES === '1') {
    return Response.json({ success: false, error: 'Local-store is not available in production' }, { status: 400 });
  }
  try {
    const body = await request.json();
    const { action } = body;

    // 动态并隐式加载 node.js 原生模块，防止 webpack 静态解析在 Edge 环境下报错
    let fs, path;
    try {
      const fsModuleName = 'fs';
      const pathModuleName = 'path';
      fs = await import(fsModuleName);
      path = await import(pathModuleName);
    } catch (err) {
      return Response.json({
        success: false,
        error: 'Local-store utility is only available in local Node.js environment.'
      }, { status: 400 });
    }

    const d1Path = path.join(process.cwd(), '.local_d1.json');
    const r2Dir = path.join(process.cwd(), '.local_r2');

    if (action === 'd1_read') {
      if (fs.existsSync(d1Path)) {
        const content = fs.readFileSync(d1Path, 'utf8');
        return Response.json({ success: true, data: JSON.parse(content) });
      }
      return Response.json({ success: true, data: { imginfo: [], tgimglog: [] } });
    }

    if (action === 'd1_write') {
      fs.writeFileSync(d1Path, JSON.stringify(body.data, null, 2), 'utf8');
      return Response.json({ success: true });
    }

    if (action === 'r2_mkdir') {
      if (!fs.existsSync(r2Dir)) {
        fs.mkdirSync(r2Dir, { recursive: true });
      }
      return Response.json({ success: true });
    }

    if (action === 'r2_put') {
      if (!fs.existsSync(r2Dir)) {
        fs.mkdirSync(r2Dir, { recursive: true });
      }
      const { key, meta, bodyBase64 } = body;
      const metaPath = path.join(r2Dir, `${key}.meta.json`);
      const contentPath = path.join(r2Dir, key);

      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
      
      const buffer = Buffer.from(bodyBase64, 'base64');
      fs.writeFileSync(contentPath, buffer);

      return Response.json({ success: true });
    }

    if (action === 'r2_get') {
      const { key } = body;
      const metaPath = path.join(r2Dir, `${key}.meta.json`);
      const contentPath = path.join(r2Dir, key);

      if (fs.existsSync(metaPath) && fs.existsSync(contentPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const buffer = fs.readFileSync(contentPath);
        return Response.json({
          success: true,
          exists: true,
          meta,
          bodyBase64: buffer.toString('base64'),
        });
      }
      return Response.json({ success: true, exists: false });
    }

    if (action === 'r2_delete') {
      const { key } = body;
      const metaPath = path.join(r2Dir, `${key}.meta.json`);
      const contentPath = path.join(r2Dir, key);

      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }
      if (fs.existsSync(contentPath)) {
        fs.unlinkSync(contentPath);
      }
      return Response.json({ success: true });
    }

    return Response.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
