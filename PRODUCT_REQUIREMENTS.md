# Product Requirements Document (PRD)
# 스마트 주유소 찾기

**버전:** 1.2
**최종 업데이트:** 2026-01-08
**Repository:** https://github.com/johntom9439/gas-station-finder

---

## 📋 목차

1. [제품 개요](#제품-개요)
2. [목표 및 목적](#목표-및-목적)
3. [사용자 페르소나](#사용자-페르소나)
4. [주요 기능](#주요-기능)
5. [기술 스택](#기술-스택)
6. [시스템 아키텍처](#시스템-아키텍처)
7. [핵심 기술 구현](#핵심-기술-구현)
8. [사용자 플로우](#사용자-플로우)
9. [성능 요구사항](#성능-요구사항)
10. [보안 요구사항](#보안-요구사항)
11. [향후 개선사항](#향후-개선사항)

---

## 제품 개요

**스마트 주유소 찾기**는 한국 오피넷(Opinet) API를 활용하여 실시간 주유소 가격 정보를 제공하고, 이동 비용을 고려한 **가성비 분석**을 통해 사용자에게 최적의 주유소를 추천하는 웹 애플리케이션입니다.

### 핵심 가치 제안

- 🎯 **실시간 가격 정보**: 오피넷 API 기반 실시간 휘발유 가격
- 💰 **가성비 계산**: 이동 비용을 차감한 실제 절감액 분석
- 🗺️ **시각적 표시**: 카카오맵 기반 주유소 위치 표시
- 🚗 **경로 안내**: 주유소까지 실시간 경로 및 턴바이턴 네비게이션
- 📱 **반응형 디자인**: 데스크톱/모바일 최적화 UI
- 📍 **정확한 좌표 변환**: TM_OPINET ↔ WGS84 좌표계 변환으로 정확한 위치 제공

---

## 목표 및 목적

### 비즈니스 목표

1. 사용자에게 **실질적인 비용 절감** 정보 제공
2. 단순 최저가가 아닌 **이동 비용을 고려한 가성비** 분석
3. 직관적인 UI/UX를 통한 **빠른 의사결정** 지원

### 기술 목표

1. 오피넷 API의 복잡한 좌표계(KATEC)를 정확하게 변환
2. Backend-Frontend 분리 아키텍처로 API 키 보안
3. 실시간 데이터 캐싱으로 API 호출 최적화

---

## 사용자 페르소나

### 주 타겟 (Primary Persona)

**김경제 (35세, 직장인)**
- 주 5일 출퇴근으로 주유 빈도 높음
- 월 10-15만원 주유 비용 지출
- 스마트폰으로 주유소 가격 비교 습관
- 5-10분 추가 이동 시 실제 절감 금액이 궁금함

### 부 타겟 (Secondary Persona)

**박여행 (28세, 프리랜서)**
- 주말마다 장거리 여행
- 한 번에 40-50L 주유
- 여행 경로상 가성비 좋은 주유소 탐색
- 지도로 주유소 위치 확인 선호

---

## 주요 기능

### 1. 주소 기반 주유소 검색

**기능 설명**
- 다음 우편번호 서비스를 통한 주소 검색
- 검색된 주소를 WGS84 좌표로 자동 변환
- 카카오맵 중심점 이동

**입력**
- 사용자 선택 주소 (도로명/지번)

**출력**
- WGS84 좌표 (위도, 경도)
- 주변 주유소 목록 (기본 5km 반경)

### 2. 검색 반경 조정

**기능 설명**
- 슬라이더로 0.5km ~ 5km 범위 조정
- 반경 변경 시 실시간 필터링 (API 재호출 없음)
- 지도 원(circle) 크기 실시간 업데이트

**동작 방식**
- 초기 로드: 5km 데이터 캐싱
- 반경 조정: 캐싱된 데이터 필터링
- 새 주소 검색: 반경 자동 5km 리셋 + API 재호출

### 3. 가격 정보 제공

**표시 정보**
- **평균 가격**: 검색 반경 내 주유소 평균가
- **최저 가격**: 가장 저렴한 주유소 가격
- **예상 절감액**: 이동 비용 차감 후 순이익

**가격 업데이트**
- 오피넷 API 실시간 데이터
- 각 주유소별 최종 업데이트 일시 표시

### 4. 정렬 모드

**3가지 정렬 옵션**
1. **💰 최저가 순**: 리터당 가격이 가장 저렴한 순
   - 1순위: 가격 오름차순
   - 2순위: 거리 오름차순 (가격이 같을 때)
2. **📍 최단거리 순**: 현재 위치에서 가장 가까운 순
   - 1순위: 거리 오름차순
   - 2순위: 가격 오름차순 (거리가 같을 때)
3. **⚡ 가성비 순**: 순이익이 가장 높은 순 (권장)

### 5. 가성비 분석

**계산 로직**
```
주유 절감 = (평균가 - 해당 주유소 가격) × 주유량(40L)
이동 비용 = (거리 × 2 ÷ 연비(12km/L)) × 평균가
순이익 = 주유 절감 - 이동 비용
```

**시각적 표시**
- ✅ 이동 가치 있음 (순이익 > 0원)
- ❌ 이동 비효율 (순이익 ≤ 0원)
- 진행바로 거리 비율 표시

### 6. 카카오맵 통합

**지도 기능**
- 🔴 빨간 마커: 현재 검색 위치
- 🔵 파란 마커: 주유소 위치 (검색 반경 내)
- 파란 원: 검색 반경 시각화
- 드래그/줌 컨트롤

**주유소 마커**
- TM_OPINET → WGS84 좌표 역변환으로 정확한 위치 표시
- 마커 클릭 시 인포윈도우 표시
  - 주유소 이름
  - 브랜드 | 가격
  - 거리
  - 🏆 트로피 배지 (최저가/최단거리/가성비 최우수)
- X 버튼으로 인포윈도우 닫기

### 7. 경로 안내 (Route Navigation)

**기능 설명**
- 주유소 카드 클릭 시 현재 위치에서 주유소까지 실시간 경로 표시
- Kakao Mobility Directions API 기반 자동차 경로
- 지도 위에 파란색 폴리라인으로 경로 시각화

**경로 정보**
- 🚗 총 거리 (km)
- ⏱️ 예상 소요 시간 (분)
- 💰 통행료
- 🧭 턴바이턴 안내 (Turn-by-Turn Directions)
  - 좌회전/우회전/직진/U턴 등 방향 아이콘
  - 각 구간 거리 및 도로명
  - 단계별 안내 메시지

**UI/UX**
- **데스크톱**: 중앙 패널에 경로 정보 표시
- **모바일**:
  - 주유소 클릭 시 주유소 리스트 바텀시트 숨김
  - 경로 바텀시트(50vh 고정 높이)로 전환 표시
  - 경로 닫기 시 다시 주유소 리스트 바텀시트로 복귀
  - 지도 영역은 바텀시트 위쪽만 활용 (바텀시트 뒤로 숨김 없음)
- 경로 표시 시 출발지(빨간 마커), 도착지(파란 마커) 자동 추가
- 지도 자동 fit으로 출발지/도착지 모두 표시 (바텀시트 높이 고려)
- 닫기 버튼으로 경로 해제 및 원래 뷰로 복귀

### 8. 반응형 디자인

**데스크톱 (≥ 768px)**
- 좌측 사이드바 (450px) + 우측 지도
- 사이드바 토글 버튼으로 접기/펼치기
  - 접기: 지도 전체 화면 활용
  - 펼치기: 사이드바 복원
- 사이드바 접을 때 지도 자동 relayout (크기 재조정)
- 지도 중심점 유지하며 부드러운 전환 애니메이션

**모바일 (< 768px)**
- 상단: 주소 검색 + 반경 슬라이더
- 중앙: 전체 화면 지도 (바텀시트 위쪽 영역만 표시)
- 하단: 주유소 요약 카드 (Top 3)
  - 💰 최저가
  - 📍 최단거리
  - ⚡ 가성비
- "전체 보기" 버튼 → 하단 시트 열림
- **드래그 가능 바텀시트**:
  - 핸들 바를 터치/드래그하여 높이 조절
  - 스냅 포인트: 40vh (최소), 70vh (중간), 90vh (최대)
  - 드래그 중 핸들 바 시각적 피드백 (크기/색상 변화)
  - 터치 시작/이동/종료 이벤트로 부드러운 인터랙션
- 하단 시트: 전체 주유소 목록 스크롤

---

## 기술 스택

### Frontend

| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19.2.3 | UI 프레임워크 |
| Lucide React | 0.562.0 | 아이콘 라이브러리 |
| Kakao Maps SDK | - | 지도 표시 및 마커 |
| Daum Postcode | - | 주소 검색 |

**배포**: Vercel
**URL**: https://gas-station-finder-chi.vercel.app/

### Backend

| 기술 | 버전 | 용도 |
|------|------|------|
| Node.js | - | 런타임 |
| Express | 4.18.2 | 웹 서버 프레임워크 |
| proj4 | 2.20.2 | 좌표계 변환 |
| node-fetch | 2.7.0 | HTTP 클라이언트 |
| dotenv | 16.3.1 | 환경변수 관리 |

**배포**: Render
**URL**: https://gas-station-finder-backend.onrender.com

### External APIs

| API | 용도 | 인증 |
|-----|------|------|
| Opinet API | 주유소 가격/위치 정보 | API Key |
| Kakao Maps SDK | 지도 표시 | App Key |
| Kakao Geocoder | 주소 → 좌표 변환 | App Key |
| Kakao Mobility Directions | 경로 안내 및 턴바이턴 | REST API Key |
| Kakao Reverse Geocoding | 좌표 → 주소 변환 | REST API Key |
| Daum Postcode | 주소 검색 UI | 공개 API |

---

## 시스템 아키텍처

### 전체 구조

```
┌─────────────┐      HTTPS      ┌──────────────┐      HTTPS      ┌─────────────┐
│   Browser   │ ◄─────────────► │   Frontend   │ ◄─────────────► │   Backend   │
│             │                  │   (Vercel)   │                  │  (Render)   │
└─────────────┘                  └──────────────┘                  └─────────────┘
       ▲                                ▲                                 ▲
       │                                │                                 │
       │ Kakao APIs                     │                                 │
       ▼                                │                                 ▼
┌─────────────┐                         │                          ┌─────────────┐
│ Kakao Maps  │                         │                          │  Opinet API │
│ Geocoder    │                         │                          │             │
│ Postcode    │                         │                          └─────────────┘
└─────────────┘                         │
                                        │
                                        ▼
                              ┌──────────────────┐
                              │  Local Storage   │
                              │  (Cache)         │
                              └──────────────────┘
```

### 데이터 흐름

**주소 검색 플로우**
```
1. User enters address
   ↓
2. Daum Postcode → Address selection
   ↓
3. Kakao Geocoder → WGS84 coordinates
   ↓
4. Frontend → Backend (lat, lng, radius=10km)
   ↓
5. Backend: WGS84 → KATEC conversion (proj4)
   ↓
6. Backend → Opinet API (KATEC x, y, radius)
   ↓
7. Opinet API → Gas station data (KATEC coordinates)
   ↓
8. Backend: KATEC → WGS84 reverse conversion
   ↓
9. Backend → Frontend (WGS84 coordinates + station data)
   ↓
10. Frontend: Display on Kakao Map + List view
```

---

## 핵심 기술 구현

### 1. 좌표계 변환 (TM_OPINET ↔ WGS84)

**문제**
- 오피넷 API는 TM_OPINET(Korea Transverse Mercator) 좌표계 사용
- 카카오맵은 WGS84(GPS) 좌표계 사용
- 두 좌표계 간 정확한 변환 필요

**해결**
```javascript
// Backend: proj4 설정
proj4.defs([
  ['EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs'],
  ['TM_OPINET', '+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +no_defs']
]);

// WGS84 → TM_OPINET
const [x, y] = proj4('EPSG:4326', 'TM_OPINET', [lng, lat]);

// TM_OPINET → WGS84
const [lng, lat] = proj4('TM_OPINET', 'EPSG:4326', [x, y]);
```

**파라미터 설명**
- `lat_0=38`: 원점 위도 (한반도 중부)
- `lon_0=128`: 중심 경선 (서울 기준 최적화)
- `k=0.9999`: 축척 계수
- `x_0=400000, y_0=600000`: False Easting/Northing
- `ellps=bessel`: Bessel 타원체 (구 일본측지계)
- `towgs84`: 7-파라미터 변환 (Tokyo Datum → WGS84)

### 2. API 호출 최적화

**캐싱 전략**
```javascript
// 초기 로드: 5km 데이터 가져오기
const data = await fetchNearbyStations(lat, lng, 5);
setAllStations(data); // 캐싱

// 반경 조정: 캐시에서 필터링
const filtered = allStations.filter(station => station.distance <= radius);
setStations(filtered); // 표시

// 새 주소 검색: 캐시 무효화 + 5km 재로드
```

**효과**
- API 호출 90% 감소
- 슬라이더 조정 시 즉각 반응
- 서버 부하 최소화

### 3. 환경별 Backend URL 자동 전환

```javascript
const BACKEND_API_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3001'              // Local 개발
  : 'https://gas-station-finder-backend.onrender.com'; // Production
```

---

## 사용자 플로우

### 메인 사용 시나리오

```
1. 사용자 방문 (기본 위치: 서울시청)
   └─► 5km 반경 주유소 자동 로드
   └─► 카카오맵 표시 (중심: 서울시청)
   └─► 지도 자동 fit (초기 위치 중심, 바텀시트 높이 고려)

2. 주소 검색 버튼 클릭
   └─► Daum Postcode 팝업
   └─► 주소 선택
   └─► 좌표 변환 (Kakao Geocoder)
   └─► 반경 5km 리셋
   └─► Backend API 호출
   └─► 주유소 목록 + 지도 마커 업데이트
   └─► 지도 중심 이동 및 fit

3. 검색 반경 슬라이더 조정 (예: 3km)
   └─► 캐시에서 3km 이내 필터링
   └─► 목록 업데이트
   └─► 지도 원 크기 조정
   └─► 지도 마커 업데이트 (3km 내만 표시)

4. 정렬 모드 변경 (예: 가성비 순)
   └─► 주유소 재정렬 (tiebreaker 로직 적용)
   └─► 1위 주유소에 트로피 표시
   └─► 지도 마커 인포윈도우 업데이트

5. 주유소 카드/마커 클릭
   └─► [데스크톱] 중앙 패널에 경로 정보 표시
   └─► [모바일] 주유소 리스트 바텀시트 숨김 → 경로 바텀시트(50vh) 표시
   └─► Backend 경로 API 호출 (Kakao Mobility)
   └─► 지도에 파란 폴리라인 표시
   └─► 출발지/도착지 마커 표시
   └─► 지도 자동 fit (경로 전체 표시, 바텀시트 높이 고려)
   └─► 턴바이턴 안내 표시
   └─► 닫기 버튼 → 경로 제거 + 원래 뷰 복귀

6. [모바일] 바텀시트 드래그
   └─► 핸들 바 터치/드래그
   └─► 높이 실시간 변경
   └─► 드래그 종료 시 가장 가까운 스냅 포인트로 이동
   └─► 지도 영역 자동 조정 (relayout)
```

---

## 성능 요구사항

### 응답 시간

| 동작 | 목표 시간 | 현재 상태 |
|------|----------|----------|
| 주소 검색 (Kakao Geocoder) | < 500ms | ✅ 달성 |
| Backend API 호출 (Opinet) | < 2s | ✅ 달성 |
| 반경 필터링 (캐시) | < 100ms | ✅ 달성 |
| 지도 마커 업데이트 | < 200ms | ✅ 달성 |

### 데이터 제한

- **최대 검색 반경**: 5km (오피넷 API 제한)
- **최대 주유소 개수**: 제한 없음 (오피넷 API 응답 기준)
- **캐시 유효 기간**: 주소 변경 시까지
- **바텀시트 높이 범위**: 40vh ~ 90vh (모바일)

### 브라우저 호환성

- Chrome 90+
- Safari 14+
- Firefox 88+
- Edge 90+

---

## 보안 요구사항

### API 키 보안

**문제**
- Opinet API 키를 Frontend에 노출하면 무단 사용 위험

**해결**
```
Frontend (Public)
   ↓ (좌표만 전달)
Backend Proxy (Private)
   - .env 파일에 API 키 저장
   - Backend에서만 Opinet API 호출
   - Frontend에는 가공된 데이터만 전달
```

### 환경변수 관리

**Backend (.env)**
```bash
OPINET_API_KEY=your_actual_api_key_here
```

**주의사항**
- ❌ Git에 커밋 금지 (.gitignore 필수)
- ✅ Render 환경변수에 별도 설정
- ✅ 로컬 개발 시 `.env.example` 템플릿 제공

### CORS 정책

```javascript
// Backend
app.use(cors({
  origin: '*',  // Production에서는 특정 도메인으로 제한 권장
  methods: ['GET', 'POST'],
  credentials: true
}));
```

---

## 향후 개선사항

### Phase 2 (단기)

1. **다른 유종 지원**
   - 경유, 고급휘발유, LPG 선택 옵션

2. **즐겨찾기 기능**
   - LocalStorage에 자주 가는 주유소 저장
   - 빠른 접근 버튼

3. **주유 히스토리**
   - 주유 기록 저장
   - 월간 지출 통계

### Phase 3 (중기)

1. **회원 시스템**
   - 사용자 계정 생성
   - 차량 정보 등록 (연비 커스터마이징)
   - 클라우드 동기화

2. **Push 알림**
   - 주변 주유소 가격 급락 시 알림
   - 즐겨찾기 주유소 가격 변동 알림

3. **경로 최적화**
   - 목적지 입력 → 경로상 가성비 주유소 추천
   - 카카오내비 연동

### Phase 4 (장기)

1. **모바일 앱**
   - React Native 기반 iOS/Android 앱
   - GPS 자동 위치 탐지
   - 오프라인 모드

2. **AI 추천**
   - 사용자 주유 패턴 학습
   - 최적 주유 타이밍 제안
   - 예상 소비량 기반 주유량 추천

3. **커뮤니티**
   - 사용자 리뷰 및 평점
   - 주유소 실시간 혼잡도
   - 세차/정비 정보 공유

---

## 부록

### A. API 명세

**Backend Endpoints**

**1. GET /api/stations**

```
Query Parameters:
  - lat: number (WGS84 latitude)
  - lng: number (WGS84 longitude)
  - radius: number (km, max 5)

Response:
{
  "RESULT": {
    "OIL": [
      {
        "UNI_ID": "string",
        "OS_NM": "string",
        "POLL_DIV_CD": "string",
        "PRICE": "string",
        "DISTANCE": "string",
        "NEW_ADR": "string",
        "PRICE_DT": "string",
        "GIS_X_COOR": "number",
        "GIS_Y_COOR": "number",
        "WGS84_LAT": "number",  // TM_OPINET → WGS84 역변환
        "WGS84_LNG": "number"   // TM_OPINET → WGS84 역변환
      }
    ]
  }
}
```

**2. GET /api/route**

```
Query Parameters:
  - origin: string (lng,lat 형식, 예: "126.9778,37.5664")
  - destination: string (lng,lat 형식, 예: "127.0276,37.4979")

Response:
{
  "routes": [
    {
      "summary": {
        "distance": number,      // 총 거리 (미터)
        "duration": number,      // 예상 소요 시간 (초)
        "fare": {
          "taxi": number,
          "toll": number         // 통행료 (원)
        }
      },
      "sections": [
        {
          "distance": number,
          "duration": number,
          "roads": [
            {
              "name": "string",  // 도로명
              "distance": number,
              "vertexes": [...]  // 폴리라인 좌표 배열 [lng, lat, ...]
            }
          ],
          "guides": [
            {
              "name": "string",        // 안내 메시지
              "distance": number,      // 구간 거리 (미터)
              "duration": number,      // 구간 시간 (초)
              "type": number,          // 방향 타입 (1:좌회전, 2:우회전, etc.)
              "guidance": "string"     // 상세 안내
            }
          ]
        }
      ]
    }
  ]
}
```

### B. 참고 문서

- [오피넷 API 문서](https://www.opinet.co.kr/)
- [Kakao Maps API](https://apis.map.kakao.com/)
- [proj4 라이브러리](http://proj4js.org/)

---

**문서 버전 관리**

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2026-01-01 | 초안 작성 | johntom9439 |
| 1.1 | 2026-01-05 | 경로 안내 기능 추가, 반응형 디자인 개선, Kakao Mobility API 연동 | johntom9439 |
| 1.2 | 2026-01-08 | 모바일 바텀시트 드래그 기능 추가, 지도 fit 최적화, 정렬 tiebreaker 로직 추가, 최대 검색 반경 10km→5km 수정 | johntom9439 |
 
 
 
 
