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
  url:   "#e8637a",
  code:  "#8b5cf6",
  json:  "#f59e0b",
  color: "#ec4899",
  email: "#10b981",
  image: "#f97316",
  text:  "#64748b",
};

const TYPE_LABELS: Record<string, string> = {
  url:   "URL",
  code:  "CODE",
  json:  "JSON",
  color: "COLOR",
  email: "EMAIL",
  image: "IMAGE",
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

  useEffect(() => {
    loadClips();
    let lastText = "";
    let lastImage = "";
    
    const interval = setInterval(async () => {
      try {
        const imgData = await invoke<string | null>("get_clipboard_image");
        if (imgData && imgData !== lastImage) {
          lastImage = imgData;
          lastText = "";
          await invoke("save_image_clip", { base64Data: imgData });
          loadClips(search);
          return;
        }
        
        const text = await invoke<string>("get_clipboard_now");
        if (text && text.trim() && text !== lastText) {
          lastText = text;
          lastImage = "";
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
    if (!confirm("Clear all clips?")) return;
    await invoke("clear_all");
    setStatus("Cleared");
    setTimeout(() => setStatus(""), 2000);
    loadClips();
  }

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      height: "100vh",
      background: "linear-gradient(135deg, #f2c4ce 0%, #e8a0b0 50%, #d4849a 100%)",
      fontFamily: "'DM Sans', 'Inter', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap');
        
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.1);
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(232, 99, 122, 0.4);
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(232, 99, 122, 0.6);
        }
        input::placeholder {
          color: #888;
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: "rgba(255, 255, 255, 0.25)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
      }}>
        <div style={{ 
          fontSize: 28, 
          fontWeight: 800, 
          color: "#1a1a1a",
          letterSpacing: -1,
        }}>
          ClipVault
        </div>
        <div style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#e8637a",
        }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clips..."
          style={{
            flex: 1,
            background: "rgba(255, 255, 255, 0.5)",
            border: "1px solid rgba(255, 255, 255, 0.6)",
            borderRadius: 50,
            padding: "12px 20px",
            color: "#1a1a1a",
            fontSize: 14,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <div style={{ 
          fontSize: 13, 
          color: "#555", 
          minWidth: 80,
          fontWeight: 500,
        }}>
          {clips.length} clips
        </div>
        <button
          onClick={clearAll}
          style={{
            background: "#1a1a1a",
            color: "#fff",
            border: "none",
            borderRadius: 50,
            padding: "12px 24px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Clear all
        </button>
        {status && (
          <div style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 500 }}>{status}</div>
        )}
      </div>

      {/* Clip list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {clips.length === 0 && (
          <div style={{
            textAlign: "center",
            color: "#888",
            marginTop: 100,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: -0.5,
          }}>
            Copy something to get started
          </div>
        )}

        {clips.map(clip => (
          <div
            key={clip.id}
            style={{
              background: "rgba(255, 255, 255, 0.25)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              borderLeft: `4px solid ${TYPE_COLORS[clip.content_type] ?? "#64748b"}`,
              borderRadius: 20,
              padding: "16px 20px",
              marginBottom: 14,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
            onClick={() => copyToClipboard(clip)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              {/* type badge */}
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#fff",
                background: "#1a1a1a",
                padding: "6px 12px",
                borderRadius: 50,
                letterSpacing: 0.5,
              }}>
                {TYPE_LABELS[clip.content_type] ?? "TEXT"}
              </span>

              {/* color swatch */}
              {clip.content_type === "color" && (
                <span style={{
                  width: 18, height: 18,
                  borderRadius: 6,
                  background: clip.content,
                  border: "2px solid rgba(255,255,255,0.5)",
                  display: "inline-block",
                }} />
              )}

              <span style={{ flex: 1 }} />

              {/* timestamp */}
              <span style={{ fontSize: 12, color: "#555", fontWeight: 500 }}>
                {clip.created_at}
              </span>

              {/* pin button */}
              <button
                onClick={e => { e.stopPropagation(); togglePin(clip.id); }}
                style={{
                  background: clip.pinned ? "#1a1a1a" : "transparent",
                  border: "1px solid rgba(0,0,0,0.1)",
                  fontSize: 12,
                  color: clip.pinned ? "#fff" : "#555",
                  padding: "6px 14px",
                  borderRadius: 50,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
                title={clip.pinned ? "Unpin" : "Pin"}
              >
                {clip.pinned ? "Pinned" : "Pin"}
              </button>

              {/* delete button */}
              <button
                onClick={(e) => deleteClip(e, clip.id)}
                style={{
                  background: "#1a1a1a",
                  border: "none",
                  color: "#fff",
                  fontSize: 12,
                  padding: "6px 14px",
                  borderRadius: 50,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
                title="Delete"
              >
                Delete
              </button>
            </div>

            {/* content preview */}
            {clip.content_type === "image" ? (
              <img
                src={`data:image/png;base64,${clip.content}`}
                alt="clipboard image"
                style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 12, border: "1px solid rgba(255,255,255,0.3)" }}
              />
            ) : (
              <div style={{
                fontSize: 14,
                color: copied === clip.id ? "#1a1a1a" : "#333",
                fontFamily: clip.content_type === "code" || clip.content_type === "json"
                  ? "monospace" : "inherit",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: 80,
                overflow: "hidden",
                lineHeight: 1.6,
                fontWeight: 400,
              }}>
                {copied === clip.id ? "✓ Copied!" : clip.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}