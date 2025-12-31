const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const proj4 = require('proj4');
require('dotenv').config();

const app = express();
const PORT = 3001;

app.use(cors({ origin: '*', methods: ['GET', 'POST'], credentials: true }));

// 단일 좌표계 정의 - lon_0=127로 고정
proj4.defs([
  ['EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs'],
  ['TM_OPINET', '+proj=tmerc +lat_0=37.9674 +lon_0=125.75 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs'],
]);

// 좌표 변환 함수 (단일 좌표계만 사용)
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

// 오피넷 API 호출
async function tryOpinet(lat, lng, radius, apiKey) {
  const coords = convertCoordinates(lat, lng);
  const radiusInMeters = Math.round(radius * 1000);
  
  console.log('🔄 변환된 좌표:');
  Object.entries(coords).forEach(([system, coord]) => {
    if (!coord.error) {
      console.log(`   ${system}: x=${coord.x}, y=${coord.y}`);
      console.log(`   설정: lon_0=127, y_0=600000`);
    }
  });
  
  // TM_OPINET 좌표계로 시도
  for (const [system, coord] of Object.entries(coords)) {
    if (coord.error) {
      console.log(`   ❌ 좌표 변환 실패:`, coord.error);
      continue;
    }
    
    const url = `https://www.opinet.co.kr/api/aroundAll.do?code=${apiKey}&x=${coord.x}&y=${coord.y}&radius=${radiusInMeters}&sort=1&prodcd=B027&out=json`;
    
    console.log(`\n🔗 API 호출:`);
    console.log(`   x=${coord.x}, y=${coord.y}, radius=${radiusInMeters}m`);
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.RESULT && data.RESULT.OIL && data.RESULT.OIL.length > 0) {
        const count = data.RESULT.OIL.length;
        const firstStation = data.RESULT.OIL[0];
        const address = firstStation.NEW_ADR || firstStation.VAN_ADR || '';
        
        console.log(`✅ ${count}개 주유소 발견`);
        console.log(`\n📍 첫 번째 주유소:`);
        console.log(`   이름: ${firstStation.OS_NM}`);
        console.log(`   주소: ${address}`);
        console.log(`   거리: ${firstStation.DISTANCE}m`);
        console.log(`   가격: ${firstStation.PRICE}원`);
        
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
    const { lat, lng, radius } = req.query;
    const OPINET_API_KEY = process.env.OPINET_API_KEY;

    console.log('\n========================================');
    console.log('📍 새 요청:', { lat, lng, radius: `${radius}km` });

    if (!lat || !lng || !radius) {
      return res.status(400).json({ error: '필수 파라미터 누락' });
    }

    // 오피넷 API 시도
    if (OPINET_API_KEY) {
      const result = await tryOpinet(parseFloat(lat), parseFloat(lng), parseFloat(radius), OPINET_API_KEY);
      
      if (result.success) {
        if (!result.needAdjust || result.needAdjust === 'unknown') {
          console.log(`🎉 좌표계 설정 완료!`);
        }
        console.log('========================================\n');
        return res.json(result.data);
      }
    }

    // Mock 데이터
    console.log('🎭 Mock 데이터 생성');
    console.log('========================================\n');
    const mockStations = generateMockStations(parseFloat(lat), parseFloat(lng), parseFloat(radius));
    
    res.json({
      RESULT: {
        OIL: mockStations
      }
    });
    
  } catch (error) {
    console.error('❌ 서버 에러:', error);
    res.status(500).json({ error: error.message });
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
  console.log(`   lon_0 = 127 (기준 경도)`);
  console.log(`   lat_0 = 38 (기준 위도)`);
  console.log(`   y_0 = 600000`);
  console.log(`   x_0 = 200000`);
  console.log(`   k = 1`);
  console.log(`\n💡 lon_0 조정 가이드:`);
  console.log(`   인천이 나오면 → lon_0을 127.5~128로 증가`);
  console.log(`   강원도가 나오면 → lon_0을 126~126.5로 감소`);
  console.log(`   서울/경기가 나올 때까지 0.1~0.5씩 조정`);
  console.log(`========================================\n`);
});