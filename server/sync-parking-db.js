// 주차장 데이터베이스 동기화 스크립트
// 실행: node server/sync-parking-db.js
// macOS cron 설정 예시: 0 3 1 * * cd /path/to/project/server && node sync-parking-db.js

const Database = require('better-sqlite3');
const fetch = require('node-fetch');
const path = require('path');

// .env 파일 경로 명시
require('dotenv').config({ path: path.join(__dirname, '.env') });

const DB_PATH = path.join(__dirname, 'parking.db');
const db = new Database(DB_PATH);

// 주소를 좌표로 변환 (카카오 지오코딩)
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
    return null;
  }
}

// 서울시 주차장 데이터 가져오기
async function fetchParkingData() {
  console.log('📡 서울시 주차장 API 호출 중...');

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
  console.log(`✅ 첫 번째 배치: ${allParkingLots.length}개 수신 (전체: ${totalCount}개)`);

  // 나머지 데이터 가져오기 (전체)
  for (let startIndex = PAGE_SIZE + 1; startIndex <= totalCount; startIndex += PAGE_SIZE) {
    const endIndex = Math.min(startIndex + PAGE_SIZE - 1, totalCount);
    const apiUrl = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/GetParkInfo/${startIndex}/${endIndex}/`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.GetParkInfo && data.GetParkInfo.row) {
      allParkingLots = allParkingLots.concat(data.GetParkInfo.row);
    }

    // API 제한 방지를 위한 딜레이
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`✅ 총 ${allParkingLots.length}개 주차장 데이터 수신\n`);
  return allParkingLots;
}

// DB에 데이터 동기화
async function syncParkingLots(parkingLots) {
  console.log('🔄 DB 동기화 시작...\n');

  // 기존 DB의 주차장 정보 (코드와 좌표)
  const existingData = new Map(
    db.prepare('SELECT pklt_cd, latitude, longitude FROM parking_lots').all()
      .map(r => [r.pklt_cd, { lat: r.latitude, lng: r.longitude }])
  );

  const insert = db.prepare(`
    INSERT INTO parking_lots (
      pklt_cd, pklt_nm, addr, latitude, longitude,
      tpkct, prk_crg, prk_hm, add_crg, add_unit_tm_mnt, dly_max_crg,
      oper_se_nm, chgd_free_nm, wd_oper_bgng_tm, wd_oper_end_tm, telno,
      raw_data, geocoded, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const update = db.prepare(`
    UPDATE parking_lots SET
      pklt_nm = ?, addr = ?, latitude = ?, longitude = ?,
      tpkct = ?, prk_crg = ?, prk_hm = ?, add_crg = ?, add_unit_tm_mnt = ?, dly_max_crg = ?,
      oper_se_nm = ?, chgd_free_nm = ?, wd_oper_bgng_tm = ?, wd_oper_end_tm = ?, telno = ?,
      raw_data = ?, geocoded = ?, updated_at = CURRENT_TIMESTAMP
    WHERE pklt_cd = ?
  `);

  let newCount = 0;
  let updateCount = 0;
  let needsGeocoding = [];

  for (const lot of parkingLots) {
    const existing = existingData.get(lot.PKLT_CD);
    const isNew = !existing;
    const apiHasCoords = lot.LAT && lot.LAT !== 0 && lot.LOT && lot.LOT !== 0;

    // 좌표 결정: API에 있으면 API 좌표, 없으면 기존 좌표 유지
    let finalLat, finalLng, finalGeocoded;

    if (apiHasCoords) {
      // API에 좌표가 있으면 사용
      finalLat = lot.LAT;
      finalLng = lot.LOT;
      finalGeocoded = 1;
    } else if (!isNew && existing.lat && existing.lng) {
      // API에 좌표 없고, 기존 DB에 있으면 유지
      finalLat = existing.lat;
      finalLng = existing.lng;
      finalGeocoded = 1;
    } else {
      // 둘 다 없으면 null (지오코딩 필요)
      finalLat = null;
      finalLng = null;
      finalGeocoded = 0;
    }

    if (isNew) {
      insert.run(
        lot.PKLT_CD,
        lot.PKLT_NM,
        lot.ADDR,
        finalLat,
        finalLng,
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
        finalGeocoded
      );

      newCount++;
      if (!finalLat && lot.ADDR) {
        needsGeocoding.push(lot);
      }
    } else {
      update.run(
        lot.PKLT_NM,
        lot.ADDR,
        finalLat,
        finalLng,
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
        finalGeocoded,
        lot.PKLT_CD
      );

      updateCount++;
    }
  }

  console.log(`📊 동기화 결과:`);
  console.log(`   신규 추가: ${newCount}개`);
  console.log(`   업데이트: ${updateCount}개`);
  console.log(`   지오코딩 필요: ${needsGeocoding.length}개\n`);

  return needsGeocoding;
}

// 지오코딩 수행 (신규 주차장만)
async function geocodeNewParking(needsGeocoding) {
  if (needsGeocoding.length === 0) {
    console.log('✅ 지오코딩 필요 없음\n');
    return;
  }

  console.log(`📍 카카오 지오코딩 시작 (${needsGeocoding.length}개)...\n`);

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
  console.log(`   실패: ${failCount}개\n`);
}

// 최종 통계 출력
function printStats() {
  console.log('📊 최종 DB 통계:');

  const total = db.prepare('SELECT COUNT(*) as count FROM parking_lots').get();
  const withCoords = db.prepare('SELECT COUNT(*) as count FROM parking_lots WHERE latitude IS NOT NULL').get();
  const geocoded = db.prepare('SELECT COUNT(*) as count FROM parking_lots WHERE geocoded = 1').get();

  console.log(`   전체 주차장: ${total.count}개`);
  console.log(`   좌표 있음: ${withCoords.count}개 (${(withCoords.count / total.count * 100).toFixed(1)}%)`);
  console.log(`   지오코딩됨: ${geocoded.count}개`);
}

// 메인 실행
async function main() {
  const startTime = new Date();
  console.log('\n' + '='.repeat(60));
  console.log('🔄 주차장 데이터베이스 동기화 시작');
  console.log(`⏰ 시작 시간: ${startTime.toLocaleString('ko-KR')}`);
  console.log('='.repeat(60) + '\n');

  try {
    // 1. 서울시 API에서 최신 데이터 가져오기
    const parkingLots = await fetchParkingData();

    // 2. DB 동기화 (신규/업데이트)
    const needsGeocoding = await syncParkingLots(parkingLots);

    // 3. 신규 주차장 지오코딩
    await geocodeNewParking(needsGeocoding);

    // 4. 최종 통계
    printStats();

    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 동기화 완료!');
    console.log(`⏱️  소요 시간: ${duration}초`);
    console.log(`📁 DB 파일: ${DB_PATH}`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
