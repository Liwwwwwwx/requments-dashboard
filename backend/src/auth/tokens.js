"use strict";
const jwt = require("jsonwebtoken");

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "requirements-board-access-secret-dev";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "requirements-board-refresh-secret-dev";
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

function signAccess(user) { return jwt.sign({ sub: user.id, username: user.username, type: "access" }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES }); }
function signRefresh(user) { return jwt.sign({ sub: user.id, type: "refresh" }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES }); }
function verifyAccess(token) { return jwt.verify(token, ACCESS_SECRET); }
function verifyRefresh(token) { return jwt.verify(token, REFRESH_SECRET); }

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh, ACCESS_SECRET, REFRESH_SECRET };
