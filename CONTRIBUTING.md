# 贡献指南

感谢你愿意让下午茶变得更简单！🍔

## 开发

```bash
git clone https://github.com/Jasonin2099/mcd-team-feast && cd mcd-team-feast
npm test                     # 零依赖，Node 18+
node bin/cli.js demo --mock --theme all --out out
```

### 网页检查（可选，需要本机 Chrome）

```bash
npm i --no-save puppeteer-core          # 只装到 node_modules，不改 package.json
CHROME="/path/to/chrome" node scripts/web-qa.mjs          # 单页：3 种宽度 × 深浅色、溢出/遮挡、导出图片
CHROME="/path/to/chrome" node scripts/web-qa-multi.mjs    # 多人房间：并发点单、断线重连、锁单
```

两个脚本都会自己起本地静态服务；`web-qa-multi` 还会在 `:8787` 起一个本地同步服务，测完关掉。截图默认写到 `shots/`（`OUT=` 可改）。

- 网页地址加 `?sync=off` 可关掉实时同步，只用链接分享，不会连线上同步服务。
- 改了网页文案或菜单后，若出现新汉字，需重新生成字体子集：从 [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) 下载 `Sans/OTC/NotoSansCJK-Regular.ttc` 和 `-Bold.ttc`，然后

  ```bash
  NOTO_CJK_DIR=/下载目录 python scripts/subset-fonts.py
  NOTO_CJK_DIR=/下载目录 python scripts/subset-card-fonts.py   # 账单卡字体；没有 JETBRAINS_MONO 时跳过英文部分
  ```
- 改了 `web/` 下的文件，记得同步改 `index.html` 和 `web/app.js` 里引用的 `?v=` 版本号，避免浏览器用旧缓存。

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
