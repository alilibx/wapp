# Contributing to Wapp

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/alilibx/wapp.git
cd wapp

# Install dependencies
bun install

# Run in development
bun run start
```

## Project Structure

```
src/
  main/          # Electron main process
    index.js     # Window creation, IPC handlers, native menus
  renderer/      # Electron renderer process
    index.html   # App shell
    styles.css   # All styles
    app.js       # UI logic, account/tab management
  preload.js     # Secure bridge between main and renderer
```

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b my-feature`
3. Make your changes
4. Test locally with `bun run start`
5. Commit with a clear message
6. Push and open a Pull Request

## Guidelines

- Keep changes focused — one feature or fix per PR
- Test on macOS before submitting
- Follow existing code style
- Update README if adding user-facing features

## Reporting Issues

Use [GitHub Issues](https://github.com/alilibx/wapp/issues) and include:
- macOS version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
