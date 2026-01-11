import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, TrendingDown, Search, Fuel, ChevronLeft, ChevronRight } from 'lucide-react';

// API Base URL
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://gas-station-finder-backend.onrender.com'
  : 'http://localhost:3001';

function ParkingApp() {
  // 상태 관리
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState(null);
  const [radius, setRadius] = useState(1);
  const [parkingLots, setParkingLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [selectedParking, setSelectedParking] = useState(null);

  // 바텀시트 드래그 관련 state
  const [bottomSheetHeight, setBottomSheetHeight] = useState(45); // vh 단위
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Map refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const circleRef = useRef(null);
  const centerMarkerRef = useRef(null);

  // 반응형 처리
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 지도 초기화
  useEffect(() => {
    if (window.kakao && window.kakao.maps && mapRef.current && !mapInstanceRef.current) {
      const options = {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 5
      };
      mapInstanceRef.current = new window.kakao.maps.Map(mapRef.current, options);

      // 지도 컨트롤 추가
      const mapTypeControl = new window.kakao.maps.MapTypeControl();
      mapInstanceRef.current.addControl(mapTypeControl, window.kakao.maps.ControlPosition.TOPRIGHT);

      const zoomControl = new window.kakao.maps.ZoomControl();
      mapInstanceRef.current.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);
    }
  }, []);

  // 페이지 로드 시 현재 위치 자동 가져오기
  useEffect(() => {
    if (navigator.geolocation && !coordinates) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCoordinates({ lat, lng });
          setAddress('현재 위치');

          if (mapInstanceRef.current) {
            const pos = new window.kakao.maps.LatLng(lat, lng);
            mapInstanceRef.current.setCenter(pos);
          }
          setLoading(false);
        },
        (err) => {
          console.log('위치 가져오기 실패:', err.message);
          setLoading(false);
          setCoordinates({ lat: 37.5665, lng: 126.9780 });
          setAddress('서울시청');
        },
        { timeout: 5000 }
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 바텀시트 드래그 핸들러
  const handleTouchStart = (e) => {
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = bottomSheetHeight;
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const deltaY = dragStartY.current - e.touches[0].clientY;
    const deltaVh = (deltaY / window.innerHeight) * 100;
    // 최대 85vh로 제한 (헤더 56px + 탭바 70px = 126px ≈ 15vh)
    const newHeight = Math.max(20, Math.min(85, dragStartHeight.current + deltaVh));
    setBottomSheetHeight(newHeight);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // 스냅 포인트: 20vh (최소), 45vh (중간), 85vh (최대 - 헤더 아래까지)
    const snapPoints = [20, 45, 85];
    const closest = snapPoints.reduce((prev, curr) =>
      Math.abs(curr - bottomSheetHeight) < Math.abs(prev - bottomSheetHeight) ? curr : prev
    );
    setBottomSheetHeight(closest);
  };

  // 주소 검색 (다음 우편번호 API)
  const openAddressSearch = () => {
    new window.daum.Postcode({
      oncomplete: async (data) => {
        const addr = data.address;
        setAddress(addr);

        const geocoder = new window.kakao.maps.services.Geocoder();
        geocoder.addressSearch(addr, (result, status) => {
          if (status === window.kakao.maps.services.Status.OK) {
            const lat = parseFloat(result[0].y);
            const lng = parseFloat(result[0].x);
            setCoordinates({ lat, lng });

            if (mapInstanceRef.current) {
              const position = new window.kakao.maps.LatLng(lat, lng);
              mapInstanceRef.current.setCenter(position);
            }
          }
        });
      }
    }).open();
  };

  // 현재 위치 사용
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('현재 위치를 사용할 수 없습니다.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoordinates({ lat, lng });
        setAddress('현재 위치');

        if (mapInstanceRef.current) {
          const pos = new window.kakao.maps.LatLng(lat, lng);
          mapInstanceRef.current.setCenter(pos);
        }
        setLoading(false);
      },
      (err) => {
        setError('위치를 가져올 수 없습니다: ' + err.message);
        setLoading(false);
      }
    );
  };

  // 주차장 검색
  const searchParking = useCallback(async () => {
    if (!coordinates) {
      setError('먼저 위치를 선택해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/parking?lat=${coordinates.lat}&lng=${coordinates.lng}&radius=${radius}`
      );

      if (!response.ok) {
        throw new Error('주차장 검색 실패');
      }

      const data = await response.json();
      setParkingLots(data.parkingLots || []);
      updateMapMarkers(data.parkingLots || []);
    } catch (err) {
      setError(err.message);
      setParkingLots([]);
    } finally {
      setLoading(false);
    }
  }, [coordinates, radius]);

  // 좌표 변경 시 자동 검색
  useEffect(() => {
    if (coordinates) {
      searchParking();
    }
  }, [coordinates, radius, searchParking]);

  // 지도 마커 업데이트
  const updateMapMarkers = (lots) => {
    if (!mapInstanceRef.current) return;

    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    if (circleRef.current) {
      circleRef.current.setMap(null);
    }
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setMap(null);
    }

    if (!coordinates) return;

    const map = mapInstanceRef.current;
    const centerPosition = new window.kakao.maps.LatLng(coordinates.lat, coordinates.lng);

    // 중심 마커 (빨간색)
    centerMarkerRef.current = new window.kakao.maps.Marker({
      position: centerPosition,
      map: map,
      image: new window.kakao.maps.MarkerImage(
        'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
        new window.kakao.maps.Size(24, 35)
      )
    });

    // 반경 원
    circleRef.current = new window.kakao.maps.Circle({
      center: centerPosition,
      radius: radius * 1000,
      strokeWeight: 2,
      strokeColor: '#3B82F6',
      strokeOpacity: 0.8,
      fillColor: '#3B82F6',
      fillOpacity: 0.15,
      map: map
    });

    // 주차장 마커
    lots.forEach((lot) => {
      if (!lot.latitude || !lot.longitude) return;

      const position = new window.kakao.maps.LatLng(lot.latitude, lot.longitude);

      const marker = new window.kakao.maps.Marker({
        position: position,
        map: map
      });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        setSelectedParking(lot);
      });

      markersRef.current.push(marker);
    });

    // 지도 중심을 현재 위치로 설정 (레벨은 유지)
    map.setCenter(centerPosition);
  };

  // 요금 포맷
  const formatPrice = (price) => {
    if (!price || price === 0) return '무료';
    return `${price.toLocaleString()}원`;
  };

  // 거리 포맷
  const formatDistance = (meters) => {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // 스타일
  const styles = {
    // 데스크톱 스타일
    container: {
      display: 'flex',
      flexDirection: 'row',
      height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    sidebar: {
      width: '450px',
      minWidth: '450px',
      maxWidth: '450px',
      height: '100vh',
      overflowY: 'auto',
      backgroundColor: 'white',
      boxShadow: '2px 0 10px rgba(0, 0, 0, 0.1)'
    },
    headerWrapper: {
      padding: '1.5rem'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      marginBottom: '1.5rem'
    },
    iconBox: {
      background: '#2563eb',
      padding: '0.75rem',
      borderRadius: '0.75rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    title: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: '#111827',
      margin: 0
    },
    subtitle: {
      fontSize: '0.875rem',
      color: '#6b7280',
      margin: 0
    },
    inputGroup: {
      marginBottom: '1rem'
    },
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: '600',
      color: '#374151',
      marginBottom: '0.5rem'
    },
    inputWrapper: {
      position: 'relative',
      display: 'flex',
      gap: '0.5rem',
      flex: 1
    },
    inputIcon: {
      position: 'absolute',
      left: '0.75rem',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#9ca3af',
      fontSize: '20px'
    },
    input: {
      width: '100%',
      padding: '0.75rem 1rem 0.75rem 2.5rem',
      border: '2px solid #e5e7eb',
      borderRadius: '0.75rem',
      fontSize: '1rem',
      background: '#f9fafb',
      boxSizing: 'border-box',
      cursor: 'pointer'
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    slider: {
      width: '100%',
      height: '0.5rem',
      background: '#bfdbfe',
      borderRadius: '0.5rem',
      appearance: 'none',
      cursor: 'pointer',
      accentColor: '#2563eb'
    },
    results: {
      padding: '16px'
    },
    resultCount: {
      fontSize: '14px',
      color: '#6B7280',
      marginBottom: '12px'
    },
    card: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
      border: '1px solid #e5e7eb'
    },
    cardSelected: {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
      border: '2px solid #2563eb',
      cursor: 'pointer'
    },
    cardTitle: {
      fontSize: '16px',
      fontWeight: 'bold',
      marginBottom: '8px',
      color: '#1F2937'
    },
    cardInfo: {
      fontSize: '13px',
      color: '#6B7280',
      marginBottom: '4px'
    },
    badge: {
      display: 'inline-block',
      padding: '2px 8px',
      backgroundColor: '#E5E7EB',
      borderRadius: '4px',
      fontSize: '12px',
      color: '#4B5563',
      marginRight: '6px'
    },
    badgeFree: {
      display: 'inline-block',
      padding: '2px 8px',
      backgroundColor: '#D1FAE5',
      borderRadius: '4px',
      fontSize: '12px',
      color: '#059669',
      marginRight: '6px'
    },
    map: {
      flex: 1,
      height: '100vh'
    },
    error: {
      padding: '12px',
      backgroundColor: '#FEE2E2',
      color: '#DC2626',
      borderRadius: '8px',
      margin: '16px',
      fontSize: '14px'
    },
    loading: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px',
      color: '#6B7280'
    },
    // 모바일 스타일
    mobileHeader: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '56px',
      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      color: 'white',
      padding: '0 1rem',
      zIndex: 1000,
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    mobileBottomSheet: {
      position: 'fixed',
      bottom: '70px',
      left: 0,
      right: 0,
      background: 'white',
      borderRadius: '1.5rem 1.5rem 0 0',
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      overscrollBehavior: 'contain'
    },
    bottomSheetHandle: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '12px',
      cursor: 'grab'
    },
    bottomSheetHandleBar: {
      width: '48px',
      height: '5px',
      backgroundColor: '#d1d5db',
      borderRadius: '3px'
    },
    bottomSheetContent: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 1rem 1rem 1rem'
    },
    compactInput: {
      width: '100%',
      padding: '0.5rem 0.75rem 0.5rem 2rem',
      border: '2px solid #e5e7eb',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      background: '#f9fafb',
      boxSizing: 'border-box'
    },
    compactSlider: {
      width: '100%',
      height: '0.4rem',
      background: '#bfdbfe',
      borderRadius: '0.5rem',
      appearance: 'none',
      cursor: 'pointer',
      accentColor: '#2563eb'
    }
  };

  // 모바일 렌더링
  if (isMobile) {
    return (
      <div style={{ height: '100vh', background: '#f3f4f6' }}>
        {/* 모바일 헤더 */}
        <div style={styles.mobileHeader}>
          <span style={{ fontSize: '1.5rem' }}>🅿️</span>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0, flex: 1 }}>
            스마트 주차장 찾기
          </h1>
        </div>

        {/* 지도 */}
        <div style={{
          position: 'fixed',
          top: '56px',
          left: 0,
          right: 0,
          bottom: `calc(${bottomSheetHeight}vh + 70px)`,
          zIndex: 0,
          transition: isDragging ? 'none' : 'bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
        </div>

        {/* 바텀 시트 */}
        <div style={{
          ...styles.mobileBottomSheet,
          height: `${bottomSheetHeight}vh`,
          transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          {/* 드래그 핸들 */}
          <div
            style={{
              ...styles.bottomSheetHandle,
              cursor: isDragging ? 'grabbing' : 'grab'
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
              transition: 'all 0.2s ease'
            }}></div>
          </div>

          {/* 컨텐츠 */}
          <div style={styles.bottomSheetContent}>
            {/* 주소 검색 */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ ...styles.inputWrapper, flex: 1 }}>
                  <span style={{ ...styles.inputIcon, fontSize: '16px' }}>📍</span>
                  <input
                    type="text"
                    value={address}
                    readOnly
                    onClick={openAddressSearch}
                    style={styles.compactInput}
                    placeholder="주소를 검색하세요"
                  />
                </div>
                <button
                  style={{ ...styles.button, padding: '0.5rem 0.75rem' }}
                  onClick={openAddressSearch}
                >
                  🔍
                </button>
              </div>

              {/* 검색 반경 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151' }}>검색 반경</label>
                <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#2563eb' }}>{radius.toFixed(1)}km</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value))}
                style={styles.compactSlider}
              />
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div style={{
                padding: '0.75rem',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                {error}
              </div>
            )}

            {/* 결과 목록 */}
            {!loading && parkingLots.length > 0 && (
              <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem', color: '#6B7280' }}>
                {parkingLots.length}개 주차장 발견
              </div>
            )}

            {/* 검색 결과 없을 때 반경 넓히기 버튼 */}
            {!loading && parkingLots.length === 0 && coordinates && (
              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                background: '#f9fafb',
                borderRadius: '0.75rem',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '48px', display: 'block', marginBottom: '0.5rem' }}>🅿️</span>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  {radius.toFixed(1)}km 반경 내에 주차장이 없습니다
                </p>
                {radius < 5 && (
                <button
                  onClick={() => setRadius(Math.min(5, radius + 1))}
                  style={{ ...styles.button, width: '100%', justifyContent: 'center' }}
                >
                  검색 반경 넓히기 (+1km)
                </button>
              )}
              </div>
            )}

            {!loading && parkingLots.map((lot, index) => (
              <div
                key={lot.pklt_cd || index}
                style={selectedParking?.pklt_cd === lot.pklt_cd ? styles.cardSelected : styles.card}
                onClick={() => {
                  setSelectedParking(lot);
                  if (mapInstanceRef.current && lot.latitude && lot.longitude) {
                    const pos = new window.kakao.maps.LatLng(lot.latitude, lot.longitude);
                    mapInstanceRef.current.setCenter(pos);
                    mapInstanceRef.current.setLevel(3);
                  }
                }}
              >
                <div style={styles.cardTitle}>{lot.pklt_nm || lot.PKLT_NM}</div>
                <div style={styles.cardInfo}>
                  📍 {lot.addr || lot.ADDR || '주소 없음'}
                </div>
                <div style={styles.cardInfo}>
                  📏 {formatDistance(lot.distance)}
                </div>
                <div style={{ marginTop: '8px' }}>
                  <span style={lot.prk_crg === 0 ? styles.badgeFree : styles.badge}>
                    {formatPrice(lot.prk_crg || lot.PRK_CRG)} / {lot.prk_hm || lot.PRK_HM || '30'}분
                  </span>
                  <span style={styles.badge}>
                    {lot.oper_se_nm || lot.OPER_SE_NM || '공영'}
                  </span>
                  {lot.tpkct && (
                    <span style={styles.badge}>
                      🚗 {lot.tpkct || lot.TPKCT}대
                    </span>
                  )}
                </div>
                {(lot.wd_oper_bgng_tm || lot.WD_OPER_BGNG_TM) && (
                  <div style={{ ...styles.cardInfo, marginTop: '8px' }}>
                    🕐 {lot.wd_oper_bgng_tm || lot.WD_OPER_BGNG_TM} ~ {lot.wd_oper_end_tm || lot.WD_OPER_END_TM}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 데스크톱 렌더링
  return (
    <div style={styles.container}>
      {/* 사이드바 */}
      <div style={styles.sidebar}>
        <div style={styles.headerWrapper}>
          {/* 헤더 */}
          <div style={styles.header}>
            <div style={styles.iconBox}>
              <span style={{ fontSize: '32px' }}>🅿️</span>
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={styles.title}>스마트 주차장 검색</h1>
              <p style={styles.subtitle}>서울 주차장 실시간 검색</p>
            </div>
          </div>

          {/* 주소 검색 영역 */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>내 위치</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={styles.inputWrapper}>
                <MapPin size={20} style={styles.inputIcon} />
                <input
                  type="text"
                  value={address}
                  placeholder="주소를 검색하세요"
                  onClick={openAddressSearch}
                  readOnly
                  style={styles.input}
                />
              </div>
              <button onClick={openAddressSearch} style={styles.button}>
                🔍
              </button>
            </div>
          </div>

          {/* 검색 반경 슬라이더 */}
          <div style={styles.inputGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ ...styles.label, marginBottom: 0 }}>검색 반경</label>
              <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#2563eb' }}>{radius.toFixed(1)}km</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={radius}
              onChange={(e) => setRadius(parseFloat(e.target.value))}
              style={styles.slider}
            />
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && <div style={styles.error}>{error}</div>}

        {/* 결과 목록 */}
        <div style={styles.results}>
          {loading ? (
            <div style={styles.loading}>검색 중...</div>
          ) : parkingLots.length === 0 && coordinates ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              background: '#f9fafb',
              borderRadius: '0.75rem'
            }}>
              <span style={{ fontSize: '64px', display: 'block', marginBottom: '1rem' }}>🅿️</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '0.5rem' }}>
                주변에 주차장이 없습니다
              </h3>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                {radius.toFixed(1)}km 반경 내에서 주차장을 찾을 수 없습니다.
              </p>
              {radius < 5 && (
                <button
                  onClick={() => setRadius(Math.min(5, radius + 1))}
                  style={{ ...styles.button, display: 'block', margin: '0 auto' }}
                >
                  검색 반경 넓히기 (+1km)
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={styles.resultCount}>
                {parkingLots.length > 0
                  ? `${parkingLots.length}개 주차장 발견`
                  : '위치를 선택하세요'}
              </div>

              {parkingLots.map((lot, index) => (
                <div
                  key={lot.pklt_cd || index}
                  style={selectedParking?.pklt_cd === lot.pklt_cd ? styles.cardSelected : styles.card}
                  onClick={() => {
                    setSelectedParking(lot);
                    if (mapInstanceRef.current && lot.latitude && lot.longitude) {
                      const pos = new window.kakao.maps.LatLng(lot.latitude, lot.longitude);
                      mapInstanceRef.current.setCenter(pos);
                      mapInstanceRef.current.setLevel(3);
                    }
                  }}
                >
                  <div style={styles.cardTitle}>{lot.pklt_nm || lot.PKLT_NM}</div>
                  <div style={styles.cardInfo}>
                    📍 {lot.addr || lot.ADDR || '주소 없음'}
                  </div>
                  <div style={styles.cardInfo}>
                    📏 {formatDistance(lot.distance)}
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <span style={lot.prk_crg === 0 ? styles.badgeFree : styles.badge}>
                      {formatPrice(lot.prk_crg || lot.PRK_CRG)} / {lot.prk_hm || lot.PRK_HM || '30'}분
                    </span>
                    <span style={styles.badge}>
                      {lot.oper_se_nm || lot.OPER_SE_NM || '공영'}
                    </span>
                    {lot.tpkct && (
                      <span style={styles.badge}>
                        🚗 {lot.tpkct || lot.TPKCT}대
                      </span>
                    )}
                  </div>
                  {(lot.wd_oper_bgng_tm || lot.WD_OPER_BGNG_TM) && (
                    <div style={{ ...styles.cardInfo, marginTop: '8px' }}>
                      🕐 {lot.wd_oper_bgng_tm || lot.WD_OPER_BGNG_TM} ~ {lot.wd_oper_end_tm || lot.WD_OPER_END_TM}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 지도 */}
      <div ref={mapRef} style={styles.map}></div>
    </div>
  );
}

export default ParkingApp;
