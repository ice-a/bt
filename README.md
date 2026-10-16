# BT 种子预览台（DSL）

搜索 / 解析 / 预览 BT 种子内容，并一键投递到本机下载工具（qBittorrent / Transmission / aria2）的 Web 控制台。

## 功能特性

- **多源聚合搜索**：同时搜索多个公开磁力站并自动按 infoHash 去重、按做种数排序。
  - The Pirate Bay（apibay）
  - Nyaa
  - SolidTorrents
  - 磁力搜索（cilisousuo.cc）
- **种子内容预览**：通过 WebTorrent 的 DHT / Tracker 解析磁力链，取得文件清单、总大小、做种/下载人数（无需真正下载文件）。
- **一键投递**：把选中的磁力链直接发给本机 BT 客户端开始下载，并记录投递历史。
- **可配置**：搜索代理、超时、启用哪些搜索源、BT 客户端地址都可在「设置」页或 `.env` 中调整。

## 技术栈

- 前端/全栈：[Nuxt 4](https://nuxt.com/)（Vue 3 + Nitro 服务端）
- 数据库：[MongoDB](https://www.mongodb.com/)（搜索历史、投递记录、配置持久化；不连库时回落到 `.env` 默认值）
- 关键依赖：`webtorrent`（种子解析）、`mongodb`、`parse-torrent`、`undici`（带代理的 fetch）、`fast-xml-parser`

## 环境要求

- Node.js ≥ 18（推荐 20 LTS）
- MongoDB（可选；不安装也能跑，只是配置和历史记录不会持久化）

## 快速开始（本地开发）

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（可选，见下文「配置项」）
cp .env.example .env

# 3. 启动开发服务器
npm run dev
```

打开 http://localhost:3000 即可。

构建并本地预览生产版本：

```bash
npm run build
npm run preview
```

## 配置项

所有配置都可写入 `.env`（项目根目录），未设置时使用括号内默认值。

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `MONGODB_URI` | MongoDB 连接串 | `mongodb://127.0.0.1:27017` |
| `MONGODB_DB` | 数据库名 | `torrent_console` |
| `SEARCH_PROXY` | 访问搜索源时使用的 HTTP 代理（如 `http://127.0.0.1:7890`），留空直连 | 空 |
| `SEARCH_TIMEOUT` | 单次搜索源请求超时（毫秒） | `12000` |
| `METADATA_TIMEOUT` | 磁力链元数据解析超时（毫秒） | `30000` |
| `APIBAY_BASE` | The Pirate Bay 接口地址 | `https://apibay.org` |
| `NYAA_BASE` | Nyaa 地址 | `https://nyaa.si` |
| `CILISOUSUO_BASE` | 磁力搜索（cilisousuo）地址 | `https://cilisousuo.cc` |

> 这些项也可在「设置」页通过 UI 修改（保存后写入 MongoDB 的 `settings` 集合，优先级高于 `.env`）。

## 搜索源说明

cilisousuo.cc 的列表页只暴露名称、大小和详情页短链，不含 infoHash，因此该源会**逐条抓取详情页**补全磁力链（单次搜索最多取前 24 条、5 路并发）。若服务端网络连不上该站，请在「设置」里配置 `SEARCH_PROXY`。

## 部署

### 方式一：Docker（推荐）

已提供 `Dockerfile` 与 `docker-compose.yml`（自带 MongoDB）：

```bash
# 构建并启动（后台）
docker compose up -d --build

# 查看日志
docker compose logs -f app
```

访问 http://<服务器IP>:3000 。

仅构建镜像单独运行：

```bash
docker build -t bt-preview .
docker run -d --name bt-preview -p 3000:3000 \
  -e MONGODB_URI=mongodb://mongo:27017 \
  bt-preview
```

### 方式二：直接运行（Node 服务器）

```bash
# 生产构建，产物在 .output/
npm run build

# 用任意进程管理器跑起来（以 PM2 为例）
npm install -g pm2
pm2 start .output/server/index.mjs --name bt-preview
pm2 save
```

关键运行环境变量：

```bash
HOST=0.0.0.0   # 监听地址
PORT=3000      # 监听端口
MONGODB_URI=mongodb://127.0.0.1:27017
```

### 方式三：反向代理（Nginx 示例）

```nginx
server {
    listen 80;
    server_name your.domain;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 常见问题

- **搜索源"打不开" / 搜不到结果**：公开磁力站在部分网络下被墙。在「设置」里填一个可用的 HTTP 代理（`SEARCH_PROXY`），保存后重试。
- **MongoDB 未连接提示**：不影响基础搜索；只是配置和历史不会持久化。安装并启动 MongoDB，或设置 `MONGODB_URI` 指向可用的实例即可。
- **磁力解析不可用**：WebTorrent 依赖 Node 网络环境（DHT/UDP）。在受限网络下可能只能显示 infoHash，拿不到文件清单，属正常现象。

## 目录结构

```
app/            前端页面与组件（Nuxt pages / components / composables）
server/
  api/         Nitro 接口（search / torrent / clients / history / downloads ...）
  utils/
    search/    各搜索源实现（apibay / nyaa / solidtorrents / cilisousuo）
    mongo.ts   MongoDB 连接与索引
    appconfig.ts  配置读写与默认值
    torrent.ts    磁力链 / 种子解析工具
```
