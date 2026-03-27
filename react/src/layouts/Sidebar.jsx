import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  PieChart,
  Flame,
  Calculator,
  Activity,
  FileText,
  Upload,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'blue' },
  { path: '/upload', label: 'Upload Statement', icon: Upload, color: 'indigo' },
  { path: '/portfolio', label: 'Portfolio Analysis', icon: PieChart, color: 'purple' },
  { path: '/fire-planner', label: 'FIRE Planner', icon: Flame, color: 'orange' },
  { path: '/tax-optimizer', label: 'Tax Optimizer', icon: Calculator, color: 'emerald' },
  { path: '/health-score', label: 'Health Score', icon: Activity, color: 'pink' },
  { path: '/recommendations', label: 'Recommendations', icon: FileText, color: 'cyan' },
];

const bottomItems = [
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/help', label: 'Help & Support', icon: HelpCircle },
];

const iconColors = {
  blue: 'group-hover:text-blue-600',
  indigo: 'group-hover:text-indigo-600',
  purple: 'group-hover:text-purple-600',
  orange: 'group-hover:text-orange-500',
  emerald: 'group-hover:text-emerald-600',
  pink: 'group-hover:text-pink-600',
  cyan: 'group-hover:text-cyan-600',
};

const activeBgColors = {
  blue: 'bg-blue-50',
  indigo: 'bg-indigo-50',
  purple: 'bg-purple-50',
  orange: 'bg-orange-50',
  emerald: 'bg-emerald-50',
  pink: 'bg-pink-50',
  cyan: 'bg-cyan-50',
};

const activeTextColors = {
  blue: 'text-blue-600',
  indigo: 'text-indigo-600',
  purple: 'text-purple-600',
  orange: 'text-orange-500',
  emerald: 'text-emerald-600',
  pink: 'text-pink-600',
  cyan: 'text-cyan-600',
};

export function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-screen z-40',
        'bg-white/80 backdrop-blur-xl',
        'border-r border-gray-100/80',
        'transition-all duration-300 ease-out',
        'hidden lg:flex flex-col',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      {/* Logo */}
      <div className={clsx(
        'h-20 flex items-center border-b border-gray-100/80',
        collapsed ? 'justify-center px-4' : 'px-6'
      )}>
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-11 h-11 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30"
          >
            <Sparkles className="h-5 w-5 text-white" />
            <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <span className="font-bold text-xl text-gray-900 tracking-tight">
                  FinSage
                </span>
                <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ml-1">
                  AI
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            item={item}
            collapsed={collapsed}
            isActive={location.pathname === item.path}
          />
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-100/80 py-4 px-3 space-y-1">
        {bottomItems.map((item) => (
          <NavItem
            key={item.path}
            item={{ ...item, color: 'blue' }}
            collapsed={collapsed}
            isActive={location.pathname === item.path}
          />
        ))}
      </div>

      {/* User Section */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-100/80">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">Ayush</p>
              <p className="text-xs text-gray-500 truncate">Free Plan</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setCollapsed(!collapsed)}
        className={clsx(
          'absolute -right-3 top-24 p-2',
          'bg-white border border-gray-200 rounded-full',
          'shadow-md hover:shadow-lg',
          'text-gray-400 hover:text-gray-600',
          'transition-all duration-200'
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </motion.button>
    </aside>
  );
}

function NavItem({ item, collapsed, isActive }) {
  const Icon = item.icon;
  const color = item.color || 'blue';

  return (
    <NavLink
      to={item.path}
      className={clsx(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl',
        'transition-all duration-200 relative',
        isActive
          ? [activeBgColors[color], activeTextColors[color]]
          : 'text-gray-600 hover:bg-gray-50'
      )}
    >
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Icon className={clsx(
          'h-5 w-5 flex-shrink-0 transition-colors duration-200',
          isActive ? activeTextColors[color] : ['text-gray-400', iconColors[color]]
        )} />
      </motion.div>

      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className={clsx(
              'text-sm font-medium whitespace-nowrap',
              isActive ? activeTextColors[color] : 'group-hover:text-gray-900'
            )}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Tooltip for collapsed state */}
      {collapsed && (
        <div className={clsx(
          'absolute left-full ml-3 px-3 py-2',
          'bg-gray-900 text-white text-sm font-medium rounded-lg',
          'opacity-0 invisible group-hover:opacity-100 group-hover:visible',
          'transition-all duration-200 whitespace-nowrap z-50',
          'shadow-xl'
        )}>
          {item.label}
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
        </div>
      )}

      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="sidebar-indicator"
          className={clsx(
            'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full',
            'bg-gradient-to-b',
            color === 'blue' && 'from-blue-500 to-blue-600',
            color === 'indigo' && 'from-indigo-500 to-indigo-600',
            color === 'purple' && 'from-purple-500 to-purple-600',
            color === 'orange' && 'from-orange-400 to-orange-500',
            color === 'emerald' && 'from-emerald-500 to-emerald-600',
            color === 'pink' && 'from-pink-500 to-pink-600',
            color === 'cyan' && 'from-cyan-500 to-cyan-600'
          )}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
    </NavLink>
  );
}

export function MobileNav({ isOpen, setIsOpen }) {
  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg text-gray-900">FinSage</span>
            <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ml-1">AI</span>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </motion.button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="lg:hidden fixed left-0 top-16 bottom-0 w-80 bg-white z-50 overflow-y-auto shadow-2xl"
            >
              <nav className="py-6 px-4 space-y-2">
                {navItems.map((item) => (
                  <MobileNavItem
                    key={item.path}
                    item={item}
                    onClick={() => setIsOpen(false)}
                  />
                ))}
              </nav>
              <div className="border-t border-gray-100 py-4 px-4 space-y-2">
                {bottomItems.map((item) => (
                  <MobileNavItem
                    key={item.path}
                    item={{ ...item, color: 'blue' }}
                    onClick={() => setIsOpen(false)}
                  />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function MobileNavItem({ item, onClick }) {
  const location = useLocation();
  const isActive = location.pathname === item.path;
  const Icon = item.icon;
  const color = item.color || 'blue';

  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200',
        isActive
          ? [activeBgColors[color], activeTextColors[color]]
          : 'text-gray-600 hover:bg-gray-50'
      )}
    >
      <Icon className={clsx(
        'h-5 w-5',
        isActive ? activeTextColors[color] : 'text-gray-400'
      )} />
      <span className="font-medium">{item.label}</span>
    </NavLink>
  );
}

export default Sidebar;
