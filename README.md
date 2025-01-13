# Epilepsy Flash Protection Extension

A browser extension providing real-time protection against harmful flashing content in videos by dynamically analyzing and controlling video brightness.

## Features

### Core Protection
- Automatic flash detection and prevention
- Real-time frame analysis (30fps)
- Instant blackout response (0ms latency)
- Maximum protection by default
- Works with YouTube and embedded videos

### Controls
- Adjustable sensitivity (5 levels)
- High contrast mode
- Real-time statistics
- Keyboard shortcuts
- Accessibility support

### Auto-Protection
- Prevents video autoplay
- Automatic video detection
- Works in iframes
- Persistent settings
- Frame-by-frame analysis

## Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Space` | Play/Pause | Control video playback |
| `Alt+B` | Manual Blackout | Trigger 5-second blackout |
| `Alt+S` | Increase Sensitivity | Make detection more sensitive |
| `Alt+D` | Decrease Sensitivity | Make detection less sensitive |
| `Esc` | Reset | Reset video brightness |

## Protection Levels

### Sensitivity Settings
- Very Low: Minimal detection
- Low: Basic protection
- Medium: Standard protection (default)
- High: Enhanced detection
- Very High: Maximum sensitivity

### Technical Details
- Flash detection uses weighted RGB analysis
- Brightness calculation: `0.2126R + 0.7152G + 0.0722B`
- Sample rate: 30 frames per second
- Blackout duration: 5 seconds
- Zero-brightness protection during triggers

## Installation

1. Download or clone repository
2. Open Edge browser
3. Go to `edge://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked"
6. Select extension directory

## Usage

1. Install extension
2. Navigate to any page with videos
3. Videos are automatically protected
4. Adjust sensitivity if needed
5. Use keyboard shortcuts for manual control
6. Monitor protection stats in popup

## Privacy & Performance

### Data Handling
- No data collection
- Local processing only
- Settings stored locally
- No external dependencies

### Optimization
- Efficient frame sampling
- Debounced settings updates
- Memory-optimized processing
- Minimal CPU usage

## Technical Architecture

### Components
```
content.js    - Core protection logic
popup.html    - User interface
popup.js      - Settings management
manifest.json - Extension config
```

### Protection Flow
1. Video detection
2. Frame analysis
3. Flash detection
4. Blackout trigger
5. Automatic reset
6. Stats update

## Accessibility

- Screen reader support
- High contrast mode
- Keyboard navigation
- ARIA attributes
- Audio feedback

## Known Limitations

- HTML5 videos only
- Browser-specific implementation
- Local processing only
- Manual sensitivity adjustment may be needed

## Support

- Microsoft Edge (primary)
- YouTube support
- Iframe support
- Local video support

## Development

- Manifest V3
- JavaScript ES6+
- CSS3 filters
- DOM manipulation
- Event-driven architecture

## License

MIT License - Free to use and modify
