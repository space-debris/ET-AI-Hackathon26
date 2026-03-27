import { clsx } from 'clsx';
import { FileQuestion } from 'lucide-react';
import { Button } from './Button';

export function EmptyState({
  icon: Icon = FileQuestion,
  title = 'No data found',
  description,
  action,
  actionLabel = 'Get Started',
  className = '',
}) {
  return (
    <div className={clsx(
      'flex flex-col items-center justify-center py-12 px-6 text-center',
      className
    )}>
      <div className="p-4 bg-gray-50 rounded-full mb-4">
        <Icon className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action} variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
