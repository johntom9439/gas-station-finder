// Gas Station Finder Backend - Opinet API Proxy Server
// Features: Coordinate conversion (WGS84 ↔ TM_OPINET), Route navigation, Reverse geocoding
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const proj4 = require('proj4');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001; // Render는 환경변수 PORT 사용

app.use(cors({ origin: '*', methods: ['GET', 'POST'], credentials: true }));

// 단일 좌표계 정의 - lon_0=127로 고정
proj4.defs([
  ['EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs'],
  ['TM_OPINET', '+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +no_defs'],
]);

// 'TM_OPINET', '+proj=tmerc +lat_0=37.9674 +lon_0=125.75 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs'

// 좌표 변환 함수 (WGS84 → KATEC)
function convertCoordinates(lat, lng) {
  const results = {};

  try {
    const [x, y] = proj4('EPSG:4326', 'TM_OPINET', [lng, lat]);
    results['TM_OPINET'] = { x: Math.round(x), y: Math.round(y) };
  } catch (error) {
    results['TM_OPINET'] = { error: error.message };
  }

  return results;
}

// 역변환 함수 (KATEC → WGS84)
function reverseConvertCoordinates(x, y) {
  try {
    const [lng, lat] = proj4('TM_OPINET', 'EPSG:4326', [x, y]);
    return { lat, lng };
  } catch (error) {
    console.error('❌ KATEC → WGS84 역변환 실패:', error);
    return null;
  }
}

// 카카오 역지오코딩 (좌표 → 주소)
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Kakao API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.documents && data.documents.length > 0) {
      // 도로명 주소 우선, 없으면 지번 주소
      const roadAddress = data.documents[0].road_address;
      const jibunAddress = data.documents[0].address;

      return roadAddress?.address_name || jibunAddress?.address_name || null;
    }

    return null;
  } catch (error) {
    console.error('❌ 역지오코딩 실패:', error.message);
    return null;
  }
}

// 오피넷 API 호출
async function tryOpinet(lat, lng, radius, apiKey, prodcd = 'B027') {
  const coords = convertCoordinates(lat, lng);
  const radiusInMeters = Math.round(radius * 1000);
  
  //console.log('🔄 변환된 좌표:');
  //Object.entries(coords).forEach(([system, coord]) => {
  //  if (!coord.error) {
  //    console.log(`   ${system}: x=${coord.x}, y=${coord.y}`);
  //    console.log(`   설정: lon_0=127, y_0=600000`);
  //  }
  //});
  
  // TM_OPINET 좌표계로 시도
  for (const [system, coord] of Object.entries(coords)) {
    if (coord.error) {
      console.log(`   ❌ 좌표 변환 실패:`, coord.error);
      continue;
    }
    
    const url = `https://www.opinet.co.kr/api/aroundAll.do?code=${apiKey}&x=${coord.x}&y=${coord.y}&radius=${radiusInMeters}&sort=1&prodcd=${prodcd}&out=json`;
    
    console.log(`\n🔗 API 호출:`);
    console.log(`   x=${coord.x}, y=${coord.y}, radius=${radiusInMeters}m`);
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.RESULT && data.RESULT.OIL && data.RESULT.OIL.length > 0) {
        const count = data.RESULT.OIL.length;
        const firstStation = data.RESULT.OIL[0];
        const address = firstStation.NEW_ADR || firstStation.VAN_ADR || '';

       // console.log(`✅ ${count}개 주유소 발견`);
       // console.log(`\n📍 첫 번째 주유소:`);
       // console.log(`   이름: ${firstStation.OS_NM}`);
       // console.log(`   주소: ${address}`);
       // console.log(`   거리: ${firstStation.DISTANCE}m`);
       // console.log(`   가격: ${firstStation.PRICE}원`);

        // 각 주유소의 KATEC 좌표를 WGS84로 역변환
        data.RESULT.OIL = data.RESULT.OIL.map(station => {
          // 오피넷 API 좌표 필드
          const katecX = parseFloat(station.GIS_X_COOR || 0);
          const katecY = parseFloat(station.GIS_Y_COOR || 0);

          if (katecX && katecY) {
            const wgs84 = reverseConvertCoordinates(katecX, katecY);
            if (wgs84) {
              station.WGS84_LAT = wgs84.lat;
              station.WGS84_LNG = wgs84.lng;
             // console.log(`   🔄 ${station.OS_NM}: KATEC(${katecX}, ${katecY}) → WGS84(${wgs84.lat.toFixed(6)}, ${wgs84.lng.toFixed(6)})`);
            }
          } else {
            console.log(`   ⚠️ ${station.OS_NM}: GIS 좌표 정보 없음`);
          }

          return station;
        });

        // 주소 없는 주유소에 역지오코딩 적용
        const stationsNeedingGeocode = data.RESULT.OIL.filter(
          s => !s.NEW_ADR && !s.VAN_ADR && s.WGS84_LAT && s.WGS84_LNG
        );

        console.log(`\n📍 역지오코딩 시작...`);
        console.log(`   전체 주유소: ${data.RESULT.OIL.length}개`);
        console.log(`   주소 없음: ${stationsNeedingGeocode.length}개`);

        const geocodeStartTime = Date.now();
        let successCount = 0;
        let failCount = 0;

        // 10개씩 배치 처리
        const BATCH_SIZE = 10;
        for (let i = 0; i < stationsNeedingGeocode.length; i += BATCH_SIZE) {
          const batch = stationsNeedingGeocode.slice(i, i + BATCH_SIZE);

          await Promise.all(batch.map(async (station) => {
            const address = await reverseGeocode(station.WGS84_LAT, station.WGS84_LNG);
            if (address) {
              station.REVERSE_GEOCODED_ADDRESS = address;
              successCount++;
            } else {
              failCount++;
            }
          }));

          console.log(`   배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stationsNeedingGeocode.length / BATCH_SIZE)}: ${batch.length}개 처리 완료`);
        }

        const geocodeEndTime = Date.now();

        console.log(`✅ 역지오코딩 완료 (${geocodeEndTime - geocodeStartTime}ms)`);
        console.log(`   성공: ${successCount}개, 실패: ${failCount}개\n`);

        // 지역 확인 및 피드백
        if (address.includes('서울') || address.includes('경기')) {
          console.log(`   ✅ 올바른 지역 (서울/경기)`);
          return { success: true, data, system };
        } else if (address.includes('인천')) {
          console.log(`   ⚠️ 인천 지역 감지`);
          console.log(`   💡 해결: lon_0 값을 127.5 이상으로 증가 필요`);
          return { success: true, data, system, needAdjust: 'increase' };
        } else if (address.includes('강원') || address.includes('충청')) {
          console.log(`   ⚠️ 동쪽 지역 감지`);
          console.log(`   💡 해결: lon_0 값을 126.5 이하로 감소 필요`);
          return { success: true, data, system, needAdjust: 'decrease' };
        } else {
          console.log(`   ⚠️ 예상 외 지역: ${address}`);
          return { success: true, data, system, needAdjust: 'unknown' };
        }
      } else {
        console.log(`   ⚠️ 응답 성공하지만 데이터 없음 (${data.RESULT?.OIL?.length || 0}개)`);
      }
    } catch (error) {
      console.log(`   ❌ API 호출 실패:`, error.message);
    }
  }
  
  return { success: false };
}

app.get('/api/stations', async (req, res) => {
  try {
    const { lat, lng, radius, prodcd = 'B027' } = req.query;
    const OPINET_API_KEY = process.env.OPINET_API_KEY;

    console.log('\n========================================');
    console.log('📍 새 요청:', { lat, lng, radius: `${radius}km`, prodcd });

    if (!lat || !lng || !radius) {
      return res.status(400).json({ error: '필수 파라미터 누락' });
    }

    // 오피넷 API 시도
    if (OPINET_API_KEY) {
      const result = await tryOpinet(parseFloat(lat), parseFloat(lng), parseFloat(radius), OPINET_API_KEY, prodcd);
      
      if (result.success) {
        if (!result.needAdjust || result.needAdjust === 'unknown') {
          console.log(`🎉 좌표계 설정 완료!`);
        }
        console.log('========================================\n');
        return res.json(result.data);
      }
    }

    // 데이터 없음 - 빈 배열 반환
    console.log('⚠️ 주유소 데이터 없음 - 빈 배열 반환');
    console.log('========================================\n');

    res.json({
      RESULT: {
        OIL: []
      }
    });
    
  } catch (error) {
    console.error('❌ 서버 에러:', error);
    res.status(500).json({ error: error.message });
  }
});

// 경로 안내 API (Kakao Mobility Directions)
app.get('/api/route', async (req, res) => {
  try {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'origin and destination required' });
    }

    console.log(`📍 경로 요청: ${origin} → ${destination}`);

    // Kakao Mobility Directions API 호출
    const url = `https://apis-navi.kakaomobility.com/v1/directions?` +
      `origin=${origin}&destination=${destination}&priority=RECOMMEND&car_fuel=GASOLINE`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Kakao API 오류 (${response.status}):`, errorText);
      return res.status(response.status).json({
        error: 'Kakao API error',
        details: errorText
      });
    }

    const data = await response.json();
    console.log('✅ 경로 조회 성공');

    res.json(data);

  } catch (error) {
    console.error('❌ 경로 API 오류:', error);
    res.status(500).json({ error: 'Failed to fetch route', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: '서버 작동 중' });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 오피넷 API 프록시 서버 시작`);
  console.log(`========================================`);
  console.log(`📍 서버: http://localhost:${PORT}`);
  console.log(`\n📐 현재 TM 좌표계 설정:`);
  console.log(`   lon_0 = 128 (기준 경도)`);
  console.log(`   lat_0 = 38 (기준 위도)`);
  console.log(`   y_0 = 600000`);
  console.log(`   x_0 = 400000`);
  console.log(`   k = 0.9999`);
  console.log(`========================================\n`);
});