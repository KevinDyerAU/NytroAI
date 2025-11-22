import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { X, ExternalLink } from 'lucide-react';

interface VideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoDialog({ open, onOpenChange }: VideoDialogProps) {
  const videoUrl = "https://notebooklm.google.com/notebook/8d341fd3-09a2-463e-aa7c-c307a288f18b?artifactId=b1672c8f-ebb4-4e7e-a248-9fddc331e08e";

  const handleOpenVideo = () => {
    window.open(videoUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white p-0">
        <DialogHeader className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Nytro Product Demo
            </DialogTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full p-2 hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </DialogHeader>
        
        <div className="px-6 py-8">
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Product Demo Video
              </h3>
              <p className="text-gray-600 mb-6">
                Watch our comprehensive product demonstration to see how Nytro can streamline your RTO validation processes.
              </p>
            </div>
            
            <button
              onClick={handleOpenVideo}
              className="w-full bg-gradient-brand text-white rounded-full font-semibold py-3 px-6 hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="h-5 w-5" />
              Open Demo Video
            </button>
            
            <p className="text-sm text-gray-500 mt-4">
              The video will open in a new tab
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
