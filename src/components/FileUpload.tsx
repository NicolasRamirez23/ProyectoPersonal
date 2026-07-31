import { useState, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './Button';

interface FileUploadProps {
  label?: string;
  onChange: (files: string[]) => void;
  maxFiles?: number;
  accept?: string;
}

export function FileUpload({ label, onChange, maxFiles = 5, accept = 'image/*' }: FileUploadProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (previews.length + files.length > maxFiles) {
      alert(`Máximo ${maxFiles} archivos permitidos`);
      return;
    }

    const newFiles: string[] = [];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        newFiles.push(base64);
        if (newFiles.length === files.length) {
          const updated = [...previews, ...newFiles];
          setPreviews(updated);
          onChange(updated);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    const updated = previews.filter((_, i) => i !== index);
    setPreviews(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div 
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all",
          previews.length >= maxFiles && "opacity-50 pointer-events-none"
        )}
      >
        <Upload className="h-8 w-8 text-slate-400 mb-2" />
        <p className="text-sm text-slate-500">Haz click o arrastra archivos aquí</p>
        <p className="text-xs text-slate-400 mt-1">Soporta PNG, JPG, PDF (Máx {maxFiles})</p>
        <input 
          ref={inputRef}
          type="file" 
          multiple 
          accept={accept}
          className="hidden" 
          onChange={handleFileChange}
        />
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mt-4">
          {previews.map((src, i) => (
            <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-100 shadow-sm">
              <img src={src} className="w-full h-full object-cover" alt="Preview" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="absolute top-1 right-1 bg-white/90 rounded-full p-1 shadow-md hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
