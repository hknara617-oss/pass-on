export type Child = {
  id: string;
  user_id: string;
  name: string;
  birth_date: string | null;
  created_at: string;
};
export type Attachment = {
  id: string;
  entry_id: string;
  type: "photo" | "audio";
  storage_path: string;
  mime_type: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  created_at: string;
};
export type LinkAttachment = {
  id: string;
  entry_id: string;
  url: string | null;
  quote_or_note: string | null;
  metadata_title: string | null;
  created_at: string;
};
export type Note = {
  id: string;
  entry_id: string;
  text: string;
  created_at: string;
};
export type Revision = {
  id: string;
  entry_id: string;
  original_text: string | null;
  edited_text: string | null;
  edited_at: string;
};
export type Entry = {
  id: string;
  user_id: string;
  child_id: string | null;
  text: string | null;
  capture_source: "text" | "photo" | "voice" | "link" | "mixed" | null;
  created_at: string;
  updated_at: string;
  original_frozen_at: string | null;
  timezone: string | null;
  is_deleted: boolean | null;
  attachments: Attachment[];
  link_attachments: LinkAttachment[];
  entry_notes: Note[];
  entry_revisions: Revision[];
};
