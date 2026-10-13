const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/callback', (req, res) => {
  const auth_code = req.query.code;
  const state = req.query.state;
  res.send(`
    <h2>OAuth Callback Success</h2>
    <p>code: ${auth_code}</p>
    <p>state: ${state}</p>
  `);
});

app.get('/', (req, res) => {
  res.send('TikTok OAuth Callback Service');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
