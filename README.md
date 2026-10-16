<div align="center">

# 🍔 麦麦拼单 · mcd-team-feast

**1024 程序员节，请全组吃麦当劳，只需要一行命令。**

开团 → 大家报名 → 自动凑单 + 挑最优券 → 人均分账 → 生成一张 `git log` 风格的账单卡，直接甩进工作群。

[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![McDonald's MCP](https://img.shields.io/badge/麦当劳-MCP-DA291C?logo=mcdonalds&logoColor=FFC72C)](https://github.com/M-China/mcd-mcp-server)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](test)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![M-CODE](https://img.shields.io/badge/M--CODE-程序员节创意开发大赛-FFC72C)](https://github.com/M-China/mcd-developer-innovation-challenge)

<img src="assets/feast-receipt.png" width="720" alt="麦麦拼单账单卡示例" />

<sub>↑ 接入真实麦当劳 MCP，在上海福州路餐厅实时计价生成（成员为化名，仅计价未下单）</sub>

</div>

## 😩 痛点

每次组里点下午茶：

- 群里接龙 30 条消息，最后还是有人被漏掉；
- 满减券、单品券、折扣券到底怎么叠最省？没人算得清；
- 付完钱还要挨个算“你该转我多少”，几毛钱的尾差最尴尬。

**麦麦拼单**把这些事交给麦当劳 MCP 和一个小脚本：报名、凑单、用券、分账、出账单，一条龙。

## ✨ 特性

| | |
|---|---|
| 🧑‍🤝‍🧑 **多人拼单** | 每人 `feast pick 名字 餐品`，餐品名模糊匹配（“拿铁”就行） |
| 🎟 **自动挑最优券** | 拉取门店可用券，枚举组合逐一调用 `calculate-price`，选实付最低 |
| 🧮 **公平分账** | 按原价占比分摊优惠，配送费平摊，金额按“分”计算，尾差发起人兜底，总额严格守恒 |
| 🧾 **程序员风账单卡** | 一键输出 PNG / SVG / HTML，`commit`、`+`、`-`、`git push` 一个不少 |
| 🛡 **绝不误下单** | 真正下单必须带上 checkout 生成的确认码，方案变了确认码就失效 |
| 🤖 **Skill 即插即用** | 附带 [`SKILL.md`](SKILL.md)，Claude / WorkBuddy / 各类 Agent 直接加载 |
| 🧪 **`--mock` 离线体验** | 没有 Token 也能完整跑通全流程 |
| 📦 **零依赖** | 只需要 Node 18+，`npx` 即用 |

## 🚀 快速开始

### 1. 30 秒体验（无需 Token）

```bash
npx github:Jasonin2099/mcd-team-feast demo --mock
```

当前目录会生成（mock 数据为虚构示例） `feast-receipt.png`（本机装有 Chrome 时）、`feast-receipt.svg` 和 `feast-receipt.html`。

### 2. 接入真实麦当劳 MCP

1. 到 [麦当劳开放平台](https://open.mcd.cn/mcp) 登录并获取 MCP Token；
2. 设置环境变量：

```bash
export MCD_MCP_TOKEN=你的token   # 切勿提交到仓库
```

3. 开一个真实的团：

```bash
alias feast="npx -y github:Jasonin2099/mcd-team-feast"

feast stores 福州路 --city 上海   # 查门店，拿到门店编码
feast new --store 1450441 --near 福州路 --city 上海 --title "1024 程序员节下午茶" --by 老王
feast menu                      # 菜单随时段变化（早餐/正餐）
feast pick 小李 麦咖啡™美式
feast pick 小李 脆薯饼
feast pick 阿杰 派 2
feast list                      # 看看谁还没报名
feast checkout --out ./out      # 凑单 + 最优券 + 人均 + 账单卡
feast order --confirm 3f9a1c    # 核对无误后才下单，返回支付链接
```

### 3. 作为 Skill 给 AI Agent 用

把本仓库的 [`SKILL.md`](SKILL.md) 放进你的 Agent skills 目录，并按 [`mcp-config.example.json`](mcp-config.example.json) 配置麦当劳 MCP Server。然后在对话里说：

> “帮我们组拼个麦当劳下午茶，老王要巨无霸和可乐，小李要麦旋风，算一下人均。”

## 🧭 命令一览

| 命令 | 说明 |
|---|---|
| `demo` | 一键演示：开团 → 5 人点餐 → 自动用券 → 分账 → 账单卡 |
| `stores [关键词] [--city 城市]` | 查询门店 |
| `new --store <编码> [--title] [--by]` | 开团并缓存菜单 |
| `menu` | 查看菜单 |
| `pick <名字> <餐品> [数量]` | 报名点餐 |
| `drop <名字>` | 删除某人的选择 |
| `list` | 查看当前团 |
| `checkout [--out 目录]` | 结算并生成账单卡 |
| `order --confirm <确认码> [--takeway take-in-store\|eat-in]` | 真正下单（必须确认，默认外带自提） |
| `tools` | 列出 MCP 工具及参数 |

所有命令都支持 `--mock`；团的状态保存在当前目录的 `.feast.json`（可用 `--file` 指定）。

## 🔌 用到的麦当劳 MCP 能力

`query-nearby-stores` · `query-meals` · `query-meal-detail` · `query-store-coupons` · `available-coupons` · `auto-bind-coupons` · `calculate-price` · `create-order` · `now-time-info` · `campaign-calendar` · `list-nutrition-foods`

详细调用流程见 [MCP_INTEGRATION.md](MCP_INTEGRATION.md)。

## 🎯 适合谁

- 想在 1024 程序员节请全组吃饭的 Tech Lead / 老板；
- 每周固定下午茶的团队行政；
- 宿舍、实验室、社团的拼单发起人；
- 想给自己 Agent 加一个实用 Skill 的开发者。

## 🧪 开发

```bash
git clone https://github.com/Jasonin2099/mcd-team-feast && cd mcd-team-feast
npm test          # node:test，零依赖
npm run demo      # 重新生成 assets/feast-receipt.png
```

## ⚠️ 声明

本项目为「麦当劳程序员节创意开发大赛」参赛作品，由参赛者独立开发，非麦当劳官方产品。`--mock` 模式中的餐品、价格与优惠券均为虚构示例；真实餐品信息、价格及供应状态以麦当劳官方渠道实时结果为准。详见 [CONTEST_DECLARATION.md](CONTEST_DECLARATION.md)。

<div align="center">

### ⭐ 如果它帮你省下了算账的时间，点个 Star 吧！

**也欢迎把账单卡晒到群里 —— 下一顿下午茶，也许就是你发起的。**

</div>
