#!/bin/bash
# Script to push all feature branches to GitHub
# Make sure you're authenticated with GitHub first

echo "Pushing all feature branches to GitHub..."
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

for branch in "${branches[@]}"; do
  echo "Pushing $branch..."
  git push -u origin "$branch"
  if [ $? -eq 0 ]; then
    echo "✓ Successfully pushed $branch"
  else
    echo "✗ Failed to push $branch"
  fi
  echo ""
done

echo "Done! All branches pushed."
