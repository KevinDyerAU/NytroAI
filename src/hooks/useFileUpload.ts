import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface UploadResult {
  filePath: string;
  publicUrl: string;
}

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(
    async (file: File, userId: string, rtoCode: string): Promise<UploadResult> => {
      setIsUploading(true);
      setProgress(0);

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const filePath = `${rtoCode}/${fileName}`;

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 200);

        const { data, error } = await supabase.storage
          .from('documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        clearInterval(progressInterval);

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        setProgress(100);

        return { filePath: data.path, publicUrl };
      } finally {
        setTimeout(() => {
          setIsUploading(false);
          setProgress(0);
        }, 500);
      }
    },
    []
  );

  return { uploadFile, isUploading, progress };
}
