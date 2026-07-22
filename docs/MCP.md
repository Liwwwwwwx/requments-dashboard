# TraceBoard MCP（本地 stdio）

本目录提供 TraceBoard 的本地 MCP Server。它通过现有 REST API 访问项目和需求，不直接读写数据库。

## 前置环境

后端必须已启动，并设置以下环境变量：

```bash
export TRACEBOARD_BASE_URL=http://127.0.0.1:4315
export TRACEBOARD_API_TOKEN='从安全存储读取的 Token'
export TRACEBOARD_DEFAULT_PROJECT=default # 可选
```

`TRACEBOARD_API_TOKEN` 对应的服务端 `REQUIREMENTS_API_TOKEN` 必须同时配置 `REQUIREMENTS_API_USER_ID`，并绑定到有项目成员权限的真实用户。

## 启动

```bash
npm run mcp
```

stdio 协议占用标准输出；不要在该进程向 stdout 输出日志。

## 客户端配置示例

```json
{
  "mcpServers": {
    "traceboard": {
      "command": "npm",
      "args": ["run", "mcp", "--prefix", "/absolute/path/to/requirements-board"],
      "env": {
        "TRACEBOARD_BASE_URL": "http://127.0.0.1:4315",
        "TRACEBOARD_API_TOKEN": "从本机安全存储注入"
      }
    }
  }
}
```

当前提供项目与需求的增删改查、需求状态变更和备注工具。`delete_project` 会永久级联删除项目数据，`delete_requirement` 会从当前看板隐藏需求但保留删除事件；两者均要求 `confirm: true`。
