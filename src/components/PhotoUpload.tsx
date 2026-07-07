import { useRef } from "react";
import { Camera } from "lucide-react";
import { cn } from "../utils/cn";

type PhotoUploadProps = {
  photoUrl: string;
  onFileSelect: (file: File) => void;
  uploading?: boolean;
  size?: "sm" | "lg";
  className?: string;
};

export function PhotoUpload({ photoUrl, onFileSelect, uploading, size = "lg", className }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dim = size === "lg" ? "w-32 h-32" : "w-24 h-24";

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = "";
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <img
        src={photoUrl}
        alt="Profile"
        className={cn(dim, "rounded-full bg-slate-200 object-cover border-4 border-indigo-100 dark:border-indigo-900")}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition"
        title="Change photo"
      >
        <Camera className="w-4 h-4" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onChange}
      />
      {uploading && (
        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center text-white text-xs font-medium">
          Uploading…
        </div>
      )}
    </div>
  );
}

export function photoPreview(file: File | null, fallback: string): string {
  if (!file) return fallback;
  return URL.createObjectURL(file);
}

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export function validatePhotoFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please select an image file";
  if (file.size > 5 * 1024 * 1024) return "Photo must be 5 MB or smaller";
  return null;
}
