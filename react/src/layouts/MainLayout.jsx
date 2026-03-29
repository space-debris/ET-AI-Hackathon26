import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import { Sidebar, MobileNav } from './Sidebar';

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 50),
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 320),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [sidebarCollapsed]);

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Desktop Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Mobile Navigation */}
      <MobileNav
        isOpen={mobileNavOpen}
        setIsOpen={setMobileNavOpen}
      />

      {/* Main Content */}
      <main
        className={clsx(
          'min-h-screen transition-all duration-300 ease-out',
          'pt-16 lg:pt-0',
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'
        )}
      >
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
