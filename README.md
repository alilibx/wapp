# Wapp

A lightweight WhatsApp Web client for Mac with multi-account support and a toggleable sidebar.

## Features

- **Multiple accounts** — run as many WhatsApp accounts as you need, each in its own isolated session
- **Toggleable sidebar** — hide the chat list to focus on a single conversation (`⌘B`)
- **Flexible tab layout** — switch between top (horizontal) and left (vertical) tab positions
- **Tab management** — right-click to rename, reload, or remove accounts
- **Persistent sessions** — stay logged in between restarts
- **Native macOS look** — hidden title bar with traffic light controls

## Install

```bash
git clone https://github.com/alilibx/wapp.git
cd wapp
bun install
```

## Run

```bash
bun run start
```

## Build

```bash
bun run build
```

The built `.dmg` will be in the `dist/` folder.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘B` | Toggle WhatsApp sidebar |

## Project Structure

```
src/
  main/index.js        # Electron main process
  renderer/
    index.html          # App shell
    styles.css          # Styles
    app.js              # UI logic
  preload.js            # Secure IPC bridge
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

[MIT](LICENSE)
