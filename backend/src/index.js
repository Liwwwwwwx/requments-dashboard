"use strict";

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { createRoutes } = require("./routes");
const { errorMiddleware } = require("./errors");

const ROOT = process.env.REQUIREMENTS_ROOT || require("path").resolve(__dirname, "..", "..");
const HOST = process.env.REQUIREMENTS_HOST || "127.0.0.1";
const PORT = Number(process.env.REQUIREMENTS_PORT || 4315);

const app = express();

const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // 允许无 origin 的请求（如服务器间调用、curl、Postman 等）
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api", createRoutes(ROOT));
app.use(errorMiddleware());

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Requirements board backend listening at http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`  data dir: ${require("path").join(ROOT, "data")}`);
});