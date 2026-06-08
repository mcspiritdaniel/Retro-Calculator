# Push changes to GitHub

```bash
# 1. Go to the project
cd "/Users/danmcspirit/Library/CloudStorage/OneDrive-Personal/Cursor/retro-calculator"

# 2. See what changed (optional)
git status
git diff --stat

# 3. Stage files
git add .                    # everything changed
# git add path/to/file.ts    # or specific files only

# 4. Commit (edit the message each time)
git commit -m "$(cat <<'EOF'
Short summary of why you made the change.

EOF
)"

# 5. Push to GitHub
git push origin main
```

## Remote (after repo rename)

Repo: **https://github.com/mcspiritdaniel/rpn-financial-calculator**

Set the remote once per machine (or if `git push` fails):

```bash
git remote set-url origin https://github.com/mcspiritdaniel/rpn-financial-calculator.git
git remote -v   # confirm
```

## Quick checks

| Situation | Command |
|-----------|---------|
| Branch name | `git branch` |
| Unpushed commits | `git status` (look for "ahead of origin") |
| Recent commits | `git log -5 --oneline` |
| Undo staged files | `git restore --staged .` |
| Discard local edits | `git restore .` (careful) |

## Commit message tips

- One line is enough for small fixes.
- Say **why**, not only what — e.g. "Add STO ± register arithmetic for running balances."
- Do not reuse an old message like "Design Changes" for unrelated work.

## After push

- Vercel usually redeploys from `main` automatically.
- Site: **https://rpn-financial-calculator.vercel.app** (old URL redirects if redirect was enabled in Vercel).
