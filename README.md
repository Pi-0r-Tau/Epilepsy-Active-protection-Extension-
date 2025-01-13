# Epilepsy Flash Protection Extension

A browser extension that protects users from harmful flashing content by analyzing video frames in real-time and applying dynamic brightness control.

## Key Features

### Protection Mechanisms
- Real-time frame analysis (30fps)
- Near instant flash detection (1ms latency)
- Automatic blackout response
- Seek protection with gradual fade
- YouTube and iframe support

### User Controls
- Adjustable sensitivity (5 levels)
- High contrast interface mode
- Real-time statistics
- Keyboard shortcuts
- Visual feedback

### Safety Features
- Autoplay prevention
- 5-second blackout duration
- Frame-by-frame analysis
- Persistent settings
- Cross-tab protection

## Quick Start

### Installation
1. Clone repository
2. Open `edge://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select extension folder

### Usage
- Videos are protected automatically
- Use slider to adjust sensitivity
- Monitor stats in popup
- Use shortcuts for manual control
- Enable high contrast if needed

## Project Files

### Core Components
```
extension/
├── manifest.json    # Extension config
├── background.js   # Service worker
├── content.js     # Protection logic
├── popup.html     # UI interface
├── popup.js       # Settings logic
└── styles.css     # UI styling
```

### File Purposes
- manifest.json: Permissions and structure
- background.js: State and communication
- content.js: Video protection engine
- popup.html/js: User interface
- styles.css: Visual presentation

## Protection System

### Protection Features
- Prevents autoplay
- Blocks sudden changes
- Gradual transitions
- Manual override
- Error recovery

### Analysis Pipeline
```
Video Frame → Canvas → RGB Analysis → Threshold Check → Protection
```

### Detection Method
```javascript
brightness = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 255;
change = Math.abs(currentBrightness - lastBrightness);
if (change > threshold) triggerProtection();
```

### Keyboard Controls
| Key | Action |
|-----|--------|
| Space | Play/Pause |
| Alt+B | Manual Blackout |
| Alt+S | Increase Sensitivity |
| Alt+D | Decrease Sensitivity |
| Esc | Reset Brightness |

## Technical Details

### Sensitivity Levels
```javascript
{
    'Very Low':  0.42,  // Minimal protection
    'Low':       0.34,  // Basic protection
    'Medium':    0.26,  // Standard (default)
    'High':      0.18,  // Enhanced protection
    'Very High': 0.10   // Maximum protection
}
```

### Performance
- Frame Rate: 30fps
- CPU Usage: 1-3%
- Memory: ~10MB max
- Latency: <50ms

### Optimizations
- 25% pixel sampling
- Debounced updates
- Canvas reuse
- WeakSet/Map usage
- Event delegation

## Developer Notes

### Installation Requirements
- Microsoft Edge
- Developer Mode enabled
- No external dependencies

### Testing Steps
1. Load extension
2. Open video content
3. Check console logs
4. Verify protection
5. Test keyboard shortcuts

### Common Issues
- Cross-origin frames
- Video format support
- Storage quotas
- Tab communication
- Updates to user settings are causing errors if the stats counter is not reset

## Privacy & Data Protection

### Data Collection
- No personal data collected
- No video content stored
- No analytics tracking
- No remote processing
- No user identification

### Local Processing
- All analysis done on-device
- Frame data immediately discarded
- No cloud services used
- No external API calls
- No data sharing

### Storage Usage
```javascript
// Only stores:
{
    threshold: number,        // Sensitivity setting
    stats: {                 // Anonymous usage stats
        flashCount: number,  // Number of detections
        lastDetection: date  // Timestamp only
    },
    userPreferences: {       // Interface settings
        highContrast: boolean,
        lastSensitivity: number
    }
}
```

### Security Measures
- No external communications
- Sandboxed execution
- Content isolation
- Secure storage
- No cookies used

### User Control
- All settings stored locally
- Stats can be reset anytime
- No background processing
- Clear data on uninstall
- No persistent storage

### Permissions Used
```json
{
    "activeTab": "Only when viewing videos",
    "storage": "Local settings only",
    "tabs": "Current tab protection"
}
```

## Support

### Browsers
- Microsoft Edge (primary)


### Video Types
- HTML5 video elements
- YouTube players
- Embedded videos
- Local media files

### Known Limitations
- HTML5 videos only
- Local processing
- Browser specific
- Storage limits

## License
MIT License - Free to use and modify
