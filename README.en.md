<div align="center">

[中文](README.md) | **English** | [日本語](README.ja.md)

<img src="assets/hero.webp" width="100%" alt="mcd-team-feast: treat your whole team to McDonald's on Programmer's Day with one command" />

# 🍔 mcd-team-feast (麦麦拼单)

**In one sentence: drop a link in your team chat, everyone picks their own food, and it merges the order, finds the cheapest coupon combo, works out exactly who owes what, then prints a receipt card that looks like a `git log`.**

> Real run (priced live via McDonald's China MCP): a 5-person breakfast order, list price ¥139.50 → paid **¥125.30**, **¥25.06** per person — one command.

[![GitHub stars](https://img.shields.io/github/stars/Jasonin2099/mcd-team-feast?style=social)](https://github.com/Jasonin2099/mcd-team-feast/stargazers)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![McDonald's China MCP](https://img.shields.io/badge/McDonald's%20China-MCP-DA291C?logo=mcdonalds&logoColor=FFC72C)](https://github.com/M-China/mcd-mcp-server)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![Tests](https://img.shields.io/badge/tests-23%20passing-brightgreen)](test)
[![Web](https://img.shields.io/badge/Live%20demo-GitHub%20Pages-FFC72C)](https://jasonin2099.github.io/mcd-team-feast/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**[🌐 Live demo](https://jasonin2099.github.io/mcd-team-feast/)** · **[🚀 Quick start](#-quick-start)** · **[🤖 Use with AI agents](#-use-with-ai-agents-claude--cursor--workbuddy)**

<img src="assets/demo.svg" width="760" alt="Animated terminal demo" />

**If you find it fun or useful, a ⭐ Star helps more people discover it.**

</div>

> [!NOTE]
> **Live ordering works with McDonald's China (mainland) only.** Real data comes from the official [McDonald's China MCP Server](https://github.com/M-China/mcd-mcp-server), and a token requires a mainland Chinese phone number. Outside China, think of this as a fun open-source project for Programmer's Day (Oct 24, "1024"): everything runs with `--mock` sample data, and the [web demo](https://jasonin2099.github.io/mcd-team-feast/) is fully playable in your browser. The bill-splitting, coupon search and receipt cards are plain JavaScript you're welcome to borrow.

## 🧾 A real receipt card

<div align="center">
<img src="assets/feast-receipt.png" width="640" alt="Real receipt card, git log theme" />

<sub>↑ Priced live at a McDonald's in Shanghai via the official MCP (names are made up; price check only, nothing was ordered)</sub>
</div>

### 🎨 Three themes: `--theme git | pr | receipt | all`

| `git` commit log | `pr` pull request | `receipt` paper receipt |
|:---:|:---:|:---:|
| <img src="assets/theme-git.png" width="300"/> | <img src="assets/real-pr.png" width="300"/> | <img src="assets/theme-receipt.png" width="200"/> |

## 😩 The problem

Every time the team orders afternoon snacks:

- a 30-message sign-up thread in the group chat, and someone still gets left out;
- nobody can figure out which combination of coupons actually saves the most;
- after paying, you go around asking "you owe me ¥24.90" — and the odd cents are always awkward.

**mcd-team-feast** hands all of that to McDonald's MCP plus a small tool: sign-up, order merging, coupons, splitting and the receipt, end to end.

## ✨ Features

| | |
|---|---|
| 🧑‍🤝‍🧑 **Group orders** | `feast pick <name> <item>` with fuzzy item matching |
| 🌐 **Order from a link** | The [web version](https://jasonin2099.github.io/mcd-team-feast/) encodes the whole order in the URL — no server involved |
| 🎟 **Best coupons, automatically** | Fetches the store's coupons, tries every valid combination via `calculate-price`, keeps the cheapest |
| 🧮 **Fair split** | Discounts shared in proportion to each person's list price, computed in cents; the organizer absorbs rounding, so the shares always add up to the amount paid |
| 🧾 **Three card themes** | git log / GitHub PR / paper receipt, exported as PNG · SVG · HTML |
| 📋 **Payment message** | The web version writes "@Li pay Wang ¥24.90" lines for your group chat |
| 🔍 **`feast blame`** | A git-blame style leaderboard: biggest spender, most calories (`list-nutrition-foods`), most restrained |
| 🤖 **MCP server + Skill** | `feast mcp` is itself an MCP server, plus a [`SKILL.md`](SKILL.md) for agents |
| 🛡 **No accidental orders** | Placing an order needs the confirmation code from checkout; the MCP server exposes no ordering tool at all |
| 🧪 **`--mock` mode** | The full flow works without a token |
| 📦 **Zero dependencies** | Just Node 18+ and `npx` |

## 🚀 Quick start

### 1. Try it in 30 seconds (no token, works anywhere)

```bash
npx github:Jasonin2099/mcd-team-feast demo --mock --theme all
```

Three receipt cards land in the current directory (PNG if Chrome is installed, otherwise SVG/HTML). Mock data is fictional.

### 2. Connect to the real McDonald's China MCP (mainland China)

1. Sign in at the [McDonald's China open platform](https://open.mcd.cn/mcp) (mainland phone number required) and get an MCP token;
2. Set an environment variable (never commit it):

```bash
export MCD_MCP_TOKEN=your-token
alias feast="npx -y github:Jasonin2099/mcd-team-feast"
```

3. Start a real group order:

```bash
feast stores 福州路 --city 上海   # find a store and its code
feast new --store 1450441 --near 福州路 --city 上海 --title "1024 afternoon tea" --by Wang
feast menu                      # the menu changes by time of day
feast pick Li 麦咖啡™美式
feast pick Li 脆薯饼
feast pick Jie 派 2
feast list
feast diff                      # group order vs. the chat sign-up thread
feast checkout --theme all      # merge + best coupons + split + cards
feast blame                     # today's biggest spender / calorie champion
feast order --confirm 3f9a1c    # only after you've checked; returns a payment link
```

## 🤖 Use with AI agents (Claude / Cursor / WorkBuddy)

Merge [`mcp-config.example.json`](mcp-config.example.json) into your MCP config:

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

Or drop [`SKILL.md`](SKILL.md) into your agent's skills folder, then just say:

> "Set up a McDonald's group order for us. Wang wants a Sausage & Egg McMuffin and an Americano, Li wants hash browns. Work out the split and give me a PR-style receipt."

Tools: `feast_stores / feast_new / feast_menu / feast_pick / feast_drop / feast_list / feast_checkout / feast_blame`. **There is no ordering tool** — a human has to run `feast order --confirm` in the terminal.

## 🧭 Commands

| Command | What it does |
|---|---|
| `demo` | One-shot demo: start → 5 people order → coupons → split → card |
| `stores [keyword] [--city city]` | Find stores |
| `new --store <code> [--title] [--by]` | Start a group order and cache the menu |
| `menu` / `list` | Show the menu / current order |
| `pick <name> <item> [qty]` / `drop <name>` | Add an item / remove someone's picks |
| `checkout [--theme git\|pr\|receipt\|all] [--out dir]` | Price, split and render the cards |
| `blame` / `diff` | Easter eggs: git-blame leaderboard / order diff |
| `order --confirm <code> [--takeway take-in-store\|eat-in]` | Actually place the order (confirmation required) |
| `mcp` | Run as an MCP server (stdio) |
| `tools` | List McDonald's MCP tools and their parameters |

Every command accepts `--mock`. State lives in `.feast.json` in the current directory (override with `--file` or `FEAST_FILE`).

## 🔌 McDonald's MCP tools used

`query-nearby-stores` · `query-meals` · `query-meal-detail` · `query-store-coupons` · `calculate-price` · `create-order` · `now-time-info` · `list-nutrition-foods` · `available-coupons` · `campaign-calendar`

Real parameters, a sequence diagram and the business case are in [MCP_INTEGRATION.md](MCP_INTEGRATION.md) (Chinese).

## 🎯 Who it's for

- Tech leads who want to treat the team on Programmer's Day;
- whoever runs the weekly snack order;
- dorms, labs and clubs that order together;
- developers looking for a practical example of an MCP server / agent skill.

## 🧪 Development & contributing

```bash
git clone https://github.com/Jasonin2099/mcd-team-feast && cd mcd-team-feast
npm test                      # node:test, zero deps, 23 cases
node scripts/make-assets.js   # regenerate the demo animation and theme samples
```

PRs welcome — new themes, new easter-egg commands, smarter splitting rules. See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Jasonin2099/mcd-team-feast&type=Date)](https://star-history.com/#Jasonin2099/mcd-team-feast&Date)

## ⚠️ Disclaimer

This is an entry in the McDonald's China Programmer's Day developer contest, built independently — not an official McDonald's product. Items, prices and coupons in `--mock` mode and the web demo are fictional; real menu, prices and availability are whatever McDonald's official channels say. Calorie figures are for reference only and are not nutritional advice. See [CONTEST_DECLARATION.md](CONTEST_DECLARATION.md).

<div align="center">

### ⭐ If you like it, please give it a Star!

**And if your team tries it, share the receipt card — the next snack run might be yours to organize.**

</div>
