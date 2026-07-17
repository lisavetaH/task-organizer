export type Role = "admin" | "worker";

export interface Folder {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
  // created_by is intentionally NOT selected by clients — column-restricted
  // in 003 so member information can't leak through folder metadata.
  created_by?: string;
}

// Columns safe for any workspace member to read (matches the GRANT in 003).
export const FOLDER_METADATA_COLUMNS =
  "id,workspace_id,name,color,icon,position,archived_at,created_at";

export interface Membership {
  workspace_id: string;
  role: Role;
}

export interface FolderItem {
  id: string;
  workspace_id: string;
  folder_id: string;
  title: string | null;
  body: string | null;
  item_type: "note" | "task";
  scheduled_date: string | null;
  scheduled_time: string | null;
  is_pinned: boolean;
  position: number;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface MediaRecord {
  id: string;
  item_id: string;
  folder_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  position: number;
  uploaded_by: string;
  created_at: string;
}

export interface VoiceNote extends MediaRecord {
  duration_seconds: number | null;
}

export interface FolderItemFull extends FolderItem {
  photos: MediaRecord[];
  attachments: MediaRecord[];
  voice_notes: VoiceNote[];
  is_favorite: boolean;
  creator_name?: string | null;
  completer_name?: string | null;
}

export const PHOTO_BUCKET = "folder-photos";
export const ATTACHMENT_BUCKET = "folder-attachments";
export const VOICE_BUCKET = "folder-voice";

// Optional folder icon keys. Kept as a small, curated set — the picker maps
// these to lucide-react icons. `null` means "default folder icon".
export const FOLDER_ICONS = [
  "folder",
  "home",
  "briefcase",
  "cart",
  "heart",
  "star",
  "flower",
  "user",
  "book",
  "wrench",
] as const;

export type FolderIcon = (typeof FOLDER_ICONS)[number];

// Optional folder colors as Tailwind-friendly hex values.
export const FOLDER_COLORS = [
  "#4f46e5", // indigo (brand)
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#64748b", // slate
] as const;
