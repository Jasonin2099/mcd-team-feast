# 更新记录

按 git 历史整理。只列用户看得到的变化；纯文档、截图的提交省略。

## 未发布

- 网页：`?sync=off` 关闭实时同步（纯链接模式）
- 网页：品类按钮换行显示，不再横向滚动
- 同步服务：限流按 nginx 设置的 `X-Real-IP` 计，不再信任客户端可伪造的 `CF-Connecting-IP`
- QA 脚本自带静态服务，Windows 上也能跑；README 演示动图可复现（`scripts/record-demo.mjs`）
- CI：Node 18/20/22/24 和 Windows 上跑测试，外加一次 mock CLI 冒烟
- `npm run qa` / `npm run qa:multi`：浏览器 QA 脚本自动找 Chrome（也认 Edge、Chromium），不用再设 `CHROME`

## 0.2.2 — 2026-10-23

- 修复：网页白屏——`version.js` 在浏览器里 import 了 `node:fs`（0.2.1 引入）
- 示例菜单新增 套餐 / 炸鸡 / 麦咖啡 三个品类，套餐配一张示例券
- 菜单上方加品类跳转栏
- 按名字部分匹配时优先最短的名字
- 字体子集按当前界面文字重新生成

## 0.2.1 — 2026-10-22

- `npm test` 在 Node 22+ 上能跑了
- 修复：空的商品查询会选中菜单第一项；数量只接受整数
- 定价前先跳过购物车里没有的商品券，少调几次接口
- 修复：同步服务在 Windows 和带空格的路径下起不来
- MCP clientInfo / serverInfo 报告包版本号

## 更早（2026-10-16 ～ 10-18）

- 拼单、自动用券、人均分账，三种账单卡主题（git log / PR / 小票），热量统计
- CLI、网页、MCP Server、Agent Skill 四种用法；`feast blame` / `feast diff`
- 实时拼单房间：在线状态、截止倒计时、锁单、二维码邀请、断线重连，零依赖 SSE 同步服务
- 梗签名、仓库二维码水印；不带价格的群账单图（snapDOM）
- 中 / EN / 日 三语网页与 README
