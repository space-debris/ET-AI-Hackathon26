import { useState, createContext, useContext } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

const TabsContext = createContext(null);

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className = '',
}) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeValue = value ?? internalValue;

  const handleChange = (newValue) => {
    if (onValueChange) {
      onValueChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  return (
    <TabsContext.Provider value={{ activeValue, onChange: handleChange }}>
      <div className={clsx('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = '' }) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1 p-1 bg-gray-100 rounded-lg',
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = '' }) {
  const context = useContext(TabsContext);
  const isActive = context.activeValue === value;

  return (
    <button
      onClick={() => context.onChange(value)}
      className={clsx(
        'relative px-4 py-2 text-sm font-medium rounded-md transition-colors',
        isActive
          ? 'text-gray-900'
          : 'text-gray-500 hover:text-gray-700',
        className
      )}
    >
      {isActive && (
        <motion.div
          layoutId="active-tab"
          className="absolute inset-0 bg-white rounded-md shadow-sm"
          transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

export function TabsContent({ value, children, className = '' }) {
  const context = useContext(TabsContext);

  if (context.activeValue !== value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className={clsx('mt-4', className)}
    >
      {children}
    </motion.div>
  );
}

export default Tabs;
