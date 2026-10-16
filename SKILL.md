---
name: mcd-team-feast
description: 麦麦拼单 —— 帮团队/工作群发起麦当劳团餐或下午茶拼单：收集每人点餐、调用麦当劳 MCP 合并订单、自动挑选最优优惠券、计算人均分账，并生成 git commit 风格的分享账单卡。当用户说“拼单”“团餐”“下午茶”“1024 请大家吃麦当劳”“帮我们凑单算人均”时使用。
---

# 麦麦拼单 Skill

## 前置条件
- 已配置麦当劳 MCP Server（见 `mcp-config.example.json`，Token 放在环境变量 `MCD_MCP_TOKEN`）。
- 没有 Token 时，所有命令加 `--mock` 使用示例数据演示。

## 工作流程
1. **确认门店**：调用 `query-nearby-stores`（或 `npx github:Jasonin2099/mcd-team-feast stores <地址>`），让用户选择门店。
2. **开团**：`feast new --store <门店编码> --title "<团名>" --by <发起人>`，内部调用 `query-meals` 缓存菜单。
3. **收集点餐**：逐个记录 `feast pick <名字> <餐品> [数量]`。用户在群聊里说“我要巨无霸+可乐”时，拆成多条 pick。不确定的餐品先 `feast menu` 或调用 `query-meal-detail` 确认。
4. **结算**：`feast checkout --out ./out`。内部调用 `query-store-coupons` 拿可用券，对每种券组合调用 `calculate-price`，选出实付最低的方案，按原价占比分摊优惠，生成 `feast-receipt.png/svg/html`。
5. **展示**：把终端账单和账单卡发给用户，提醒“价格以麦当劳实时结果为准”。
6. **下单（可选，必须人工确认）**：只有在用户明确说“确认下单”后，才执行 `feast order --confirm <确认码>`（调用 `create-order`，返回支付链接，由用户自行支付）。**绝不在未经确认时下单。**

## 小贴士
- 优惠券不够？可先调用 `available-coupons` 看麦麦省可领券，经用户同意后用 `auto-bind-coupons` 一键领取再结算。
- 节日氛围：用 `now-time-info` / `campaign-calendar` 判断今天是否有活动（例如 1024 程序员节）。
- 有人在控卡：用 `list-nutrition-foods` 给出热量参考。
