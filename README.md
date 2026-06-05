# Claude Code Best V5 (CCB)

[![GitHub Stars](https://img.shields.io/github/stars/claude-code-best/claude-code?style=flat-square&logo=github&color=yellow)](https://github.com/claude-code-best/claude-code/stargazers)
[![GitHub Contributors](https://img.shields.io/github/contributors/claude-code-best/claude-code?style=flat-square&color=green)](https://github.com/claude-code-best/claude-code/graphs/contributors)
[![GitHub Issues](https://img.shields.io/github/issues/claude-code-best/claude-code?style=flat-square&color=orange)](https://github.com/claude-code-best/claude-code/issues)
[![GitHub License](https://img.shields.io/github/license/claude-code-best/claude-code?style=flat-square)](https://github.com/claude-code-best/claude-code/blob/main/LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/claude-code-best/claude-code?style=flat-square&color=blue)](https://github.com/claude-code-best/claude-code/commits/main)
[![Bun](https://img.shields.io/badge/runtime-Bun-black?style=flat-square&logo=bun)](https://bun.sh/)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord)](https://discord.gg/qZU6zS7Q)

> Which Claude do you like? The open source one is the best.

牢 A (Anthropic) 官方 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI 工具的源码反编译/逆向还原项目。目标是将 Claude Code 大部分功能及工程化能力复现 (问就是老佛爷已经付过钱了)。虽然很难绷, 但是它叫做 CCB(踩踩背)...

[文档在这里, 支持投稿 PR](https://ccb.agent-aura.top/) | [留影文档在这里](./Friends.md) | [Discord 群组](https://discord.gg/qZU6zS7Q)

## 🚀 快速安装

### 方式一：从 NPM 安装（推荐）

```bash
# 全局安装
bun i -g claude-code-best
bun pm -g trust claude-code-best

# 启动
ccb
```

⚠️ **国内用户**：如遇到 GitHub 网络问题，请先设置环境变量：

```bash
export DEFAULT_RELEASE_BASE=https://ghproxy.net/https://github.com/microsoft/ripgrep-prebuilt/releases/download/v15.0.1
```

### 方式二：从源码安装

```bash
# 克隆仓库
git clone https://github.com/claude-code-best/claude-code.git
cd claude-code

# 安装依赖
bun install

# 构建
bun run build

# 全局链接（可直接使用 ccb 命令）
bun link

# 启动
ccb
```

- ✅ [x] V4 — 测试补全、[Buddy](https://ccb.agent-aura.top/docs/features/buddy)、[Auto Mode](https://ccb.agent-aura.top/docs/safety/auto-mode)、环境变量 Feature 开关
- ✅ [x] V5 — [Sentry](https://ccb.agent-aura.top/docs/internals/sentry-setup) / [GrowthBook](https://ccb.agent-aura.top/docs/internals/growthbook-adapter) 企业监控、[自定义 Login](https://ccb.agent-aura.top/docs/features/custom-platform-login)、[OpenAI 兼容](https://ccb.agent-aura.top/docs/plans/openai-compatibility)、[Web Search](https://ccb.agent-aura.top/docs/features/web-browser-tool)、[Computer Use](https://ccb.agent-aura.top/docs/features/computer-use) / [Chrome Use](https://ccb.agent-aura.top/docs/features/claude-in-chrome-mcp)、[Voice Mode](https://ccb.agent-aura.top/docs/features/voice-mode)、[Bridge Mode](https://ccb.agent-aura.top/docs/features/bridge-mode)、[/dream 记忆整理](https://ccb.agent-aura.top/docs/features/auto-dream)
- 🔮 [ ] V6 — 大规模重构石山代码，全面模块分包（全新分支，main 封存为历史版本）

- 🚀 [想要启动项目](#快速开始源码版)
- 🐛 [想要调试项目](#vs-code-调试)
- 📖 [想要学习项目](#teach-me-学习项目)



## Feature Flags

所有功能开关通过 `FEATURE_<FLAG_NAME>=1` 环境变量启用，例如：

```bash
FEATURE_BUDDY=1 FEATURE_FORK_SUBAGENT=1 bun run dev
```

各 Feature 的详细说明见 [`docs/features/`](docs/features/) 目录，欢迎投稿补充。

## VS Code 调试

TUI (REPL) 模式需要真实终端，无法直接通过 VS Code launch 启动调试。使用 **attach 模式**：

### 步骤

1. **终端启动 inspect 服务**：
   ```bash
   bun run dev:inspect
   ```
   会输出类似 `ws://localhost:8888/xxxxxxxx` 的地址。

2. **VS Code 附着调试器**：
   - 在 `src/` 文件中打断点
   - F5 → 选择 **"Attach to Bun (TUI debug)"**


## Teach Me 学习项目

我们新加了一个 teach-me skills, 通过问答式引导帮你理解这个项目的任何模块。(调整 [sigma skill 而来](https://github.com/sanyuan0704/sanyuan-skills))

```bash
# 在 REPL 中直接输入
/teach-me Claude Code 架构
/teach-me React Ink 终端渲染 --level beginner
/teach-me Tool 系统 --resume
```

### 它能做什么

- **诊断水平** — 自动评估你对相关概念的掌握程度，跳过已知的、聚焦薄弱的
- **构建学习路径** — 将主题拆解为 5-15 个原子概念，按依赖排序逐步推进
- **苏格拉底式提问** — 用选项引导思考，而非直接给答案
- **错误概念追踪** — 发现并纠正深层误解
- **断点续学** — `--resume` 从上次进度继续

### 学习记录

学习进度保存在 `.claude/skills/teach-me/` 目录下，支持跨主题学习者档案。

## 相关文档及网站

- **在线文档（Mintlify）**: [ccb.agent-aura.top](https://ccb.agent-aura.top/) — 文档源码位于 [`docs/`](docs/) 目录，欢迎投稿 PR
- **DeepWiki**: <https://deepwiki.com/claude-code-best/claude-code>

## Contributors

<a href="https://github.com/claude-code-best/claude-code/graphs/contributors">
  <img src="contributors.svg" alt="Contributors" />
</a>

## Star History

<a href="https://www.star-history.com/?repos=claude-code-best%2Fclaude-code&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=claude-code-best/claude-code&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=claude-code-best/claude-code&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=claude-code-best/claude-code&type=date&legend=top-left" />
 </picture>
</a>

## 许可证

本项目仅供学习研究用途。Claude Code 的所有权利归 [Anthropic](https://www.anthropic.com/) 所有。
