/**
 * TikTok 中转服务（多 app 版）
 *
 * 部署在 Render 上，作用：纯转发到 TikTok 官方 API，不存储任何 app_secret。
 * 所有签名由本地 ERP 算好后传过来，本服务只负责 HTTP 转发（解决国内访问不到 TikTok 的问题）。
 *
 * 接口：
 *   POST /api/token  —— 换 token / 刷新 token
 *   POST /api/proxy  —— 业务 API 转发
 *   GET  /           —— 健康检查
 *
 * 部署：Render → New Web Service → 选 Node.js → 上传本文件 → Start Command: node index.js
 */

const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const TIKTOK_API_HOST = 'open-api.tiktok.shop';

// 简单 POST 转发工具
function forwardPost(host, path, queryParams, bodyObj) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(queryParams).toString();
    const options = {
      hostname: host,
      path: path + (qs ? '?' + qs : ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ code: -1, message: 'Render 中转响应解析失败: ' + data });
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.write(JSON.stringify(bodyObj || {}));
    req.end();
  });
}

// 通用转发（支持 GET/POST/PUT/DELETE）
function forwardRequest(host, path, method, queryParams, bodyObj, accessToken) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(queryParams).toString();
    const headers = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['x-tts-access-token'] = accessToken;
    }
    const options = {
      hostname: host,
      path: path + (qs ? '?' + qs : ''),
      method: method,
      headers,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ code: -1, message: 'Render 中转响应解析失败: ' + data });
        }
      });
    });
    req.on('error', (e) => reject(e));
    if (method !== 'GET' && bodyObj) {
      req.write(JSON.stringify(bodyObj));
    }
    req.end();
  });
}

// 健康检查
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'tiktok-proxy-multi-app', time: new Date().toISOString() });
});

/**
 * POST /api/token
 * 入参（本地 ERP 算好签名后传过来）：
 *   app_key, sign, timestamp, grant_type, code 或 refresh_token
 * 转发到 https://auth.tiktok-shops.com/oauth/token
 */
app.post('/api/token', async (req, res) => {
  try {
    const { app_key, sign, timestamp, grant_type, code, refresh_token } = req.body;
    if (!app_key || !sign || !timestamp) {
      return res.json({ code: -1, message: '缺少 app_key/sign/timestamp' });
    }
    const query = {
      app_key,
      sign,
      timestamp,
      grant_type,
    };
    if (code) query.code = code;
    if (refresh_token) query.refresh_token = refresh_token;

    const result = await forwardPost(TIKTOK_API_HOST, '/oauth/token', query, {});
    res.json(result);
  } catch (e) {
    res.json({ code: -1, message: 'Render 中转异常: ' + e.message });
  }
});

/**
 * POST /api/proxy
 * 入参（本地 ERP 算好签名后传过来）：
 *   app_key, sign, timestamp, path, method, access_token, shop_cipher, query_params, body
 * 转发到 https://open-api.tiktok.shop{path}
 */
app.post('/api/proxy', async (req, res) => {
  try {
    const {
      app_key, sign, timestamp, path, method,
      access_token, shop_cipher, query_params, body,
    } = req.body;
    if (!app_key || !sign || !timestamp || !path) {
      return res.json({ code: -1, message: '缺少必要参数' });
    }
    const query = {
      app_key,
      sign,
      timestamp,
    };
    if (shop_cipher) query.shop_cipher = shop_cipher;
    // 合并业务 query 参数
    Object.assign(query, query_params || {});

    const result = await forwardRequest(
      TIKTOK_API_HOST,
      path,
      method || 'GET',
      query,
      body || {},
      access_token
    );
    res.json(result);
  } catch (e) {
    res.json({ code: -1, message: 'Render 中转异常: ' + e.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`TikTok proxy (multi-app) listening on port ${PORT}`);
});
