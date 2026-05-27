"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  DocumentSummary,
  deleteDocument,
  fetchDocuments,
  uploadDocument,
} from "../../lib/api";

export default function DocumentsPanel() {
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchDocuments();
      setDocs(list);
    } catch {
      setError("Unable to reach backend. Make sure the API is running.");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await uploadDocument(file);
      setStatus(`Indexed ${res.chunks} chunks from ${res.filename}`);
      await refresh();
    } catch {
      setError(`Upload failed for ${file.name}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    setError(null);
    setStatus(null);
    try {
      await deleteDocument(filename);
      setStatus(`Removed ${filename}`);
      await refresh();
    } catch {
      setError(`Delete failed for ${filename}`);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Knowledge Base</h2>
          <p className="text-xs text-zinc-400">Upload PDFs, DOCX, TXT or Markdown to ground the assistant</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{error}</div>
      )}
      {status && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {status}
        </div>
      )}

      <div className="grid grid-cols-[1fr_120px_72px] gap-3 px-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        <span>Document</span>
        <span>Chunks</span>
        <span className="text-right">Actions</span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {loading && docs === null && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center text-sm text-zinc-400">
            Loading documents...
          </div>
        )}
        {docs && docs.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-10 text-center">
            <FileText className="h-8 w-8 text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-300">No documents indexed yet</p>
            <p className="text-xs text-zinc-500">Upload a Scrum guide, SAFe handbook, or PRD to enrich the assistant.</p>
          </div>
        )}
        {docs?.map((doc) => (
          <div
            key={doc.name}
            className="grid grid-cols-[1fr_120px_72px] items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-zinc-400" />
              <span className="truncate text-sm font-medium text-zinc-100">{doc.name}</span>
            </div>
            <span className="font-mono text-xs text-zinc-400">{doc.chunks}</span>
            <button
              type="button"
              onClick={() => handleDelete(doc.name)}
              aria-label={`Delete ${doc.name}`}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 transition-colors hover:border-rose-500/40 hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
