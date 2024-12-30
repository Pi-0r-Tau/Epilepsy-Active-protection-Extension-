# Epilepsy-Active-protection-Extension
An extension that detects flashes in videos and applies a blackout to the video element when threshold is breached. Audio will be still heard, however flashes which breach a user defined threshold will initiate a blackout iframe over the youtube video player. 

Use at your own risk, this is buggy and not completely working. But will be updated over time.

## Why make this?
There are a couple of extensions available however these require an active server connection, or have been made by people for Hackathons and then abandoned. The aim of this is to be purely run on the client, with no requests to any external server Etc....

## Current issues
- ~~Blackout is not eager enough~~
- ~~If video starts with flashing lights above threshold delay for blackout~~
- Buggy loading of user's saved settings
- Nested if loops need to be refactored. 

## Progress
Testing edge cases before committing 
