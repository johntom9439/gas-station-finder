import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Layout({ children }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();

  // 반응형 처리
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    {
      path: '/',
      icon: '⛽',
      mobileIcon: '⛽',
      label: '스마트 주유소 찾기',
      mobileLabel: '주유소'
    },
    {
      path: '/parking',
      icon: '🅿️',
      mobileIcon: '🅿️',
      label: '스마트 주차장 찾기',
      mobileLabel: '주차장'
    }
  ];

  const styles = {
    container: {
      display: 'flex',
      minHeight: '100vh'
    },
    lnb: {
      position: 'fixed',
      left: 0,
      top: 0,
      height: '100vh',
      width: isExpanded ? '200px' : '60px',
      backgroundColor: '#1F2937',
      transition: 'width 0.3s ease',
      zIndex: 1000,
      display: isMobile ? 'none' : 'flex',
      flexDirection: 'column',
      boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
    },
    logo: {
      padding: '20px',
      borderBottom: '1px solid #374151',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isExpanded ? '12px' : '0',
      minHeight: '64px'
    },
    logoIcon: {
      fontSize: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    logoText: {
      color: 'white',
      fontSize: '16px',
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      opacity: isExpanded ? 1 : 0,
      transition: 'opacity 0.3s ease',
      overflow: 'hidden'
    },
    menu: {
      flex: 1,
      padding: '16px 0'
    },
    menuItem: {
      display: 'flex',
      alignItems: 'center',
      padding: '14px 20px',
      color: '#9CA3AF',
      textDecoration: 'none',
      gap: '14px',
      transition: 'all 0.2s ease',
      borderLeft: '3px solid transparent',
      cursor: 'pointer'
    },
    menuItemActive: {
      display: 'flex',
      alignItems: 'center',
      padding: '14px 20px',
      color: 'white',
      textDecoration: 'none',
      gap: '14px',
      backgroundColor: '#374151',
      borderLeft: '3px solid #3B82F6',
      cursor: 'pointer'
    },
    menuIcon: {
      fontSize: '20px',
      minWidth: '24px',
      textAlign: 'center'
    },
    menuLabel: {
      fontSize: '14px',
      whiteSpace: 'nowrap',
      opacity: isExpanded ? 1 : 0,
      transition: 'opacity 0.3s ease',
      overflow: 'hidden'
    },
    content: {
      flex: 1,
      marginLeft: isMobile ? 0 : '60px',
      transition: 'margin-left 0.3s ease',
      width: isMobile ? '100%' : 'calc(100% - 60px)'
    },
    // 모바일 하단 네비게이션
    mobileNav: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '70px',
      backgroundColor: 'white',
      borderTop: '1px solid #E5E7EB',
      display: isMobile ? 'flex' : 'none',
      justifyContent: 'space-around',
      alignItems: 'center',
      zIndex: 9999,
      paddingBottom: 'env(safe-area-inset-bottom)',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.1)'
    },
    mobileNavItem: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px 24px',
      color: '#6B7280',
      textDecoration: 'none',
      fontSize: '13px',
      gap: '6px',
      flex: 1
    },
    mobileNavItemActive: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px 24px',
      color: '#2563eb',
      textDecoration: 'none',
      fontSize: '13px',
      fontWeight: '600',
      gap: '6px',
      flex: 1
    },
    mobileNavIcon: {
      fontSize: '28px'
    }
  };

  return (
    <div style={styles.container}>
      {/* Desktop LNB */}
      <nav
        style={styles.lnb}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* 로고 */}
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🚗</span>
          <span style={styles.logoText}>스마트 파인더</span>
        </div>

        {/* 메뉴 */}
        <div style={styles.menu}>
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={location.pathname === item.path ? styles.menuItemActive : styles.menuItem}
            >
              <span style={styles.menuIcon}>{item.icon}</span>
              <span style={styles.menuLabel}>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <main style={styles.content}>
        {children}
      </main>

      {/* 모바일 하단 네비게이션 */}
      <nav style={styles.mobileNav}>
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            style={location.pathname === item.path ? styles.mobileNavItemActive : styles.mobileNavItem}
          >
            <span style={styles.mobileNavIcon}>{item.mobileIcon}</span>
            <span>{item.mobileLabel}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default Layout;
