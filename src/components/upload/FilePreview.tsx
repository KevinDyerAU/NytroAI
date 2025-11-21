import { FileText, File, X } from 'lucide-react';
import { Button } from '../ui/button';

interface FilePreviewProps {
  file: File;
  onRemove: () => void;
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return FileText;
    if (type.includes('word')) return FileText;
    return File;
  };

  const Icon = getFileIcon(file.type);

  return (
    <div className="flex items-center gap-3 p-3 bg-card rounded-lg border">
      <div className="p-2 bg-primary/10 rounded">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{file.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
