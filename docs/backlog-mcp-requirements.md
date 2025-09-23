# Backlog MCP Server 需求说明

## 1. 背景与目标
Backlog 提供了 REST API，但未支持 MCP（Model Context Protocol）。  
为了让 Codex CLI 或其他 MCP 客户端能够直接操作 Backlog，需要开发一个 MCP Server 作为适配层。

**目标：**
- 将 Backlog 的 REST API 封装为 MCP Server。
- 提供标准化的 **增删改查** 功能接口。
- 支持 Codex CLI 等 MCP 客户端调用，实现从任务到需求整理，再到开发流程自动化。

---

## 2. 功能需求（CRUD 分组）

### 增（Create）
- **createIssue**：新建任务（项目、类型、优先级、负责人、截止日期、描述）。
- **addComment**：为指定任务新增评论（支持 Markdown）。
- **uploadAttachment**：上传附件并关联到任务（Base64 或 multipart）。
- **createWiki**（可选）：新建 Wiki 页面（项目、标题、正文）。

### 查（Read）
- **listIssues**：按项目、状态、负责人、关键词筛选任务（分页）。
- **getIssue**：查看任务详情（含描述、最近评论）。
- **listComments**：获取任务下的评论（分页）。
- **searchWiki**：搜索 Wiki 页面（按项目、关键词）。
- **getWiki**：查看 Wiki 详情（正文、历史版本）。
- **getActivities**：获取项目活动流（任务、评论、Wiki、附件变更）。
- **listProjects**：列出可访问的项目（含 projectKey、ID）。
- **listUsers**：获取用户列表（支持过滤项目成员）。

### 改（Update）
- **updateIssue**：更新任务属性（标题、描述、优先级、截止日期、负责人等）。
- **transitionIssue**：修改任务状态（Open → InProgress → Resolved → Closed）。
- **updateComment**：编辑评论内容。
- **updateWiki**：编辑 Wiki 页面正文、标题。

### 删（Delete）
- **deleteIssue**：删除任务。
- **deleteComment**：删除评论。
- **deleteAttachment**：删除任务附件。
- **deleteWiki**：删除 Wiki 页面。

---

## 3. 技术规范

- **协议**：MCP（基于 JSON-RPC 2.0）
- **传输方式**：Stdio（默认），可扩展 HTTP/WebSocket
- **鉴权**：Backlog API Key（Header 或 query 参数）
- **Schema**：所有工具参数与返回值使用 **JSON Schema** 定义
- **分页**：统一使用 `count + offset`，返回 `nextOffset`
- **错误处理**：
  - `INVALID_ARGUMENT`：参数错误
  - `UNAUTHENTICATED`：API Key 失效
  - `PERMISSION_DENIED`：权限不足
  - `UNAVAILABLE`：限流 (429)
  - `INTERNAL`：Backlog 服务错误 (5xx)

---

## 4. 非功能需求

- **可扩展性**：预留 Git/SVN 仓库、文件、空间设置等扩展点。
- **安全性**：使用最小权限 API Key；日志脱敏处理。
- **可观测性**：每次调用记录 requestId、耗时、状态码。
- **容错性**：遇到 429/网络错误时，支持退避重试。

---

## 5. 未来扩展

- 支持 **Webhook → MCP Notification**，实现事件驱动（票据更新/评论通知）。
- 增加 **测试工具**：如导出测试报告到 Backlog 票。
- 集成 **Git MCP**，形成从 Backlog → 需求 → 开发 → Commit → MR 的闭环。

---
