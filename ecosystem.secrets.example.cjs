module.exports = {
  backendEnv: {
    REQUIREMENTS_API_TOKEN: "replace-with-a-random-token",
    // API Token 必须绑定一个已有的 PostgreSQL 用户 ID，才能按项目成员权限访问数据。
    REQUIREMENTS_API_USER_ID: "replace-with-an-existing-user-id",
    DEFAULT_USERNAME: "15232780628",
    DEFAULT_PASSWORD_HASH: "$2b$10$sQCh30VeEHqQqtwELlpaNucmN8lP6au1aSkVzsn5YGWpWkjpgfGZC",
    DEFAULT_DISPLAY_NAME: "管理员"
  },
  mcpEnv: {
    // 仅远程 MCP 客户端使用；不要与 REQUIREMENTS_API_TOKEN 复用。
    MCP_ACCESS_TOKEN: "replace-with-a-second-random-token"
  }
};
