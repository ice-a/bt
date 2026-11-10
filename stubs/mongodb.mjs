// Cloudflare 部署用桩：Serverless 运行时没有 TCP，mongodb 无法连接。
// 让动态 import('mongodb') 直接失败，由调用方（tryMongo / tryMongo 包裹）捕获并降级。
throw new Error('mongodb 在此运行环境（Cloudflare Serverless，无 TCP）不可用')
