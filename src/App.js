import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, TrendingDown, Search, Fuel, Clock, Info, ChevronLeft, ChevronRight } from 'lucide-react';

// 오피넷 API 설정
const BACKEND_API_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3001' // 로컬 개발용
  : 'https://gas-station-finder-backend.onrender.com'; // 프로덕션용

// 주소를 좌표로 변환하는 함수
const addressToCoordinates = (address) => {
  return new Promise((resolve, reject) => {
    if (!window.kakao || !window.kakao.maps) {
      reject(new Error('카카오 지도 API가 로드되지 않았습니다.'));
      return;
    }

    const geocoder = new window.kakao.maps.services.Geocoder();
    
    geocoder.addressSearch(address, function(result, status) {
      if (status === window.kakao.maps.services.Status.OK) {
        resolve({
          lat: parseFloat(result[0].y),
          lng: parseFloat(result[0].x)
        });
      } else {
        reject(new Error('주소를 좌표로 변환할 수 없습니다.'));
      }
    });
  });
};

// 백엔드 API 호출 (KATEC 좌표 포함)
const fetchNearbyStations = async (lat, lng, radius) => {
  try {
    console.log('📡 백엔드 API 호출:', { lat, lng, radius });
    
    // 카카오 좌표 변환 (WGS84 → KATEC)
    let katecX = lng;
    let katecY = lat;
    
    
    
    // 백엔드 프록시 서버로 요청 (WGS84 좌표 그대로 전송, 백엔드에서 변환)
    const url = `${BACKEND_API_URL}/api/stations?lat=${lat}&lng=${lng}&radius=${radius}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ 오피넷 API 응답:', data);
    
    // 오피넷 API 응답 구조 확인
    if (data.RESULT && data.RESULT.OIL && Array.isArray(data.RESULT.OIL)) {
      const stations = data.RESULT.OIL.map((station, index) => {
        // 브랜드명 매핑
        const brandMap = {
          'SKE': 'SK에너지',
          'GS': 'GS칼텍스',
          'GSC': 'GS칼텍스',
          'HDO': '현대오일뱅크',
          'SOL': 'S-OIL',
          'NHO': '농협',
          'ETC': '알뜰주유소',
          'SKG': 'SK가스',
          'E1': 'E1'
        };
        
        return {
          id: station.UNI_ID || `station_${index}`,
          name: station.OS_NM || '정보없음',
          brand: brandMap[station.POLL_DIV_CD] || station.POLL_DIV_CD || '기타',
          price: parseInt(station.PRICE) || 0,
          distance: parseFloat(station.DISTANCE) / 1000 || 0, // 미터를 km로 변환
          address: station.REVERSE_GEOCODED_ADDRESS || station.NEW_ADR || station.VAN_ADR || '주소 정보 없음',
          lastUpdate: station.PRICE_DT || new Date().toISOString().slice(0, 10),
          // KATEC에서 역변환된 WGS84 좌표
          lat: station.WGS84_LAT || null,
          lng: station.WGS84_LNG || null
        };
      }).filter(station => station.price > 0); // 가격 정보가 있는 주유소만
      
      console.log('✅ 파싱된 주유소 데이터:', stations.length, '개');
      
      if (stations.length > 0) {
        return stations.sort((a, b) => a.price - b.price);
      }
    }

    // 데이터가 없으면 빈 배열 반환
    console.log('⚠️ 오피넷 API에서 데이터가 없습니다.');
    return [];

  } catch (error) {
    console.error('❌ 백엔드 API 호출 실패:', error);

    // 백엔드 서버가 꺼져있을 때 안내
    if (error.message.includes('fetch')) {
      console.error('⚠️ 백엔드 서버가 실행 중이 아닙니다. npm run server 명령어로 서버를 시작하세요.');
    }

    // API 실패 시 빈 배열 반환
    return [];
  }
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(to bottom right, #eff6ff, #e0e7ff)',
    padding: '2rem',
  },
  maxWidth: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
  desktopLayout: {
    display: 'flex',
    gap: '1.5rem',
    alignItems: 'flex-start',
  },
  leftPanel: {
    flex: '0 0 450px',
    minWidth: '400px',
    maxWidth: '500px',
    overflowY: 'auto',
  },
  rightPanel: {
    flex: '1',
    minWidth: '0',
    position: 'sticky',
    top: '2rem',
    alignSelf: 'flex-start',
  },
  card: {
    background: 'white',
    borderRadius: '1rem',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  iconBox: {
    background: '#2563eb',
    padding: '0.75rem',
    borderRadius: '0.75rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#111827',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    margin: 0,
  },
  inputGroup: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.5rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    border: '2px solid #e5e7eb',
    borderRadius: '0.75rem',
    fontSize: '1rem',
    background: '#f9fafb',
    boxSizing: 'border-box',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    gap: '0.5rem',
    flex: 1,
  },
  inputIcon: {
    position: 'absolute',
    left: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#9ca3af',
  },
  button: {
    padding: '0.75rem 1.5rem',
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.75rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  slider: {
    width: '100%',
    height: '0.5rem',
    background: '#bfdbfe',
    borderRadius: '0.5rem',
    appearance: 'none',
    cursor: 'pointer',
    accentColor: '#2563eb',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  summaryCard: {
    background: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    padding: '1.25rem',
  },
  summaryCardBlue: {
    background: 'linear-gradient(to bottom right, #2563eb, #1d4ed8)',
    color: 'white',
  },
  summaryCardPurple: {
    background: 'linear-gradient(to bottom right, #8b5cf6, #7c3aed)',
    color: 'white',
  },
  summaryCardGreen: {
    background: 'linear-gradient(to bottom right, #10b981, #059669)',
    color: 'white',
  },
  tabs: {
    background: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    padding: '0.5rem',
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  tab: {
    flex: 1,
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: '#2563eb',
    color: 'white',
  },
  tabInactive: {
    background: '#f9fafb',
    color: '#374151',
  },
  stationCard: {
    background: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    padding: '1.25rem',
    marginBottom: '0.75rem',
    transition: 'box-shadow 0.2s',
  },
  stationCardHover: {
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },
  badge: {
    display: 'inline-block',
    padding: '0.25rem 0.5rem',
    background: '#f3f4f6',
    color: '#374151',
    fontSize: '0.75rem',
    borderRadius: '0.25rem',
    marginRight: '0.5rem',
  },
  badgeBlue: {
    background: '#2563eb',
    color: 'white',
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    borderRadius: '0.25rem',
  },
  priceBox: {
    fontSize: '1.875rem',
    fontWeight: 'bold',
    color: '#111827',
  },
  analysisBox: {
    background: '#f9fafb',
    borderRadius: '0.5rem',
    padding: '0.75rem',
    marginTop: '0.75rem',
  },
  progressBar: {
    height: '0.5rem',
    background: '#e5e7eb',
    borderRadius: '9999px',
    overflow: 'hidden',
    marginTop: '0.25rem',
  },
  progressFill: {
    height: '100%',
    borderRadius: '9999px',
    transition: 'width 0.3s',
  },
  mapContainer: {
    width: '100%',
    height: 'calc(100vh - 200px)',
    minHeight: '600px',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    height: '100vh',
    background: 'white',
    boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)',
    transition: 'transform 0.3s ease',
    zIndex: 1000,
    overflowY: 'auto',
    width: '450px',
  },
  sidebarCollapsed: {
    transform: 'translateX(-100%)',
  },
  sidebarToggle: {
    position: 'fixed',
    left: '450px',
    top: '10px',
    padding: '0.5rem',
    background: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0 0.5rem 0.5rem 0',
    cursor: 'pointer',
    boxShadow: '2px 2px 8px rgba(0, 0, 0, 0.2)',
    zIndex: 1001,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'left 0.3s ease',
  },
  sidebarToggleCollapsed: {
    left: '0',
  },
  mainContentWithSidebar: {
    marginLeft: '470px',
    transition: 'margin-left 0.3s ease',
  },
  mainContentWithSidebarCollapsed: {
    marginLeft: '0',
  },
  bottomSheet: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'white',
    borderRadius: '1rem 1rem 0 0',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
    transition: 'transform 0.3s ease',
    zIndex: 2000,
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  bottomSheetClosed: {
    transform: 'translateY(100%)',
  },
  bottomSheetOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1999,
    transition: 'opacity 0.3s ease',
  },
  compactInput: {
    width: '100%',
    padding: '0.5rem 0.75rem 0.5rem 2rem',
    border: '2px solid #e5e7eb',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    background: '#f9fafb',
    boxSizing: 'border-box',
  },
  compactSlider: {
    width: '100%',
    height: '0.4rem',
    background: '#bfdbfe',
    borderRadius: '0.5rem',
    appearance: 'none',
    cursor: 'pointer',
    accentColor: '#2563eb',
  },
};

const calculateTravelCost = (distance, fuelPrice) => {
  const fuelEfficiency = 12;
  const litersNeeded = (distance * 2) / fuelEfficiency;
  return Math.round(litersNeeded * fuelPrice);
};

const calculateSavings = (stationPrice, averagePrice, distance) => {
  const fixedRefuelAmount = 40; // 고정 주유량 40L
  const priceDiff = averagePrice - stationPrice;
  const totalSavings = priceDiff * fixedRefuelAmount;
  const travelCost = calculateTravelCost(distance, averagePrice);
  const netSavings = totalSavings - travelCost;

  return {
    totalSavings,
    travelCost,
    netSavings,
    isWorthIt: netSavings > 0
  };
};

const GasStationDashboard = () => {
  const [address, setAddress] = useState('서울시청');
  const [radius, setRadius] = useState(5.0); // 기본값 5km (오피넷 API 최대 반경)
  const [allStations, setAllStations] = useState([]); // 5km 내 모든 주유소
  const [stations, setStations] = useState([]); // radius로 필터링된 주유소
  const [sortMode, setSortMode] = useState('price');
  const [hoveredCard, setHoveredCard] = useState(null);
  const [coordinates, setCoordinates] = useState({ lat: 37.5664, lng: 126.9778 });
  const [loading, setLoading] = useState(false);
  const [kakaoLoaded, setKakaoLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const hasLoadedRef = React.useRef(false); // 중복 로드 방지
  const mapRef = React.useRef(null); // 지도 DOM 참조
  const mapInstanceRef = React.useRef(null); // 지도 인스턴스
  const centerMarkerRef = React.useRef(null); // 중심점 마커
  const circleRef = React.useRef(null); // 검색 반경 원
  const stationMarkersRef = React.useRef([]); // 주유소 마커들
  const currentInfoWindowRef = React.useRef(null); // 현재 열린 인포윈도우

  // 반응형 처리
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // isMobile 변경 시 지도 완전 재초기화
  useEffect(() => {
    // 지도 인스턴스가 존재하면 완전히 초기화
    if (mapInstanceRef.current) {
      console.log('🔄 모바일/데스크톱 전환 감지 - 지도 재초기화');

      // 모든 마커와 오버레이 제거
      if (centerMarkerRef.current) {
        centerMarkerRef.current.setMap(null);
        centerMarkerRef.current = null;
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      stationMarkersRef.current.forEach(marker => {
        if (marker.setMap) marker.setMap(null);
      });
      stationMarkersRef.current = [];
      if (currentInfoWindowRef.current) {
        currentInfoWindowRef.current.close();
        currentInfoWindowRef.current = null;
      }

      // 지도 인스턴스 초기화
      mapInstanceRef.current = null;
    }
  }, [isMobile]);

  // 카카오 지도 API 로드 확인
  useEffect(() => {
    const checkKakao = () => {
      if (window.kakao && window.kakao.maps) {
        console.log('✅ 카카오 지도 API 로드 완료');
        setKakaoLoaded(true);
      } else {
        console.log('⏳ 카카오 지도 API 로딩 중...');
        setTimeout(checkKakao, 100);
      }
    };
    checkKakao();
  }, []);

  // 초기 로드 (사용자 현재 위치 기반으로 5km 데이터 가져오기)
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;

      // 브라우저 Geolocation API로 현재 위치 가져오기
      if (navigator.geolocation) {
        console.log('📍 사용자 현재 위치 가져오는 중...');

        navigator.geolocation.getCurrentPosition(
          (position) => {
            // 성공: 사용자 현재 위치로 설정
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            console.log('✅ 현재 위치:', userLocation);
            setCoordinates(userLocation);
            setAddress('현재 위치');
            // 현재 위치 좌표로 주유소 데이터 로드
            loadStations(userLocation.lat, userLocation.lng);
          },
          (error) => {
            // 실패 또는 권한 거부: 서울시청 fallback
            console.warn('⚠️ 위치 권한 거부 또는 실패, 서울시청으로 기본 설정:', error.message);
            loadStations(); // 기본 좌표(서울시청)로 로드
          },
          {
            enableHighAccuracy: true, // 고정밀 위치
            timeout: 10000, // 10초 타임아웃
            maximumAge: 0 // 캐시 사용 안 함
          }
        );
      } else {
        // Geolocation API 미지원 브라우저
        console.warn('⚠️ Geolocation API 미지원, 서울시청으로 기본 설정');
        loadStations();
      }
    }
  }, []); // ✅ 컴포넌트 마운트 시 한 번만 호출 (Strict Mode에서도)

  // radius 변경 시 필터링만 수행 (API 호출 없음)
  useEffect(() => {
    const filtered = allStations.filter(station => station.distance <= radius);
    setStations(filtered);
  }, [radius, allStations]);

  // 카카오맵 초기화 및 업데이트
  useEffect(() => {
    if (!kakaoLoaded || !mapRef.current) return;

    const kakao = window.kakao;

    // 현재 좌표로 중심점 생성
    const newCenter = new kakao.maps.LatLng(coordinates.lat, coordinates.lng);

    // 지도 초기화 (최초 1회 또는 isMobile 변경 시)
    if (!mapInstanceRef.current) {
      const container = mapRef.current;
      const options = {
        center: newCenter,
        level: 6, // 확대 레벨 (한 단계 덜 확대)
        draggable: true, // 마우스 드래그 이동 가능
        scrollwheel: true, // 마우스 휠로 확대/축소 가능
        disableDoubleClick: false, // 더블클릭 확대 가능
        disableDoubleClickZoom: false
      };

      mapInstanceRef.current = new kakao.maps.Map(container, options);

      // 지도 컨트롤 추가
      const mapTypeControl = new kakao.maps.MapTypeControl();
      mapInstanceRef.current.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);

      const zoomControl = new kakao.maps.ZoomControl();
      mapInstanceRef.current.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

      console.log('✅ 카카오맵 초기화 완료 (드래그/확대축소 활성화)');

      // 지도 생성 직후 레이아웃 재조정 (모바일/데스크톱 전환 대응)
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.relayout();
          mapInstanceRef.current.setCenter(newCenter);
          console.log('✅ 지도 레이아웃 재조정 및 중심 설정 완료');
        }
      }, 200);
    } else {
      // 기존 지도가 있으면 중심만 이동
      mapInstanceRef.current.setCenter(newCenter);
    }

    // 기존 중심점 마커 제거
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setMap(null);
    }

    // 새 중심점 마커 추가 (빨간색)
    centerMarkerRef.current = new kakao.maps.Marker({
      position: newCenter,
      map: mapInstanceRef.current,
      image: new kakao.maps.MarkerImage(
        'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png',
        new kakao.maps.Size(30, 42)
      )
    });

    // 기존 원 제거
    if (circleRef.current) {
      circleRef.current.setMap(null);
    }

    // 검색 반경 원 추가
    circleRef.current = new kakao.maps.Circle({
      center: newCenter,
      radius: radius * 1000, // km를 m로 변환
      strokeWeight: 2,
      strokeColor: '#2563eb',
      strokeOpacity: 0.8,
      strokeStyle: 'solid',
      fillColor: '#2563eb',
      fillOpacity: 0.1
    });

    circleRef.current.setMap(mapInstanceRef.current);

  }, [coordinates, radius, kakaoLoaded, isMobile]);

  // 주유소 마커 업데이트 (검색 반경 내의 주유소만)
  useEffect(() => {
    if (!kakaoLoaded || !mapInstanceRef.current) return;

    const kakao = window.kakao;

    // 기존 주유소 마커들 제거
    stationMarkersRef.current.forEach(marker => marker.setMap(null));
    stationMarkersRef.current = [];

    // 기존 인포윈도우 닫기
    if (currentInfoWindowRef.current) {
      currentInfoWindowRef.current.close();
      currentInfoWindowRef.current = null;
    }

    // 전역 트로피 클릭 함수들 정리
    Object.keys(window).forEach(key => {
      if (key.startsWith('openTrophyInfo_')) {
        delete window[key];
      }
    });

    // 평균 가격 계산
    const averagePrice = stations.length > 0
      ? Math.round(stations.reduce((sum, s) => sum + s.price, 0) / stations.length)
      : 0;

    // sortedStations 계산 (정렬된 배열)
    const sortedStations = [...stations].sort((a, b) => {
      if (sortMode === 'price') {
        // 최저가 탭: 가격 오름차순 → 같으면 거리 오름차순
        if (a.price !== b.price) return a.price - b.price;
        return a.distance - b.distance;
      }

      if (sortMode === 'distance') {
        // 최단거리 탭: 거리 오름차순 → 같으면 가격 오름차순
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.price - b.price;
      }

      // 가성비 탭: 순절약금액 내림차순
      const savingsA = calculateSavings(a.price, averagePrice, a.distance);
      const savingsB = calculateSavings(b.price, averagePrice, b.distance);
      return savingsB.netSavings - savingsA.netSavings;
    });

    // 트로피 이유 텍스트
    const getBestReason = () => {
      if (sortMode === 'price') return '최저가';
      if (sortMode === 'distance') return '최단거리';
      return '가성비 최우수';
    };

    // 정렬된 주유소만 마커 표시
    sortedStations.forEach((station, index) => {
      if (!station.lat || !station.lng) {
        return; // 좌표 없으면 스킵
      }

      const position = new kakao.maps.LatLng(station.lat, station.lng);

      // 정렬 기준에 따라 첫 번째(index === 0)가 베스트
      const isBestStation = index === 0;

      let marker;

      if (isBestStation) {
        // 트로피 마커 (CustomOverlay 사용)
        // 인포윈도우 생성
        const infowindow = new kakao.maps.InfoWindow({
          removable: true,
          content: `
            <div style="padding:8px 12px; min-width:200px;">
              <div style="font-weight:bold; font-size:14px; margin-bottom:4px;">
                🏆 ${getBestReason()} ${station.name}
              </div>
              <div style="font-size:12px; color:#666;">
                ${station.brand} | ${station.price.toLocaleString()}원/L
              </div>
              <div style="font-size:11px; color:#999; margin-top:4px;">
                거리: ${station.distance.toFixed(2)}km
              </div>
            </div>
          `
        });

        // 트로피 클릭 핸들러를 content에 직접 포함
        marker = new kakao.maps.CustomOverlay({
          position: position,
          content: `
            <div style="position: relative; cursor: pointer;">
              <div style="font-size: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"
                   onclick="window.openTrophyInfo_${station.id.replace(/[^a-zA-Z0-9]/g, '_')}()">
                🏆
              </div>
            </div>
          `,
          yAnchor: 1,
          clickable: true
        });
        marker.setMap(mapInstanceRef.current);

        // 클릭 핸들러를 전역 함수로 등록
        const funcName = `openTrophyInfo_${station.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        window[funcName] = () => {
          // 기존 인포윈도우 닫기
          if (currentInfoWindowRef.current) {
            currentInfoWindowRef.current.close();
          }
          // 임시 마커를 생성해서 인포윈도우 위치 지정
          const tempMarker = new kakao.maps.Marker({
            position: position
          });
          infowindow.open(mapInstanceRef.current, tempMarker);
          currentInfoWindowRef.current = infowindow;
        };
      } else {
        // 일반 주유소 마커 (파란색)
        marker = new kakao.maps.Marker({
          position: position,
          map: mapInstanceRef.current,
          title: station.name
        });

        // 인포윈도우 추가
        const infowindow = new kakao.maps.InfoWindow({
          removable: true, // X 버튼으로 닫기 가능
          content: `
            <div style="padding:8px 12px; min-width:200px;">
              <div style="font-weight:bold; font-size:14px; margin-bottom:4px;">
                ${station.name}
              </div>
              <div style="font-size:12px; color:#666;">
                ${station.brand} | ${station.price.toLocaleString()}원/L
              </div>
              <div style="font-size:11px; color:#999; margin-top:4px;">
                거리: ${station.distance.toFixed(2)}km
              </div>
            </div>
          `
        });

        // 마커 클릭 시 인포윈도우 표시 (기존 인포윈도우 닫기)
        kakao.maps.event.addListener(marker, 'click', function() {
          // 기존 인포윈도우 닫기
          if (currentInfoWindowRef.current) {
            currentInfoWindowRef.current.close();
          }
          infowindow.open(mapInstanceRef.current, marker);
          currentInfoWindowRef.current = infowindow;
        });
      }

      stationMarkersRef.current.push(marker);
    });

    const markerCount = stationMarkersRef.current.length;
    if (markerCount > 0) {
      console.log(`✅ ${markerCount}개 주유소 마커 표시 완료 (반경 ${radius.toFixed(1)}km 내)`);
    }

  }, [stations, kakaoLoaded, radius, sortMode, isMobile]);

  // 주유소 데이터 로드 (항상 5km 기준 - 오피넷 API 최대 반경)
  const loadStations = async (lat = coordinates.lat, lng = coordinates.lng) => {
    setLoading(true);
    try {
      console.log(`📡 주유소 검색 중: lat=${lat}, lng=${lng}, radius=5km`);
      const data = await fetchNearbyStations(lat, lng, 5); // 오피넷 API 최대 5km
      setAllStations(data); // 5km 데이터를 allStations에 캐싱
      const filtered = data.filter(station => station.distance <= radius);
      setStations(filtered);
    } catch (error) {
      console.error('주유소 데이터 로드 실패:', error);
      // 실패 시 빈 배열
      setAllStations([]);
      setStations([]);
    } finally {
      setLoading(false);
    }
  };

  const openAddressSearch = () => {
    // 카카오 주소 검색 API 실행
    if (!window.daum || !window.daum.Postcode) {
      alert('주소 검색 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    new window.daum.Postcode({
      oncomplete: async function(data) {
        const fullAddress = data.address;
        const roadAddress = data.roadAddress;
        
        setAddress(roadAddress || fullAddress);
        
        // 좌표 정보가 있으면 사용 (Postcode API가 제공)
        if (data.y && data.x) {
          const coords = {
            lat: parseFloat(data.y),
            lng: parseFloat(data.x)
          };

          setCoordinates(coords);
          setRadius(5); // 반경 5km로 재설정
          console.log('✅ 선택한 주소:', fullAddress);
          console.log('✅ Postcode API 좌표:', coords);

          // 새 좌표로 주유소 데이터 로드 (5km 기준)
          setLoading(true);
          const newStations = await fetchNearbyStations(coords.lat, coords.lng, 5);
          setAllStations(newStations);
          const filtered = newStations.filter(station => station.distance <= 5);
          setStations(filtered);
          setLoading(false);
          return;
        }
        
        // Geocoding API 사용 가능 여부 확인
        if (!kakaoLoaded || !window.kakao?.maps?.services?.Geocoder) {
          console.warn('⚠️ 카카오 Geocoding API 사용 불가 - 기본 좌표 사용');
          alert(`주소가 선택되었습니다: ${roadAddress || fullAddress}\n\n좌표 변환 기능이 비활성화되어 있습니다.\n기본 위치(서울 강남) 기준으로 주유소를 표시합니다.`);

          setRadius(5); // 반경 5km로 재설정
          // 기본 좌표로 주유소 데이터 로드 (5km 기준)
          setLoading(true);
          const newStations = await fetchNearbyStations(coordinates.lat, coordinates.lng, 5);
          setAllStations(newStations);
          const filtered = newStations.filter(station => station.distance <= 5);
          setStations(filtered);
          setLoading(false);
          return;
        }

        try {
          // 주소를 좌표로 변환
          const coords = await addressToCoordinates(roadAddress || fullAddress);
          setCoordinates(coords);
          setRadius(5); // 반경 5km로 재설정

          console.log('✅ 선택한 주소:', fullAddress);
          console.log('✅ 변환된 좌표:', coords);

          // 새 좌표로 주유소 데이터 로드 (5km 기준)
          setLoading(true);
          const newStations = await fetchNearbyStations(coords.lat, coords.lng, 5);
          setAllStations(newStations);
          const filtered = newStations.filter(station => station.distance <= 5);
          setStations(filtered);
          setLoading(false);
        } catch (error) {
          console.error('❌ 주소 변환 실패:', error);
          alert(`주소: ${roadAddress || fullAddress}\n\n좌표 변환에 실패했습니다.\n기본 위치 기준으로 주유소를 표시합니다.`);
          setLoading(false);
        }
      }
    }).open();
  };

  const averagePrice = stations.length > 0 
    ? Math.round(stations.reduce((sum, s) => sum + s.price, 0) / stations.length)
    : 0;

  const sortedStations = [...stations].sort((a, b) => {
    if (sortMode === 'price') return a.price - b.price;
    if (sortMode === 'distance') return a.distance - b.distance;

    const savingsA = calculateSavings(a.price, averagePrice, a.distance);
    const savingsB = calculateSavings(b.price, averagePrice, b.distance);
    return savingsB.netSavings - savingsA.netSavings;
  });

  // 각 기준별 최고 주유소 찾기
  const lowestPriceStation = sortedStations.length > 0
    ? sortedStations.reduce((min, station) =>
        station.price < min.price ? station : min, sortedStations[0])
    : null;

  const closestStation = sortedStations.length > 0
    ? sortedStations.reduce((min, station) =>
        station.distance < min.distance ? station : min, sortedStations[0])
    : null;

  const bestEfficiencyStation = sortedStations.length > 0
    ? sortedStations.reduce((best, station) => {
        const currentSavings = calculateSavings(station.price, averagePrice, station.distance);
        const bestSavings = calculateSavings(best.price, averagePrice, best.distance);
        return currentSavings.netSavings > bestSavings.netSavings ? station : best;
      }, sortedStations[0])
    : null;

  const bestEfficiencySavings = bestEfficiencyStation
    ? calculateSavings(bestEfficiencyStation.price, averagePrice, bestEfficiencyStation.distance)
    : null;

  // 모바일 레이아웃
  if (isMobile) {
    return (
      <>
        <div style={{ ...styles.container, padding: '1rem' }}>
          <div style={styles.maxWidth}>
            {/* 1. 주소 검색 영역 (컴팩트) */}
            <div style={{ ...styles.card, padding: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ ...styles.inputWrapper, flex: 1 }}>
                  <MapPin size={16} style={styles.inputIcon} />
                  <input
                    type="text"
                    value={address}
                    readOnly
                    style={styles.compactInput}
                  />
                </div>
                <button
                  style={{ ...styles.button, padding: '0.5rem 0.75rem' }}
                  onClick={openAddressSearch}
                >
                  <Search size={16} />
                </button>
              </div>

              {/* 2. 검색 반경 (컴팩트) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151' }}>검색 반경</label>
                <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#2563eb' }}>{radius.toFixed(1)}km</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.1"
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value))}
                style={styles.compactSlider}
              />
            </div>

          {/* 3. 지도 영역 */}
          <div style={{ ...styles.card, padding: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <MapPin size={18} color="#2563eb" />
              <h2 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                주변 지도
              </h2>
            </div>
            <div ref={mapRef} style={{ ...styles.mapContainer, height: '300px', minHeight: '300px' }}></div>
            <div style={{ fontSize: '0.625rem', color: '#6b7280', marginTop: '0.5rem', textAlign: 'center' }}>
              🔴 현재 위치 | 🔵 주유소 ({stations.filter(s => s.lat && s.lng).length}개) | 반경 {radius.toFixed(1)}km
            </div>
          </div>

          {/* 4. 각 조건별 1등 주유소 정보 */}
          <div style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
              🏆 조건별 Best 주유소
            </h3>

            {/* 최저가 1등 */}
            {lowestPriceStation && (
              <div style={{ ...styles.stationCard, marginBottom: '0.5rem', border: '2px solid #2563eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div>
                    <span style={{ ...styles.badgeBlue, marginRight: '0.5rem', fontSize: '0.625rem' }}>💰 최저가</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#111827' }}>
                      {lowestPriceStation.name}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827' }}>
                      {lowestPriceStation.price.toLocaleString()}
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.25rem' }}>원/L</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {lowestPriceStation.brand} | {lowestPriceStation.distance.toFixed(2)}km
                </div>
              </div>
            )}

            {/* 최단거리 1등 */}
            {closestStation && (
              <div style={{ ...styles.stationCard, marginBottom: '0.5rem', border: '2px solid #8b5cf6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div>
                    <span style={{ background: '#8b5cf6', color: 'white', padding: '0.25rem 0.5rem', fontSize: '0.625rem', fontWeight: 'bold', borderRadius: '0.25rem', marginRight: '0.5rem' }}>📍 최단거리</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#111827' }}>
                      {closestStation.name}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827' }}>
                      {closestStation.distance.toFixed(2)}
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.25rem' }}>km</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {closestStation.brand} | {closestStation.price.toLocaleString()}원/L
                </div>
              </div>
            )}

            {/* 가성비 1등 */}
            {bestEfficiencyStation && bestEfficiencySavings && (
              <div style={{ ...styles.stationCard, marginBottom: '0.5rem', border: '2px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div>
                    <span style={{ background: '#10b981', color: 'white', padding: '0.25rem 0.5rem', fontSize: '0.625rem', fontWeight: 'bold', borderRadius: '0.25rem', marginRight: '0.5rem' }}>⚡ 가성비</span>
                    <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#111827' }}>
                      {bestEfficiencyStation.name}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>
                      {bestEfficiencySavings.netSavings > 0 ? '+' : ''}{bestEfficiencySavings.netSavings.toLocaleString()}
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.25rem' }}>원</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {bestEfficiencyStation.brand} | {bestEfficiencyStation.price.toLocaleString()}원/L | {bestEfficiencyStation.distance.toFixed(2)}km
                </div>
              </div>
            )}
          </div>

          {/* 5. 더보기 버튼 */}
          <button
            onClick={() => setBottomSheetOpen(true)}
            style={{
              ...styles.button,
              width: '100%',
              padding: '0.875rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            전체 주유소 보기 ({stations.length}개)
            <Navigation size={18} />
          </button>

          {/* Footer */}
          <div style={{ ...styles.card, textAlign: 'center', fontSize: '0.75rem', color: '#6b7280', marginTop: '1rem', padding: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.625rem' }}>
              데이터 출처: 오피넷(Opinet) API | 연비 기준: 12km/L (왕복 계산)
            </p>
          </div>
        </div>
      </div>

      {/* 바텀시트 오버레이 */}
      {bottomSheetOpen && (
        <div
          style={styles.bottomSheetOverlay}
          onClick={() => setBottomSheetOpen(false)}
        />
      )}

      {/* 바텀시트 */}
      <div style={{
        ...styles.bottomSheet,
        ...(bottomSheetOpen ? {} : styles.bottomSheetClosed)
      }}>
        <div style={{ padding: '1rem' }}>
          {/* 핸들 */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div style={{ width: '40px', height: '4px', background: '#d1d5db', borderRadius: '2px' }}></div>
          </div>

          <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
            전체 주유소 ({stations.length}개)
          </h2>

          {/* Tabs */}
          <div style={{ ...styles.tabs, marginBottom: '1rem' }}>
            <button
              onClick={() => setSortMode('price')}
              style={{
                ...styles.tab,
                ...(sortMode === 'price' ? styles.tabActive : styles.tabInactive),
                fontSize: '0.875rem',
                padding: '0.625rem'
              }}
            >
              💰 최저가
            </button>
            <button
              onClick={() => setSortMode('distance')}
              style={{
                ...styles.tab,
                ...(sortMode === 'distance' ? styles.tabActive : styles.tabInactive),
                fontSize: '0.875rem',
                padding: '0.625rem'
              }}
            >
              📍 최단거리
            </button>
            <button
              onClick={() => setSortMode('efficiency')}
              style={{
                ...styles.tab,
                ...(sortMode === 'efficiency' ? styles.tabActive : styles.tabInactive),
                fontSize: '0.875rem',
                padding: '0.625rem'
              }}
            >
              ⚡ 가성비
            </button>
          </div>

          {/* 주유소 리스트 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '1rem', color: '#6b7280' }}>
                로딩 중...
              </div>
            </div>
          ) : sortedStations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Info size={48} color="#d1d5db" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ color: '#6b7280' }}>주유소가 없습니다</p>
            </div>
          ) : (
            sortedStations.map((station, index) => {
              const savings = calculateSavings(station.price, averagePrice, station.distance);
              const priceDiff = averagePrice - station.price;

              return (
                <div
                  key={station.id}
                  style={{
                    ...styles.stationCard,
                    border: index === 0 ? '2px solid #2563eb' : 'none',
                    padding: '0.875rem',
                    marginBottom: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '0.25rem' }}>
                        {index === 0 && (
                          <span style={{ ...styles.badgeBlue, marginRight: '0.5rem', fontSize: '0.625rem' }}>
                            {sortMode === 'price' ? '최저가' : sortMode === 'distance' ? '최단거리' : 'BEST'}
                          </span>
                        )}
                        <span style={{ fontWeight: 'bold', fontSize: '0.938rem', color: '#111827' }}>
                          {station.name}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        <span style={styles.badge}>{station.brand}</span>
                        <span>{station.distance.toFixed(2)}km</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827' }}>
                        {station.price.toLocaleString()}
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.125rem' }}>원/L</span>
                      </div>
                      {priceDiff !== 0 && (
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', color: priceDiff > 0 ? '#10b981' : '#ef4444' }}>
                          {priceDiff > 0 ? '▼' : '▲'} {Math.abs(priceDiff)}원
                        </div>
                      )}
                    </div>
                  </div>

                  {sortMode === 'efficiency' && (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                      <span style={{ fontWeight: '600', color: savings.netSavings >= 0 ? '#10b981' : '#ef4444' }}>
                        순이익: {savings.netSavings >= 0 ? '+' : ''}{savings.netSavings.toLocaleString()}원
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
    );
  }

  // 데스크톱 레이아웃
  return (
    <>
      {/* 사이드바 토글 버튼 */}
      <button
        style={{
          ...styles.sidebarToggle,
          ...(sidebarCollapsed ? styles.sidebarToggleCollapsed : {})
        }}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* 사이드바 */}
      <div style={{
        ...styles.sidebar,
        ...(sidebarCollapsed ? styles.sidebarCollapsed : {})
      }}>
        <div style={{ padding: '1.5rem' }}>
          <div style={styles.header}>
            <div style={styles.iconBox}>
              <Fuel size={32} color="white" />
            </div>
            <div>
              <h1 style={styles.title}>스마트 주유소 찾기</h1>
              <p style={styles.subtitle}>최저가/최단거리/가성비 기준 추천</p>
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>내 위치</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={styles.inputWrapper}>
                <MapPin size={20} style={styles.inputIcon} />
                <input
                  type="text"
                  value={address}
                  readOnly
                  style={styles.input}
                />
              </div>
              <button
                style={styles.button}
                onClick={openAddressSearch}
              >
                <Search size={20} />
              </button>
            </div>
          </div>

          <div style={styles.inputGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={styles.label}>검색 반경</label>
              <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#2563eb' }}>{radius.toFixed(1)}km</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={radius}
              onChange={(e) => setRadius(parseFloat(e.target.value))}
              style={styles.slider}
            />
          </div>

          {/* 4개 Summary Cards */}
          <div style={{ ...styles.grid, marginBottom: '1rem' }}>
            <div style={styles.summaryCard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>평균 가격</span>
                <TrendingDown size={20} color="#9ca3af" />
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827' }}>
                {averagePrice.toLocaleString()}원
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                주변 {stations.length}개 주유소
              </div>
            </div>

            <div style={{...styles.summaryCard, ...styles.summaryCardBlue}}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>최저 가격</span>
                <Fuel size={20} style={{ opacity: 0.9 }} />
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>
                {lowestPriceStation?.price.toLocaleString()}원
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '0.25rem' }}>
                {lowestPriceStation?.name}
              </div>
            </div>

            <div style={{...styles.summaryCard, ...styles.summaryCardPurple}}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>최단 거리</span>
                <MapPin size={20} style={{ opacity: 0.9 }} />
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>
                {closestStation?.distance.toFixed(2)}km
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '0.25rem' }}>
                {closestStation?.name}
              </div>
            </div>

            <div style={{...styles.summaryCard, ...styles.summaryCardGreen}}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', opacity: 0.9 }}>가성비 (40L 주유 시)</span>
                <Navigation size={20} style={{ opacity: 0.9 }} />
              </div>
              <div style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>
                {bestEfficiencySavings ? (bestEfficiencySavings.netSavings > 0 ? '+' : '') + bestEfficiencySavings.netSavings.toLocaleString() : '0'}원
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '0.25rem' }}>
                {bestEfficiencyStation?.name}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={styles.tabs}>
            <button
              onClick={() => setSortMode('price')}
              style={{
                ...styles.tab,
                ...(sortMode === 'price' ? styles.tabActive : styles.tabInactive)
              }}
            >
              💰 최저가 순
            </button>
            <button
              onClick={() => setSortMode('distance')}
              style={{
                ...styles.tab,
                ...(sortMode === 'distance' ? styles.tabActive : styles.tabInactive)
              }}
            >
              📍 최단거리 순
            </button>
            <button
              onClick={() => setSortMode('efficiency')}
              style={{
                ...styles.tab,
                ...(sortMode === 'efficiency' ? styles.tabActive : styles.tabInactive)
              }}
            >
              ⚡ 가성비 순
            </button>
          </div>

          {/* 주유소 리스트 */}
          {loading ? (
            <div style={{ ...styles.card, textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '1rem' }}>
                주유소 정보를 불러오는 중...
              </div>
              <div style={{
                width: '50px',
                height: '50px',
                border: '4px solid #e5e7eb',
                borderTop: '4px solid #2563eb',
                borderRadius: '50%',
                margin: '0 auto',
                animation: 'spin 1s linear infinite'
              }} />
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : sortedStations.length === 0 ? (
            <div style={{ ...styles.card, textAlign: 'center', padding: '3rem' }}>
              <Info size={64} color="#d1d5db" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                주변에 주유소가 없습니다
              </h3>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                {radius.toFixed(1)}km 반경 내에서 주유소를 찾을 수 없습니다.
              </p>
              <button
                onClick={() => setRadius(Math.min(5, radius + 1))}
                style={styles.button}
              >
                검색 반경 넓히기 (+1km)
              </button>
            </div>
          ) : (
            sortedStations.map((station, index) => {
              const savings = calculateSavings(station.price, averagePrice, station.distance);
              const priceDiff = averagePrice - station.price;

              return (
                <div
                  key={station.id}
                  style={{
                    ...styles.stationCard,
                    ...(hoveredCard === station.id ? styles.stationCardHover : {}),
                    border: index === 0 ? '2px solid #2563eb' : 'none',
                  }}
                  onMouseEnter={() => setHoveredCard(station.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: '0.25rem' }}>
                        {index === 0 && (
                          <span style={{ ...styles.badgeBlue, marginRight: '0.5rem' }}>
                            {sortMode === 'price' ? '최저가' : sortMode === 'distance' ? '최단거리' : 'BEST'}
                          </span>
                        )}
                        <span style={{ fontWeight: 'bold', fontSize: '1.125rem', color: '#111827' }}>
                          {station.name}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '1.25rem 0' }}>
                        {station.address}
                      </p>
                      <div style={{ marginTop: '0.5rem' }}>
                        <span style={styles.badge}>{station.brand}</span>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {station.distance.toFixed(3)}km 떨어짐
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={styles.priceBox}>
                        {station.price.toLocaleString()}
                        <span style={{ fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.25rem' }}>원/L</span>
                      </div>
                      {priceDiff !== 0 && (
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: priceDiff > 0 ? '#10b981' : '#ef4444' }}>
                          {priceDiff > 0 ? '▼' : '▲'} {Math.abs(priceDiff)}원
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={styles.analysisBox}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151' }}>가성비 분석</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: savings.isWorthIt ? '#10b981' : '#ef4444' }}>
                        {savings.isWorthIt ? '✓ 이동 가치 있음' : '✗ 이동 비효율'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.75rem' }}>
                      <div style={{ background: 'white', borderRadius: '0.5rem', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>주유 절감</div>
                        <div style={{ fontWeight: 'bold', color: '#10b981' }}>+{savings.totalSavings.toLocaleString()}원</div>
                      </div>
                      <div style={{ background: 'white', borderRadius: '0.5rem', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>이동 비용</div>
                        <div style={{ fontWeight: 'bold', color: '#ef4444' }}>-{savings.travelCost.toLocaleString()}원</div>
                      </div>
                      <div style={{ background: 'white', borderRadius: '0.5rem', padding: '0.5rem', textAlign: 'center' }}>
                        <div style={{ color: '#6b7280', marginBottom: '0.25rem' }}>순이익</div>
                        <div style={{ fontWeight: 'bold', color: savings.netSavings >= 0 ? '#2563eb' : '#6b7280' }}>
                          {savings.netSavings >= 0 ? '+' : ''}{savings.netSavings.toLocaleString()}원
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                        <span>현재 위치</span>
                        <span>{station.distance.toFixed(3)}km</span>
                      </div>
                      <div style={styles.progressBar}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${Math.min((station.distance / radius) * 100, 100)}%`,
                            background: savings.isWorthIt ? '#10b981' : '#f97316',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 메인 콘텐츠 (우측) */}
      <div style={{
        ...styles.container,
        ...(sidebarCollapsed ? styles.mainContentWithSidebarCollapsed : styles.mainContentWithSidebar)
      }}>
        <div style={styles.maxWidth}>
          {/* 지도 영역 */}
          <div style={styles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <MapPin size={20} color="#2563eb" />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                주변 지도
              </h2>
            </div>
            <div ref={mapRef} style={styles.mapContainer}></div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem', textAlign: 'center' }}>
              🔴 현재 검색 위치 | 🔵 파란 마커: 주유소 ({stations.filter(s => s.lat && s.lng).length}개) | 검색 반경 {radius.toFixed(1)}km
            </div>
          </div>

          {/* Footer */}
          <div style={{ ...styles.card, textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
            <p style={{ marginBottom: '0.5rem' }}>
              💡 <strong>가성비 계산 로직:</strong> (평균가-해당가) × 주유량 - (거리×2÷연비×평균가)
            </p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
              데이터 출처: 오피넷(Opinet) API | 연비 기준: 12km/L (왕복 계산)
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default GasStationDashboard;
