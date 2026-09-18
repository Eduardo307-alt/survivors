# Pixel Survivors

A lightweight 2D top-down survivor game prototype built with plain HTML, CSS, and JavaScript.

## Run

1. Start the app from this folder:
   npm start
2. Open http://localhost:3000

If port 3000 is already in use, start it on another port with `PORT=3001 npm start`, then open http://localhost:3001.

### Using a different port

The server must be started from the project folder and must listen on all interfaces:

```bash
PORT=4173 npm start
```

Then open `http://localhost:4173` in the same computer's browser. Choose a port above 1024 that is not already in use. To check a port on Linux, run `lsof -i :4173`; stop the old server with `Ctrl+C` or choose another port.

If the game is running in a dev container, Codespace, Docker container, or another computer, `localhost` in your browser may refer to the browser's machine instead of the server. Forward/expose the chosen port (for example, 4173) in the environment and open the forwarded URL, or use the server machine's IP address. For two players to join the same hosted session, both players must use the same forwarded host and port; changing the port creates a different address, not a shared game session. This prototype currently runs one local game per browser and does not implement online multiplayer synchronization.

Use the **Install App** button below Play to install Pixel Survivors as an app. The app shell is cached by the service worker, so after the first online visit it can launch and play offline. On browsers that do not provide an install prompt, use the browser's **Add to Home Screen** or **Install** menu item.

## Current gameplay

- Move with WASD
- Auto-fire at the nearest enemy
- Survive as long as possible
- Collect blue shards to heal
- Gain XP and level up for stronger attacks

## Next ideas

- Add more enemy types
- Add weapon upgrades and skill cards
- Add a score / high-score system
