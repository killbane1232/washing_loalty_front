import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";
import { Notice } from "./ui";

export function Scanner({ onScan }: { onScan: (value: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onScan);
  callback.current = onScan;
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let controls: IScannerControls | undefined;
    const element = video.current!;
    void import("@zxing/browser")
      .then(({ BrowserQRCodeReader }) => {
        if (cancelled) return;
        const reader = new BrowserQRCodeReader();
        return reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          element,
          (result, _error, scanner) => {
            if (result && !cancelled) {
              scanner.stop();
              cancelled = true;
              setActive(false);
              callback.current(result.getText());
            }
          },
        );
      })
      .then((value) => {
        controls = value;
        if (cancelled) controls?.stop();
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err?.name === "NotAllowedError"
              ? "Разрешите доступ к камере в настройках браузера или введите код вручную."
              : "Камера недоступна. Используйте HTTPS или localhost, либо введите код вручную.",
          );
          setActive(false);
        }
      });
    return () => {
      cancelled = true;
      controls?.stop();
      (element.srcObject as MediaStream | null)
        ?.getTracks()
        .forEach((track) => track.stop());
      element.srcObject = null;
    };
  }, [active]);
  return (
    <>
      <div className={`scanner-view ${active ? "is-active" : ""}`}>
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          aria-label="Камера для сканирования QR-кода"
        />
        <div className="scanner-frame">
          <span />
          <span />
          <span />
          <span />
          {!active && <ScanLine size={60} strokeWidth={1} />}
        </div>
        {!active && (
          <button
            className="button lime"
            onClick={() => {
              setError("");
              setActive(true);
            }}
          >
            <Camera size={19} /> Включить камеру
          </button>
        )}
        {active && (
          <span className="scanner-caption">Наведите камеру на QR-код</span>
        )}
      </div>
      {error && <Notice>{error}</Notice>}
    </>
  );
}
