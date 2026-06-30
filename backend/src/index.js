"use strict";

const express = require("express");
const cors = require("cors");
const { createRoutes } = require("./routes");
const { errorMiddleware } = require("./errors");

const ROOT = process.env.REQUIREMENTS_ROOT || require("path").resolve(__dirname, "..", "..");
const HOST = process.env.REQUIREMENTS_HOST || "127.0.0.1";
const PORT = Number(process.env.REQUIREMENTS_PORT || 4315);

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", createRoutes(ROOT));
app.use(errorMiddleware());

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Requirements board backend listening at http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`  data dir: ${require("path").join(ROOT, "data")}`);
});