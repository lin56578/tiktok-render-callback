/**
 * TikTok 中转服务（多 app 版）
 *
 * 部署在 Render 上，作用：纯转发到 TikTok 官方 API。
 * 本地 ERP 从数据库读 app_key/app_secret 后传给本服务，本服务不存储任何凭据。
 *
 * 接口：
 *   POST /api/token  —— 换 token / 刷新 token
 *   POST /api/proxy  —— 业务 API 转发
 *   GET  /           —— 健康检查
 */

const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const TIKTOK_AUTH_HOST = 'auth.tiktok-shops.com';
const TIKTOK_API_HOST = 'open-api.tiktokglobalshop.com';

// 简单 GET 请求工具（token 接口是 GET）
function forwardGet(host, path, queryParams) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(queryParams).toString();
    const options = {
      hostname: host,
      path: path + (qs ? '?' + qs : ''),
      method: 'GET',
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

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'tiktok-proxy-multi-app', time: new Date().toISOString() });
});

/**
 * POST /api/token
 * 入参：app_key, app_secret, code 或 refresh_token, grant_type
 * 换 token：GET https://auth.tiktok-shops.com/api/v2/token/get
 * 刷新 token：GET https://auth.tiktok-shops.com/api/v2/token/refresh
 */
app.post('/api/token', async (req, res) => {
  try {
    const { app_key, app_secret, code, refresh_token, grant_type } = req.body;
    if (!app_key || !app_secret) {
      return res.json({ code: -1, message: '缺少 app_key/app_secret' });
    }
    const isRefresh = grant_type === 'refresh_token';
    const path = isRefresh ? '/api/v2/token/refresh' : '/api/v2/token/get';
    const query = {
      app_key,
      app_secret,
      grant_type,
    };
    if (code) query.auth_code = code;
    if (refresh_token) query.refresh_token = refresh_token;

    const result = await forwardGet(TIKTOK_AUTH_HOST, path, query);
    res.json(result);
  } catch (e) {
    res.json({ code: -1, message: 'Render 中转异常: ' + e.message });
  }
});

/**
 * POST /api/proxy
 * 入参：app_key, sign, timestamp, path, method, access_token, shop_cipher, query_params, body
 * 转发到 https://open-api.tiktokglobalshop.com{path}
 */
app.post('/api/proxy', async (req, res) => {
  try {
    const {
      app_key, sign, timestamp, path, method, access_token, shop_cipher, query_params, body,
    } = req.body;
    if (!path) {
      return res.json({ code: -1, message: '缺少 path' });
    }
    const query = {};
    if (app_key) query.app_key = app_key;
    if (sign) query.sign = sign;
    if (timestamp) query.timestamp = timestamp;
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
