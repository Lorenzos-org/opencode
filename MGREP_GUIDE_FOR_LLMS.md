# 🔍 mgrep Complete Guide for LLMs

## ⚠️ **CRITICAL: Repository Safety Configuration**

### **Git Remote Setup (MANDATORY - Do Not Change)**

This repository uses a **forked workflow** with strict safety measures:

```bash
# Current remote configuration (DO NOT MODIFY):
$ git remote -v
origin	https://github.com/Lorenzos-org/opencode.git (fetch)
origin	https://github.com/Lorenzos-org/opencode.git (push)    # ← SAFE TO PUSH HERE
upstream	https://github.com/sst/opencode.git (fetch)        # ← ONLY FETCH FROM HERE
upstream	no-pushing-allowed (push)                         # ← PUSH BLOCKED FOR SAFETY
```

### **🚨 ABSOLUTE RULES:**

1. **✅ PUSH ONLY TO**: `origin` (Lorenzos-org/opencode) - your private fork
2. **✅ FETCH ONLY FROM**: `upstream` (sst/opencode) - original repository
3. **❌ NEVER PUSH TO**: `upstream` (sst/opencode) - will fail with "no-pushing-allowed"
4. **❌ NEVER COMMIT DIRECTLY TO**: `sst/opencode` upstream repository

### **🛡️ Safety Measures:**

- **Push URL blocked**: Upstream push URL is set to invalid value
- **Fork-only workflow**: All changes go through private fork first
- **No direct upstream access**: Prevents accidental upstream modifications

### **📋 Workflow:**

```bash
# ✅ Safe operations:
git push origin dev                    # Push to your fork
git fetch upstream                     # Get upstream updates
git pull upstream dev                  # Merge upstream changes

# ❌ Blocked operations (will fail):
git push upstream dev                  # ❌ BLOCKED - push to upstream
```

---

## What is mgrep?

**mgrep** (Mixedbread grep) is a semantic search tool that allows you to search through your codebase using natural language queries instead of traditional regex patterns. It's designed as an AI-powered complement to traditional `grep`, offering:

- **Semantic Search**: Understands intent and meaning, not just exact text matches
- **Natural Language Queries**: Ask questions like "how does authentication work?" instead of writing regex
- **AI-Powered Answers**: Can generate explanations based on search results
- **Multi-Modal**: Works with code, PDFs, images, and other file types
- **MCP Integration**: Can serve as a Model Context Protocol server for AI agents

## 🚀 Quick Start (3 Steps)

### Step 1: Install mgrep

```bash
npm install -g @mixedbread/mgrep
```

### Step 2: Authenticate

```bash
mgrep login
```

Follow the browser link to authenticate with Mixedbread platform.

### Step 3: Search Your Codebase

```bash
cd your-project-directory
mgrep search "how does authentication work"
```

## 📋 Complete Setup Guide

### 1. Installation

#### Global Installation (Recommended)

```bash
npm install -g @mixedbread/mgrep
```

#### Verify Installation

```bash
mgrep --version
mgrep --help
```

### 2. Authentication

#### Login to Mixedbread Platform

```bash
mgrep login
```

This will:

1. Open your browser to the Mixedbread authentication page
2. Prompt you to enter a device code
3. Complete OAuth authentication

#### Alternative: API Key Authentication

If you have a Mixedbread API key:

```bash
export MXBAI_API_KEY=your_api_key_here
```

#### Check Authentication Status

```bash
# Try a search - if it works, you're authenticated
mgrep search "test" -m 1
```

### 3. Basic Usage

#### Simple Search

```bash
mgrep search "authentication logic"
```

#### Search with Result Limit

```bash
mgrep search "database queries" -m 5
```

#### Search in Specific Directory

```bash
mgrep search "error handling" ./src
```

#### Case-Insensitive Search

```bash
mgrep search "OPENCODE" -i
```

#### Recursive Search

```bash
mgrep search "export" -r
```

#### Show Content in Results

```bash
mgrep search "typescript config" -c
```

## 🎯 Advanced Features

### AI-Powered Answer Generation

```bash
mgrep search "how does the authentication system work" -a
```

This generates an AI-powered explanation based on the search results, including citations.

### Sync Before Search

```bash
mgrep search "new features" -s
```

Forces a sync of your local files to the mgrep index before searching.

### Dry Run Mode

```bash
mgrep search "test query" -d
```

Shows what would be searched without actually performing the search.

### Disable Reranking

```bash
mgrep search "specific pattern" --no-rerank
```

Returns results in original order without AI reranking.

## 🔧 File Watching & Indexing

### Start File Watcher

```bash
mgrep watch
```

This continuously monitors your directory for file changes and automatically syncs them to the mgrep index.

### Dry Run Watch

```bash
mgrep watch --dry-run
```

Shows what files would be indexed without actually uploading them.

## 🤖 MCP Server Mode

### Start MCP Server

```bash
mgrep mcp
```

This starts mgrep as a Model Context Protocol server, allowing AI agents to use mgrep's search capabilities.

### Default MCP Configuration

- Port: 3000 (configurable)
- Provides semantic search tools to connected AI agents

## 🛠️ Integration Options

### OpenCode Integration

```bash
mgrep install-opencode
```

Integrates mgrep as a tool in the OpenCode agent system.

### Claude Code Integration

```bash
mgrep install-claude-code
```

Adds mgrep as a tool in Claude Code.

### Codex Integration

```bash
mgrep install-codex
```

Integrates with GitHub Copilot's Codex system.

### Factory Droid Integration

```bash
mgrep install-droid
```

Adds mgrep hooks and skills to Factory Droid.

## 📊 Organization Management

### Switch Organizations

```bash
mgrep switch-org
```

Allows you to switch between different Mixedbread organizations.

### Logout

```bash
mgrep logout
```

Removes stored authentication tokens.

## 🔍 Search Examples

### Code Understanding

```bash
# How does a specific feature work?
mgrep search "how does user registration work" -a

# Find configuration patterns
mgrep search "environment variable setup"

# Locate error handling
mgrep search "error handling patterns" -m 10
```

### Architecture Exploration

```bash
# Find database interactions
mgrep search "database connection" -c

# Locate API endpoints
mgrep search "API routes" -r

# Find authentication logic
mgrep search "JWT token validation"
```

### Debugging & Troubleshooting

```bash
# Find logging statements
mgrep search "console.log" -i

# Locate TODO comments
mgrep search "TODO|FIXME|BUG"

# Find deprecated code
mgrep search "deprecated" -i
```

## 🚨 Troubleshooting

### "No authentication token found"

**Solution**: Run `mgrep login` or set `MXBAI_API_KEY` environment variable.

### "No results found"

**Possible causes**:

1. Files not indexed: Run `mgrep watch` first
2. Query too specific: Try broader terms
3. Wrong directory: Check current working directory

### "Quota exceeded"

**Solution**: Upgrade your Mixedbread plan or wait for quota reset.

### "Connection failed"

**Possible causes**:

1. Network issues: Check internet connection
2. API key expired: Re-run `mgrep login`
3. Firewall blocking: Ensure ports 80/443 are open

### "Command not found"

**Solution**: Ensure mgrep is installed globally with `npm install -g @mixedbread/mgrep`

## 📈 Best Practices

### Query Writing

- **Be specific but natural**: "how does user login work" vs "login"
- **Use questions**: "what is the database schema" works better than "schema"
- **Include context**: "authentication in the API routes" vs just "authentication"

### Performance

- **Limit results**: Use `-m` flag to avoid overwhelming output
- **Use specific paths**: Search in `./src` instead of entire project when possible
- **Sync strategically**: Use `-s` flag only when you know files have changed

### Integration

- **Set up watching**: Run `mgrep watch` in background for automatic indexing
- **Use MCP mode**: For AI agent integration, prefer `mgrep mcp`
- **Automate authentication**: Set `MXBAI_API_KEY` in CI/CD environments

## 🔧 Configuration

### Environment Variables

```bash
# API Key (alternative to login)
export MXBAI_API_KEY=your_key_here

# Store name (default: "mgrep")
export MGREP_STORE=my_store

# Development mode
export MGREP_IS_TEST=1
```

### Store Management

- Default store: `mgrep`
- Custom stores: Use `--store` flag or `MGREP_STORE` env var
- Multiple stores: Useful for different projects/organizations

## 📚 API Reference

### Search Command

```bash
mgrep search [options] <pattern> [path]

Options:
  -i, --case-insensitive    Case insensitive search
  -r, --recursive          Recursive search
  -m, --max-count <n>      Maximum results (default: 10)
  -c, --content           Show file content
  -a, --answer            Generate AI answer
  -s, --sync              Sync before search
  -d, --dry-run           Dry run mode
  --no-rerank             Disable reranking
```

### Watch Command

```bash
mgrep watch [options]

Options:
  -d, --dry-run           Show what would be indexed
```

### MCP Command

```bash
mgrep mcp [options]
# Starts MCP server on port 3000
```

### Authentication Commands

```bash
mgrep login              # Interactive login
mgrep logout             # Remove stored tokens
mgrep switch-org         # Switch organizations
```

### Integration Commands

```bash
mgrep install-opencode    # OpenCode integration
mgrep install-claude-code # Claude Code integration
mgrep install-codex       # Codex integration
mgrep install-droid       # Factory Droid integration
```

## 🎯 Use Cases

### For Code Understanding

- **New team member onboarding**: "how does the build system work"
- **Architecture documentation**: "what are the main components"
- **Feature exploration**: "where is user profile management"

### For Debugging

- **Error investigation**: "where are exceptions logged"
- **Configuration issues**: "how is database connection configured"
- **Performance problems**: "where are slow queries"

### For Development

- **Code reuse**: "existing implementations of file upload"
- **Pattern discovery**: "how do we handle API responses"
- **Refactoring**: "unused imports or functions"

### For AI Integration

- **Context provision**: MCP server provides semantic search to AI assistants
- **Code explanation**: AI can ask mgrep for code understanding
- **Documentation generation**: Use search results to build docs

## 🚀 Getting Help

### Built-in Help

```bash
mgrep --help                    # General help
mgrep search --help            # Search command help
mgrep watch --help             # Watch command help
mgrep mcp --help               # MCP command help
```

### Community Resources

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check Mixedbread platform docs
- **Discord**: Join the Mixedbread community

---

## 🎉 Quick Reference

```bash
# Install & Setup
npm install -g @mixedbread/mgrep
mgrep login

# Basic Usage
mgrep search "your query here"
mgrep search "question?" -a          # With AI answer
mgrep search "pattern" -m 5 -c       # Limited results with content

# Advanced Usage
mgrep watch                         # Start file watcher
mgrep mcp                           # Start MCP server
mgrep search "query" -s             # Sync before search

# Integrations
mgrep install-opencode              # OpenCode integration
mgrep install-claude-code           # Claude Code integration
```

**Remember**: mgrep understands natural language! Ask questions like a human would, and it will find relevant code for you.
