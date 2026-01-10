#!/bin/bash
# 주차장 DB 동기화 및 Git 자동 배포 스크립트
# macOS cron 설정: 0 3 1 * * /Users/eric/Desktop/gas-station-finder/server/sync-and-deploy.sh >> /tmp/parking-sync.log 2>&1

# 로그 출력
echo "=========================================="
echo "🔄 주차장 DB 동기화 + 자동 배포"
echo "⏰ $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# 프로젝트 디렉토리로 이동
cd "$(dirname "$0")" || exit 1
PROJECT_ROOT="$(cd .. && pwd)"

echo "📂 프로젝트 디렉토리: $PROJECT_ROOT"
echo ""

# 1. DB 동기화 실행
echo "🔄 Step 1: DB 동기화 실행..."
node sync-parking-db.js

if [ $? -ne 0 ]; then
  echo "❌ DB 동기화 실패!"
  exit 1
fi

echo ""

# 2. Git 변경사항 확인
cd "$PROJECT_ROOT" || exit 1

if git diff --quiet server/parking.db; then
  echo "ℹ️  DB 변경사항 없음. 배포 스킵."
  exit 0
fi

# 3. Git add
echo "📝 Step 2: Git add..."
git add server/parking.db

# 4. Git commit
echo "💾 Step 3: Git commit..."
COMMIT_MSG="Update parking DB - $(date '+%Y-%m-%d %H:%M')"
git commit -m "$COMMIT_MSG"

if [ $? -ne 0 ]; then
  echo "❌ Git commit 실패!"
  exit 1
fi

# 5. Git push
echo "🚀 Step 4: Git push..."
git push origin main

if [ $? -eq 0 ]; then
  echo ""
  echo "=========================================="
  echo "✅ 동기화 및 배포 완료!"
  echo "🌐 Render에서 자동 재배포됩니다."
  echo "=========================================="
else
  echo ""
  echo "❌ Git push 실패! 수동으로 확인 필요"
  exit 1
fi
