import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

const iconColors = {
  blue: 'bg-blue-50 text-blue-600 ring-blue-100',
  green: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  purple: 'bg-purple-50 text-purple-600 ring-purple-100',
  orange: 'bg-orange-50 text-orange-600 ring-orange-100',
  pink: 'bg-pink-50 text-pink-600 ring-pink-100',
};

export function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconColor = 'blue',
  subtitle,
  trend,
  className = '',
  animated = true,
}) {
  const changeStyles = {
    positive: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      icon: TrendingUp,
    },
    negative: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      icon: TrendingDown,
    },
    neutral: {
      bg: 'bg-gray-50',
      text: 'text-gray-600',
      icon: Minus,
    },
  };

  const changeConfig = changeStyles[changeType];
  const ChangeIcon = changeConfig.icon;

  const Wrapper = animated ? motion.div : 'div';
  const wrapperProps = animated ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4 },
  } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={clsx(
        'relative overflow-hidden',
        'bg-white rounded-2xl border border-gray-100/80',
        'p-6 shadow-sm hover:shadow-md transition-shadow duration-200',
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-transparent pointer-events-none" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-500 tracking-wide">
              {title}
            </p>
            <p className="text-3xl font-bold text-gray-900 tracking-tight number-display">
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className={clsx(
              'p-3 rounded-xl ring-1 ring-inset transition-transform hover:scale-105',
              iconColors[iconColor]
            )}>
              <Icon className="h-6 w-6" strokeWidth={2} />
            </div>
          )}
        </div>

        {change !== undefined && (
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-3">
            <span className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold',
              changeConfig.bg,
              changeConfig.text
            )}>
              <ChangeIcon className="h-3.5 w-3.5" />
              {change}
            </span>
            <span className="text-xs text-gray-400">
              {trend || 'vs last period'}
            </span>
          </div>
        )}
      </div>
    </Wrapper>
  );
}

// Gradient stat card for highlighting key metrics
export function GradientStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient = 'primary',
  className = '',
}) {
  const gradients = {
    primary: 'from-blue-600 to-indigo-600',
    success: 'from-emerald-500 to-teal-600',
    purple: 'from-purple-600 to-pink-600',
    orange: 'from-orange-500 to-red-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'relative overflow-hidden rounded-2xl p-6',
        'bg-gradient-to-br',
        gradients[gradient],
        'text-white shadow-lg',
        className
      )}
    >
      {/* Decorative circles */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">{title}</p>
            <p className="text-4xl font-bold mt-2 tracking-tight number-display">
              {value}
            </p>
            {subtitle && (
              <p className="text-sm text-white/70 mt-2">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Icon className="h-7 w-7" strokeWidth={2} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default StatCard;
