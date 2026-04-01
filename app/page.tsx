"use client";

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ClipItem {
  id: number;
  content: string;
  content_type: string;
  created_at: string;
  pinned: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  url:   "#3b82f6",
  code:  "#a855f7",
  json:  "#f59e0b",
  color: "#ec4899",
  email: "#10b981",
  text:  "#6b7280",
};

const TYPE_LABELS: Record<string, string> = {
  url:   "URL",
  code:  "CODE",
  json:  "JSON",
  color: "COLOR",
  email: "EMAIL",
  text:  "TEXT",
};

export default function Home() {
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  const loadClips = useCallback(async (q = "") => {
    try {
      const data = await invoke<ClipItem[]>("get_clips", {
        search: q || null,
      });
      setClips(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // poll clipboard every 1.5s
  useEffect(() => {
    loadClips();
    const interval = setInterval(async () => {
      try {
        const text = await invoke<string>("get_clipboard_now");
        if (text && text.trim()) {
          await invoke("save_clip", { content: text });
          loadClips(search);
        }
      } catch (_) {}
    }, 1500);
    return () => clearInterval(interval);
  }, [loadClips, search]);

  useEffect(() => {
    loadClips(search);
  }, [search, loadClips]);

  async function copyToClipboard(item: ClipItem) {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopied(item.id);
      setTimeout(() => setCopied(null), 1500);
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteClip(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    try {
      await invoke("delete_clip", { id });
      loadClips(search);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  async function togglePin(id: number) {
    await invoke("toggle_pin", { id });
    loadClips(search);
  }

  async function clearAll() {
    if (!confirm("Clear all unpinned clips?")) return;
    await invoke("clear_all");
    setStatus("Cleared");
    setTimeout(() => setStatus(""), 2000);
    loadClips();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>

      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid #1e1e2e",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "#0f0f13",
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#7c3aed" }}>
          ClipVault
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clips..."
          style={{
            flex: 1,
            background: "#1a1a2e",
            border: "1px solid #2a2a3e",
            borderRadius: 8,
            padding: "8px 14px",
            color: "#e2e2e2",
            fontSize: 14,
            outline: "none",
          }}
        />
        <div style={{ fontSize: 12, color: "#555", minWidth: 80 }}>
          {clips.length} clips
        </div>
        <button
          onClick={clearAll}
          style={{
            background: "#1a1a2e",
            color: "#ef4444",
            border: "1px solid #2a2a3e",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 13,
          }}
        >
          Clear all
        </button>
        {status && (
          <div style={{ fontSize: 12, color: "#10b981" }}>{status}</div>
        )}
      </div>

      {/* Clip list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {clips.length === 0 && (
          <div style={{
            textAlign: "center",
            color: "#444",
            marginTop: 80,
            fontSize: 15,
          }}>
            Copy something to get started
          </div>
        )}

        {clips.map(clip => (
          <div
            key={clip.id}
            style={{
              background: "#16161f",
              border: `1px solid ${clip.pinned ? "#7c3aed44" : "#1e1e2e"}`,
              borderLeft: `3px solid ${TYPE_COLORS[clip.content_type] ?? "#6b7280"}`,
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 8,
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onClick={() => copyToClipboard(clip)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {/* type badge */}
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: TYPE_COLORS[clip.content_type] ?? "#6b7280",
                background: `${TYPE_COLORS[clip.content_type]}18`,
                padding: "2px 7px",
                borderRadius: 4,
                letterSpacing: 1,
              }}>
                {TYPE_LABELS[clip.content_type] ?? "TEXT"}
              </span>

              {/* color swatch */}
              {clip.content_type === "color" && (
                <span style={{
                  width: 14, height: 14,
                  borderRadius: 3,
                  background: clip.content,
                  border: "1px solid #333",
                  display: "inline-block",
                }} />
              )}

              <span style={{ flex: 1 }} />

              {/* timestamp */}
              <span style={{ fontSize: 11, color: "#444" }}>
                {clip.created_at}
              </span>

              {/* pin button */}
              <button
                onClick={e => { e.stopPropagation(); togglePin(clip.id); }}
                style={{
                  background: "none",
                  fontSize: 14,
                  opacity: clip.pinned ? 1 : 0.3,
                  padding: "0 4px",
                }}
                title={clip.pinned ? "Unpin" : "Pin"}
              >
                📌
              </button>

              {/* delete button */}
                <button
                onClick={(e) => deleteClip(e, clip.id)}
                style={{
                  background: "none",
                  color: "#ef4444",
                  fontSize: 14,
                  opacity: 0.5,
                  padding: "0 4px",
                }}
                title="Delete"
              >
                ✕
              </button>
            </div>

            {/* content preview */}
            <div style={{
              fontSize: 13,
              color: copied === clip.id ? "#10b981" : "#c4c4d4",
              fontFamily: clip.content_type === "code" || clip.content_type === "json"
                ? "monospace" : "inherit",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              maxHeight: 80,
              overflow: "hidden",
              lineHeight: 1.5,
            }}>
              {copied === clip.id ? "✓ Copied!" : clip.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}