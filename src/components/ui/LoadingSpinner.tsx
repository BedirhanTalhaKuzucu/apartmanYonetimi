import { Loader2 } from 'lucide-react';

interface Props {
  text?: string;
}

export default function LoadingSpinner({ text }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  );
}

export { LoadingSpinner };
