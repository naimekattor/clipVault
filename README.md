# ClipVault

A modern clipboard manager desktop application built with Tauri (Rust + Next.js).

## Features

- **Automatic Clipboard Capture** - Automatically saves clipboard content
- **Content Type Detection** - Automatically detects:
  - URLs
  - JSON
  - Code snippets (JavaScript, Rust, Python, etc.)
  - Colors (hex codes)
  - Email addresses
  - Plain text
- **Pin Important Clips** - Pin frequently used clips to keep them at top
- **Search** - Full-text search through your clipboard history
- **Duplicate Prevention** - Won't save duplicate entries
- **Clear Unpinned** - Remove all non-pinned clips at once
- **Persistent Storage** - SQLite database stored locally

## Tech Stack

- **Backend**: Rust + Tauri 2.x
- **Frontend**: Next.js 16 + React 19 + TypeScript
- **Database**: SQLite (rusqlite)
- **Clipboard**: arboard

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Rust toolchain (latest stable)
- Visual Studio Build Tools (Windows)

### Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev
```

### Build

```bash
# Build for production
pnpm tauri build
```

The executable will be generated at:
- Windows: `src-tauri/target/release/bundle/nsis/ClipVault_0.1.0_x64-setup.exe`

## Project Structure

```
clipvault/
├── app/                    # React frontend (Next.js app router)
│   ├── page.tsx          # Main UI
│   └── ...
├── src-tauri/            # Rust backend
│   ├── src/
│   │   ├── lib.rs       # Main logic (commands, DB)
│   │   └── main.rs      # Entry point
│   ├── Cargo.toml       # Rust dependencies
│   ├── tauri.conf.json  # Tauri config
│   └── build.rs         # Build script
└── package.json          # Node dependencies
```

## Available Tauri Commands

| Command | Description |
|---------|-------------|
| `save_clip` | Save new clipboard content |
| `get_clips` | Get all clips (with optional search) |
| `delete_clip` | Delete a specific clip |
| `toggle_pin` | Pin/unpin a clip |
| `clear_all` | Clear all unpinned clips |
| `get_clipboard_now` | Get current clipboard content |

## Database Schema

```sql
CREATE TABLE clips (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    content      TEXT    NOT NULL,
    content_type TEXT    NOT NULL DEFAULT 'text',
    created_at   TEXT    NOT NULL,
    pinned       INTEGER NOT NULL DEFAULT 0
);
```

Database location: `%LOCALAPPDATA%/clipvault/clips.db`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Download

### Pre-built Installer

Download the latest Windows installer:
- **[ClipVault_0.1.0_x64-setup.exe](src-tauri/target/release/bundle/nsis/ClipVault_0.1.0_x64-setup.exe)** (2.8 MB)

Or build yourself:
```bash
pnpm tauri build
# Output: src-tauri/target/release/bundle/nsis/ClipVault_0.1.0_x64-setup.exe
```

## License

MIT