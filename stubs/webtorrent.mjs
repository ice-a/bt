// Cloudflare 部署用桩：Serverless 运行时不支持 UDP / DHT / 原生模块，webtorrent 无法运行。
// 让动态 import('webtorrent') 失败，调用方（loadWebTorrent）捕获后返回 false，
// 种子解析自动降级到「torrent 缓存服务」或浏览器端 P2P。
throw new Error('webtorrent 在此运行环境（Cloudflare Serverless）不可用')
