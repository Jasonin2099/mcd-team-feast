<div align="center">

[中文](README.md) | [English](README.en.md) | **日本語**

<img src="assets/hero.webp" width="100%" alt="麦麦拼单 mcd-team-feast：プログラマーの日に、コマンド一発でチーム全員にマックをおごる" />

# 🍔 麦麦拼单（マイマイ・ピンダン）· mcd-team-feast

**ひとことで言うと：チャットにリンクを貼って、みんなが食べたいものを選ぶだけ。注文をまとめて、いちばん安くなるクーポンの組み合わせを探し、誰がいくら払えばいいかを計算して、`git log` 風のレシートカードまで作ってくれるツールです。**

> 実測例（マクドナルド中国の公式 MCP でリアルタイム計算）：5 人分の朝食で、定価 ¥139.50 → 支払い **¥125.30**、1 人あたり **¥25.06**。コマンド一発です。

[![GitHub stars](https://img.shields.io/github/stars/Jasonin2099/mcd-team-feast?style=social)](https://github.com/Jasonin2099/mcd-team-feast/stargazers)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![McDonald's China MCP](https://img.shields.io/badge/McDonald's%20China-MCP-DA291C?logo=mcdonalds&logoColor=FFC72C)](https://github.com/M-China/mcd-mcp-server)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![Tests](https://img.shields.io/badge/tests-23%20passing-brightgreen)](test)
[![Web](https://img.shields.io/badge/Webデモ-GitHub%20Pages-FFC72C)](https://jasonin2099.github.io/mcd-team-feast/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**[🌐 Web デモ](https://jasonin2099.github.io/mcd-team-feast/)** · **[🚀 クイックスタート](#-クイックスタート)** · **[🤖 AI エージェントから使う](#-ai-エージェントから使うclaude--cursor--workbuddy)**

<img src="assets/demo.svg" width="760" alt="ターミナルのデモアニメーション" />

**おもしろいと思ったら ⭐ Star をいただけると励みになります。**

</div>

> [!NOTE]
> **実際の注文・価格計算は、マクドナルド中国（中国本土）でしか使えません。** データはマクドナルド中国の公式 [MCP Server](https://github.com/M-China/mcd-mcp-server) から取得しており、トークンの発行には中国本土の電話番号が必要です。日本から触る場合は、「1024（中国のプログラマーの日、10 月 24 日）向けのネタ系 OSS」として楽しんでもらえればうれしいです。`--mock` のサンプルデータで全機能が動き、[Web デモ](https://jasonin2099.github.io/mcd-team-feast/)もブラウザだけで遊べます。割り勘ロジックやクーポン探索、カード描画はただの JavaScript なので、自由に流用してください。

## 🧾 実データのレシートカード

<div align="center">
<img src="assets/feast-receipt.png" width="640" alt="実データのレシートカード（git log テーマ）" />

<sub>↑ 公式 MCP で上海の店舗の価格をリアルタイム計算して生成（メンバー名は仮名、価格計算のみで注文はしていません）</sub>
</div>

### 🎨 テーマは 3 種類：`--theme git | pr | receipt | all`

| `git` コミットログ | `pr` プルリクエスト | `receipt` レシート |
|:---:|:---:|:---:|
| <img src="assets/theme-git.png" width="300"/> | <img src="assets/real-pr.png" width="300"/> | <img src="assets/theme-receipt.png" width="200"/> |

## 😩 こんな経験ありませんか

チームでおやつを頼むたびに：

- チャットで 30 件も取りまとめたのに、なぜか誰かが漏れている
- 割引クーポンをどう組み合わせれば一番安いのか、誰にもわからない
- 支払いのあとに「24.90 元ちょうだい」と一人ずつ回るのが地味につらい。端数はもっと気まずい

**麦麦拼单**は、こうした面倒をマクドナルドの MCP と小さなツールにまるごと任せます。取りまとめ、注文の合算、クーポン、割り勘、レシートまで全部です。

## ✨ 特長

| | |
|---|---|
| 🧑‍🤝‍🧑 **まとめて注文** | `feast pick 名前 商品` で参加。商品名はあいまい検索に対応 |
| 🌐 **リンクひとつで注文** | [Web 版](https://jasonin2099.github.io/mcd-team-feast/)は注文内容をまるごと URL に埋め込むので、サーバーを一切通りません |
| 🎟 **最適なクーポンを自動選択** | 店舗で使えるクーポンを取得し、組み合わせごとに `calculate-price` で計算して最安を選びます |
| 🧮 **公平な割り勘** | 割引は各自の定価の比率で按分し、計算はすべて「分（0.01 元）」単位。端数は幹事が吸収するので、全員分を足すと必ず支払額と一致します |
| 🧾 **3 種類のカード** | git log / GitHub PR / レシート。PNG・SVG・HTML で書き出し |
| 📋 **集金メッセージ** | Web 版で「@李さん → 王さんに ¥24.90」のような集金メッセージをワンクリックでコピー |
| 🔍 **`feast blame`** | git blame 風ランキング：一番使った人、カロリー王（`list-nutrition-foods`）、一番控えめな人 |
| 🤖 **MCP Server + Skill** | `feast mcp` 自体が MCP Server。エージェント向けの [`SKILL.md`](SKILL.md) 付き |
| 🛡 **誤発注しない設計** | 注文には checkout が出す確認コードが必須。MCP Server には注文ツール自体がありません |
| 🧪 **`--mock` モード** | トークンなしで最初から最後まで動きます |
| 📦 **依存ゼロ** | Node 18 以上と `npx` だけ |

## 🚀 クイックスタート

### 1. 30 秒でお試し（トークン不要・どこからでも）

```bash
npx github:Jasonin2099/mcd-team-feast demo --mock --theme all
```

カレントディレクトリに 3 種類のレシートカードが出力されます（Chrome があれば PNG、なければ SVG/HTML）。mock データは架空のものです。

### 2. マクドナルド中国の MCP に接続する（中国本土向け）

1. [マクドナルド中国 オープンプラットフォーム](https://open.mcd.cn/mcp)にログインして MCP トークンを取得します（中国本土の電話番号が必要）
2. 環境変数に設定します（リポジトリには絶対にコミットしないでください）

```bash
export MCD_MCP_TOKEN=あなたのトークン
alias feast="npx -y github:Jasonin2099/mcd-team-feast"
```

3. 本番の注文を立ち上げます

```bash
feast stores 福州路 --city 上海   # 店舗を検索して店舗コードを確認
feast new --store 1450441 --near 福州路 --city 上海 --title "1024 おやつ会" --by 王
feast menu                      # メニューは時間帯（朝食／通常）で変わります
feast pick 李 麦咖啡™美式
feast pick 李 脆薯饼
feast pick 傑 派 2
feast list
feast diff                      # チャットでの取りまとめとの差分
feast checkout --theme all      # 合算 + 最適クーポン + 割り勘 + カード
feast blame                     # 今日の「お財布担当」「カロリー担当」
feast order --confirm 3f9a1c    # 内容を確認してから注文。支払いリンクが返ります
```

## 🤖 AI エージェントから使う（Claude / Cursor / WorkBuddy）

[`mcp-config.example.json`](mcp-config.example.json) を MCP の設定にマージします。

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

または [`SKILL.md`](SKILL.md) をエージェントの skills フォルダに置いて、こう話しかけるだけです。

> 「みんなでマックをまとめて頼みたい。王さんはソーセージエッグマフィンとアメリカーノ、李さんはハッシュポテト。割り勘して PR 風のレシートも作って」

提供ツール：`feast_stores / feast_new / feast_menu / feast_pick / feast_drop / feast_list / feast_checkout / feast_blame`。**注文ツールはありません。** 注文は人がターミナルで `feast order --confirm` を実行したときだけです。

## 🧭 コマンド一覧

| コマンド | 説明 |
|---|---|
| `demo` | ワンショットのデモ：開始 → 5 人が注文 → クーポン → 割り勘 → カード |
| `stores [キーワード] [--city 都市]` | 店舗を検索 |
| `new --store <コード> [--title] [--by]` | 注文を立ち上げてメニューをキャッシュ |
| `menu` / `list` | メニュー／現在の注文を表示 |
| `pick <名前> <商品> [数量]` / `drop <名前>` | 注文に参加／その人の注文を削除 |
| `checkout [--theme git\|pr\|receipt\|all] [--out ディレクトリ]` | 価格計算・割り勘・カード生成 |
| `blame` / `diff` | おまけ：git blame 風ランキング／注文の diff |
| `order --confirm <コード> [--takeway take-in-store\|eat-in]` | 実際に注文（確認コード必須） |
| `mcp` | MCP Server（stdio）として起動 |
| `tools` | マクドナルド MCP のツールと引数を一覧表示 |

すべてのコマンドで `--mock` が使えます。状態はカレントディレクトリの `.feast.json` に保存されます（`--file` または `FEAST_FILE` で変更可）。

## 🔌 使っているマクドナルド MCP のツール

`query-nearby-stores` · `query-meals` · `query-meal-detail` · `query-store-coupons` · `calculate-price` · `create-order` · `now-time-info` · `list-nutrition-foods` · `available-coupons` · `campaign-calendar`

実際の引数、シーケンス図、ビジネス上の価値は [MCP_INTEGRATION.md](MCP_INTEGRATION.md)（中国語）にまとめています。

## 🎯 こんな人に

- プログラマーの日にチームへごちそうしたいテックリード
- 毎週のおやつ当番
- 寮・研究室・サークルでまとめて頼む人
- 実用的な MCP Server／エージェント Skill のサンプルを探している開発者

## 🧪 開発・コントリビュート

```bash
git clone https://github.com/Jasonin2099/mcd-team-feast && cd mcd-team-feast
npm test                      # node:test、依存ゼロ、23 ケース
node scripts/make-assets.js   # デモアニメーションとテーマ見本を再生成
```

PR 大歓迎です。新しいテーマ、おまけコマンド、もっと賢い割り勘ルールなど。詳しくは [CONTRIBUTING.md](CONTRIBUTING.md)（中国語）をどうぞ。

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Jasonin2099/mcd-team-feast&type=Date)](https://star-history.com/#Jasonin2099/mcd-team-feast&Date)

## ⚠️ 免責事項

本プロジェクトは、マクドナルド中国「プログラマーの日 クリエイティブ開発コンテスト」への応募作品で、個人が独自に開発したものです。マクドナルドの公式製品ではありません。`--mock` モードおよび Web デモの商品・価格・クーポンはすべて架空の例です。実際のメニュー・価格・販売状況はマクドナルド公式の情報をご確認ください。カロリーは参考値であり、栄養指導ではありません。詳しくは [CONTEST_DECLARATION.md](CONTEST_DECLARATION.md) をご覧ください。

<div align="center">

### ⭐ 気に入ったら Star をお願いします！

**チームで使ってみたら、ぜひレシートカードをシェアしてください。次のおやつ会の幹事は、あなたかもしれません。**

</div>
