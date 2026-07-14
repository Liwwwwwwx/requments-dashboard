"use strict";

/**
 * 状态机不变量校验（极简版）。
 *
 * 只拦截「终态 → 其他」这一类不可逆转移：
 *   - requirement.done   → 任何其他状态
 *   - task.accepted      → 任何其他状态
 *
 * 中间状态（todo/doing/blocked/working/claimed/done）之间允许自由转移，
 * 这样 CLI 一次性把 task 标记为 done、UI 直接拖到 done 列都不会被拒绝。
 */

const TERMINAL_REQUIREMENT_STATUSES = new Set(["done"]);
const TERMINAL_TASK_STATUSES = new Set(["accepted"]);

function assertNotTerminal(prevStatus, nextStatus, terminalSet, scope) {
  if (!prevStatus || !nextStatus) return;
  if (prevStatus === nextStatus) return;
  if (terminalSet.has(prevStatus)) {
    throw new Error(
      `状态机非法转移 (${scope}): ${prevStatus} 是终态，不能转移到 ${nextStatus}`
    );
  }
}

function assertRequirementTransition(prev, next, requirementId) {
  assertNotTerminal(prev, next, TERMINAL_REQUIREMENT_STATUSES, `requirement ${requirementId}`);
}

function assertTaskTransition(prev, next, requirementId, taskId) {
  assertNotTerminal(prev, next, TERMINAL_TASK_STATUSES, `task ${requirementId}/${taskId}`);
}

module.exports = {
  TERMINAL_REQUIREMENT_STATUSES,
  TERMINAL_TASK_STATUSES,
  assertRequirementTransition,
  assertTaskTransition
};
