# 주차장 DB 자동 동기화 설정 (macOS cron)

## 📋 개요

매월 1일 새벽 3시에 자동으로 서울시 주차장 데이터를 동기화하고 Git에 커밋/푸시합니다.

## 🔧 설정 방법

### 1. crontab 편집

```bash
crontab -e
```

### 2. 다음 라인 추가

```bash
# 매월 1일 새벽 3시에 주차장 DB 동기화 (로그 기록)
0 3 1 * * /Users/eric/Desktop/gas-station-finder/server/sync-and-deploy.sh >> /tmp/parking-sync.log 2>&1
```

**cron 표현식 설명:**
- `0` - 0분
- `3` - 새벽 3시
- `1` - 매월 1일
- `*` - 모든 월
- `*` - 모든 요일

**다른 예시:**
```bash
# 매일 새벽 3시
0 3 * * * /Users/eric/Desktop/gas-station-finder/server/sync-and-deploy.sh >> /tmp/parking-sync.log 2>&1

# 매주 월요일 새벽 3시
0 3 * * 1 /Users/eric/Desktop/gas-station-finder/server/sync-and-deploy.sh >> /tmp/parking-sync.log 2>&1

# 매주 일요일 오전 2시
0 2 * * 0 /Users/eric/Desktop/gas-station-finder/server/sync-and-deploy.sh >> /tmp/parking-sync.log 2>&1
```

### 3. cron 저장 및 종료

- **vi/vim**: `ESC` 누르고 `:wq` 입력 후 Enter
- **nano**: `Ctrl+X`, `Y`, Enter

### 4. cron 등록 확인

```bash
crontab -l
```

## 🧪 테스트

### 수동 실행 테스트

```bash
# 1. 스크립트 직접 실행
/Users/eric/Desktop/gas-station-finder/server/sync-and-deploy.sh

# 2. 로그 확인
tail -50 /tmp/parking-sync.log
```

### DB만 동기화 (Git 커밋 없이)

```bash
cd /Users/eric/Desktop/gas-station-finder/server
node sync-parking-db.js
```

## 📊 로그 확인

```bash
# 최근 로그 50줄 보기
tail -50 /tmp/parking-sync.log

# 실시간 로그 모니터링
tail -f /tmp/parking-sync.log

# 전체 로그 보기
cat /tmp/parking-sync.log
```

## 🔍 동작 과정

1. **DB 동기화** (`sync-parking-db.js`)
   - 서울시 API에서 최신 주차장 데이터 가져오기
   - 신규/업데이트 주차장 DB에 저장
   - 신규 주차장 지오코딩 (카카오 API)

2. **Git 배포** (`sync-and-deploy.sh`)
   - DB 변경사항 확인
   - Git add/commit/push
   - Render 자동 재배포

## ⚠️ 주의사항

### macOS 권한 설정

macOS Catalina 이상에서는 cron이 디스크 접근 권한이 필요할 수 있습니다:

1. **시스템 설정** > **개인정보 보호 및 보안** > **전체 디스크 접근 권한**
2. `cron` 또는 `/usr/sbin/cron` 추가
3. Mac 재시작

### Git 인증

cron에서 Git push가 작동하려면:

**HTTPS 사용 시:**
```bash
# Credential helper 설정 (한 번만)
git config --global credential.helper osxkeychain
```

**SSH 사용 시:**
```bash
# SSH key가 이미 GitHub에 등록되어 있어야 함
# ~/.ssh/config 설정 확인
```

### 환경변수

`.env` 파일에 다음 키가 필요합니다:
- `SEOUL_PARKING_API_KEY` - 서울시 공공데이터 API 키
- `KAKAO_REST_API_KEY` - 카카오 REST API 키

## 🛑 cron 중지/삭제

```bash
# cron 목록 확인
crontab -l

# 특정 cron만 삭제: crontab -e로 해당 라인 삭제

# 모든 cron 삭제 (주의!)
crontab -r
```

## 📈 예상 소요 시간

- **변경사항 없음**: 약 10-20초
- **신규 주차장 ~100개**: 약 1-2분
- **신규 주차장 ~1000개**: 약 3-5분

## 🔗 참고 링크

- [Crontab Guru](https://crontab.guru/) - cron 표현식 테스트
- [서울 열린데이터 광장](https://data.seoul.go.kr/)
- [카카오 개발자 센터](https://developers.kakao.com/)
