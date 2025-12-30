# SSH Setup for TRI-TWO GitHub

## Current Status

Your SSH key is authenticated with GitHub, but it's associated with the `mjhanratty` account. To push to `TRI-TWO/seo-grader`, you need to either:

## Option 1: Add SSH Key to TRI-TWO Account (Recommended)

1. **Get your SSH public key:**
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

2. **Add to TRI-TWO account:**
   - Go to: https://github.com/settings/keys
   - Make sure you're logged in as the TRI-TWO account
   - Click "New SSH key"
   - Paste your public key
   - Give it a title (e.g., "MacBook Air")
   - Click "Add SSH key"

3. **Update git remote:**
   ```bash
   git remote set-url origin git@github.com:TRI-TWO/seo-grader.git
   ```

4. **Test:**
   ```bash
   git push -u origin feature/tri-two-migration
   ```

## Option 2: Use Personal Access Token (Quick Alternative)

1. **Create Personal Access Token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" > "Generate new token (classic)"
   - Name it: "TRI-TWO Deployment"
   - Select scope: `repo` (full control)
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again!)

2. **Push using token:**
   ```bash
   git remote set-url origin https://github.com/TRI-TWO/seo-grader.git
   git push -u origin feature/tri-two-migration
   ```
   When prompted:
   - Username: `TRI-TWO` (or your GitHub username)
   - Password: `[paste your token here]`

3. **Or use token in URL (one-time):**
   ```bash
   git remote set-url origin https://[YOUR_TOKEN]@github.com/TRI-TWO/seo-grader.git
   git push -u origin feature/tri-two-migration
   ```

## Option 3: Use SSH Config for Multiple Accounts

If you need to use different SSH keys for different GitHub accounts:

1. **Create/edit SSH config:**
   ```bash
   nano ~/.ssh/config
   ```

2. **Add configuration:**
   ```
   # Personal account
   Host github.com-personal
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519

   # TRI-TWO account
   Host github.com-tri-two
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519_tri_two
   ```

3. **Generate new key for TRI-TWO (if needed):**
   ```bash
   ssh-keygen -t ed25519 -C "tri-two@example.com" -f ~/.ssh/id_ed25519_tri_two
   ```

4. **Add new key to TRI-TWO account** (follow Option 1, step 2)

5. **Update git remote:**
   ```bash
   git remote set-url origin git@github.com-tri-two:TRI-TWO/seo-grader.git
   ```

## Quick Test

After setting up, test with:
```bash
ssh -T git@github.com
```

Should see: "Hi TRI-TWO! You've successfully authenticated..."

## Current SSH Key

Your current SSH public key is:
```
[Run: cat ~/.ssh/id_ed25519.pub to see it]
```

Add this to the TRI-TWO GitHub account to enable SSH access.



