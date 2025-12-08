# Add New SSH Key to TRI-TWO GitHub

## ✅ New SSH Key Generated!

A new SSH key has been created specifically for TRI-TWO GitHub account.

## Step 1: Copy Your Public Key

Your new SSH public key is:
```
[See output above - it starts with ssh-ed25519]
```

## Step 2: Add to GitHub

1. **Go to GitHub Settings:**
   - Make sure you're logged in as the **TRI-TWO** account
   - Go to: https://github.com/settings/keys

2. **Add SSH Key:**
   - Click "New SSH key"
   - Title: `MacBook Air - TRI-TWO` (or any name you prefer)
   - Key type: `Authentication Key`
   - Key: Paste the entire public key (starts with `ssh-ed25519`)
   - Click "Add SSH key"

## Step 3: Test Connection

After adding the key, test it:
```bash
ssh -T git@github.com-tri-two
```

You should see:
```
Hi TRI-TWO! You've successfully authenticated, but GitHub does not provide shell access.
```

## Step 4: Push Branches

Once the key is added, you can push:
```bash
./push-branches.sh
```

Or manually:
```bash
git push -u origin feature/tri-two-migration
```

## Troubleshooting

**If you see "Permission denied":**
- Make sure you added the key to the TRI-TWO account (not your personal account)
- Verify the key was copied completely (should be one long line)
- Try: `ssh -T git@github.com-tri-two` to test

**If you see "Host key verification failed":**
```bash
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
```

## Key Files

- **Private key:** `~/.ssh/id_ed25519_tri_two` (keep this secret!)
- **Public key:** `~/.ssh/id_ed25519_tri_two.pub` (this is what you add to GitHub)
- **SSH config:** `~/.ssh/config` (already configured)

The git remote is already set to use this new key via the SSH config alias.

