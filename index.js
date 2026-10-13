const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// ========== 应用配置 ==========
const APP_KEY = "6lifb7a73ip11";
const APP_SECRET = "182fc26d53ea35956c65529888e2cf45841161c1";
const REDIRECT_URI = "https://my666.free.idcfengye.com/callback";
// ==============================

// 【关键】JSON中转接口：code换token
// 本地POST过来 { code: "xxx" }，这里请求TikTok换token，返回JSON
app.post('/api/token', async (req, res) => {
  const { code, refresh_token } = req.body;
  try {
    let url, payload;
    if (refresh_token) {
      url = 'https://auth.tiktok-shops.com/api/v2/refresh_token';
      payload = { app_key: APP_KEY, app_secret: APP_SECRET, grant_type: 'refresh_token', refresh_token };
    } else {
      url = 'https://auth.tiktok-shops.com/api/v2/token';
      payload = { app_key: APP_KEY, app_secret: APP_SECRET, code, grant_type: 'authorized_code', redirect_uri: REDIRECT_URI };
    }
    const resp = await axios.post(url, payload);
    res.json(resp.data);
  } catch (err) {
    res.status(500).json({ error: err.response ? err.response.data : err.message });
  }
});

// 【关键】JSON中转接口：通用API代理
// 本地POST过来 { path: "/product/search", access_token: "xxx", shop_id: "xxx", body: {} }
app.post('/api/proxy', async (req, res) => {
  const { path, access_token, shop_id, method = 'POST', body = {} } = req.body;
  try {
    const url = `https://openapi.tiktok-shops.com${path}?app_key=${APP_KEY}`;
    const resp = await axios({
      method,
      url,
      headers: {
        'x-tts-access-token': access_token,
        'x-tts-shop-id': shop_id,
        'Content-Type': 'application/json',
      },
      data: method === 'POST' ? body : undefined,
      params: method === 'GET' ? body : undefined,
    });
    res.json(resp.data);
  } catch (err) {
    res.status(500).json({ error: err.response ? err.response.data : err.message });
  }
});

// OAuth回调页面（保留，用于浏览器跳转）
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  if (!code) return res.send("缺少code参数");
  try {
    const resp = await axios.post('https://auth.tiktok-shops.com/api/v2/token', {
      app_key: APP_KEY,
      app_secret: APP_SECRET,
      code,
      grant_type: 'authorized_code',
      redirect_uri: REDIRECT_URI,
    });
    res.send(`<h2>Token获取成功</h2><pre>${JSON.stringify(resp.data, null, 2)}</pre>`);
  } catch (err) {
    res.send(`<h2>失败</h2><pre>${err.response ? JSON.stringify(err.response.data) : err.message}</pre>`);
  }
});

app.get('/', (req, res) => res.send('TikTok API Proxy Service Running'));

app.listen(port, () => console.log(`Proxy on port ${port}`));
