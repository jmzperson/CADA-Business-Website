"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { parseTokenFromScan } from "@/lib/mobile/redeem";
import { CompactShell } from "@/components/compact-shell";
import {
  postRedeemToken,
  RedeemErrorCard,
  RedeemSuccessCard,
  type RedeemResponse,
} from "@/components/redeem-result";

type ScanState = "idle" | "scanning" | "processing" | "success" | "error";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue?: string }[]>;
};

export function ScannerClient({
  brandName,
  role,
  initialToken,
}: {
  brandName: string;
  role: "admin" | "scanner";
  initialToken?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const processingRef = useRef(false);
  const initialRedeemDone = useRef(false);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [cameraSupported, setCameraSupported] = useState(false);
  const [manualToken, setManualToken] = useState(initialToken ?? "");
  const [result, setResult] = useState<RedeemResponse | null>(null);

  const stopCamera = useCallback(() => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const redeem = useCallback(
    async (raw: string) => {
      const token = parseTokenFromScan(raw);
      if (!token || processingRef.current) return;

      processingRef.current = true;
      setScanState("processing");
      setResult(null);
      stopCamera();

      try {
        const { ok, data } = await postRedeemToken(token, "web-scanner");
        setResult(data);
        setScanState(ok ? "success" : "error");
      } catch {
        setResult({ error: "invalid_token", message: "Network error. Try again." });
        setScanState("error");
      } finally {
        processingRef.current = false;
      }
    },
    [stopCamera]
  );

  useEffect(() => {
    if (initialToken && !initialRedeemDone.current) {
      initialRedeemDone.current = true;
      redeem(initialToken);
    }
  }, [initialToken, redeem]);

  const startCamera = useCallback(async () => {
    if (!cameraSupported || !detectorRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanState("scanning");

      const detect = async () => {
        if (!videoRef.current || !detectorRef.current || processingRef.current) return;
        try {
          const codes = await detectorRef.current.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            await redeem(codes[0].rawValue);
            return;
          }
        } catch {
          // keep scanning
        }
        loopRef.current = requestAnimationFrame(detect);
      };
      loopRef.current = requestAnimationFrame(detect);
    } catch {
      setCameraSupported(false);
      setScanState("idle");
    }
  }, [cameraSupported, redeem]);

  useEffect(() => {
    const hasMedia =
      typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    const win = window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike };
    const hasDetector = typeof win.BarcodeDetector === "function";

    setCameraSupported(hasMedia && hasDetector);

    if (hasDetector && win.BarcodeDetector) {
      detectorRef.current = new win.BarcodeDetector({ formats: ["qr_code"] });
    }

    return () => stopCamera();
  }, [stopCamera]);

  function reset() {
    processingRef.current = false;
    setScanState("idle");
    setResult(null);
    setManualToken("");
  }

  return (
    <CompactShell pageTitle="Scan QR" subtitle={`${brandName} · ${role}`}>
        {scanState === "success" && result && (
          <RedeemSuccessCard result={result} onScanAnother={reset} />
        )}

        {scanState === "error" && result && (
          <RedeemErrorCard result={result} onRetry={reset} />
        )}

        {(scanState === "idle" || scanState === "scanning" || scanState === "processing") && (
          <>
            <div className="card overflow-hidden p-0">
              <div className="relative aspect-square bg-ink/90">
                {cameraSupported ? (
                  <>
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      playsInline
                      muted
                    />
                    {scanState === "scanning" && (
                      <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-teal/80" />
                    )}
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center text-white">
                    <p className="text-sm font-medium">Camera scanning unavailable</p>
                    <p className="mt-2 text-xs text-white/70">
                      Use manual entry below, or open in Chrome on a device with camera access.
                    </p>
                  </div>
                )}
                {scanState === "processing" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/60 text-white">
                    Processing…
                  </div>
                )}
              </div>
            </div>

            {cameraSupported && scanState !== "processing" && (
              <button
                type="button"
                className="btn-primary mt-4 w-full"
                onClick={() => {
                  if (scanState === "scanning") {
                    stopCamera();
                    setScanState("idle");
                  } else {
                    startCamera();
                  }
                }}
              >
                {scanState === "scanning" ? "Stop camera" : "Start camera"}
              </button>
            )}

            <div className="card mt-6">
              <h2 className="font-display text-sm font-semibold text-ink">Manual entry</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Paste the full QR URL or raw token if the camera cannot read the code.
              </p>
              <input
                className="input mt-3"
                placeholder="https://redeem.cada.app/r/…"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                disabled={scanState === "processing"}
              />
              <button
                type="button"
                className="btn-secondary mt-3 w-full"
                disabled={!manualToken.trim() || scanState === "processing"}
                onClick={() => redeem(manualToken)}
              >
                Redeem manually
              </button>
            </div>
          </>
        )}
    </CompactShell>
  );
}
