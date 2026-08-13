# 部署 Mystic 运势网站（含 DeepSeek AI 解读）

这个网站 = 纯前端网页 + 一个轻量 Node 后端代理。后端负责保管你的 DeepSeek API Key 并转发 AI 请求，**Key 绝不会出现在浏览器里**，朋友访问也拿不到。

---

## 第一步：拿到 DeepSeek API Key

1. 打开 https://platform.deepseek.com ，注册并登录
2. 左侧「API Keys」→ 创建 Key，复制下来（以 `sk-` 开头）
3. 充值一点余额（deepseek-chat 很便宜，几块钱能用很久）

---

## 第二步：把代码推到 GitHub

部署平台都需要从一个 Git 仓库拉代码。

```bash
git init
git add .
git commit -m "mystic fortune app"
git remote add origin https://github.com/你的用户名/mystic.git
git push -u origin main
```

> ⚠️ 千万别把 `.env` 文件提交上去！里面是你的 Key。
> 仓库里只放 `.env.example`（已经帮你建好了，里面是占位符）。

---

## 第三步：选一个免费平台部署

### 方案 A：Render（推荐，最简单）

1. 打开 https://render.com ，用 GitHub 登录
2. 点「New」→「Web Service」→ 连接你的 GitHub 仓库
3. 配置：
   - **Name**: mystic（随便起）
   - **Environment**: `Node`
   - **Build Command**: 留空（零依赖，不用 npm install）
   - **Start Command**: `node server.js`
4. 往下拉到「Environment Variables」，添加：
   - `DEEPSEEK_API_KEY` = 你的真实 key
5. 点「Create Web Service」
6. 等一两分钟，Render 会给一个网址（形如 `https://mystic-xxxx.onrender.com`）
7. 把这个网址发给朋友，他们打开就能用 AI 解读了 🎉

> Render 免费版在一段时间没人访问后会「睡」几分钟，第一次打开稍慢，正常。

### 方案 B：Railway

1. 打开 https://railway.app ，用 GitHub 登录
2. 「New Project」→「Deploy from GitHub repo」选你的仓库
3. 默认会识别 `package.json` 并用 `npm start` 启动（已配置好）
4. 在「Variables」里加 `DEEPSEEK_API_KEY`
5. 部署完成后点「Generate Domain」拿到网址

---

## 本地调试（不部署也能跑）

```bash
# 1. 复制环境变量模板
cp .env.example .env
# 2. 编辑 .env，把 DEEPSEEK_API_KEY 改成你的真实 key
# 3. 启动
node server.js
# 4. 浏览器打开 http://localhost:3000
```

---

## 常见问题

**Q: 朋友打开后 AI 解读报错？**
- 检查部署平台的环境变量 `DEEPSEEK_API_KEY` 有没有填对
- 访问 `https://你的网址/health` ，看返回里 `hasKey` 是不是 `true`

**Q: 直接双击 fortune-app.html 打开，AI 按钮报错？**
- 正常。AI 功能必须走后端（即部署后的网址，或本地 localhost:3000）。
- 直接打开文件时，网页的静态运势/星盘/塔罗仍然能用，只是 AI 解读需要后端。

**Q: 会不会被人刷我的 Key？**
- 后端加了每 IP 每分钟 30 次的限流。朋友正常使用不会触发。
- 如果担心，可以在部署平台随时删掉 Key 或换一个。

**Q: 想换模型？**
- 在环境变量加 `DEEPSEEK_MODEL=deepseek-reasoner` 即可（推理更强但更慢更贵）。
