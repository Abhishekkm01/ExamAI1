import { useEffect, useRef, useState } from "react";
import { Camera, AlertTriangle } from "lucide-react";
import { Button } from "./Layout";
import { cn } from "../utils/cn";

type FaceCaptureProps = {
  onCapture: (imageBase64: string) => void;
  disabled?: boolean;
  captureLabel?: string;
  className?: string;
};

export function FaceCapture({
  onCapture,
  disabled,
  captureLabel = "Capture Photo",
  className,
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not supported in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch {
        setError("Camera access denied. Allow camera permission in your browser and reload.");
      }
    })();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.9));
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="aspect-video rounded-xl bg-slate-900 flex items-center justify-center relative overflow-hidden">
        {error ? (
          <div className="p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="text-sm text-slate-300">{error}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror"
            />
            <div className="absolute inset-0 pointer-events-none border-2 border-indigo-400/40 rounded-xl m-6" />
          </>
        )}
        <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-rose-500 text-white text-xs font-semibold flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE
        </div>
      </div>
      <Button
        variant="primary"
        className="w-full"
        onClick={capture}
        disabled={disabled || !ready || !!error}
      >
        <Camera className="w-4 h-4" /> {captureLabel}
      </Button>
      <style>{`.mirror { transform: scaleX(-1); }`}</style>
    </div>
  );
}
