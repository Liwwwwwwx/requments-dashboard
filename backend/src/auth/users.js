"use strict";
const bcrypt = require("bcryptjs");
const { query } = require("../postgres");

const asUser = (row) => row && ({ id: row.id, username: row.username, password_hash: row.password_hash, role: row.role || "member", display_name: row.display_name, created_at: row.created_at });

function initUsers() {
  return {
    async findByUsername(username) { const result = await query("SELECT id,username,password_hash,role,display_name,created_at FROM users WHERE username=$1", [username]); return asUser(result.rows[0]); },
    async findById(id) { const result = await query("SELECT id,username,password_hash,role,display_name,created_at FROM users WHERE id=$1", [id]); return asUser(result.rows[0]); },
    verifyPassword(user, password) { return bcrypt.compareSync(password, user.password_hash); },
    async create({ username, password, displayName }) { const id=`u-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; const name=String(username||"").trim(); const display=String(displayName||"").trim()||name; await query("INSERT INTO users (id,username,password_hash,role,display_name) VALUES ($1,$2,$3,'member',$4)",[id,name,bcrypt.hashSync(password,12),display]); return this.findById(id); }
  };
}
module.exports={initUsers};
