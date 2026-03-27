import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, Check } from 'lucide-react';

export const Input = forwardRef(({
  label,
  error,
  hint,
  success,
  icon: Icon,
  suffix,
  size = 'md',
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  const hasStatus = error || success;

  return (
    <div className={clsx('space-y-2', containerClassName)}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700">
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            'block w-full rounded-xl border-2 bg-white',
            'text-gray-900 placeholder:text-gray-400',
            'transition-all duration-200 ease-out',
            'focus:outline-none',
            'hover:border-gray-300',
            sizes[size],
            Icon && 'pl-11',
            suffix && 'pr-12',
            error && 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-4 focus:ring-red-100',
            success && 'border-emerald-300 bg-emerald-50/30 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100',
            !hasStatus && 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100',
            className
          )}
          {...props}
        />
        {suffix && (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
            <span className="text-gray-400 text-sm">{suffix}</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
        )}
        {success && !error && (
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
            <Check className="h-5 w-5 text-emerald-500" />
          </div>
        )}
      </div>
      {hint && !error && (
        <p className="text-xs text-gray-500 pl-1">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 pl-1 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// Textarea component
export const Textarea = forwardRef(({
  label,
  error,
  hint,
  rows = 4,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  return (
    <div className={clsx('space-y-2', containerClassName)}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={clsx(
          'block w-full rounded-xl border-2 bg-white px-4 py-3',
          'text-gray-900 placeholder:text-gray-400 resize-none',
          'transition-all duration-200 ease-out',
          'focus:outline-none',
          'hover:border-gray-300',
          error
            ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-4 focus:ring-red-100'
            : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100',
          className
        )}
        {...props}
      />
      {hint && !error && (
        <p className="text-xs text-gray-500 pl-1">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 pl-1 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Input;
