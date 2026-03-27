import { clsx } from 'clsx';

const variants = {
  default: 'bg-gray-100 text-gray-600 ring-gray-200/50',
  primary: 'bg-blue-50 text-blue-700 ring-blue-200/50',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200/50',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200/50',
  danger: 'bg-red-50 text-red-700 ring-red-200/50',
  purple: 'bg-purple-50 text-purple-700 ring-purple-200/50',
  pink: 'bg-pink-50 text-pink-700 ring-pink-200/50',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200/50',
  gradient: 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm',
};

const sizes = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  pulse = false,
  outline = false,
  className = '',
  ...props
}) {
  const dotColors = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    primary: 'bg-blue-500',
    default: 'bg-gray-400',
    purple: 'bg-purple-500',
    pink: 'bg-pink-500',
    indigo: 'bg-indigo-500',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-semibold rounded-lg',
        'ring-1 ring-inset',
        'transition-colors duration-150',
        variants[variant],
        sizes[size],
        outline && 'bg-transparent ring-2',
        className
      )}
      {...props}
    >
      {dot && (
        <span className={clsx(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          dotColors[variant] || dotColors.default,
          pulse && 'animate-pulse'
        )} />
      )}
      {children}
    </span>
  );
}

// Status badge with built-in dot
export function StatusBadge({ status, children, className = '' }) {
  const statusConfig = {
    active: { variant: 'success', label: 'Active' },
    pending: { variant: 'warning', label: 'Pending' },
    inactive: { variant: 'default', label: 'Inactive' },
    error: { variant: 'danger', label: 'Error' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge variant={config.variant} dot pulse={status === 'active'} className={className}>
      {children || config.label}
    </Badge>
  );
}

// Count badge for notifications
export function CountBadge({ count, max = 99, className = '' }) {
  const displayCount = count > max ? `${max}+` : count;

  if (count === 0) return null;

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center',
        'min-w-[18px] h-[18px] px-1',
        'text-[10px] font-bold text-white',
        'bg-red-500 rounded-full',
        className
      )}
    >
      {displayCount}
    </span>
  );
}

export default Badge;
