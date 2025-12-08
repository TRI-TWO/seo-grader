#!/bin/bash
# Push all feature branches to GitHub
# Make sure you have access set up first (see SETUP_SSH.md)

echo "🚀 Pushing all feature branches to GitHub..."
echo ""

branches=(
  "feature/tri-two-migration"
  "feature/production-stack"
  "feature/job-based-pipeline"
  "feature/scrape-stages"
  "feature/safety-timeouts"
  "feature/caching-rate-limits"
  "feature/frontend-job-flow"
)

success_count=0
fail_count=0

for branch in "${branches[@]}"; do
  echo "📤 Pushing $branch..."
  if git push -u origin "$branch" 2>&1; then
    echo "✅ Successfully pushed $branch"
    ((success_count++))
  else
    echo "❌ Failed to push $branch"
    ((fail_count++))
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary: $success_count succeeded, $fail_count failed"
echo ""

if [ $fail_count -eq 0 ]; then
  echo "🎉 All branches pushed successfully!"
  echo "👉 Next: Follow DEPLOY_NOW.md to complete deployment"
else
  echo "⚠️  Some branches failed to push."
  echo "👉 Check SETUP_SSH.md for authentication help"
fi

