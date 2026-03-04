# HealthPanel - Agent Workflow

## Automatic Execution Sequence

```
PHASE 1 (9 subtasks) ─── Sonnet 4.6 (1.1→1.9) ─── Opus 4.6 (review) ─── ✓
   │
PHASE 2 (5 subtasks) ─── Sonnet 4.6 (2.1→2.5) ─── Opus 4.6 (review) ─── ✓
   │
PHASE 3 (5 subtasks) ─── Sonnet 4.6 (3.1→3.5) ─── Opus 4.6 (review) ─── ✓
   │
PHASE 4 (6 subtasks) ─── Sonnet 4.6 (4.1→4.6) ─── Opus 4.6 (review) ─── ✓
   │
PHASE 5 (4 subtasks) ─── Sonnet 4.6 (5.1→5.4) ─── Opus 4.6 (review) ─── ✓
   │
PHASE 6 (4 subtasks) ─── Sonnet 4.6 (6.1→6.4) ─── Opus 4.6 (review) ─── ✓
   │
PHASE 7 (4 subtasks) ─── Sonnet 4.6 (7.1→7.4) ─── Opus 4.6 (review) ─── ✓
```

## Instructions for Sonnet 4.6 (subtask development)

```
1. Read .claude/md/PLAN.md in full
2. Identify the current phase and subtask
3. Develop the subtask code
4. Verify it compiles without errors (npm run build / tsc)
5. The last subtask of each phase MUST ALWAYS include tests + security
6. When ALL subtasks of the phase are done → signal ready for review
```

## Instructions for Opus 4.6 (phase review)

```
1. Read .claude/md/PLAN.md → acceptance criteria for the phase
2. Review ALL code generated in the phase
3. Verification checklist:
   ✓ No hallucinations (non-existent imports, invented APIs)
   ✓ Code compiles and is functional
   ✓ ALL acceptance criteria are met
   ✓ Consistent with monorepo architecture
   ✓ TypeORM: synchronize=false, migrations correct
   ✓ Ports configurable from .env
   ✓ Hot reload works in Docker dev
   ✓ No security vulnerabilities (OWASP)
   ✓ No hardcoded secrets
   ✓ Tests exist and are valid
4. If issues found → list corrections → modify EVERYTHING if needed → Sonnet fixes
5. If all OK → certify → advance to next phase
```

## Important Notes

- Each test subtask includes security verification
- TypeORM NEVER uses synchronize: true
- Migrations and seeders are run manually, not automatically
- Ports PORT_PANEL, PORT_API, PORT_DB are configurable
- PostgreSQL uses a Docker volume for persistence
- Hot reload active in development via volume mounts
- Node.js LTS, Next.js LTS, NestJS LTS, pnpm
- Update in PLAN.md the finished task as soon as it is finished
