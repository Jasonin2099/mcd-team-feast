# 贡献指南

感谢你愿意让下午茶变得更简单！🍔

## 开发

```bash
git clone https://github.com/Jasonin2099/mcd-team-feast && cd mcd-team-feast
npm test                     # 零依赖，Node 18+
node bin/cli.js demo --mock --theme all --out out
```

## 欢迎的贡献

- 🎨 **新账单卡主题**：在 `src/card-core.js` 中新增渲染函数并加入 `THEMES`（纯函数、无 Node 依赖，网页也能用）。
- 🥚 **新彩蛋命令**：`feast stash`、`feast rebase`…… 越程序员越好。
- 🧮 **分账规则**：例如“发起人请客”“按人头平摊”等可选策略。
- 🌐 **网页体验**：`index.html`（GitHub Pages）。

## 约定

- **安全第一**：测试中禁止调用任何真实下单/领券等写操作工具；需要真实接口的逻辑请用脱敏样例数据测试（参见 `test/live-shape.test.js`）。
- **不提交凭证**：Token 只能来自环境变量 `MCD_MCP_TOKEN`，提交前请检查 `git diff`。
- 提交信息建议使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)，例如 `feat(card): 新增像素风主题`。
- 用户可见文案以中文为主。
