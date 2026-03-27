import { AlertCircle, FlaskConical, ServerCrash } from 'lucide-react';
import { runtimeConfig } from '../../services/api';

export function RuntimeNotice({
  title,
  description,
  variant = runtimeConfig.demoModeEnabled ? 'demo' : 'live',
}) {
  const styles = {
    demo: {
      icon: FlaskConical,
      wrapper: 'border-amber-200 bg-amber-50 text-amber-900',
      subtext: 'text-amber-800',
    },
    error: {
      icon: ServerCrash,
      wrapper: 'border-red-200 bg-red-50 text-red-900',
      subtext: 'text-red-800',
    },
    live: {
      icon: AlertCircle,
      wrapper: 'border-blue-200 bg-blue-50 text-blue-900',
      subtext: 'text-blue-800',
    },
  };

  const style = styles[variant];
  const Icon = style.icon;

  return (
    <div className={`rounded-xl border px-4 py-3 ${style.wrapper}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {description && <p className={`mt-1 text-sm ${style.subtext}`}>{description}</p>}
        </div>
      </div>
    </div>
  );
}

export default RuntimeNotice;
