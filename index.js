const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// ========== 填入你的应用信息 ==========
const APP_KEY = "6liekctig46mj";
const APP_SECRET = "在这里粘贴你的AppSecret";
const REDIRECT_URI = "https://tiktok-render-callback.onrender.com/callback";
// ======================================

// OAuth回调：code换取access_token
app.get('/callback', async (req, res) => {
  const auth_code = req.query.code;
  const state = req.query.state;
  if (!auth_code) {
    return res.send("<h2>缺少code参数</h2>");
  }
  let tokenResult = null;
  let errMsg = null;
  try {
    const resp = await axios.post('https://auth.tiktok-shops.com/api/v2/token', {
      app_key: APP_KEY,
      app_secret: APP_SECRET,
      code: auth_code,
      grant_type: "authorized_code",
      redirect_uri: REDIRECT_URI
    });
    tokenResult = resp.data;
  } catch (err) {
    if(err.response){
      errMsg = JSON.stringify(err.response.data, null, 2);
    }else{
      errMsg = err.message;
    }
  }

  let html = `
    <h2>OAuth Callback Success</h2>
    <p>code: ${auth_code}</p>
    <p>state: ${state ?? 'empty'}</p>
    <hr>
  `;
  if(tokenResult){
    html += `<h3>✅ Token返回结果</h3><pre>${JSON.stringify(tokenResult, null, 2)}</pre>`;
  }else{
    html += `<h3>❌ 获取Token失败</h3><pre>${errMsg}</pre>`;
  }
  res.send(html);
});

// 刷新access_token接口
// 访问示例：/refresh-token?refresh_token=xxx
app.get('/refresh-token', async (req, res)=>{
  const refresh_token = req.query.refresh_token;
  if(!refresh_token){
    return res.send("<h3>缺少refresh_token</h3>");
  }
  try{
    const resp = await axios.post('https://auth.tiktok-shops.com/api/v2/token',{
      app_key:APP_KEY,
      app_secret:APP_SECRET,
      grant_type:"refresh_token",
      refresh_token:refresh_token
    });
    res.send(`<h3>✅ 刷新Token成功</h3><pre>${JSON.stringify(resp.data,null,2)}</pre>`);
  }catch(e){
    res.send(`<h3>❌ 刷新失败</h3><pre>${e.response ? JSON.stringify(e.response.data,null,2):e.message}</pre>`);
  }
})

// 测试获取订单列表接口
app.get('/test-order', async (req, res)=>{
  const access_token = req.query.token;
  const shop_id = req.query.shop_id;
  if(!access_token || !shop_id){
    return res.send("缺少token或shop_id，url格式：/test-order?token=xxx&shop_id=xxx")
  }
  try{
    const result = await axios.get("https://api.tiktok-shops.com/api/v2/orders/search",{
      headers:{
        "Authorization":`Bearer ${access_token}`
      },
      params:{
        app_key:APP_KEY,
        shop_id:shop_id,
        page_size:10
      }
    })
    res.send(`<pre>${JSON.stringify(result.data,null,2)}</pre>`)
  }catch(e){
    res.send(`<pre>${e.response ? JSON.stringify(e.response.data,null,2):e.message}</pre>`)
  }
})

// 【新增】测试获取商品列表接口
// 访问示例：/test-product?token=xxx&shop_id=xxx
app.get('/test-product', async (req, res)=>{
  const access_token = req.query.token;
  const shop_id = req.query.shop_id;
  if(!access_token || !shop_id){
    return res.send("缺少token或shop_id，url格式：/test-product?token=xxx&shop_id=xxx")
  }
  try{
    const result = await axios.get("https://api.tiktok-shops.com/api/v2/products/list",{
      headers:{
        "Authorization":`Bearer ${access_token}`
      },
      params:{
        app_key:APP_KEY,
        shop_id:shop_id,
        page_size:10
      }
    })
    res.send(`<pre>${JSON.stringify(result.data,null,2)}</pre>`)
  }catch(e){
    res.send(`<pre>${e.response ? JSON.stringify(e.response.data,null,2):e.message}</pre>`)
  }
})

app.get('/', (req, res) => {
  res.send('TikTok OAuth Callback Service');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
