"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, X, Check } from "lucide-react";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Phase = "idle" | "recording" | "paused" | "review";

/**
 * Records audio from the mic. Emits the finished Blob + duration via onSave.
 * Pause/resume/cancel/finish plus playback before saving.
 */
export function VoiceRecorder({
  onSave,
  onClose,
}: {
  onSave: (blob: Blob, durationSeconds: number) => Promise<void> | void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function tick(on: boolean) {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (on) timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        blobRef.current = blob;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob);
        setPhase("review");
        tick(false);
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      mediaRef.current = mr;
      mr.start();
      setSeconds(0);
      setPhase("recording");
      tick(true);
    } catch {
      setError("Microphone access was blocked.");
    }
  }

  function pause() {
    mediaRef.current?.pause();
    setPhase("paused");
    tick(false);
  }
  function resume() {
    mediaRef.current?.resume();
    setPhase("recording");
    tick(true);
  }
  function finish() {
    mediaRef.current?.stop();
  }
  function cancel() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  }

  async function save() {
    if (!blobRef.current) return;
    setSaving(true);
    try {
      await onSave(blobRef.current, seconds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label="Close" onClick={cancel} className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 rounded-t-2xl bg-white px-5 pt-5"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Voice note</h2>
          <button type="button" onClick={cancel} aria-label="Cancel" className="grid h-9 w-9 place-items-center rounded-full text-gray-400 active:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-4xl font-bold tabular-nums text-gray-900">{fmt(seconds)}</p>
          <p className="mt-1 text-sm text-gray-400">
            {phase === "recording" ? "Recording…" : phase === "paused" ? "Paused" : phase === "review" ? "Review" : "Ready"}
          </p>
        </div>

        {phase === "review" && urlRef.current ? (
          <audio ref={audioRef} src={urlRef.current} controls className="mt-4 w-full" />
        ) : null}

        {error ? <p className="mt-3 text-center text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex items-center justify-center gap-4">
          {phase === "idle" ? (
            <button type="button" onClick={start} className="grid h-16 w-16 place-items-center rounded-full bg-red-500 text-white active:bg-red-600">
              <Mic className="h-7 w-7" />
            </button>
          ) : null}

          {phase === "recording" ? (
            <>
              <button type="button" onClick={pause} aria-label="Pause" className="grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-700">
                <Pause className="h-6 w-6" />
              </button>
              <button type="button" onClick={finish} aria-label="Finish" className="grid h-16 w-16 place-items-center rounded-full bg-brand text-white active:bg-brand-dark">
                <Square className="h-6 w-6" />
              </button>
            </>
          ) : null}

          {phase === "paused" ? (
            <>
              <button type="button" onClick={resume} aria-label="Resume" className="grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-700">
                <Play className="h-6 w-6" />
              </button>
              <button type="button" onClick={finish} aria-label="Finish" className="grid h-16 w-16 place-items-center rounded-full bg-brand text-white active:bg-brand-dark">
                <Square className="h-6 w-6" />
              </button>
            </>
          ) : null}

          {phase === "review" ? (
            <>
              <button type="button" onClick={start} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 active:bg-gray-50">
                Re-record
              </button>
              <button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white active:bg-brand-dark disabled:opacity-60">
                <Check className="h-4 w-4" />
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
