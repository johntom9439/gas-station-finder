// 주차장 데이터베이스 초기화 스크립트
// 실행: node server/init-parking-db.js

const Database = require('better-sqlite3');
const fetch = require('node-fetch');
const path = require('path');

// .env 파일 경로 명시
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = new Database(path.join(__dirname, 'parking.db'));

// DB 스키마 생성
function createSchema() {
  console.log('📦 DB 스키마 생성 중...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS parking_lots (
      pklt_cd TEXT PRIMARY KEY,
      pklt_nm TEXT NOT NULL,
      addr TEXT,
      latitude REAL,
      longitude REAL,
      tpkct REAL,
      prk_crg REAL,
      prk_hm REAL,
      add_crg REAL,
      add_unit_tm_mnt REAL,
      dly_max_crg REAL,
      oper_se_nm TEXT,
      chgd_free_nm TEXT,
      wd_oper_bgng_tm TEXT,
      wd_oper_end_tm TEXT,
      telno TEXT,
      raw_data TEXT,
      geocoded INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_coordinates ON parking_lots(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_location ON parking_lots(latitude, longitude) WHERE latitude IS NOT NULL;
  `);

  console.log('✅ 스키마 생성 완료');
}

// 주소를 좌표로 변환
async function addressToCoordinates(address) {
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent('서울특별시 ' + address)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `KakaoAK ${process.env.KAKAO_REST_API_KEY}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.documents && data.documents.length > 0) {
      return {
        lat: parseFloat(data.documents[0].y),
        lng: parseFloat(data.documents[0].x)
      };
    }

    return null;
  } catch (error) {
    console.error('❌ 지오코딩 실패:', address, error.message);
    return null;
  }
}

// 서울시 주차장 데이터 가져오기
async function fetchParkingData() {
  console.log('\n📡 서울시 주차장 API 호출 중...');

  const SEOUL_API_KEY = process.env.SEOUL_PARKING_API_KEY;
  let allParkingLots = [];
  const PAGE_SIZE = 1000;

  // 첫 번째 요청
  const firstUrl = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/GetParkInfo/1/${PAGE_SIZE}/`;
  const firstResponse = await fetch(firstUrl);
  const firstData = await firstResponse.json();

  if (!firstData.GetParkInfo || !firstData.GetParkInfo.row) {
    throw new Error('주차장 데이터를 가져올 수 없습니다');
  }

  const totalCount = firstData.GetParkInfo.list_total_count;
  allParkingLots = firstData.GetParkInfo.row;
  console.log(`✅ 첫 번째 배치: ${allParkingLots.length}개 (전체: ${totalCount}개)`);

  // 나머지 데이터 가져오기 (전체)
  for (let startIndex = PAGE_SIZE + 1; startIndex <= totalCount; startIndex += PAGE_SIZE) {
    const endIndex = Math.min(startIndex + PAGE_SIZE - 1, totalCount);
    const apiUrl = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/GetParkInfo/${startIndex}/${endIndex}/`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.GetParkInfo && data.GetParkInfo.row) {
      allParkingLots = allParkingLots.concat(data.GetParkInfo.row);
      console.log(`✅ 배치 ${Math.floor(startIndex / PAGE_SIZE) + 1}: ${data.GetParkInfo.row.length}개 추가 (누적: ${allParkingLots.length}개)`);
    }

    // API 제한 방지를 위한 딜레이
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`✅ 총 ${allParkingLots.length}개 주차장 데이터 수신\n`);
  return allParkingLots;
}

// DB에 데이터 저장
async function saveParkingLots(parkingLots) {
  console.log('💾 DB에 저장 중...');

  const insert = db.prepare(`
    INSERT OR REPLACE INTO parking_lots (
      pklt_cd, pklt_nm, addr, latitude, longitude,
      tpkct, prk_crg, prk_hm, add_crg, add_unit_tm_mnt, dly_max_crg,
      oper_se_nm, chgd_free_nm, wd_oper_bgng_tm, wd_oper_end_tm, telno,
      raw_data, geocoded
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let savedCount = 0;
  let needsGeocoding = [];

  for (const lot of parkingLots) {
    const hasCoords = lot.LAT && lot.LAT !== 0 && lot.LOT && lot.LOT !== 0;

    insert.run(
      lot.PKLT_CD,
      lot.PKLT_NM,
      lot.ADDR,
      hasCoords ? lot.LAT : null,
      hasCoords ? lot.LOT : null,
      lot.TPKCT,
      lot.PRK_CRG,
      lot.PRK_HM,
      lot.ADD_CRG,
      lot.ADD_UNIT_TM_MNT,
      lot.DLY_MAX_CRG,
      lot.OPER_SE_NM,
      lot.CHGD_FREE_NM,
      lot.WD_OPER_BGNG_TM,
      lot.WD_OPER_END_TM,
      lot.TELNO,
      JSON.stringify(lot),
      hasCoords ? 1 : 0
    );

    savedCount++;

    if (!hasCoords && lot.ADDR) {
      needsGeocoding.push(lot);
    }

    if (savedCount % 500 === 0) {
      console.log(`   저장됨: ${savedCount}/${parkingLots.length}`);
    }
  }

  console.log(`✅ ${savedCount}개 주차장 저장 완료`);
  console.log(`⚠️  좌표 없음: ${needsGeocoding.length}개\n`);

  return needsGeocoding;
}

// 지오코딩 수행
async function geocodeMissingCoordinates(needsGeocoding) {
  if (needsGeocoding.length === 0) {
    console.log('✅ 모든 주차장에 좌표가 있습니다');
    return;
  }

  console.log(`📍 카카오 지오코딩 시작 (${needsGeocoding.length}개)...`);
  console.log('⏱️  예상 소요 시간: 약 ${Math.ceil(needsGeocoding.length * 0.1 / 60)}분\n');

  const update = db.prepare(`
    UPDATE parking_lots
    SET latitude = ?, longitude = ?, geocoded = 1
    WHERE pklt_cd = ?
  `);

  let successCount = 0;
  let failCount = 0;

  // 10개씩 배치 처리
  const BATCH_SIZE = 10;
  for (let i = 0; i < needsGeocoding.length; i += BATCH_SIZE) {
    const batch = needsGeocoding.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (lot) => {
      const coords = await addressToCoordinates(lot.ADDR);
      if (coords) {
        update.run(coords.lat, coords.lng, lot.PKLT_CD);
        successCount++;
      } else {
        failCount++;
      }
    }));

    if ((i / BATCH_SIZE) % 10 === 0) {
      const progress = Math.min(i + BATCH_SIZE, needsGeocoding.length);
      console.log(`   진행: ${progress}/${needsGeocoding.length} (성공: ${successCount}, 실패: ${failCount})`);
    }

    // API 제한 방지
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n✅ 지오코딩 완료!`);
  console.log(`   성공: ${successCount}개`);
  console.log(`   실패: ${failCount}개`);
}

// 통계 출력
function printStats() {
  console.log('\n📊 DB 통계:');

  const total = db.prepare('SELECT COUNT(*) as count FROM parking_lots').get();
  const withCoords = db.prepare('SELECT COUNT(*) as count FROM parking_lots WHERE latitude IS NOT NULL').get();
  const geocoded = db.prepare('SELECT COUNT(*) as count FROM parking_lots WHERE geocoded = 1').get();

  console.log(`   전체 주차장: ${total.count}개`);
  console.log(`   좌표 있음: ${withCoords.count}개 (${(withCoords.count / total.count * 100).toFixed(1)}%)`);
  console.log(`   지오코딩됨: ${geocoded.count}개`);
}

// 메인 실행
async function main() {
  console.log('🚀 주차장 데이터베이스 초기화 시작\n');
  console.log('='.repeat(60));

  try {
    // 1. 스키마 생성
    createSchema();

    // 2. 데이터 가져오기
    const parkingLots = await fetchParkingData();

    // 3. DB에 저장
    const needsGeocoding = await saveParkingLots(parkingLots);

    // 4. 지오코딩
    await geocodeMissingCoordinates(needsGeocoding);

    // 5. 통계
    printStats();

    console.log('\n' + '='.repeat(60));
    console.log('✅ 데이터베이스 초기화 완료!');
    console.log(`📁 DB 파일: server/parking.db`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
