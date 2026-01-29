# SaveState — Launch Review Checklist

**Project**: SaveState — Time Machine for AI  
**Website**: https://savestate.dev  
**GitHub**: https://github.com/savestatedev/savestate  
**npm**: @savestate/cli  
**Vikunja Project ID**: 5  
**Target Review Date**: 2026-01-29  

---

## Instructions for Sub-Agent

You are tasked with completing a comprehensive launch review for SaveState. Work through each section systematically, testing everything hands-on where possible. Document your findings, noting any issues discovered.

**Your deliverables**:
1. Complete this checklist with actual test results
2. Create a summary report
3. Submit to Bear with tags `#dbh-ventures`, `#launch-review`, `#savestate`
4. Sign and timestamp
5. Report back to the main session

---

## 1. 🎯 Specification Verification

### 1.1 Reference Documents

- **CONCEPT.md**: `/Users/steve/Git/savestate/CONCEPT.md`
- **README.md**: `/Users/steve/Git/savestate/README.md`

### 1.2 Core Features Checklist

| Feature | Spec'd | Implemented | Test |
|---------|--------|-------------|------|
| Local snapshots | ✅ | ☐ Verify | `savestate snapshot` |
| Encrypted backups (.saf.enc) | ✅ | ☐ Verify | Check file is encrypted |
| Incremental snapshots | ✅ | ☐ Verify | Multiple snapshots, check sizes |
| Snapshot restore | ✅ | ☐ Verify | `savestate restore` |
| Snapshot listing | ✅ | ☐ Verify | `savestate list` |
| Snapshot diff | ✅ | ☐ Verify | `savestate diff` |
| Snapshot search | ✅ | ☐ Verify | `savestate search <query>` |
| Cloud push (Pro/Team) | ✅ | ☐ Verify | `savestate cloud push` |
| Cloud pull (Pro/Team) | ✅ | ☐ Verify | `savestate cloud pull` |
| Cloud list (Pro/Team) | ✅ | ☐ Verify | `savestate cloud list` |
| Cloud delete (Pro/Team) | ✅ | ☐ Verify | `savestate cloud delete` |
| Scheduled backups | ✅ | ☐ Verify | `savestate schedule` |
| Migration between platforms | ✅ | ☐ Verify | `savestate migrate` |

### 1.3 Adapter Support

| Adapter | Spec'd | Implemented | Test Command |
|---------|--------|-------------|--------------|
| Claude Code | ✅ | ☐ Verify | `savestate init --adapter claude-code` |
| Claude Web | ✅ | ☐ Verify | `savestate init --adapter claude-web` |
| ChatGPT | ✅ | ☐ Verify | `savestate init --adapter chatgpt` |
| Gemini | ✅ | ☐ Verify | `savestate init --adapter gemini` |
| Clawdbot/Moltbot | ✅ | ☐ Verify | `savestate init --adapter clawdbot` |
| OpenAI Assistants | ✅ | ☐ Verify | `savestate init --adapter openai-assistants` |

### 1.4 Pricing Tiers

| Tier | Price | Storage | Adapters | Cloud | Spec Match |
|------|-------|---------|----------|-------|------------|
| Free | $0 | Local only | 1 | ❌ | ☐ Verify |
| Pro | $9/mo | 10 GB | All | ✅ | ☐ Verify |
| Team | $29/mo | 50 GB | All + custom | ✅ | ☐ Verify |

---

## 2. 🌐 Website Verification

### 2.1 Domain & SSL

```bash
# Test these:
curl -I https://savestate.dev
curl -I https://www.savestate.dev
```

- [ ] https://savestate.dev loads
- [ ] SSL certificate valid
- [ ] No mixed content warnings

### 2.2 Landing Page Sections

Visit https://savestate.dev and verify:

- [ ] Hero: "Time Machine for AI" messaging clear
- [ ] Features section lists all key capabilities
- [ ] Pricing section shows Free/Pro/Team with correct prices
- [ ] "Get Started" CTA links to docs or CLI install
- [ ] Dashboard link exists (for logged-in users)
- [ ] Blog section accessible

### 2.3 SEO Check

```bash
# Fetch and check meta tags:
curl -s https://savestate.dev | grep -E '<title>|<meta name="description"|og:|twitter:'
```

- [ ] Title tag present
- [ ] Meta description present
- [ ] OG tags present
- [ ] Twitter cards present

```bash
# Check robots and sitemap:
curl -s https://savestate.dev/robots.txt
curl -s https://savestate.dev/sitemap.xml
```

- [ ] robots.txt exists
- [ ] sitemap.xml exists

### 2.4 Google Search Console

- [ ] Domain verified
- [ ] Sitemap submitted
- [ ] No critical errors

---

## 3. 💳 Stripe & Payments

### 3.1 Stripe Configuration

```
Account: WithCandor (steve@withagency.ai)
Mode: Live
Products: SaveState Pro, SaveState Team
Webhook: https://savestate.dev/api/webhook
Webhook ID: we_1SuNxlEJ7b5sfPTDSqlHspTE
```

### 3.2 Price IDs

| Product | Price ID | Amount | Verify in Stripe |
|---------|----------|--------|------------------|
| Pro Monthly | price_1SuN4PEJ7b5sfPTDks7Q6SHO | $9/mo | ☐ |
| Team Monthly | price_1SuN4PEJ7b5sfPTDmE9uHVM6 | $29/mo | ☐ |

### 3.3 Webhook Events

Test that these events are handled (check `/api/webhook.ts`):

- [ ] `checkout.session.completed` → Creates account, sends email
- [ ] `customer.subscription.updated` → Updates tier
- [ ] `customer.subscription.deleted` → Downgrades to free
- [ ] `invoice.payment_failed` → Marks as past_due

### 3.4 Checkout Flow Test

**Pro Plan Test**:
1. [ ] Go to https://savestate.dev/#pricing
2. [ ] Click "Subscribe" for Pro
3. [ ] Verify redirects to Stripe checkout
4. [ ] Correct price shown ($9/mo)
5. [ ] (Optional) Complete test purchase

---

## 4. 📧 Email System

### 4.1 Email Configuration

```
Provider: PurelyMail
From: noreply@savestate.dev
Reply-To: hello@savestate.dev
```

### 4.2 DNS Records

```bash
# Verify email DNS:
dig MX savestate.dev +short
dig TXT savestate.dev +short | grep -E 'spf|v=spf'
dig TXT default._domainkey.savestate.dev +short
dig TXT _dmarc.savestate.dev +short
```

- [ ] MX records point to PurelyMail
- [ ] SPF record exists
- [ ] DKIM record exists
- [ ] DMARC record exists

### 4.3 Email Delivery Test

Use the test endpoint (if available) or trigger a real flow:

```bash
# E2E test (creates test account, sends email):
curl -X POST "https://savestate.dev/api/test-flow?secret=savestate-e2e-test-2026"
```

- [ ] Welcome email sends
- [ ] Email renders correctly
- [ ] Contains API key
- [ ] Getting started instructions clear

---

## 5. 🔐 API Authentication

### 5.1 Account Endpoint

```bash
# Without auth (should fail):
curl https://savestate.dev/api/account

# With invalid key (should fail):
curl -H "Authorization: Bearer ss_live_invalid" https://savestate.dev/api/account

# With valid key (should succeed):
curl -H "Authorization: Bearer ss_live_XXXXX" https://savestate.dev/api/account
```

- [ ] Missing auth returns 401 with helpful message
- [ ] Invalid key returns 401
- [ ] Valid key returns account info

### 5.2 Storage Endpoint (Pro/Team only)

```bash
# Free tier should be blocked:
curl -H "Authorization: Bearer [FREE_USER_KEY]" "https://savestate.dev/api/storage?list=true"

# Pro/Team should work:
curl -H "Authorization: Bearer [PRO_USER_KEY]" "https://savestate.dev/api/storage?list=true"
```

- [ ] Free users get 403 with upgrade message
- [ ] Pro users can access storage
- [ ] Team users can access storage

---

## 6. 🖥️ CLI End-to-End Tests

### 6.1 Installation

```bash
# Test all install methods:
npm install -g @savestate/cli
# or
brew tap savestatedev/tap && brew install savestate
# or
curl -fsSL https://savestate.dev/install.sh | bash
```

- [ ] npm install works
- [ ] Homebrew install works (if tap exists)
- [ ] Shell installer works
- [ ] `savestate --version` shows 0.4.1

### 6.2 Free User Journey

```bash
# 1. Initialize
savestate init --adapter claude-code

# 2. Create snapshot
savestate snapshot

# 3. List snapshots
savestate list

# 4. Try cloud (should fail gracefully)
savestate cloud list
```

- [ ] Init creates config in `~/.savestate/`
- [ ] Snapshot creates encrypted .saf.enc file
- [ ] List shows snapshot with timestamp
- [ ] Cloud commands prompt for login/upgrade

### 6.3 Pro User Journey

```bash
# 1. Login with Pro API key
savestate login --key ss_live_XXXXX

# 2. Verify subscription
savestate cloud list  # Should show tier and storage

# 3. Push to cloud
savestate snapshot
savestate cloud push

# 4. Verify in cloud
savestate cloud list

# 5. Pull from cloud (test on different machine or after delete)
savestate cloud pull --id <snapshot_id>

# 6. Delete from cloud
savestate cloud delete --id <snapshot_id> --force
```

- [ ] Login validates key and saves config
- [ ] Cloud list shows Pro tier with 10GB limit
- [ ] Push uploads snapshot successfully
- [ ] List shows uploaded snapshot
- [ ] Pull downloads snapshot
- [ ] Delete removes snapshot and frees storage

### 6.4 Storage Quota Enforcement

- [ ] Upload counts against storage used
- [ ] Re-upload same snapshot doesn't double-count
- [ ] Delete frees up storage space
- [ ] Exceeding quota returns clear error

### 6.5 Other Commands

```bash
savestate search "test query"
savestate diff <id1> <id2>
savestate restore <id>
savestate adapters
savestate config show
```

- [ ] Search works
- [ ] Diff shows changes between snapshots
- [ ] Restore extracts snapshot
- [ ] Adapters lists available adapters
- [ ] Config shows current configuration

---

## 7. 🗄️ Database & Infrastructure

### 7.1 Neon Database

```
Provider: Neon (Vercel Integration)
Database: savestate_db (or similar)
```

- [ ] Database accessible from Vercel functions
- [ ] Accounts table exists with correct schema
- [ ] Indexes on email, api_key, stripe_customer_id

### 7.2 Cloudflare R2 Storage

```
Bucket: savestate-backups
Endpoint: 3896f91bc02fe2ec4f45b9e92981e626.r2.cloudflarestorage.com
```

- [ ] R2 credentials configured in Vercel
- [ ] Upload/download works
- [ ] Files organized by account ID

### 7.3 Vercel Deployment

```
Project: savestate
Domain: savestate.dev
```

- [ ] Auto-deploys from GitHub main branch
- [ ] All environment variables set
- [ ] Functions deploy without errors

### 7.4 Environment Variables Check

Verify these are set in Vercel:

- [ ] `DATABASE_URL` or `NEON_DATABASE_URL`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `R2_ACCESS_KEY_ID`
- [ ] `R2_SECRET_ACCESS_KEY`
- [ ] `R2_ENDPOINT`
- [ ] `R2_BUCKET`
- [ ] `SMTP_PASSWORD`

---

## 8. 📚 Documentation

### 8.1 README Quality

- [ ] Clear description of what SaveState does
- [ ] Installation instructions (all methods)
- [ ] Quick start guide
- [ ] Feature list
- [ ] Pricing information
- [ ] Link to full docs

### 8.2 CLI Help

```bash
savestate --help
savestate init --help
savestate snapshot --help
savestate cloud --help
```

- [ ] All commands have help text
- [ ] Examples provided
- [ ] Options documented

### 8.3 Website Documentation

- [ ] Getting started guide
- [ ] Adapter-specific instructions
- [ ] Cloud storage docs
- [ ] API reference (if applicable)

---

## 9. 📱 Distribution

### 9.1 npm Registry

```bash
npm view @savestate/cli
```

- [ ] Package published
- [ ] Version 0.4.1 available
- [ ] Description and keywords set
- [ ] Repository linked

### 9.2 GitHub

- [ ] Repository public
- [ ] README renders correctly
- [ ] License file present (MIT)
- [ ] Releases tagged
- [ ] Issues enabled

### 9.3 Homebrew (if applicable)

```bash
brew info savestate
```

- [ ] Tap exists: savestatedev/tap
- [ ] Formula installs correctly

---

## 10. 🚨 Security Audit

- [ ] No secrets in git history
- [ ] API keys use secure random generation
- [ ] Passwords/keys not logged
- [ ] Stripe webhook signature verified
- [ ] SQL injection protected (parameterized queries)
- [ ] Rate limiting on API endpoints
- [ ] CORS configured appropriately

---

## 11. 📊 Final Scorecard

Complete after testing:

| Category | Total Items | Passed | Score |
|----------|-------------|--------|-------|
| Specification | | | % |
| Website | | | % |
| Payments | | | % |
| Email | | | % |
| API Auth | | | % |
| CLI E2E | | | % |
| Infrastructure | | | % |
| Documentation | | | % |
| Distribution | | | % |
| Security | | | % |
| **TOTAL** | | | **%** |

---

## 12. 🐛 Issues Found

| # | Severity | Description | Action Required |
|---|----------|-------------|-----------------|
| 1 | | | |
| 2 | | | |

---

## 13. ✅ Sign-Off

```
===============================================
SAVESTATE LAUNCH REVIEW - FINAL REPORT
===============================================

Project: SaveState — Time Machine for AI
Version: 0.4.1
Website: https://savestate.dev

Review Completed: [YYYY-MM-DD HH:MM:SS TZ]
Reviewer: [SUB_AGENT_NAME]

Overall Score: [X]%
Launch Approved: ☐ YES  ☐ NO (blocking issues)

Blocking Issues:
- [List any critical issues]

Signature: [Generate unique hash: sha256(agent_name + timestamp + project)]

===============================================
```

---

## 14. 📤 Submission

After completing this review:

1. **Bear Note**: Create note titled `SaveState Launch Review - [DATE]`
   - Tags: `#dbh-ventures`, `#launch-review`, `#savestate`
   - Paste the completed Sign-Off section and scorecard
   - Include full issues list if any

2. **Vikunja**: If approved, update project ID 5 status to "Launched"

3. **Report Back**: Send summary to main session

---

*Review Template v1.0 — SaveState Specific*
