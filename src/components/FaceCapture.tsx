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
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not supported in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          // Wait until we have a real frame (avoids blank / black captures after remount)
          await new Promise<void>((resolve) => {
            const done = () => resolve();
            if (video.readyState >= 2 && video.videoWidth > 0) {
              done();
              return;
            }
            video.onloadeddata = () => done();
            setTimeout(done, 800);
          });
        }
        if (active) setReady(true);
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

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || capturing) return;
    setCapturing(true);
    try {
      // Grab the next painted frame so we don't reuse a stale buffer
      await new Promise<void>((resolve) => {
        if ("requestVideoFrameCallback" in video) {
          (video as HTMLVideoElement & {
            requestVideoFrameCallback: (cb: () => void) => void;
          }).requestVideoFrameCallback(() => resolve());
        } else {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }
      });

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Capture the raw camera frame (preview is mirrored for UX only).
      // Keep this consistent with enrolled face templates.
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onCapture(canvas.toDataURL("image/jpeg", 0.92));
    } finally {
      setCapturing(false);
    }
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
        disabled={disabled || capturing || !ready || !!error}
      >
        <Camera className="w-4 h-4" /> {capturing ? "Capturing…" : captureLabel}
      </Button>
      <p className="text-xs text-center text-slate-500">
        Face the camera directly with even lighting. Keep still while capturing.
      </p>
      <style>{`.mirror { transform: scaleX(-1); }`}</style>
    </div>
  );
}
