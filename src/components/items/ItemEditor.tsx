"use client";

import { useRef, useState } from "react";
import { ImagePlus, Paperclip, Mic, Loader2 } from "lucide-react";
import type { FolderItemFull, MediaRecord, VoiceNote } from "@/lib/types";
import {
  createItem, updateItem, uploadPhoto, uploadAttachment, uploadVoiceNote, removeMedia,
} from "@/lib/items";
import { PhotoGrid } from "./PhotoGrid";
import { AttachmentList } from "./AttachmentList";
import { VoiceNoteList } from "./VoiceNoteList";
import { VoiceRecorder } from "./VoiceRecorder";

export function ItemEditor({
  folderId,
  existing,
  photoUrls,
  voiceUrls,
  defaultDate,
  onClose,
  onSaved,
}: {
  folderId: string;
  existing?: FolderItemFull;
  photoUrls: Record<string, string>;
  voiceUrls: Record<string, string>;
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [date, setDate] = useState(existing?.scheduled_date ?? defaultDate ?? "");
  const [time, setTime] = useState(existing?.scheduled_time?.slice(0, 5) ?? "");
  const [photos, setPhotos] = useState<MediaRecord[]>(existing?.photos ?? []);
  const [attachments, setAttachments] = useState<MediaRecord[]>(existing?.attachments ?? []);
  const [voices, setVoices] = useState<VoiceNote[]>(existing?.voice_notes ?? []);
  const [urls, setUrls] = useState<Record<string, string>>({ ...photoUrls, ...voiceUrls });
  const [itemId, setItemId] = useState<string | null>(existing?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSave = title.trim().length > 0 || body.trim().length > 0;

  async function ensureItemId(): Promise<string> {
    if (itemId) return itemId;
    const created = await createItem(folderId, { title, body, scheduled_date: date, scheduled_time: time });
    setItemId(created.id);
    return created.id;
  }

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setError(null); setBusy(true); setUploading({ done: 0, total: files.length });
    try {
      const id = await ensureItemId();
      let pos = photos.length;
      const added: MediaRecord[] = [];
      const local: Record<string, string> = {};
      for (let i = 0; i < files.length; i++) {
        const p = await uploadPhoto(folderId, id, files[i], pos++);
        added.push(p);
        local[p.id] = URL.createObjectURL(files[i]);
        setUploading({ done: i + 1, total: files.length });
      }
      setPhotos((prev) => [...prev, ...added]);
      setUrls((u) => ({ ...u, ...local }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally { setBusy(false); setUploading(null); }
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setError(null); setBusy(true); setUploading({ done: 0, total: files.length });
    try {
      const id = await ensureItemId();
      let pos = attachments.length;
      const added: MediaRecord[] = [];
      for (let i = 0; i < files.length; i++) {
        const a = await uploadAttachment(folderId, id, files[i], pos++);
        added.push(a);
        setUploading({ done: i + 1, total: files.length });
      }
      setAttachments((prev) => [...prev, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally { setBusy(false); setUploading(null); }
  }

  async function onSaveVoice(blob: Blob, duration: number) {
    setError(null); setBusy(true);
    try {
      const id = await ensureItemId();
      const v = await uploadVoiceNote(folderId, id, blob, duration, voices.length);
      setVoices((prev) => [...prev, v as VoiceNote]);
      setUrls((u) => ({ ...u, [v.id]: URL.createObjectURL(blob) }));
      setRecording(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save voice note.");
    } finally { setBusy(false); }
  }

  async function onRemovePhoto(p: MediaRecord) {
    try { await removeMedia("photo", p); setPhotos((x) => x.filter((i) => i.id !== p.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not remove."); }
  }
  async function onRemoveAttachment(a: MediaRecord) {
    try { await removeMedia("attachment", a); setAttachments((x) => x.filter((i) => i.id !== a.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not remove."); }
  }
  async function onRemoveVoice(v: VoiceNote) {
    try { await removeMedia("voice", v); setVoices((x) => x.filter((i) => i.id !== v.id)); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not remove."); }
  }

  async function onSave() {
    if (!canSave || busy) return;
    setBusy(true); setError(null);
    try {
      if (itemId) await updateItem(itemId, { title, body, scheduled_date: date, scheduled_time: time });
      else await createItem(folderId, { title, body, scheduled_date: date, scheduled_time: time });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-white"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <button type="button" onClick={onClose} className="text-sm font-medium text-gray-500">Cancel</button>
          <h2 className="text-base font-semibold text-gray-900">{existing ? "Edit entry" : "New entry"}</h2>
          <button type="button" onClick={onSave} disabled={!canSave || busy} className="text-sm font-semibold text-brand disabled:opacity-40">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-base font-medium outline-none focus:border-brand focus:ring-1 focus:ring-brand" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write something…" rows={5}
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-1 focus:ring-brand" />

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-600">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-base outline-none focus:border-brand" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-gray-600">Time</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!date}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-base outline-none focus:border-brand disabled:opacity-50" />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => photoRef.current?.click()} disabled={busy}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-60">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Photos
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-60">
              <Paperclip className="h-4 w-4" /> Files
            </button>
            <button type="button" onClick={() => setRecording(true)} disabled={busy}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-60">
              <Mic className="h-4 w-4" /> Voice
            </button>
          </div>
          {uploading ? (
            <p className="text-sm text-gray-500">Uploading {uploading.done}/{uploading.total}…</p>
          ) : null}

          <input ref={photoRef} type="file" accept="image/*" multiple onChange={onPickPhotos} className="hidden" />
          <input ref={fileRef} type="file" multiple onChange={onPickFiles} className="hidden" />

          <PhotoGrid photos={photos} urls={urls} onRemove={onRemovePhoto} />
          <AttachmentList attachments={attachments} onRemove={onRemoveAttachment} />
          <VoiceNoteList notes={voices} urls={urls} onRemove={onRemoveVoice} />

          {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
        </div>
      </div>

      {recording ? <VoiceRecorder onSave={onSaveVoice} onClose={() => setRecording(false)} /> : null}
    </div>
  );
}
