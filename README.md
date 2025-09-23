# Backlog MCP Server

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/protocol-MCP-green)](https://github.com/modelcontextprotocol)

A **Model Context Protocol (MCP) server** for [Backlog](https://backlog.com).  
With this server, you can **manage Backlog issues, comments, wikis, and attachments directly from MCP clients** such as **Codex CLI**.  

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
