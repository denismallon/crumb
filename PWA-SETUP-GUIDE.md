# Crumb PWA Setup Guide

## Overview
Your Expo app is now configured as a Progressive Web App (PWA) that can be installed on iOS devices.

## What's Been Configured

### 1. `app.json` - PWA Configuration
- **Display mode**: `standalone` (runs fullscreen like a native app)
- **Theme color**: `#FF986F` (coral/salmon orange)
- **Orientation**: `portrait` (locked to portrait mode)
- **iOS meta tags**: Configured for standalone mode and status bar styling
- **Splash screen**: White background with your app icon

### 2. `public/index.html` - Custom HTML Template
Contains iOS-specific meta tags:
- `apple-mobile-web-app-capable`: Makes the app run in fullscreen
- `apple-mobile-web-app-status-bar-style`: Controls iOS status bar appearance
- `apple-mobile-web-app-title`: App name on iOS home screen
- Apple touch icon links (various sizes)
- Splash screen links for different iPhone models

### 3. `public/manifest.json` - Web App Manifest
- App name, description, theme colors
- Icon definitions (192x192, 512x512)
- App shortcuts (quick action to add a note)
- Display and orientation settings

## Required Icons

You need to create/copy the following icon files to the `public/` directory:

### Essential Icons (REQUIRED)
```
public/
├── favicon.png              (32x32 or 64x64)
├── icon-192.png            (192x192 - Android/Chrome)
├── icon-512.png            (512x512 - Android/Chrome)
├── apple-touch-icon.png    (180x180 - default iOS)
├── apple-touch-icon-180x180.png  (180x180 - iPhone X and newer)
├── apple-touch-icon-167x167.png  (167x167 - iPad Pro)
├── apple-touch-icon-152x152.png  (152x152 - iPad)
└── apple-touch-icon-120x120.png  (120x120 - iPhone)
```

### Optional Splash Screens (RECOMMENDED for better UX)
Create a `public/splash/` directory with device-specific splash screens. You can generate these using tools like:
- https://www.appicon.co
- https://progressier.com/pwa-icons-and-ios-splash-screen-generator
- npx pwa-asset-generator

## How to Generate Icons from Your Existing Icon

### Option 1: Using Online Tools (Easiest)
1. Go to https://www.appicon.co or https://www.pwa-icon-generator.com
2. Upload your `assets/icon.png`
3. Download the generated package
4. Copy the icons to your `public/` folder

### Option 2: Using ImageMagick (Command Line)
If you have ImageMagick installed:

```bash
# From your main icon (assumed to be 1024x1024)
magick assets/icon.png -resize 192x192 public/icon-192.png
magick assets/icon.png -resize 512x512 public/icon-512.png
magick assets/icon.png -resize 180x180 public/apple-touch-icon.png
magick assets/icon.png -resize 180x180 public/apple-touch-icon-180x180.png
magick assets/icon.png -resize 167x167 public/apple-touch-icon-167x167.png
magick assets/icon.png -resize 152x152 public/apple-touch-icon-152x152.png
magick assets/icon.png -resize 120x120 public/apple-touch-icon-120x120.png
magick assets/icon.png -resize 32x32 public/favicon.png
```

### Option 3: Use Expo's Built-in Icon Generation
Expo can generate some icons automatically, but you'll get better results with custom generation.

## Splash Screens

For the best iOS experience, generate splash screens for different iPhone sizes. Use a tool like:

**PWA Asset Generator (Recommended)**:
```bash
npx pwa-asset-generator assets/splash-icon.png public/splash --background "#ffffff" --splash-only --portrait-only
```

Or use an online generator:
- https://progressier.com/pwa-icons-and-ios-splash-screen-generator

## Building for Production

### 1. Build the Web App
```bash
npx expo export:web
```

This will:
- Generate optimized static files in `dist/` directory
- Include your `public/` folder contents
- Create service worker for offline support
- Generate manifest.json from your app.json config

### 2. Deploy to Vercel

Your existing Vercel deployment should automatically pick up these changes. Ensure your `vercel.json` (if you have one) or Vercel project settings include:

```json
{
  "buildCommand": "npx expo export:web",
  "outputDirectory": "dist",
  "framework": null
}
```

### 3. Verify Deployment

After deploying, test on iOS:
1. Open https://crumb-coral.vercel.app in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"
4. Verify the icon appears correctly
5. Launch from home screen - should open fullscreen without Safari UI

## Testing Locally

To test PWA features locally:

```bash
# Start development server
npm start

# Or specifically for web
npm run web
```

Then:
1. Open http://localhost:8081 in your browser
2. Open DevTools → Application tab
3. Check:
   - Manifest is loaded correctly
   - Service worker is registered
   - Icons are accessible
   - Theme color is applied

## iOS-Specific Notes

### Status Bar Styles
The app is configured with `apple-mobile-web-app-status-bar-style: "default"` which shows:
- Black text on light background
- Best for apps with light headers

To change this, edit `app.json` → `web.meta.apple-mobile-web-app-status-bar-style`:
- `"default"` - Black text (current)
- `"black"` - Black background with white text
- `"black-translucent"` - Translucent black, content flows under status bar

### Safe Area Handling
The viewport includes `viewport-fit=cover` to support notched devices (iPhone X and newer). Make sure your app handles safe areas properly in your components.

### Offline Support
Expo's web build includes a service worker for offline caching. Users can use basic features even without internet.

## Troubleshooting

### "Add to Home Screen" doesn't appear
- Ensure you're using HTTPS (Vercel provides this)
- Check manifest.json is accessible at https://crumb-coral.vercel.app/manifest.json
- Verify `display: "standalone"` in manifest
- Clear Safari cache and try again

### Icons don't show correctly
- Verify icon files exist in `public/` directory
- Check file names match exactly (case-sensitive)
- Icons must be PNG format
- Recommended sizes: exact dimensions, not larger/smaller

### App doesn't run fullscreen
- Check `apple-mobile-web-app-capable` is set to `"yes"`
- Verify you're launching from home screen, not Safari bookmark
- Clear iOS cache: Settings → Safari → Clear History and Website Data

### Theme color not applied
- iOS applies theme color to status bar and Safari UI
- Only works when viewing in Safari, not in standalone mode
- `theme-color` meta tag must match your brand color

## Files Modified/Created

✅ Modified:
- `app.json` - Added comprehensive web/PWA configuration

✅ Created:
- `public/index.html` - Custom HTML with iOS meta tags
- `public/manifest.json` - PWA manifest
- `PWA-SETUP-GUIDE.md` - This guide

📋 TODO (You need to create):
- Icon files in `public/` directory (see "Required Icons" section above)
- Splash screen images in `public/splash/` (optional but recommended)

## Next Steps

1. **Generate icons** using one of the methods above
2. **Test locally** to ensure everything works
3. **Build for production**: `npx expo export:web`
4. **Deploy to Vercel** (should auto-deploy if connected to Git)
5. **Test on iOS device**: Add to home screen and verify
6. **Optional**: Generate splash screens for better UX

## Resources

- [Expo Web Documentation](https://docs.expo.dev/guides/progressive-web-apps/)
- [PWA Builder](https://www.pwabuilder.com/)
- [Apple PWA Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Web App Manifest Spec](https://www.w3.org/TR/appmanifest/)

---

**Note**: After deploying, you can test your PWA using Google Lighthouse (in Chrome DevTools) to check for any missing features or optimizations.
