// DB 조회 유틸리티
// 사용법: node server/query-db.js [명령어]

const Database = require('better-sqlite3');
const db = new Database('server/parking.db', { readonly: true });

const command = process.argv[2] || 'stats';

switch (command) {
  case 'stats':
    // 통계
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM parking_lots').get().count,
      withCoords: db.prepare('SELECT COUNT(*) as count FROM parking_lots WHERE latitude IS NOT NULL').get().count,
      geocoded: db.prepare('SELECT COUNT(*) as count FROM parking_lots WHERE geocoded = 1').get().count
    };

    console.log('📊 DB 통계:');
    console.log(`   전체: ${stats.total}개`);
    console.log(`   좌표 있음: ${stats.withCoords}개 (${(stats.withCoords / stats.total * 100).toFixed(1)}%)`);
    console.log(`   지오코딩됨: ${stats.geocoded}개`);
    break;

  case 'sample':
    // 샘플 데이터
    const samples = db.prepare(`
      SELECT pklt_nm, addr, ROUND(latitude, 6) as lat, ROUND(longitude, 6) as lng, tpkct
      FROM parking_lots
      WHERE latitude IS NOT NULL
      LIMIT 10
    `).all();

    console.log('\n📍 샘플 주차장 (10개):\n');
    samples.forEach((row, i) => {
      console.log(`${i + 1}. ${row.pklt_nm}`);
      console.log(`   주소: ${row.addr}`);
      console.log(`   좌표: (${row.lat}, ${row.lng})`);
      console.log(`   주차면: ${row.tpkct}대\n`);
    });
    break;

  case 'near':
    // 특정 위치 근처 (서울시청)
    const lat = parseFloat(process.argv[3]) || 37.5665;
    const lng = parseFloat(process.argv[4]) || 126.9780;
    const radius = parseFloat(process.argv[5]) || 1; // km

    const nearby = db.prepare(`
      SELECT
        pklt_nm,
        addr,
        latitude,
        longitude,
        tpkct,
        prk_crg,
        (6371 * 2 * ASIN(SQRT(
          POWER(SIN((latitude - ?) * 0.0174533 / 2), 2) +
          COS(latitude * 0.0174533) * COS(? * 0.0174533) *
          POWER(SIN((longitude - ?) * 0.0174533 / 2), 2)
        ))) * 1000 as distance
      FROM parking_lots
      WHERE latitude IS NOT NULL
      HAVING distance <= ?
      ORDER BY distance
      LIMIT 10
    `).all(lat, lat, lng, radius * 1000);

    console.log(`\n📍 ${lat}, ${lng} 근처 ${radius}km 이내 주차장:\n`);
    nearby.forEach((row, i) => {
      console.log(`${i + 1}. ${row.pklt_nm} (${Math.round(row.distance)}m)`);
      console.log(`   주소: ${row.addr}`);
      console.log(`   요금: ${row.prk_crg}원`);
      console.log(`   주차면: ${row.tpkct}대\n`);
    });
    break;

  case 'search':
    // 검색
    const keyword = process.argv[3];
    if (!keyword) {
      console.log('사용법: node server/query-db.js search [키워드]');
      break;
    }

    const results = db.prepare(`
      SELECT pklt_nm, addr, latitude, longitude, tpkct
      FROM parking_lots
      WHERE pklt_nm LIKE ? OR addr LIKE ?
      LIMIT 20
    `).all(`%${keyword}%`, `%${keyword}%`);

    console.log(`\n🔍 "${keyword}" 검색 결과 (${results.length}개):\n`);
    results.forEach((row, i) => {
      console.log(`${i + 1}. ${row.pklt_nm}`);
      console.log(`   주소: ${row.addr}`);
      console.log(`   좌표: ${row.latitude ? `(${row.latitude.toFixed(6)}, ${row.longitude.toFixed(6)})` : '없음'}\n`);
    });
    break;

  default:
    console.log('사용법:');
    console.log('  node server/query-db.js stats                  # 통계');
    console.log('  node server/query-db.js sample                 # 샘플 10개');
    console.log('  node server/query-db.js near [lat] [lng] [km]  # 근처 주차장');
    console.log('  node server/query-db.js search [키워드]          # 검색');
}

db.close();
