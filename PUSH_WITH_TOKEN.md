# Push Branches Using Personal Access Token

Since your SSH key is already in use, we'll use a Personal Access Token with HTTPS.

## Step 1: Create Personal Access Token

1. **Go to GitHub Settings:**
   - If you have access to TRI-TWO account: https://github.com/settings/tokens
   - Or create from your personal account if you have repo access

2. **Generate New Token:**
   - Click "Generate new token" > "Generate new token (classic)"
   - Name: `TRI-TWO Deployment`
   - Expiration: Choose your preference (90 days, 1 year, or no expiration)
   - **Select scope:** Check `repo` (this gives full repository access)
   - Click "Generate token"

3. **Copy the Token:**
   - ⚠️ **IMPORTANT:** Copy the token immediately - you won't see it again!
   - It will look like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Push Branches

**Option A: Use the script (will prompt for token)**
```bash
./push-branches.sh
```
When prompted:
- Username: `TRI-TWO` (or your GitHub username)
- Password: `[paste your token here]`

**Option B: Push manually**
```bash
git push -u origin feature/tri-two-migration
```
When prompted:
- Username: `TRI-TWO`
- Password: `[paste your token]`

**Option C: Store token in URL (one-time setup)**
```bash
# Replace YOUR_TOKEN with your actual token
git remote set-url origin https://YOUR_TOKEN@github.com/TRI-TWO/seo-grader.git
git push -u origin feature/tri-two-migration
```

**Option D: Use Git Credential Helper (recommended for security)**
```bash
# Store token securely
git config --global credential.helper osxkeychain

# Then push (will prompt once, then remember)
git push -u origin feature/tri-two-migration
# Username: TRI-TWO
# Password: [your token]
```

## Step 3: Push All Branches

Once authentication is set up, run:
```bash
./push-branches.sh
```

Or push each branch:
```bash
git push -u origin feature/tri-two-migration
git push -u origin feature/production-stack
git push -u origin feature/job-based-pipeline
git push -u origin feature/scrape-stages
git push -u origin feature/safety-timeouts
git push -u origin feature/caching-rate-limits
git push -u origin feature/frontend-job-flow
```

## Security Note

If you use Option C (token in URL), consider removing it after pushing:
```bash
git remote set-url origin https://github.com/TRI-TWO/seo-grader.git
```

Option D (credential helper) is the most secure as it stores the token in your macOS keychain.



