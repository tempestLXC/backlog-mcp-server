# Backlog MCP Server

[![CI](https://github.com/tempestLXC/backlog-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/tempestLXC/backlog-mcp-server/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/tempestLXC/backlog-mcp-server/main/.github/badges/coverage.json)](https://github.com/tempestLXC/backlog-mcp-server/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
![Node.js ≥ 18](https://img.shields.io/badge/Node.js-%E2%89%A518-43853D?logo=node.js&logoColor=white)
[![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
![Tests: Jest](https://img.shields.io/badge/Tests-Jest-99424F?logo=jest&logoColor=white)
[![Protocol: MCP](https://img.shields.io/badge/Protocol-MCP-1F6FEB?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTUwIDBDMjIuMzc2IDAgMCAyMi4zNzYgMCA1MHMgMjIuMzc2IDUwIDUwIDUwIDUwLTIyLjM3NiA1MC01MFM3Ny42MjQgMCA1MCAweiIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik01MCAxNS4yNWMtMTkuMjI1IDAtMzQuNzUgMTUuNTI1LTM0Ljc1IDM0Ljc1UzMwLjc3NSA4NC43NSA1MCA4NC43NSA4NC43NSA2OS4yMjUgODQuNzUgNTBTNjkuMjI1IDE1LjI1IDUwIDE1LjI1em0tNi4yNSAyMS4yNWE2LjI1IDYuMjUgMCAxIDEgMTIuNSAwIDYuMjUgNi4yNSAwIDEgMS0xMi41IDB6bTAgMTUuNjI1YTYuMjUgNi4yNSAwIDEgMSAxMi41IDAgNi4yNSA2LjI1IDAgMSAxLTEyLjUgMHptNi4yNSA0My4xMjVhNi4yNSA2LjI1IDAgMSAxIDEyLjUgMCA2LjI1IDYuMjUgMCAxIDEtMTIuNSAwem0yMS44NzUtMTcuNWExMi41IDEyLjUgMCAxIDEgMjUgMCAxMi41IDEyLjUgMCAxIDEtMjUgMHptLTI3LjUgMTIuNWExMi41IDEyLjUgMCAxIDEgMjUgMCAxMi41IDEyLjUgMCAxIDEtMjUgMHoiIGZpbGw9IiMxZjZmZWIiLz48L3N2Zz4=)](https://github.com/modelcontextprotocol)

A **Model Context Protocol (MCP) server** for [Backlog](https://backlog.com).
With this server, you can **manage Backlog issues, comments, wikis, and attachments directly from MCP clients** such as **Codex CLI**.

---

## 📚 目录 / Table of Contents

- [✨ Key Features](#-key-features)
- [📂 项目结构](#-项目结构)
- [🔧 先决条件](#-先决条件)
- [⚙️ 安装与构建](#️-安装与构建)
- [▶️ 使用方法](#️-使用方法)
- [🧰 可用 MCP 工具](#-可用-mcp-工具)
- [🛠️ 开发指南](#️-开发指南)
- [📜 License](#-license)
- [🤝 贡献](#-贡献)
- [🔮 未来计划](#-未来计划)

---

## ✨ Key Features
- 🔍 Query issues, projects, users, and activity logs  
- 📝 Create, update, and comment on Backlog issues  
- 📖 Search and edit Wiki pages  
- 📎 Upload and manage attachments  
- 🛠️ Full CRUD support grouped by Issues, Comments, Wiki, and Attachments  

---

> 🚀 Example: Summarize issues from Backlog in Codex CLI and turn them into structured requirements automatically.

---

## 📂 项目结构
```bash
backlog-mcp-server/
├── src/
│   ├── server.ts              # MCP Server 入口
│   ├── backlogClient.ts       # Backlog REST API 封装
│   ├── tools/                 # MCP 工具实现
│   │   ├── issues.ts          # 处理 Backlog 任务
│   │   ├── comments.ts        # 处理任务评论
│   │   ├── wiki.ts            # Wiki 页面工具
│   │   ├── attachments.ts     # 附件相关操作
│   │   └── activities.ts      # 项目活动日志
│   └── utils/                 # 通用工具函数
│       ├── auth.ts            # 鉴权辅助
│       ├── errors.ts          # 错误格式化
│       └── pagination.ts      # 分页处理
├── docs/                      # 文档与设计草稿
├── README.md
└── LICENSE
```

---

## 🔧 先决条件

- [Node.js](https://nodejs.org/) >= 18（推荐使用最新 LTS）
- npm >= 9
- 可访问 Backlog 空间的 API Key（需要 Issues / Wiki / Attachments 权限）

在首次运行前，请确认 `BACKLOG_BASE_URL` 没有尾随 `/api/v2`，该路径由服务器自动补齐。例如：`https://your-space.backlog.jp` ✅，`https://your-space.backlog.jp/api/v2` ❌。

---

## ⚙️ 安装与构建

### 1. 克隆仓库
```bash
git clone https://github.com/your-org/backlog-mcp-server.git
cd backlog-mcp-server
```

### 2. 安装依赖
```bash
npm install
```

### 3. 构建
```bash
npm run build
```

---

## ▶️ 使用方法

### 1. 配置环境变量
在 `.env` 文件或系统环境中设置：

```bash
BACKLOG_BASE_URL=https://your-space.backlog.jp
BACKLOG_API_KEY=your_api_key_here
```

### 2. 启动 MCP Server
```bash
npm run start
```
或直接运行编译后的文件：
```bash
node dist/server.js
```

### 3. 在 Codex CLI 中配置 MCP
编辑 `~/.codex/config.toml`：

```toml
[mcp_servers.backlog]
command = "node"
args = ["/absolute/path/to/dist/server.js"]
env = { BACKLOG_BASE_URL = "https://your-space.backlog.jp", BACKLOG_API_KEY = "your_api_key_here" }
```

重启 Codex CLI 后，即可通过 MCP 使用 Backlog 工具。

### 4. 运行测试
在提交改动前，可运行测试套件以确保工具行为符合预期：

```bash
npm run test
```

> 💡 **调试技巧**：先执行 `npm run build && node dist/server.js`，再在 MCP 客户端调用 `ping` 工具验证连接是否成功，预期返回 `pong:<你的输入>`。

---

## 🧰 可用 MCP 工具

| 工具名称 | 操作范围 | 典型用法 |
| --- | --- | --- |
| `ping` | 健康检查 | 回显 `pong:<message>`，快速验证连接是否正常 |
| `issues` / `listIssues` / `getIssue` / `createIssue` / `updateIssue` / `deleteIssue` / `transitionIssue` | Backlog 任务 | 列表、查询、创建、更新、删除任务以及执行状态流转 |
| `comments` / `listComments` / `addComment` / `updateComment` / `deleteComment` | 任务评论 | 查看或管理指定任务的评论记录 |
| `attachments` | 任务附件 | 上传、列出或删除 Backlog 任务附件（上传需提供 Base64 文件内容） |
| `wiki` / `searchWiki` / `getWiki` / `createWiki` / `updateWiki` / `deleteWiki` | Wiki 页面 | 搜索、读取和维护项目 Wiki 页面 |
| `activities` | 项目活动 | 查看项目的最近活动日志，便于同步团队动态 |

表格中的工具名称均与 MCP 客户端调用时的 `tool` 字段一致，可根据实际需求组合使用。

---

## 🛠️ 开发指南

- **代码风格**：使用 ESLint + Prettier  
- **测试框架**：Jest（可选）  
- **接口校验**：使用 `zod` 定义 MCP 工具参数 Schema  
- **错误处理**：统一返回 JSON-RPC 错误码（INVALID_ARGUMENT / UNAVAILABLE / INTERNAL 等）  

---

## 📜 License
本项目基于 **Apache License 2.0** 开源。  
详细内容请见 [LICENSE](./LICENSE) 文件。  

---

## 🤝 贡献
欢迎提交 Pull Request 或 Issue！  
- 新增功能时请包含测试用例  
- 确保 `npm run lint && npm run test` 通过  

---

## 🔮 未来计划
- [ ] 支持 Backlog Webhook → MCP Notification  
- [ ] 更细粒度的任务状态流转（自定义工作流）  
- [ ] 支持 Git/SVN 仓库操作  
- [ ] Docker 镜像发布  
