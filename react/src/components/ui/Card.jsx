import { clsx } from 'clsx';

const cardVariants = {
  default: 'bg-white border-gray-100/80',
  elevated: 'bg-white border-gray-100/50 shadow-lg',
  outline: 'bg-transparent border-gray-200',
  ghost: 'bg-gray-50/50 border-transparent',
  gradient: 'bg-gradient-to-br from-white to-gray-50/50 border-gray-100/80',
};

const paddingSizes = {
  none: '',
  xs: 'p-3',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10',
};

export function Card({
  children,
  className = '',
  variant = 'default',
  hover = false,
  interactive = false,
  padding = 'md',
  glow = false,
  ...props
}) {
  return (
    <div
      className={clsx(
        // Base styles
        'relative min-w-0 rounded-2xl border transition-all duration-200',
        'shadow-sm',
        // Variant styles
        cardVariants[variant],
        // Padding
        paddingSizes[padding],
        // Hover effects
        hover && 'card-hover cursor-pointer',
        interactive && 'card-interactive',
        // Glow effect
        glow && 'animate-glow',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', action }) {
  return (
    <div className={clsx('mb-5 flex items-start justify-between', className)}>
      <div className="flex-1">{children}</div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  );
}

export function CardTitle({ children, className = '', as: Tag = 'h3' }) {
  return (
    <Tag className={clsx(
      'text-lg font-bold text-gray-900 tracking-tight',
      className
    )}>
      {children}
    </Tag>
  );
}

export function CardDescription({ children, className = '' }) {
  return (
    <p className={clsx(
      'text-sm text-gray-500 mt-1.5 leading-relaxed',
      className
    )}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={clsx(className)}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', border = true }) {
  return (
    <div className={clsx(
      'mt-6 pt-5 flex items-center',
      border && 'border-t border-gray-100',
      className
    )}>
      {children}
    </div>
  );
}

// Premium card with gradient border
export function GradientCard({ children, className = '', padding = 'md', ...props }) {
  return (
    <div
      className={clsx(
        'relative rounded-2xl p-[1px]',
        'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500',
        className
      )}
      {...props}
    >
      <div className={clsx(
        'bg-white rounded-2xl h-full',
        paddingSizes[padding]
      )}>
        {children}
      </div>
    </div>
  );
}

// Glass card for overlays
export function GlassCard({ children, className = '', padding = 'md', ...props }) {
  return (
    <div
      className={clsx(
        'rounded-2xl',
        'bg-white/70 backdrop-blur-xl',
        'border border-white/20',
        'shadow-xl shadow-gray-900/5',
        paddingSizes[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
