# Development Scripts

## update-local-ip.sh

Automatically detects and updates your local network IP address in environment files.

### When to use

Run this script when:

- Your IP address changes (e.g., after DHCP reassignment)
- You get CORS errors saying "CORS request did not succeed"
- You're switching between different networks

### How to use

```bash
# From the web directory
npm run update-ip

# Or directly
bash scripts/update-local-ip.sh
```

### What it does

1. Detects your current local IP address (excluding localhost and Docker interfaces)
2. Updates `VITE_API_URL` and `VITE_API_FILES_URL` in:
   - `.env`
   - `.env.development`
3. Creates backup files (`.env.bak`, `.env.development.bak`)
4. Shows before/after IP addresses

### Example output

```
🔍 Detecting local IP address...
✅ Detected IP: 192.168.10.169
📝 Current IP in .env: 192.168.10.169
📝 Updating to: 192.168.10.169
✅ Updated .env
✅ Updated .env.development

✅ IP address updated successfully!
⚠️  Note: You'll need to restart your dev server for changes to take effect

Backend CORS is now configured to automatically accept:
  • localhost:* (any port)
  • 192.168.0.* (any device on 192.168.0.x network)
  • 192.168.1.* (any device on 192.168.1.x network)
  • 10.*.*.* (any device on 10.x.x.x network)
```

### Important notes

- **You must restart your dev server** after running this script for changes to take effect
- The backend (API) is already configured to accept any IP in common local network ranges
- This script is safe to run multiple times
- Backup files are created automatically in case you need to revert

### Backend CORS Configuration

The API backend (`/home/kennedy/Documents/repositories/api`) has been configured with **dynamic CORS** in development mode. This means:

- **No hardcoded IPs required**: The backend automatically accepts requests from:
  - `localhost:*` (any port)
  - `192.168.0.*` (entire subnet)
  - `192.168.1.*` (alternative subnet)
  - `10.*.*.*` (corporate networks)

- **Automatic handling**: When your IP changes, you only need to update the frontend `.env` files
- **Production security**: This dynamic behavior is ONLY active in development mode

### Troubleshooting

**Issue**: Script says "Could not detect local IP address"

- **Solution**: Check that you're connected to a network (WiFi or Ethernet)
- Run `ip addr show` to manually check your network interfaces

**Issue**: CORS errors persist after updating

- **Solution**: Make sure you restarted your Vite dev server
- Clear browser cache or use incognito mode
- Check that the API is running on the correct IP

**Issue**: Want to use localhost instead of network IP

- **Solution**: Manually edit `.env` and change `VITE_API_URL` to `http://localhost:3030`
- This works if frontend and backend are on the same machine
