# Task Execution Workflow

This repo should move through small, ticket-driven Codex work.

## Rules
- One Linear issue equals one branch and one pull request.
- Every issue must go through plan-only first before implementation.
- Do not combine unrelated issues into one branch.
- Do not mark Linear issues Done unless the repo proves the work is complete.
- Update ROADMAP.md when a task is completed or when new gaps are discovered.
- Keep app behavior unchanged unless the issue explicitly scopes a behavior change.

## Branch Naming
Use the Recommended Branch Name from linear-export/issues.json, for example:

```
codex/ppp-sec-001-remove-tracked-local-env-files-and-document-credi
```

## Plan Files
When a task needs a durable plan, create:

```
tasks/<TASK-ID>/plan.md
```

The plan should include scope, non-goals, acceptance tests, validation commands, and rollback notes where relevant.

## Implementation Summary Files
After implementation, create or update:

```
tasks/<TASK-ID>/implementation-summary.md
```

Include changed files, commands run, results, remaining risks, and the Linear status update to post.

## Linear And Roadmap Updates
- Move the issue to Planning when writing a plan.
- Move it to Plan Approved only after the plan is accepted.
- Move it to In Progress only when implementation starts.
- Move it to In Review when a PR is ready.
- Move it to Done only after validation passes and the PR is merged or otherwise accepted.
- Update ROADMAP.md if the task closes a roadmap gap or reveals a new one.
