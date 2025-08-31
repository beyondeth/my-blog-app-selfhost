import { FiArrowLeft } from 'react-icons/fi';

interface ErrorMessageProps {
  title?: string;
  message: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export default function ErrorMessage({ 
  title = '404',
  message,
  showBackButton = true,
  onBack
}: ErrorMessageProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center">
        {title && <h1 className="text-6xl font-light text-gray-900 mb-4">{title}</h1>}
        <p className="text-gray-600 mb-8">{message}</p>
        {showBackButton && (
          <button
            onClick={handleBack}
            className="inline-flex items-center px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors"
          >
            <FiArrowLeft className="mr-2" />
            Back to Home
          </button>
        )}
      </div>
    </div>
  );
} 