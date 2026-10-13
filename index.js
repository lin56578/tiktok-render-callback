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

// 【关键】GET方式 code换token（按官方文档）
app.post('/api/token', async (req, res) => {
  const { code, refresh_token } = req.body;
  try {
    let url;
    if (refresh_token) {
      // 刷新token
      url = 'https://auth.tiktok-shops.com/api/v2/token/refresh?'
        + `app_key=${APP_KEY}&app_secret=${APP_SECRET}&grant_type=refresh_token&refresh_token=${refresh_token}`;
    } else {
      // code换token（GET请求，参数名auth_code）
      url = 'https://auth.tiktok-shops.com/api/v2/token/get?'
        + `app_key=${APP_KEY}&app_secret=${APP_SECRET}&auth_code=${code}&grant_type=authorized_code`;
    }
    console.log('Token URL:', url.replace(APP_SECRET, '***'));
    const resp = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      validateStatus: () => true,
    });
    console.log('Token response:', resp.status, JSON.stringify(resp.data).substring(0, 200));
    res.json(resp.data);
  } catch (err) {
    console.error('Token error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 【关键】通用API代理（Open API走tiktokglobalshop.com）
app.post('/api/proxy', async (req, res) => {
  const { path, access_token, shop_id, method = 'POST', body = {}, timestamp, sign } = req.body;
  try {
    let url = `https://open-api.tiktokglobalshop.com${path}?app_key=${APP_KEY}`;
    if (timestamp) url += `&timestamp=${timestamp}`;
    if (sign) url += `&sign=${sign}`;
    const headers = {
      'x-tts-access-token': access_token,
      'Content-Type': 'application/json',
    };
    if (shop_id) headers['x-tts-shop-id'] = shop_id;
    const resp = await axios({
      method,
      url,
      headers,
      data: method === 'POST' ? body : undefined,
      validateStatus: () => true,
    });
    res.json(resp.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OAuth回调页面（浏览器跳转用）
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("缺少code参数");
  try {
    const url = 'https://auth.tiktok-shops.com/api/v2/token/get?'
      + `app_key=${APP_KEY}&app_secret=${APP_SECRET}&auth_code=${code}&grant_type=authorized_code`;
    const resp = await axios.get(url, { validateStatus: () => true });
    res.send(`<h2>Token结果</h2><pre>${JSON.stringify(resp.data, null, 2)}</pre>`);
  } catch (err) {
    res.send(`<h2>失败</h2><pre>${err.message}</pre>`);
  }
});

app.get('/', (req, res) => res.send('TikTok API Proxy Running'));

app.listen(port, () => console.log(`Proxy on port ${port}`));
