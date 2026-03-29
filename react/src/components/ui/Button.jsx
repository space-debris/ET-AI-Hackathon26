import { forwardRef } from 'react';
import { clsx } from 'clsx';

const variants = {
  primary: `
    bg-gradient-to-r from-blue-600 to-blue-500 text-white
    hover:from-blue-700 hover:to-blue-600
    shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30
    active:shadow-sm
  `,
  secondary: `
    bg-white text-gray-700 border border-gray-200
    hover:bg-gray-50 hover:border-gray-300
    shadow-sm hover:shadow
  `,
  success: `
    bg-gradient-to-r from-emerald-600 to-emerald-500 text-white
    hover:from-emerald-700 hover:to-emerald-600
    shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30
  `,
  danger: `
    bg-gradient-to-r from-red-600 to-red-500 text-white
    hover:from-red-700 hover:to-red-600
    shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/30
  `,
  ghost: `
    bg-transparent text-gray-600
    hover:bg-gray-100 hover:text-gray-900
  `,
  outline: `
    bg-transparent border-2 border-blue-500 text-blue-600
    hover:bg-blue-50 hover:border-blue-600
  `,
  glass: `
    bg-white/80 backdrop-blur-lg text-gray-700 border border-white/30
    hover:bg-white/90 shadow-lg
  `,
};

const sizes = {
  xs: 'px-2.5 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
  xl: 'px-8 py-4 text-lg gap-2.5',
};

export const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'group relative inline-flex items-center justify-center font-semibold',
        'rounded-xl transition-all duration-200 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
        'active:scale-[0.98]',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading...</span>
        </div>
      ) : (
        <>
          {Icon && iconPosition === 'left' && (
            <Icon className={clsx(
              'transition-transform group-hover:-translate-x-0.5',
              size === 'xs' || size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
            )} />
          )}
          {children}
          {Icon && iconPosition === 'right' && (
            <Icon className={clsx(
              'transition-transform group-hover:translate-x-0.5',
              size === 'xs' || size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
            )} />
          )}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
