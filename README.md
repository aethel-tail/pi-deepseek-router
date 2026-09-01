# pi-deepseek-router

[English](README.en.md)

DeepSeek 专用的 pi 扩展包：任务感知的思维模式路由 + 两阶段工具锚定。
机制移植自 [yjh051108/dsh-router-standard](https://github.com/yjh051108/dsh-router-standard)
与 [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)
（均 MIT；轨迹词法分类器移植自 xiaobright/modeltest trigger_probe，MIT，
该实验工具现已迁移至 DeepseekCotexplorations 研究仓库）。

**实验性。** 上游的提分数据仅在 DeepSeek V4 Pro/Flash 上实测有效，且其理论解释
已被原作者勘误（工程增益保留）。对其他模型本扩展默认惰性，除非手动 `/router-mode` 强制。
与 DeepSeek 官方无关；"DeepSeek" 是其各自所有者的商标。

## 机制

1. 会话首个用户 prompt 经正则分类：**build 类 → react 模式**（边想边做），
   **fix 类 → spec 模式**（计划先行），**含糊 → weak 模式**（模型自路由，
   persona 按 Pro/Flash 自动选择）。
2. 系统提示词替换为对应实测 persona；工具面收窄到该模式的核心集
   （weak 为 RL 形态 `bash`+`edit`）。
3. 首次工具调用成功落地后，恢复完整工具目录与 pi 正常系统提示词。
4. persona/模式整会话锁定（路径承诺），中途切换不生效。

## 安装（git 包，无需 npm 发布）

```bash
# 直接安装
pi install git:github.com/aethel-tail/pi-deepseek-router

# 钉版本（推荐，配合 git tag）
pi install git:github.com/aethel-tail/pi-deepseek-router@v0.1.0

# 试用不安装
pi -e git:github.com/aethel-tail/pi-deepseek-router

# 升级 / 卸载
pi update git:github.com/aethel-tail/pi-deepseek-router
pi remove git:github.com/aethel-tail/pi-deepseek-router
```

本地开发则把本目录复制到 `~/.pi/agent/extensions/pi-deepseek-router/` 即可自动加载。

## 命令

| 命令 | 作用 |
|---|---|
| `/router-status` | 当前模型 / 模式 / 阶段（anchored·unlocked）/ 首条推理轨迹分类 |
| `/router-mode auto` | 恢复自动分类（默认） |
| `/router-mode spec\|react\|weak\|mixed\|0-100` | 强制模式（会话锁定，下个会话生效） |
| `/router-mode off` | 完全禁用并恢复工具 |

## 开发

```bash
npm install        # 安装 devDependencies（pi 类型 + typescript）
npm test           # node --test（Node 24 原生跑 .ts）
npm run typecheck  # tsc --noEmit（strict，无 any）
```

## 文件

- `index.ts` — pi 扩展入口（事件 + 命令）
- `router-core.ts` — 零依赖路由逻辑与正则（可单测）
- `router-core.test.ts` — 自检测试

## License

MIT（见 [LICENSE](./LICENSE)，含上游 xiaobright 版权行）。衍生部分的归属同时写在各源文件头部注释里。

## 致谢

本扩展由 aethel-tail 与 KIMI K3（Moonshot AI）共同开发维护。路由逻辑、persona 与轨迹分类器移植自 xiaobright 的 DSH 系列研究（MIT）。
