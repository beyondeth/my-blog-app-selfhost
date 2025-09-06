import Spinner from './Spinner';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ 
  message, 
  size = 'md' 
}: LoadingSpinnerProps) {
  const spinnerSize = size === 'sm' ? 'md' : size === 'md' ? 'lg' : 'xl';

  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center">
        <Spinner size={spinnerSize} className="mx-auto" />
        {message && <p className="mt-4 text-gray-600 text-sm">{message}</p>}
      </div>
    </div>
  );
} 