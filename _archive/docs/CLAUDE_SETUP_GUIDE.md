# Claude Code Setup Guide for Cursor Terminal

## Prerequisites
- Mac, Linux, or Windows with WSL
- Node.js 18+ installed
- Active Anthropic API account

## Installation Steps

### 1. Install Claude Code CLI

Open Cursor's integrated terminal (`` Ctrl+` `` or `Cmd+` on Mac) and run:

```bash
npm install -g @anthropic-ai/claude-code
```

Or using Homebrew (Mac/Linux):

```bash
brew install anthropic/tap/claude-code
```

### 2. Get Your Anthropic API Key

1. Go to: https://console.anthropic.com/
2. Sign in or create an account
3. Navigate to **Settings** → **API Keys**
4. Click **"Create Key"**
5. Copy the API key (starts with `sk-ant-...`)
6. **Important**: Save this key securely - you won't be able to see it again!

### 3. Configure Claude Code

Run the setup command:

```bash
claude configure
```

When prompted:
1. Paste your API key
2. Choose your preferred model (recommend: `claude-sonnet-4-5` for best performance)
3. Set your default working directory (optional)

### 4. Verify Installation

Test that Claude is working:

```bash
claude --version
```

Should display version number.

Try a simple query:

```bash
claude "What is 2+2?"
```

Should return `4`.

## Using Claude in Cursor Terminal

### Basic Usage

**Interactive conversation mode:**
```bash
claude
```
Type your questions, press Enter. Type `exit` to quit.

**Single command:**
```bash
claude "Your question here"
```

**Work on files:**
```bash
claude "Add error handling to src/utils/api.ts"
```

### Common Commands

**Help:**
```bash
claude --help
```

**Change model:**
```bash
claude --model claude-opus-4
```

**Set context from files:**
```bash
claude --file package.json "What dependencies do we have?"
```

**Continue previous conversation:**
```bash
claude --continue
```

## Best Practices for This Project

### 1. Always Work from Project Root

```bash
cd /path/to/perf-spotlight-portal
claude
```

### 2. Be Specific with File Paths

```bash
claude "Update the ZIP dashboard at src/pages/ZipDashboard.tsx to add a new filter"
```

### 3. Ask for Multiple Changes at Once

```bash
claude "Add bulk assignment feature to ZIP dashboard:
1. Create BulkZipAssignmentModal component
2. Add button to ZipDashboard header
3. Implement bulk update function"
```

### 4. Review Changes Before Committing

Claude will modify files directly. Always review with:

```bash
git diff
```

### 5. Use Context-Aware Commands

```bash
# Good - gives context
claude "Fix the TypeScript error in StateLeadsAnalytics component where month prop is undefined"

# Less helpful - too vague
claude "Fix the error"
```

## Project-Specific Tips

### Working with Our Tech Stack

**Supabase queries:**
```bash
claude "Add a new query to fetch client leads from Supabase in ClientPortalPage.tsx"
```

**React components:**
```bash
claude "Create a new modal component for editing client settings with TypeScript types"
```

**Database migrations:**
```bash
claude "Create a migration to add a new column 'agency_tier' to client_registry table"
```

### Common Tasks

**Fix TypeScript errors:**
```bash
claude "Fix all TypeScript errors in src/components/"
```

**Add new feature:**
```bash
claude "Add a CSV export button to the Contact Pipeline Dashboard"
```

**Debug issue:**
```bash
claude "The map on ZIP dashboard isn't loading. Check ZipChoroplethMap.tsx and fix the issue"
```

**Update dependencies:**
```bash
claude "Update all dependencies in package.json to their latest versions"
```

## Environment Setup

### Important Files to Know

- **`.env`** - Environment variables (NEVER commit this!)
- **`src/integrations/supabase/client.ts`** - Supabase configuration
- **`supabase/migrations/`** - Database schema changes
- **`src/pages/`** - Main dashboard pages
- **`src/components/`** - Reusable React components

### Environment Variables Needed

Create `.env` file (if not exists):

```env
VITE_SUPABASE_URL=https://gjqbbgrfhijescaouqkx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Ask team lead for actual values.

## Troubleshooting

### "Command not found: claude"

**Solution:**
```bash
npm install -g @anthropic-ai/claude-code
```

Or add to PATH:
```bash
export PATH="$PATH:$HOME/.npm-global/bin"
```

### "Authentication failed"

**Solution:**
```bash
claude configure
```
Re-enter your API key.

### "Rate limit exceeded"

**Solution:**
- Wait 1 minute and try again
- Check your API usage at https://console.anthropic.com/
- Upgrade your plan if needed

### Claude modifies wrong files

**Solution:**
1. Be more specific with file paths
2. Use git to revert: `git checkout -- path/to/file`
3. Review changes before continuing

### "Cannot read property of undefined"

**Solution:**
```bash
# Clear Claude's cache
rm -rf ~/.claude/cache
claude configure
```

## Git Workflow with Claude

### Before Starting Work

```bash
git pull                    # Get latest changes
git checkout -b feature/your-feature-name
claude "Start working on [feature]"
```

### During Development

```bash
# Make changes with Claude
claude "Add [feature]"

# Review changes
git diff

# Test locally
npm run dev
```

### After Completing Work

```bash
# Stage changes
git add .

# Let Claude write commit message
claude "Write a commit message for these changes" --file <(git diff --staged)

# Or write manually
git commit -m "feat: your feature description"

# Push to GitHub
git push origin feature/your-feature-name
```

## Getting Help

### In This Project

1. **Check documentation**: Look in `docs/` folder
2. **Ask Claude**: `claude "How do I [task] in this project?"`
3. **Ask team lead**: @tommy for architecture questions

### Claude Code Issues

- GitHub Issues: https://github.com/anthropics/claude-code/issues
- Documentation: https://docs.claude.com/en/docs/claude-code

### Anthropic API Issues

- Status page: https://status.anthropic.com/
- Support: https://console.anthropic.com/support

## Quick Reference Card

```bash
# Start Claude
claude

# Run single command
claude "your question"

# Work on file
claude "fix bug in src/app.tsx"

# Get help
claude --help

# Check version
claude --version

# Configure
claude configure

# Continue conversation
claude --continue

# Use specific model
claude --model claude-opus-4

# Exit interactive mode
exit
```

## Security Notes

### ⚠️ Important Security Rules

1. **NEVER commit API keys** to git
2. **NEVER share API keys** in Slack or email
3. **NEVER include `.env`** in git (it's in `.gitignore`)
4. **ALWAYS review code** before committing
5. **USE environment variables** for sensitive data

### What Claude Can Access

✅ Claude can:
- Read files in your project
- Modify files you specify
- Run terminal commands
- Search the internet (when needed)

❌ Claude cannot:
- Access files outside project directory (without permission)
- Make git commits (you must do this)
- Access production databases directly
- Share your conversations

---

## Next Steps

1. ✅ Install Claude Code CLI
2. ✅ Configure with API key
3. ✅ Test with simple command
4. ✅ Clone project repository
5. ✅ Try editing a file with Claude
6. ✅ Review and commit changes
7. 🎉 Start building!

**Questions?** Ask in team Slack or ping @tommy

---

*Last updated: October 2025*
*For project: Performance Spotlight Portal*
