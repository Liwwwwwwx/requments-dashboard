"use strict";

const { query } = require("../postgres");

const now = () => Date.now();
const id = (prefix) => `${prefix}-${now()}-${Math.random().toString(36).slice(2, 8)}`;
const conversation = (row) => row && ({ id: row.id, userId: row.user_id, projectId: row.project_id, requirementId: row.requirement_id, title: row.title, model: row.model, accountId: row.account_id, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at) });
const message = (row) => row && ({ id: row.id, conversationId: row.conversation_id, role: row.role, content: row.content, toolCalls: row.tool_calls, tokensIn: row.tokens_in, tokensOut: row.tokens_out, ts: Number(row.ts) });
const proposal = (row) => row && ({ id: row.id, conversationId: row.conversation_id, messageId: row.message_id, events: row.events_json || [], status: row.status, appliedAt: row.applied_at && Number(row.applied_at), appliedBy: row.applied_by, createdAt: Number(row.created_at) });

function autoTitleFromText(text) { const value = String(text || "").trim().replace(/\s+/g, " "); return !value ? null : value.length <= 30 ? value : `${value.slice(0, 30)}…`; }

async function createConversation(_root, projectId, input) {
  const row = { id: input.id || id("CONV"), userId: String(input.userId), projectId, requirementId: input.requirementId || null, title: input.title || null, model: input.model || "deepseek-chat", accountId: input.accountId || null, createdAt: now(), updatedAt: now() };
  await query("INSERT INTO ai_conversations (id,user_id,project_id,requirement_id,title,model,account_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [row.id,row.userId,row.projectId,row.requirementId,row.title,row.model,row.accountId,row.createdAt,row.updatedAt]);
  return { ...row };
}
async function getConversation(_root, projectId, conversationId) { const r = await query("SELECT * FROM ai_conversations WHERE id=$1 AND project_id=$2", [conversationId,projectId]); return conversation(r.rows[0]); }
async function listConversations(_root, projectId, { userId, limit = 50 } = {}) { const r = await query(userId ? "SELECT * FROM ai_conversations WHERE project_id=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT $3" : "SELECT * FROM ai_conversations WHERE project_id=$1 ORDER BY updated_at DESC LIMIT $2", userId ? [projectId,userId,limit] : [projectId,limit]); return r.rows.map(conversation); }
async function touchConversation(_root, projectId, conversationId) { await query("UPDATE ai_conversations SET updated_at=$3 WHERE id=$1 AND project_id=$2", [conversationId,projectId,now()]); }
async function setConversationTitleIfEmpty(_root, projectId, conversationId, title) { if (!title) return false; const r = await query("UPDATE ai_conversations SET title=$3,updated_at=$4 WHERE id=$1 AND project_id=$2 AND (title IS NULL OR title='')", [conversationId,projectId,title,now()]); return r.rowCount > 0; }
async function renameConversation(_root, projectId, conversationId, title) { const value=String(title||"").trim(); if (!value) throw new Error("TITLE_EMPTY"); const r=await query("UPDATE ai_conversations SET title=$3,updated_at=$4 WHERE id=$1 AND project_id=$2",[conversationId,projectId,value,now()]); return r.rowCount>0; }
async function findDuplicateTitle(_root, projectId, title, excludeId, userId) { const r=await query("SELECT id,title FROM ai_conversations WHERE project_id=$1 AND user_id=$2 AND id != COALESCE($3,'') AND lower(trim(title))=$4 LIMIT 1",[projectId,userId,excludeId,String(title||"").trim().toLowerCase()]); return r.rows[0]||null; }
async function deleteConversation(_root, projectId, conversationId) { const r=await query("DELETE FROM ai_conversations WHERE id=$1 AND project_id=$2",[conversationId,projectId]); return { conversations:r.rowCount, messages:0, proposals:0 }; }
async function appendMessage(_root, _project, input) { const row={id:input.id||id("MSG"),conversationId:String(input.conversationId),role:String(input.role),content:String(input.content||""),toolCalls:input.toolCalls||null,tokensIn:Number(input.tokensIn)||0,tokensOut:Number(input.tokensOut)||0,ts:input.ts||now()}; await query("INSERT INTO ai_messages (id,conversation_id,role,content,tool_calls,tokens_in,tokens_out,ts) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)",[row.id,row.conversationId,row.role,row.content,row.toolCalls?JSON.stringify(row.toolCalls):null,row.tokensIn,row.tokensOut,row.ts]); return row; }
async function updateMessageContent(_root,_project,messageId,patch) { const r=await query("UPDATE ai_messages SET content=COALESCE($2,content),tokens_in=COALESCE($3,tokens_in),tokens_out=COALESCE($4,tokens_out),tool_calls=COALESCE($5::jsonb,tool_calls) WHERE id=$1 RETURNING *",[messageId,patch.content===undefined?null:String(patch.content),patch.tokensIn===undefined?null:Number(patch.tokensIn),patch.tokensOut===undefined?null:Number(patch.tokensOut),patch.toolCalls?JSON.stringify(patch.toolCalls):null]); return message(r.rows[0]); }
async function listMessages(_root,_project,conversationId) { const r=await query("SELECT * FROM ai_messages WHERE conversation_id=$1 ORDER BY ts,id",[conversationId]); return r.rows.map(message); }
async function createProposal(_root,_project,input) { const row={id:input.id||id("PROP"),conversationId:String(input.conversationId),messageId:String(input.messageId),events:input.events||[],status:"pending",createdAt:now()}; await query("INSERT INTO ai_proposals (id,conversation_id,message_id,events_json,status,created_at) VALUES ($1,$2,$3,$4::jsonb,$5,$6)",[row.id,row.conversationId,row.messageId,JSON.stringify(row.events),row.status,row.createdAt]); return row; }
async function getProposal(_root,_project,proposalId) { const r=await query("SELECT * FROM ai_proposals WHERE id=$1",[proposalId]); return proposal(r.rows[0]); }
async function listProposals(_root,_project,conversationId) { const r=await query("SELECT * FROM ai_proposals WHERE conversation_id=$1 ORDER BY created_at,id",[conversationId]); return r.rows.map(proposal); }
async function markProposalApplied(_root,_project,proposalId,userId) { await query("UPDATE ai_proposals SET status='applied',applied_at=$2,applied_by=$3 WHERE id=$1",[proposalId,now(),String(userId)]); }

module.exports={createConversation,getConversation,listConversations,touchConversation,autoTitleFromText,setConversationTitleIfEmpty,renameConversation,findDuplicateTitle,deleteConversation,appendMessage,updateMessageContent,listMessages,createProposal,getProposal,listProposals,markProposalApplied};
