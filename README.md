# Epilepsy Flash Protection Extension

A browser extension that protects users from harmful flashing content by analyzing video frames in real-time and applying dynamic brightness control. With stats for how many flashes detected. 
User has the ability to reset stats and when a video is blacked out can see the amount of flashes that have been detected and prevented the user from experiencing.
## Key Features

### Protection Mechanisms
- Real-time frame analysis (30fps)
- Near instant flash detection 
- Automatic blackout response
- Seek protection with gradual fade out
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

### Current issues to fix:
- Stats counter can cause error of 'Too many requests':
  Fix is being worked on to pause stats counter, this is the ticker that informs the user of how many flashes that breach the users set threshold have been blocked whilst the video is blacked out.

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

## Recent Fixes & Improvements

### Storage Management
- Added reliable storage queue system
- Implemented batch storage updates
- Added retry mechanism for failed storage operations
- Reduced storage write operations to prevent quota limits
- Added chunked processing for large storage updates

### Performance & Reliability
- Improved settings recovery mechanism
- Added fallback for missing DOM elements
- Enhanced error handling for storage operations
- Implemented debounced settings updates
- Added validation for all storage operations

### User Interface
- Improved high contrast mode persistence
- Enhanced sensitivity control feedback
- Added more reliable stats updates
- Improved error messaging
- Added accessibility announcements

### Bug Fixes
- Fixed storage queue processing
- Resolved settings sync issues
- Fixed high contrast mode toggle
- Improved stats update reliability
- Fixed sensitivity control edge cases

### Background Service Worker
- Fixed duplicate function declarations
- Added proper error handling in message broadcasting
- Improved settings validation logic
- Enhanced storage retry mechanism
- Added JSDoc documentation for key functions

### Storage System
- Implemented dual storage system (batch + queue)
- Added chunked processing for large operations
- Improved error recovery for failed writes
- Added storage operation debouncing
- Enhanced queue processing reliability

### Settings Management
- Fixed settings recovery mechanism
- Improved settings validation
- Added fallback for failed settings loads
- Enhanced settings synchronization
- Improved settings persistence

### Error Handling
- Added comprehensive error logging
- Improved error recovery flows
- Enhanced validation checks
- Added fallback mechanisms
- Improved error messaging

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

### Storage System

### Installation Requirements
- Microsoft Edge
- Developer Mode enabled
- No external dependencies


### Common Issues
- Cross-origin frames
- Video format support
- Storage quotas
- Tab communication

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
- Chrome 


### Known Limitations
- HTML5 videos only
- Local processing
- Browser specific
- Storage limits

## Why make this?
There are a couple of these published to GitHub however they have been made for Hackathons and have been abandoned since. Moreover, some of these require external server access, where realistically this is not needed in the slightest. I wanted to make something that will continue to be updated, works even offline and requires the least amount of CPU resources to work. It has no external dependencies, makes no calls to external servers and does not store user data or stats.

## License
MIT License - Free to use and modify
