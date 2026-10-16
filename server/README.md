# feast-sync · 实时拼单房间服务

零依赖 Node（≥18）HTTP + Server-Sent Events。浏览器用 `EventSource` 收房间状态、`fetch POST` 发操作，断线自动重连。

- **只存**：团名、昵称、每人点了哪些菜品编码和数量。不存手机号、不碰麦当劳账号、不下单。
- **过期**：房间创建 24 小时后删除（`TTL_MS`）。
- **限制**：每房间 ≤40 人、每人 ≤60 种、单次请求 ≤16KB、每 IP 每分钟 ≤240 次写、全局 ≤5000 房间。
- **权限**：团长持 `hostKey`（改团名、截止时间、锁单/解锁）；成员持自己的 `key`，只能改自己的点单。锁单后服务器拒绝修改（423）。
- **CORS**：只放行 `ORIGINS`（默认 `https://jasonin2099.github.io`）和 localhost。

## API
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/rooms` `{t, name, picks}` | 开团，返回 `{id, hostKey, mid, key, state}` |
| GET | `/rooms/:id` | 公开状态（不含任何 key） |
| GET | `/rooms/:id/events?mid&key` | SSE；带对 key 才计入“在线” |
| POST | `/rooms/:id/op` | `join` / `rename` / `picks` / `done` / `leave` / `meta` / `deadline` / `lock` / `unlock` / `kick` |

## 本地运行
```bash
PORT=8787 node server/sync-server.js
# 网页指向本地服务：http://127.0.0.1:8000/?sync=http://127.0.0.1:8787
```

## 部署到你的 VPS（systemd + nginx，模板见 `deploy/`）
```bash
sudo mkdir -p /srv/feast-sync /var/lib/feast-sync && sudo chown www-data: /var/lib/feast-sync
sudo cp server/sync-server.js /srv/feast-sync/ && sudo cp server/deploy/feast-sync.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now feast-sync
sudo cp server/deploy/feast-ratelimit.conf /etc/nginx/conf.d/
sudo cp server/deploy/nginx-site.conf /etc/nginx/sites-enabled/feast-sync.conf   # 改成你的域名和证书路径
sudo nginx -t && sudo systemctl reload nginx
```
- 前面可以套 Cloudflare 等 CDN（需支持流式响应）；nginx 对 `/events` 关闭缓冲（`proxy_buffering off`），否则 SSE 会被攒住。
- `ORIGINS` 改成你网页的来源；网页用 `?sync=https://你的域名`，或改 `index.html` 里的 `<meta name="feast-sync">` 指向你的服务。
