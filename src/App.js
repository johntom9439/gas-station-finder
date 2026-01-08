import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, TrendingDown, Search, Fuel, ChevronLeft, ChevronRight } from 'lucide-react';

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
const fetchNearbyStations = async (lat, lng, radius, prodcd = 'B027') => {
  try {
    console.log('📡 백엔드 API 호출:', { lat, lng, radius, prodcd });

    // 카카오 좌표 변환 (WGS84 → KATEC)
    let katecX = lng;
    let katecY = lat;



    // 백엔드 프록시 서버로 요청 (WGS84 좌표 그대로 전송, 백엔드에서 변환)
    const url = `${BACKEND_API_URL}/api/stations?lat=${lat}&lng=${lng}&radius=${radius}&prodcd=${prodcd}`;
    
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

// 방향 아이콘 매핑 함수
const getDirectionIcon = (type) => {
  const iconMap = {
    1: '⬅️',   // 좌회전
    2: '➡️',   // 우회전
    3: '↩️',   // U턴
    4: '⬆️',   // 직진
    5: '↖️',   // 왼쪽 방향
    6: '↗️',   // 오른쪽 방향
    7: '🛣️',   // 고속도로 진입
    8: '🛣️',   // 고속도로 진출
    11: '⬅️',  // 왼쪽 차선
    12: '➡️',  // 오른쪽 차선
    14: '🚇',  // 터널
    15: '🌉',  // 육교
    200: '⬆️'  // 직진
  };
  return iconMap[type] || '⬆️';
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
    width: '450px',
    minWidth: '450px',
    maxWidth: '450px',
    height: '100vh',
    background: 'white',
    boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)',
    transition: 'transform 0.3s ease, margin-left 0.3s ease',
    overflowY: 'auto',
    position: 'relative',
  },
  sidebarCollapsed: {
    marginLeft: '-450px',
  },
  sidebarToggle: {
    position: 'absolute',
    left: '450px',
    top: '95px',
    padding: '1.5rem 0.1rem',
    background: 'white',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderLeft: 'none',
    borderRadius: '0 0.5rem 0.5rem 0',
    cursor: 'pointer',
    boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'left 0.3s ease',
    '&:hover': {
      background: '#f9fafb',
    }
  },
  sidebarToggleCollapsed: {
    left: '0',
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
  // 경로 패널 스타일 (데스크톱 - 중간 컬럼)
  routePanel: {
    width: '380px',
    minWidth: '380px',
    maxWidth: '380px',
    background: 'white',
    borderRight: '1px solid #e5e7eb',
    overflowY: 'auto',
    padding: '1.5rem',
    height: '100vh',
    position: 'sticky',
    top: 0,
  },
  // 경로 패널 스타일 (모바일)
  routePanelMobile: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'white',
    borderRadius: '1rem 1rem 0 0',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
    transition: 'transform 0.3s ease',
    zIndex: 3000,
    height: '50vh',
    overflowY: 'auto',
    padding: '1rem',
  },
  // 모바일 헤더
  mobileHeader: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: 'white',
    padding: '1rem',
    zIndex: 1000,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  // 새로운 바텀 시트 (항상 표시)
  mobileBottomSheetNew: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'white',
    borderRadius: '1.5rem 1.5rem 0 0',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    overscrollBehavior: 'contain', // 오버스크롤 방지
  },
  // 바텀 시트 드래그 핸들
  bottomSheetHandle: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem 0',
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    minHeight: '48px', // 터치하기 쉬운 최소 높이
  },
  bottomSheetHandleBar: {
    width: '48px',
    height: '5px',
    background: '#d1d5db',
    borderRadius: '4px',
  },
  // 바텀 시트 컨텐츠 (스크롤 가능)
  bottomSheetContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 1rem 1rem 1rem',
    overscrollBehavior: 'contain', // 오버스크롤 방지
    WebkitOverflowScrolling: 'touch', // iOS 부드러운 스크롤
  },
  // 탭 바 (sticky)
  mobileTabBar: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem 0',
    position: 'sticky',
    top: 0,
    background: 'white',
    zIndex: 10,
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '0.75rem',
  },
  // 탭 버튼
  mobileTabButton: {
    flex: 1,
    padding: '0.75rem',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  mobileTabButtonActive: {
    background: '#2563eb',
    color: 'white',
  },
  mobileTabButtonInactive: {
    background: '#f3f4f6',
    color: '#6b7280',
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
  const [address, setAddress] = useState('위치 확인 중...');
  const [radius, setRadius] = useState(5.0); // 기본값 5km (오피넷 API 최대 반경)
  const [allStations, setAllStations] = useState([]); // 5km 내 모든 주유소
  const [stations, setStations] = useState([]); // radius로 필터링된 주유소
  const [sortMode, setSortMode] = useState('price');
  const [hoveredCard, setHoveredCard] = useState(null);
  const [coordinates, setCoordinates] = useState(null); // 초기값 null로 변경
  const [loading, setLoading] = useState(false);
  const [kakaoLoaded, setKakaoLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const hasLoadedRef = React.useRef(false); // 중복 로드 방지
  const mapRef = React.useRef(null); // 지도 DOM 참조
  const mapInstanceRef = React.useRef(null); // 지도 인스턴스
  const centerMarkerRef = React.useRef(null); // 중심점 마커
  const circleRef = React.useRef(null); // 검색 반경 원
  const stationMarkersRef = React.useRef([]); // 주유소 마커들
  const currentInfoWindowRef = React.useRef(null); // 현재 열린 인포윈도우

  // 경로 안내 관련 state
  const [selectedStation, setSelectedStation] = useState(null); // 선택된 주유소
  const [routeData, setRouteData] = useState(null); // 경로 데이터
  const [showRoutePanel, setShowRoutePanel] = useState(false); // 경로 패널 표시 여부
  const [routeLoading, setRouteLoading] = useState(false); // 경로 로딩 상태
  const [routeError, setRouteError] = useState(null); // 경로 에러
  const routePolylineRef = React.useRef(null); // 경로 폴리라인
  const originMarkerRef = React.useRef(null); // 출발지 마커
  const destinationMarkerRef = React.useRef(null); // 도착지 마커

  // 바텀시트 드래그 관련 state
  const [bottomSheetHeight, setBottomSheetHeight] = useState(45); // vh 단위 (45vh가 기본)
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = React.useRef(0);
  const dragStartHeight = React.useRef(0);

  // 유종 선택
  const [fuelType, setFuelType] = useState('B027'); // B027: 휘발유, D047: 경유

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

  // 사이드바 토글 시 지도 크기 재조정
  useEffect(() => {
    if (mapInstanceRef.current && !isMobile) {
      // 애니메이션 완료 후 relayout 호출 (transition이 0.3s)
      setTimeout(() => {
        mapInstanceRef.current.relayout();
        // 현재 중심점 유지
        if (coordinates) {
          mapInstanceRef.current.setCenter(new window.kakao.maps.LatLng(coordinates.lat, coordinates.lng));
        }
      }, 350); // 300ms transition + 50ms 버퍼
    }
  }, [sidebarCollapsed, isMobile, coordinates]);

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
            const fallbackLocation = { lat: 37.5664, lng: 126.9778 };
            setCoordinates(fallbackLocation);
            setAddress('서울시청');
            loadStations(fallbackLocation.lat, fallbackLocation.lng); // 서울시청 좌표로 로드
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
        const fallbackLocation = { lat: 37.5664, lng: 126.9778 };
        setCoordinates(fallbackLocation);
        setAddress('서울시청');
        loadStations(fallbackLocation.lat, fallbackLocation.lng);
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
    if (!kakaoLoaded || !mapRef.current || !coordinates) return;

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

          // 지도 중심 조정하지 않음 (자연스럽게 표시)
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

  // 경로 폴리라인 정리 (주유소 선택 변경 시)
  useEffect(() => {
    return () => {
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
        routePolylineRef.current = null;
      }
    };
  }, [selectedStation]);

  // 경로 패널 열림/닫힘에 따라 마커와 원 표시/숨김
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (showRoutePanel) {
      // 경로 패널 열림 → 마커와 원 숨김
      if (centerMarkerRef.current) {
        centerMarkerRef.current.setMap(null);
      }
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }
      stationMarkersRef.current.forEach(marker => {
        if (marker.setMap) marker.setMap(null);
      });
      if (currentInfoWindowRef.current) {
        currentInfoWindowRef.current.close();
      }
    } else {
      // 경로 패널 닫힘 → 마커와 원 다시 표시
      if (centerMarkerRef.current && coordinates) {
        centerMarkerRef.current.setMap(mapInstanceRef.current);
      }
      if (circleRef.current) {
        circleRef.current.setMap(mapInstanceRef.current);
      }
      stationMarkersRef.current.forEach(marker => {
        if (marker.setMap) marker.setMap(mapInstanceRef.current);
      });
    }
  }, [showRoutePanel, coordinates]);

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

    // 경로 패널이 열려있으면 마커를 생성하지 않음
    if (showRoutePanel) return;

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

  }, [stations, kakaoLoaded, radius, sortMode, isMobile, showRoutePanel]);

  // 주유소 데이터 로드 (항상 5km 기준 - 오피넷 API 최대 반경)
  const loadStations = async (lat, lng) => {
    if (!lat || !lng) {
      console.warn('⚠️ 좌표가 없어 주유소 로드를 건너뜁니다.');
      return;
    }
    setLoading(true);
    try {
      console.log(`📡 주유소 검색 중: lat=${lat}, lng=${lng}, radius=5km, prodcd=${fuelType}`);
      const data = await fetchNearbyStations(lat, lng, 5, fuelType); // 오피넷 API 최대 5km
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

  // 경로 조회 함수
  const fetchRoute = async (originLat, originLng, destLat, destLng) => {
    try {
      setRouteLoading(true);
      setRouteError(null);

      console.log(`📍 경로 조회: (${originLat}, ${originLng}) → (${destLat}, ${destLng})`);

      // 백엔드 API 호출 (lng, lat 순서)
      const response = await fetch(
        `${BACKEND_API_URL}/api/route?origin=${originLng},${originLat}&destination=${destLng},${destLat}`
      );

      if (!response.ok) {
        throw new Error(`경로 조회 실패: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ 경로 데이터 수신:', data);

      if (data.routes && data.routes.length > 0) {
        setRouteData(data.routes[0]);

        // 모바일/데스크톱 모두 지도에 경로 그리기 + 범위 조정
        drawRouteOnMap(data.routes[0]);
        fitMapToRoute(data.routes[0]);

        console.log('✅ 지도에 경로 표시 + 출발지/도착지 포함하여 범위 조정');
      } else {
        throw new Error('경로를 찾을 수 없습니다');
      }

    } catch (error) {
      console.error('❌ 경로 조회 실패:', error);
      setRouteError('경로를 불러올 수 없습니다. 다시 시도해주세요.');
    } finally {
      setRouteLoading(false);
    }
  };

  // 지도에 경로 그리기
  const drawRouteOnMap = (route) => {
    if (!mapInstanceRef.current || !window.kakao || !coordinates) return;

    // 기존 경로 제거
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }

    // 기존 출발지/도착지 마커 제거
    if (originMarkerRef.current) {
      originMarkerRef.current.setMap(null);
      originMarkerRef.current = null;
    }
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setMap(null);
      destinationMarkerRef.current = null;
    }

    const kakao = window.kakao;
    const path = [];

    // 경로 좌표 추출
    route.sections.forEach(section => {
      section.roads.forEach(road => {
        // vertexes 배열: [lng1, lat1, lng2, lat2, ...]
        for (let i = 0; i < road.vertexes.length; i += 2) {
          const lng = road.vertexes[i];
          const lat = road.vertexes[i + 1];
          path.push(new kakao.maps.LatLng(lat, lng));
        }
      });
    });

    // 폴리라인 생성
    const polyline = new kakao.maps.Polyline({
      path: path,
      strokeWeight: 5,
      strokeColor: '#2563eb',
      strokeOpacity: 0.8,
      strokeStyle: 'solid'
    });

    polyline.setMap(mapInstanceRef.current);
    routePolylineRef.current = polyline;

    // 출발지 마커 생성 (빨간색) - 경로의 첫 번째 좌표 사용
    const originPosition = path[0];
    const originMarker = new kakao.maps.Marker({
      position: originPosition,
      map: mapInstanceRef.current,
      image: new kakao.maps.MarkerImage(
        'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png',
        new kakao.maps.Size(34, 48)
      )
    });
    originMarkerRef.current = originMarker;

    // 도착지 마커 생성 (주황색/목적지) - 경로의 마지막 좌표 사용
    const destPosition = path[path.length - 1];
    const destMarker = new kakao.maps.Marker({
      position: destPosition,
      map: mapInstanceRef.current,
      image: new kakao.maps.MarkerImage(
        'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
        new kakao.maps.Size(24, 35)
      )
    });
    destinationMarkerRef.current = destMarker;

    console.log(`✅ 경로 폴리라인 및 출발지/도착지 마커 생성 완료 (${path.length}개 좌표)`);
  };

  // 지도 범위를 경로에 맞게 조정
  const fitMapToRoute = (route) => {
    if (!mapInstanceRef.current || !window.kakao) return;

    const kakao = window.kakao;
    const bounds = new kakao.maps.LatLngBounds();

    // 경로의 모든 좌표를 bounds에 추가
    route.sections.forEach(section => {
      section.roads.forEach(road => {
        // vertexes 배열: [lng1, lat1, lng2, lat2, ...]
        for (let i = 0; i < road.vertexes.length; i += 2) {
          const lng = road.vertexes[i];
          const lat = road.vertexes[i + 1];
          bounds.extend(new kakao.maps.LatLng(lat, lng));
        }
      });
    });

    // 모바일과 데스크톱에 따라 다른 패딩 적용 (출발지/도착지가 완전히 보이도록)
    const paddingTop = isMobile ? 80 : 150;
    const paddingRight = isMobile ? 50 : 200;
    // 모바일: 경로 패널 높이(50vh)를 고려한 패딩, 데스크톱: 기본 패딩
    const paddingBottom = isMobile ? window.innerHeight * 0.2 : 150;
    const paddingLeft = isMobile ? 50 : 0;

    mapInstanceRef.current.setBounds(bounds, paddingTop, paddingRight, paddingBottom, paddingLeft);
    // setLevel 제거 - setBounds가 자동으로 최적 레벨 설정

    // 지도 레이아웃 재조정 (모바일에서 중요)
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.relayout();
      }
    }, 100);

    console.log('✅ 지도 범위 조정 완료 (전체 경로 포함, 패딩 적용)');
  };

  // 주유소 클릭 핸들러
  const handleStationClick = (station) => {
    if (!station.lat || !station.lng) {
      alert('이 주유소의 위치 정보가 없습니다.');
      return;
    }

    if (!coordinates) {
      alert('현재 위치를 확인 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    console.log(`🏁 주유소 선택: ${station.name}`);

    setSelectedStation(station);
    setShowRoutePanel(true);

    // 데스크톱: 지도를 주유소 위치로 이동
    if (!isMobile && mapInstanceRef.current && window.kakao) {
      const stationPos = new window.kakao.maps.LatLng(station.lat, station.lng);
      mapInstanceRef.current.panTo(stationPos);
    }

    // 경로 조회 (모바일/데스크톱 공통)
    fetchRoute(coordinates.lat, coordinates.lng, station.lat, station.lng);
  };

  // 경로 패널 닫기
  const closeRoutePanel = () => {
    setShowRoutePanel(false);
    setSelectedStation(null);
    setRouteData(null);
    setRouteError(null);

    // 경로 폴리라인 제거
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }

    // 출발지/도착지 마커 제거
    if (originMarkerRef.current) {
      originMarkerRef.current.setMap(null);
      originMarkerRef.current = null;
    }
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setMap(null);
      destinationMarkerRef.current = null;
    }

    // 지도 relayout 및 재조정
    if (mapInstanceRef.current && window.kakao && coordinates) {
      // 지도 크기 재계산 (경로 패널이 닫히면서 지도 영역 변경됨)
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.relayout();

          // 현재 위치를 중심으로 설정
          const position = new window.kakao.maps.LatLng(coordinates.lat, coordinates.lng);
          mapInstanceRef.current.setCenter(position);

          // 적절한 줌 레벨 설정 (반경에 따라)
          const level = radius <= 1 ? 5 : radius <= 3 ? 6 : 7;
          mapInstanceRef.current.setLevel(level);

          console.log(`🚪 경로 패널 닫힘 - 지도 재조정 (level ${level})`);
        }
      }, 100);
    } else {
      console.log('🚪 경로 패널 닫힘');
    }
  };

  // 유종 변경 핸들러
  const handleFuelTypeChange = async (newFuelType) => {
    setFuelType(newFuelType);

    // 현재 좌표가 있으면 데이터 리로드
    if (coordinates) {
      setLoading(true);
      try {
        console.log(`🔄 유종 변경: ${newFuelType === 'B027' ? '휘발유' : '경유'}`);
        const newStations = await fetchNearbyStations(
          coordinates.lat,
          coordinates.lng,
          5,
          newFuelType
        );

        setAllStations(newStations);

        // 현재 반경에 맞는 주유소만 필터링
        const filtered = newStations.filter(s => s.distance <= radius * 1000);
        setStations(filtered);
      } catch (error) {
        console.error('유종 변경 중 오류:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  // 바텀시트 드래그 핸들러들
  const handleTouchStart = (e) => {
    e.preventDefault(); // 브라우저 기본 스크롤 방지
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = bottomSheetHeight;
    console.log('🎯 드래그 시작:', dragStartY.current);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;

    e.preventDefault(); // 브라우저 기본 스크롤 방지 (중요!)
    e.stopPropagation(); // 이벤트 전파 중지

    const currentY = e.touches[0].clientY;
    const deltaY = dragStartY.current - currentY; // 위로 드래그하면 양수
    const windowHeight = window.innerHeight;

    // deltaY를 vh로 변환
    const deltaVh = (deltaY / windowHeight) * 100;
    let newHeight = dragStartHeight.current + deltaVh;

    // 최소 40vh, 최대 90vh로 제한
    newHeight = Math.max(40, Math.min(90, newHeight));

    setBottomSheetHeight(newHeight);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    setIsDragging(false);

    // 스냅 포인트: 40vh (최소), 70vh (중간), 90vh (최대)
    const snapPoints = [40, 70, 90];

    // 현재 높이와 가장 가까운 스냅 포인트 찾기
    const closest = snapPoints.reduce((prev, curr) => {
      return Math.abs(curr - bottomSheetHeight) < Math.abs(prev - bottomSheetHeight) ? curr : prev;
    });

    console.log('🎯 드래그 종료: 스냅 포인트', closest, 'vh');
    setBottomSheetHeight(closest);
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
          const newStations = await fetchNearbyStations(coords.lat, coords.lng, 5, fuelType);
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
          const newStations = await fetchNearbyStations(coordinates.lat, coordinates.lng, 5, fuelType);
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
          const newStations = await fetchNearbyStations(coords.lat, coords.lng, 5, fuelType);
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
        {/* 최상단 헤더 */}
        <div style={styles.mobileHeader}>
          <Fuel size={24} />
          <h1 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0 }}>
            스마트 주유소 찾기
          </h1>
        </div>

        {/* 지도 (바텀시트 위까지만 표시) */}
        <div style={{
          position: 'fixed',
          top: '60px',
          left: 0,
          right: 0,
          bottom: showRoutePanel ? '50vh' : `${bottomSheetHeight}vh`,
          zIndex: 0,
          transition: 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
        </div>

        {/* 새로운 바텀 시트 (경로 패널이 열려있지 않을 때만 표시) */}
        {!showRoutePanel && (
          <div style={{
            ...styles.mobileBottomSheetNew,
            height: `${bottomSheetHeight}vh`,
            transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
          {/* 드래그 핸들 */}
          <div
            style={{
              ...styles.bottomSheetHandle,
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div style={{
              ...styles.bottomSheetHandleBar,
              background: isDragging ? '#9ca3af' : '#d1d5db',
              width: isDragging ? '60px' : '48px',
              height: isDragging ? '6px' : '5px',
              transition: 'all 0.2s ease',
            }}></div>
          </div>

          {/* 컨텐츠 */}
          <div style={styles.bottomSheetContent}>
            {/* 주소 검색 영역 */}
            <div style={{ marginBottom: '1rem' }}>
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

              {/* 유종 선택 */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', display: 'block' }}>
                  유종 선택
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <label style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: fuelType === 'B027' ? '2px solid #2563eb' : '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    backgroundColor: fuelType === 'B027' ? '#eff6ff' : 'white',
                    fontSize: '0.875rem',
                    fontWeight: fuelType === 'B027' ? '600' : '400',
                  }}>
                    <input
                      type="radio"
                      name="fuelTypeMobile"
                      value="B027"
                      checked={fuelType === 'B027'}
                      onChange={(e) => handleFuelTypeChange(e.target.value)}
                      style={{ display: 'none' }}
                    />
                    휘발유
                  </label>
                  <label style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: fuelType === 'D047' ? '2px solid #2563eb' : '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    backgroundColor: fuelType === 'D047' ? '#eff6ff' : 'white',
                    fontSize: '0.875rem',
                    fontWeight: fuelType === 'D047' ? '600' : '400',
                  }}>
                    <input
                      type="radio"
                      name="fuelTypeMobile"
                      value="D047"
                      checked={fuelType === 'D047'}
                      onChange={(e) => handleFuelTypeChange(e.target.value)}
                      style={{ display: 'none' }}
                    />
                    경유
                  </label>
                </div>
              </div>

              {/* 검색 반경 슬라이더 */}
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

            {/* 탭 바 (sticky) */}
            <div style={styles.mobileTabBar}>
              <button
                onClick={() => setSortMode('price')}
                style={{
                  ...styles.mobileTabButton,
                  ...(sortMode === 'price' ? styles.mobileTabButtonActive : styles.mobileTabButtonInactive)
                }}
              >
                💰 최저가
              </button>
              <button
                onClick={() => setSortMode('distance')}
                style={{
                  ...styles.mobileTabButton,
                  ...(sortMode === 'distance' ? styles.mobileTabButtonActive : styles.mobileTabButtonInactive)
                }}
              >
                📍 최단거리
              </button>
              <button
                onClick={() => setSortMode('efficiency')}
                style={{
                  ...styles.mobileTabButton,
                  ...(sortMode === 'efficiency' ? styles.mobileTabButtonActive : styles.mobileTabButtonInactive)
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
              <Fuel size={48} color="#d1d5db" style={{ margin: '0 auto 0.5rem' }} />
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
                    //border: index === 0 ? '2px solid #2563eb' : 'none',
                    padding: '0.875rem',
                    marginBottom: '0.5rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleStationClick(station)}
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
        )}

      {/* Route Panel */}
      {showRoutePanel && (
          <div style={styles.routePanelMobile}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                🚗 {selectedStation?.name}까지
              </h3>
              <button
                onClick={closeRoutePanel}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.25rem'
                }}
              >
                ✕
              </button>
            </div>

            {/* Loading State */}
            {routeLoading && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  경로 조회 중...
                </div>
              </div>
            )}

            {/* Error State */}
            {routeError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                padding: '1rem',
                color: '#991b1b',
                fontSize: '0.875rem'
              }}>
                {routeError}
              </div>
            )}

            {/* Route Data */}
            {!routeLoading && !routeError && routeData && (
              <>
                {/* Route Summary */}
                <div style={{
                  background: '#f9fafb',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>거리</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#111827' }}>
                      {(routeData.summary.distance / 1000).toFixed(1)}km
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>시간</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#111827' }}>
                      {Math.round(routeData.summary.duration / 60)}분
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>통행료</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#111827' }}>
                      {routeData.summary.fare?.toll || 0}원
                    </div>
                  </div>
                </div>

                {/* Step-by-step Directions */}
                <div>
                  <h4 style={{ fontSize: '0.938rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.75rem' }}>
                    상세 경로
                  </h4>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {routeData.sections.map((section, sectionIdx) =>
                      section.guides.map((guide, guideIdx) => (
                        <div
                          key={`${sectionIdx}-${guideIdx}`}
                          style={{
                            display: 'flex',
                            gap: '0.75rem',
                            padding: '0.75rem',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: '0.813rem'
                          }}
                        >
                          <div style={{ fontSize: '1.125rem', flexShrink: 0 }}>
                            {getDirectionIcon(guide.type)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>
                              {guide.guidance}
                            </div>
                            {guide.distance > 0 && (
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                {guide.distance}m {guide.duration > 0 && `(${Math.round(guide.duration / 60)}분)`}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
      )}
    </>
    );
  }

  // 데스크톱 레이아웃
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
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

          {/* 유종 선택 */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>유종 선택</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <label style={{
                flex: 1,
                padding: '0.75rem',
                border: fuelType === 'B027' ? '2px solid #2563eb' : '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                textAlign: 'center',
                backgroundColor: fuelType === 'B027' ? '#eff6ff' : 'white',
                fontSize: '1rem',
                fontWeight: fuelType === 'B027' ? '600' : '400',
                transition: 'all 0.2s',
              }}>
                <input
                  type="radio"
                  name="fuelTypeDesktop"
                  value="B027"
                  checked={fuelType === 'B027'}
                  onChange={(e) => handleFuelTypeChange(e.target.value)}
                  style={{ display: 'none' }}
                />
                휘발유
              </label>
              <label style={{
                flex: 1,
                padding: '0.75rem',
                border: fuelType === 'D047' ? '2px solid #2563eb' : '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                textAlign: 'center',
                backgroundColor: fuelType === 'D047' ? '#eff6ff' : 'white',
                fontSize: '1rem',
                fontWeight: fuelType === 'D047' ? '600' : '400',
                transition: 'all 0.2s',
              }}>
                <input
                  type="radio"
                  name="fuelTypeDesktop"
                  value="D047"
                  checked={fuelType === 'D047'}
                  onChange={(e) => handleFuelTypeChange(e.target.value)}
                  style={{ display: 'none' }}
                />
                경유
              </label>
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

            <div
              style={{...styles.summaryCard, ...styles.summaryCardBlue, cursor: 'pointer'}}
              onClick={() => lowestPriceStation && handleStationClick(lowestPriceStation)}
            >
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

            <div
              style={{...styles.summaryCard, ...styles.summaryCardPurple, cursor: 'pointer'}}
              onClick={() => closestStation && handleStationClick(closestStation)}
            >
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

            <div
              style={{...styles.summaryCard, ...styles.summaryCardGreen, cursor: 'pointer'}}
              onClick={() => bestEfficiencyStation && handleStationClick(bestEfficiencyStation)}
            >
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
                ...(sortMode === 'efficiency' ? styles.tabActive : styles.tabInactive),
                position: 'relative'
              }}
              title="가성비 계산 로직: (평균가-해당가) × 주유량 - (거리×2÷연비×평균가)"
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
              <Fuel size={64} color="#d1d5db" style={{ margin: '0 auto 1rem' }} />
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
                    //border: index === 0 ? '2px solid #2563eb' : 'none',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={() => setHoveredCard(station.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => handleStationClick(station)}
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

      {/* 경로 패널 (중간 컬럼) */}
      {showRoutePanel && (
        <div style={styles.routePanel}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
              🚗 {selectedStation?.name}까지
            </h3>
            <button
              onClick={closeRoutePanel}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '0.25rem'
              }}
            >
              ✕
            </button>
          </div>

          {/* Loading State */}
          {routeLoading && (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '1rem', color: '#6b7280' }}>
                경로 조회 중...
              </div>
            </div>
          )}

          {/* Error State */}
          {routeError && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '1rem',
              color: '#991b1b'
            }}>
              {routeError}
            </div>
          )}

          {/* Route Data */}
          {!routeLoading && !routeError && routeData && (
            <>
              {/* Route Summary */}
              <div style={{
                background: '#f9fafb',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>거리</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
                    {(routeData.summary.distance / 1000).toFixed(1)}km
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>소요시간</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
                    {Math.round(routeData.summary.duration / 60)}분
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>통행료</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
                    {routeData.summary.fare?.toll || 0}원
                  </div>
                </div>
              </div>

              {/* Step-by-step Directions */}
              <div>
                <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
                  상세 경로 안내
                </h4>
                <div style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
                  {routeData.sections.map((section, sectionIdx) =>
                    section.guides.map((guide, guideIdx) => (
                      <div
                        key={`${sectionIdx}-${guideIdx}`}
                        style={{
                          display: 'flex',
                          gap: '1rem',
                          padding: '1rem',
                          borderBottom: '1px solid #e5e7eb',
                          fontSize: '0.938rem'
                        }}
                      >
                        <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>
                          {getDirectionIcon(guide.type)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', color: '#111827', marginBottom: '0.5rem' }}>
                            {guide.guidance}
                          </div>
                          {guide.distance > 0 && (
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              {guide.distance}m {guide.duration > 0 && `(${Math.round(guide.duration / 60)}분)`}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 메인 콘텐츠 (우측 - 지도) */}
      <div style={{
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '2rem' }}>
          {/* 지도 영역 */}
          <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <MapPin size={20} color="#2563eb" />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                주변 지도
              </h2>
            </div>
            <div ref={mapRef} style={{ flex: 1, borderRadius: '0.75rem', overflow: 'hidden', minHeight: '400px' }}></div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem', textAlign: 'center' }}>
              {showRoutePanel && selectedStation ? (
                <>🔴 출발지: {address} | ⭐ 도착지: {selectedStation.name}</>
              ) : (
                <>🔴 현재 검색 위치 | 🔵 파란 마커: 주유소 ({stations.filter(s => s.lat && s.lng).length}개) | 검색 반경 {radius.toFixed(1)}km</>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GasStationDashboard;
