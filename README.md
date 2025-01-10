# Epilepsy Active Protection Extension
Detects flashes in videos and applies a blackout to the video element when threshold is breached. Audio will be still heard, however flashes which breach a user defined threshold will initiate a blackout iframe over the youtube video player.

This blackout lasts 5 seconds, and this timer resets if the extension detects further flashes that breach the threshold. After the 5 seconds is completed and no further flashes are detected the video will slowly be undimmed, as a means to reduce any impact of false negatives. 

The user can chose from 3 levels of threshold sensitivity, the lower the threshold the more sensitive the extension is to flashes:

- High:
   - 10 
- Medium:
   - 50
- Low:
   - 75
 
Currently, user settings only take effect on browser refresh - I am working on this. 
  
## Threshold calculation
This is calulated by the pixel value difference between consecutive video frames and then comparing this mean difference against the threshold value. If the mean difference exceeds the threshold, this triggers a blackout to mitigate the flashing light presence in the video.

1. Frame capture:
      The analyzeframe function captures video frames from the video element at a specified frame rate, it draws the current frames onto a canvas and retrieves the pixel data as an image.

2. Greyscale conversion:
        The pixel data is converted to greyscale using the luminance formula.

3. Frame buffering:
         The greyscale frames are stored in a buffer to keep track of recent frames.

4. Frame difference:
         For each new frame, the function processFrameDifference calculates the absolute difference between the current greyscale frame and the previous greyscale frame.

5. Mean difference:
         The sum of the difference is divided by the number of the pixels to obtain the mean difference.

6. Threshold comparison:
         The mean difference is compared to the threshold value, if it exceeds the threshold value then a blackout is applied.
   
      
## Works on:
- YouTube:
   - Default player
   - Full screen player
   - Mini-player

## Disclaimer
Use at your own risk, this is buggy and not completely working. But will be updated over time.

## Why make this?
There are a couple of extensions available however these require an active server connection, or have been made by people for Hackathons and then abandoned. The aim of this is to be purely run on the client, with no requests to any external server Etc....

## Testing 
- Edge browser
- Windows PC
- Youtube


## Current issues
- ~~Blackout is not eager enough~~
- ~~If video starts with flashing lights above threshold delay for blackout~~
- Nested if loops need to be refactored.
- User updated settings are only working on browser refresh
- Autoplay of YT videos sometimes blocked other times not
- Need to implement notifications to user for fatal code errors
- Need to implemnt silent erros for non important errors


## Progress
- Works with Youtube
- Working with Youtube adverts 
- Testing edge cases before committing

