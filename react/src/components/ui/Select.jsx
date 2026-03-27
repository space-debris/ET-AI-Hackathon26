import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Check, ChevronDown } from 'lucide-react';

export const Select = forwardRef(({
  label,
  error,
  hint,
  options = [],
  placeholder = 'Select option',
  className = '',
  containerClassName = '',
  onChange,
  value,
  name,
  ...props
}, ref) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)) ?? null,
    [options, value]
  );

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleSelect = (nextValue) => {
    setOpen(false);
    onChange?.({
      target: {
        value: nextValue,
        name,
      },
    });
  };

  return (
    <div className={clsx('space-y-2', containerClassName)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700">
          {label}
        </label>
      )}
      <input ref={ref} type="hidden" value={value ?? ''} name={name} />
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={clsx(
            'flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl border-2 bg-white px-4 py-2.5 text-left text-sm',
            'transition-all duration-200 ease-out hover:border-gray-300 focus:outline-none focus:ring-4',
            error
              ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-red-100'
              : 'border-gray-200 focus:border-blue-500 focus:ring-blue-100',
            className
          )}
          {...props}
        >
          <span className={clsx('text-sm font-medium', selectedOption ? 'text-gray-900' : 'text-gray-400')}>
            {selectedOption?.label ?? placeholder}
          </span>
          <div className={clsx(
            'flex shrink-0 items-center justify-center text-gray-400 transition-colors',
            open && 'text-blue-500'
          )}>
            <ChevronDown className={clsx('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} />
          </div>
        </button>
        {open && (
          <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-[0_20px_45px_rgba(15,23,42,0.14)]">
            <div className="max-h-64 overflow-y-auto">
              {options.map((option) => {
                const active = String(option.value) === String(value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => handleSelect(option.value)}
                    className={clsx(
                      'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <span>{option.label}</span>
                    {active && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {hint && !error && (
        <p className="pl-1 text-xs text-gray-500">{hint}</p>
      )}
      {error && (
        <p className="pl-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;
