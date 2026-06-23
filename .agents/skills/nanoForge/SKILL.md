---
name: nanoForge
description: Use when approaching any coding task - assess scope, choose strategy, analyze code for modification points, interact with user, and execute with appropriate discipline.
---

# NanoForge

A lightweight meta-skill for any coding task. Four phases: **Assess → Analyze → Strategy → Execute**.

---

## 1. Task Assessment — Size & Risk

Classify the task immediately. This drives everything downstream.

| Size | Scope | Typical Effort | Approach |
|------|-------|---------------|----------|
| **XS** | Single line/function, 1 file | <1 min | Direct edit, no plan |
| **S** | One component/logic unit, 1-2 files | 1-5 min | Brief mental plan, execute |
| **M** | Feature slice, 3-5 files | 5-15 min | Write plan, TDD if logic-heavy |
| **L** | Multi-component feature, 5-8 files | 15-60 min | Formal plan + subagent or checkpoint |
| **XL** | Cross-cutting change, 8+ files | 60+ min | Break down into L tasks |

**Risk modifier**: If the change touches production data, auth, security, or a public API, move up one size level.

**Trivial rule**: For XS tasks, just do it. No ceremony. Use judgment.

---

## 2. Code Analysis — Finding What to Change

Before writing code, trace the request to the actual modification points.

### Trace Path
1. **Start from the user request** — what behavior changes?
2. **Find the entry point** — route handler, event listener, CLI command, function call
3. **Trace the data flow** — input → transform → output
4. **Identify impact scope** — which files touch this flow?
5. **Check for side effects** — does this change affect other callers?

### Analysis Checklist
- Read the relevant file(s) first. Never assume.
- Search for existing tests to understand expected behavior.
- Check for similar patterns already in the codebase — consistency matters.
- Identify the minimal change path: what is the fewest lines that achieves the goal?

**If debugging**: reproduce the issue first, then find the root cause (not just the symptom). Isolate the minimal reproducer before fixing.

---

## 3. Strategy Selection — How to Code

Choose a mode based on task size and risk.

| Condition | Mode | What to Do |
|-----------|------|-----------|
| XS-S, obvious fix | **Direct** | Edit, verify, done |
| S-M, clear spec | **Plan → Execute** | Outline steps, implement sequentially, verify each |
| M, logic-heavy | **TDD** | Red → Green → Refactor per unit |
| M-L, risky | **Incremental slices** | Thin vertical slice → test → verify → commit → next |
| L-XL, multi-part | **Subagent / Checkpoint** | Split into independent tasks, dispatch or checkpoint after each |
| Decision uncertainty | **Doubt-driven** | Propose 2-3 approaches with trade-offs, get user sign-off |
| Bug | **Investigate → Fix → Verify** | Reproduce → root cause → fix with test → verify fix works |

### Core principles (any mode)
- **Surgical changes**: change only what the task requires. No scope creep.
- **Simplicity first**: choose the simplest design that works. Avoid premature abstraction.
- **Evidence over claims**: run the code, read the output, verify before saying "done".
- **Fail fast**: if an approach isn't working after a reasonable try, surface it — don't dig deeper silently.

---

## 4. User Interaction Protocol

### Before coding (S+ tasks)
- For ambiguous requests: ask **one question at a time**, starting with the most important unknown.
- For M+ tasks: present 2-3 approaches with trade-offs and your recommendation.
- For L+ tasks: present the plan or spec in sections, get sign-off on each before proceeding.

### During coding
- For multi-step work: show progress after each logical step.
- When stuck: state what you tried, what happened, and what you think the options are.
- Status vocabulary:
  - `DONE` — task complete, verified
  - `DONE_WITH_CONCERNS` — complete but has caveats to discuss
  - `BLOCKED` — cannot proceed without user input
  - `NEEDS_CLARIFICATION` — requirements ambiguous

### After coding
- Summarize what changed, why, and any decisions made.
- For non-trivial changes: ask if the user wants a review before moving on.
- For L+ tasks: present merge options (merge / squash / PR / discard).

---

## 5. Execution Discipline

### For every change
- **XS**: edit, run if applicable, move on
- **S**: edit, build/run, verify expected output, move on
- **M**: write/modify test → code → build → test pass → commit
- **L**: as M, but each increment is independently verified before the next
- **XL**: as L, broken into sub-tasks with explicit checkpoints

### Verification gates (always)
1. **Build/type-check passes** — no new errors
2. **Existing tests still pass** — no regressions
3. **Lint/style consistent** — matches project conventions
4. **New code does what was asked** — manually or via test evidence
5. **No unrelated changes** — diff shows only what the task requires

### If verification fails
- Read the error message first. Don't guess.
- Fix the root cause, not the symptom.
- Re-run verification. Repeat until green.

---

## Quick Reference

```
Task comes in
  → Size it (XS/S/M/L/XL + risk)
  → Read relevant code
  → Choose strategy (Direct/Plan/TDD/Incremental/Subagent)
  → Interact (ask questions → propose options → get sign-off)
  → Execute with discipline
  → Verify (build + test + lint + behavior)
  → Report done
```

**If unsure at any point: ask. One question at a time.**
