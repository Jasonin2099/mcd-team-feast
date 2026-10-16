<div align="center">

# 🍔 麦麦拼单 · mcd-team-feast

**1024 程序员节，请全组吃麦当劳，只需要一行命令（或一个链接）。**

开团 → 大家报名 → 自动凑单 + 挑最优券 → 人均分账 → 生成一张 `git log` 风格的账单卡，直接甩进工作群。

[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![McDonald's MCP](https://img.shields.io/badge/麦当劳-MCP-DA291C?logo=mcdonalds&logoColor=FFC72C)](https://github.com/M-China/mcd-mcp-server)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![Tests](https://img.shields.io/badge/tests-23%20passing-brightgreen)](test)
[![Web](https://img.shields.io/badge/在线体验-GitHub%20Pages-FFC72C)](https://jasonin2099.github.io/mcd-team-feast/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![M-CODE](https://img.shields.io/badge/M--CODE-程序员节创意开发大赛-FFC72C)](https://github.com/M-China/mcd-developer-innovation-challenge)

**[🌐 在线体验](https://jasonin2099.github.io/mcd-team-feast/)** · **[🚀 快速开始](#-快速开始)** · **[🤖 接入 AI Agent](#-接入-ai-agentclaude--cursor--workbuddy)** · **[English](#english)**

<img src="assets/demo.svg" width="760" alt="终端演示动画" />

</div>

## 🧾 真实账单卡

<div align="center">
<img src="assets/feast-receipt.png" width="640" alt="真实账单卡 git log 主题" />

<sub>↑ 接入真实麦当劳 MCP，在上海福州路餐厅实时计价生成（成员为化名，仅计价未下单）</sub>
</div>

### 🎨 三种主题，`--theme git | pr | receipt | all`

| `git` 提交记录 | `pr` 合并请求 | `receipt` 小票 |
|:---:|:---:|:---:|
| <img src="assets/theme-git.png" width="300"/> | <img src="assets/real-pr.png" width="300"/> | <img src="assets/theme-receipt.png" width="200"/> |

## 😩 痛点

每次组里点下午茶：

- 群里接龙 30 条消息，最后还是有人被漏掉；
- 满减券、单品券、折扣券到底怎么叠最省？没人算得清；
- 付完钱还要挨个算“你该转我多少”，几毛钱的尾差最尴尬。

**麦麦拼单**把这些事交给麦当劳 MCP 和一个小工具：报名、凑单、用券、分账、出账单，一条龙。

## ✨ 特性

| | |
|---|---|
| 🧑‍🤝‍🧑 **多人拼单** | 每人 `feast pick 名字 餐品`，餐品名模糊匹配（“拿铁”就行） |
| 🌐 **一个链接就能点** | [网页版](https://jasonin2099.github.io/mcd-team-feast/)：团的数据编码在链接里，不经过任何服务器，发到群里大家点完再发回来 |
| 🎟 **自动挑最优券** | 拉取门店可用券，枚举组合逐一调用 `calculate-price`，选实付最低 |
| 🧮 **公平分账** | 以实付为准按原价占比分摊优惠，金额按“分”计算，尾差发起人兜底，Σ每人应付 = 实付 |
| 🧾 **三种账单卡** | git log / GitHub PR / 小票，PNG · SVG · HTML 一键导出 |
| 🔍 **`feast blame`** | git blame 式排行：钱包贡献榜首、热量担当（`list-nutrition-foods`）、最克制 |
| 🤖 **MCP Server + Skill** | `feast mcp` 自身就是 MCP Server，附 [`SKILL.md`](SKILL.md)，一句“帮我们组拼一单麦当劳”即可 |
| 🛡 **绝不误下单** | 真正下单必须带 checkout 生成的确认码；MCP Server 根本不暴露下单工具 |
| 🧪 **`--mock` 离线体验** | 没有 Token 也能完整跑通全流程 |
| 📦 **零依赖** | 只需要 Node 18+，`npx` 即用 |

## 🚀 快速开始

### 1. 30 秒体验（无需 Token）

```bash
npx github:Jasonin2099/mcd-team-feast demo --mock --theme all
```

当前目录会生成三张账单卡（本机装有 Chrome 时导出 PNG，否则 SVG/HTML）。mock 数据为虚构示例。

### 2. 接入真实麦当劳 MCP

1. 到 [麦当劳开放平台](https://open.mcd.cn/mcp) 登录并获取 MCP Token；
2. 设置环境变量（切勿提交到仓库）：

```bash
export MCD_MCP_TOKEN=你的token
alias feast="npx -y github:Jasonin2099/mcd-team-feast"
```

3. 开一个真实的团：

```bash
feast stores 福州路 --city 上海   # 查门店，拿到门店编码
feast new --store 1450441 --near 福州路 --city 上海 --title "1024 程序员节下午茶" --by 老王
feast menu                      # 菜单随时段变化（早餐/正餐）
feast pick 小李 麦咖啡™美式
feast pick 小李 脆薯饼
feast pick 阿杰 派 2
feast list                      # 看看谁还没报名
feast diff                      # 拼单 vs 群接龙
feast checkout --theme all      # 凑单 + 最优券 + 人均 + 账单卡
feast blame                     # 谁是今天的钱包/热量担当
feast order --confirm 3f9a1c    # 核对无误后才下单，返回支付链接
```

## 🤖 接入 AI Agent（Claude / Cursor / WorkBuddy）

把 [`mcp-config.example.json`](mcp-config.example.json) 合并进你的 MCP 配置（同时挂上官方麦当劳 MCP 与麦麦拼单 MCP Server）：

```json
{
  "mcpServers": {
    "mcd-team-feast": {
      "command": "npx",
      "args": ["-y", "github:Jasonin2099/mcd-team-feast", "mcp"],
      "env": { "MCD_MCP_TOKEN": "${MCD_MCP_TOKEN}" }
    }
  }
}
```

或把 [`SKILL.md`](SKILL.md) 放进 Agent 的 skills 目录。然后直接说：

> “帮我们组拼一单麦当劳，福州路那家。老王要猪柳蛋麦满分和美式，小李要脆薯饼，算一下人均，出个 PR 风格的账单卡。”

MCP Server 提供 `feast_stores / feast_new / feast_menu / feast_pick / feast_drop / feast_list / feast_checkout / feast_blame`，**不提供下单工具**。下单只能由人在终端执行 `feast order --confirm`。

## 🧭 命令一览

| 命令 | 说明 |
|---|---|
| `demo` | 一键演示：开团 → 5 人点餐 → 自动用券 → 分账 → 账单卡 |
| `stores [关键词] [--city 城市]` | 查询门店 |
| `new --store <编码> [--title] [--by]` | 开团并缓存菜单 |
| `menu` / `list` | 看菜单 / 看当前团 |
| `pick <名字> <餐品> [数量]` / `drop <名字>` | 报名点餐 / 删除某人的选择 |
| `checkout [--theme git\|pr\|receipt\|all] [--out 目录]` | 结算并生成账单卡 |
| `blame` / `diff` | 程序员彩蛋：git blame 排行 / 拼单 diff |
| `order --confirm <确认码> [--takeway take-in-store\|eat-in]` | 真正下单（必须确认） |
| `mcp` | 以 MCP Server（stdio）运行 |
| `tools` | 列出麦当劳 MCP 工具及参数 |

所有命令都支持 `--mock`；团的状态保存在当前目录的 `.feast.json`（可用 `--file` 或 `FEAST_FILE` 指定）。

## 🔌 用到的麦当劳 MCP 能力

`query-nearby-stores` · `query-meals` · `query-meal-detail` · `query-store-coupons` · `calculate-price` · `create-order` · `now-time-info` · `list-nutrition-foods` · `available-coupons` · `campaign-calendar`

真实参数、调用时序图与业务价值见 [MCP_INTEGRATION.md](MCP_INTEGRATION.md)。

## 🎯 适合谁

- 想在 1024 程序员节请全组吃饭的 Tech Lead / 老板；
- 每周固定下午茶的团队行政；
- 宿舍、实验室、社团的拼单发起人；
- 想给自己 Agent 加一个实用 Skill / MCP Server 的开发者。

## 🧪 开发 & 贡献

```bash
git clone https://github.com/Jasonin2099/mcd-team-feast && cd mcd-team-feast
npm test                # node:test，零依赖，23 个用例
node scripts/make-assets.js   # 重新生成演示动画、主题示例与 social preview
```

欢迎 PR！新主题、新彩蛋命令、更聪明的分账规则都很棒，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## ⚠️ 声明

本项目为「麦当劳程序员节创意开发大赛」参赛作品，由参赛者独立开发，非麦当劳官方产品。`--mock` 与网页版中的餐品、价格与优惠券均为虚构示例；真实餐品信息、价格及供应状态以麦当劳官方渠道实时结果为准。热量数据仅供参考，不构成营养建议。详见 [CONTEST_DECLARATION.md](CONTEST_DECLARATION.md)。

<div align="center">

### ⭐ 如果它帮你省下了算账的时间，点个 Star 吧！

**也欢迎把账单卡晒到群里 —— 下一顿下午茶，也许就是你发起的。**

</div>

---

## English

**mcd-team-feast** is a team-order coordinator for McDonald's China, built on the official [McDonald's MCP Server](https://github.com/M-China/mcd-mcp-server). Start a group order, let teammates pick items (CLI or a [shareable web link](https://jasonin2099.github.io/mcd-team-feast/)), and it will merge the order, search for the cheapest coupon combination via `calculate-price`, split the bill fairly (to the cent), and render a shareable receipt card styled as a `git log`, a GitHub PR, or a paper receipt.

```bash
npx github:Jasonin2099/mcd-team-feast demo --mock --theme all   # no token needed
```

- Zero dependencies, Node 18+.
- Works as a CLI, an MCP server (`feast mcp`) and an Agent Skill (`SKILL.md`).
- Real orders require an explicit confirmation code; the MCP server never exposes order creation.
- Requires a McDonald's China MCP token (mainland phone number) for live data; `--mock` works everywhere.
