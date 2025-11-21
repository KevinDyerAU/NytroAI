import { CheckCircle, Loader2 } from 'lucide-react';
import { Progress } from '../ui/progress';

interface UploadProgressProps {
  fileName: string;
  progress: number;
  isUploading: boolean;
}

export function UploadProgress({ fileName, progress, isUploading }: UploadProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium truncate flex-1 mr-4">{fileName}</span>
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : progress === 100 ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : null}
      </div>
      {isUploading && <Progress value={progress} className="h-2" />}
    </div>
  );
}
