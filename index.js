const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// ========== 填入你的应用信息 ==========
const APP_KEY = "6liekctig46mj";
const APP_SECRET = "f3956461039fd2980ae156ddb29e605fe395cbf4";
const REDIRECT_URI = "https://tiktok-render-callback.onrender.com/callback";
// ======================================

app.get('/callback', async (req, res) => {
  const auth_code = req.query.code;
  const state = req.query.state;
  if (!auth_code) {
    return res.send("缺少code参数");
  }
  try {
    // TikTok Shop oauth 换取token接口
    const resp = await axios.post('https://auth.tiktok-shops.com/api/v2/token', {
      app_key: APP_KEY,
      app_secret: APP_SECRET,
      code: auth_code,
      grant_type: "authorized_code",
      redirect_uri: REDIRECT_URI
    });
    const data = resp.data;
    res.send(`
      <h2>OAuth Callback Success</h2>
      <p>code: ${auth_code}</p>
      <p>state: ${state ?? 'empty'}</p>
      <hr>
      <h3>Token返回结果</h3>
      <pre>${JSON.stringify(data, null, 2)}</pre>
    `);
  } catch (err) {
    res.send(`
      <h2>获取Token失败</h2>
      <p>code: ${auth_code}</p>
      <pre>${err.response ? JSON.stringify(err.response.data, null, 2) : err.message}</pre>
    `);
  }
});

app.get('/', (req, res) => {
  res.send('TikTok OAuth Callback Service');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
