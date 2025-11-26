import { useState, useCallback } from "react";
import { Upload, X, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssistantFileUploadProps {
  onFilesSelected: (files: File[]) => void;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
}

export default function AssistantFileUpload({
  onFilesSelected,
  selectedFiles,
  onRemoveFile,
  disabled = false,
}: AssistantFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type === 'text/csv' ||
      file.type === 'application/pdf' ||
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [disabled, onFilesSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input
    e.target.value = '';
  }, [onFilesSelected]);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="space-y-2">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
        `}
      >
        <input
          type="file"
          accept=".csv,.pdf,image/*"
          multiple
          onChange={handleFileInput}
          className="hidden"
          id="assistant-file-input"
          disabled={disabled}
        />
        <label
          htmlFor="assistant-file-input"
          className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
        >
          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drop files here or click to upload
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            CSV, PDF, or images
          </p>
        </label>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-1">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 p-2 bg-muted rounded text-sm"
            >
              {getFileIcon(file)}
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onRemoveFile(index)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
