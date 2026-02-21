


Below is a detailed Markdown (`.md`) file based on the official Google Identity documentation for "Sign in with Google" Branding Guidelines.

***

# Sign in with Google Branding Guidelines

## Page Summary
Adhering to Google's branding guidelines for the **Sign in with Google** button is a strict requirement for successfully completing the OAuth app verification process. While the recommended approach is using the Google Identity Services SDKs (which automatically follow the latest guidelines), developers also have the option to render an HTML button, download pre-approved image assets, or design a custom button. 

---

## 1. Implementation Options

### A. Google Identity Services SDKs
Using the official SDKs is strongly recommended as they automatically render buttons that comply with Google's most recent branding guidelines, ensuring users easily recognize the trusted Google brand.

### B. Render HTML Button Element
Google provides an interactive HTML configurator tool that allows you to customize the appearance of the button (Standard or Icon mode, Theme, Shape, Text, and Logo alignment). Once customized, you can easily copy and paste the generated HTML and CSS snippets directly into your web project.

### C. Download Pre-Approved Brand Icons
If you prefer not to use the SDK or HTML snippets, you can download pre-approved button assets provided by Google in both **PNG** and **SVG** formats for all platforms. 
*   **Themes Supported:** Light, Dark, and Neutral.
*   **Shapes Supported:** Rectangular, Pill, Square (Icon only), and Circle (Icon only).
*   *Note:* The SVG files require the **Roboto** font. Utilizing the SVG format allows you to easily localize the button text to match the native language of your application.

---

## 2. Guidelines for Custom Buttons
If you must build a custom button from scratch to adapt to your app's specific UI design, you must strictly adhere to the following rules:

### Size
You may scale the button to accommodate different devices and screen sizes, but you **must preserve the aspect ratio** so the Google logo is never stretched or distorted.

### Text & Localization
*   **Recommended Call-to-Action:** Use "Sign in with Google", "Sign up with Google", or "Continue with Google".
*   **Clarity:** It must be explicitly clear to users that they are signing into *your* app with their Google credentials, not registering for a new Google Account.
*   **Localization:** Translating the text to match your app or website's language is permitted and encouraged for a better user experience.

### Font
The required button font is **Roboto Medium** (a TrueType font). 

### Padding
Padding around the Google logo varies slightly by platform:
*   **Web (Mobile & Desktop):** 12px left padding before the logo, 10px right padding after the logo.
*   **Android:** 12px left padding before the logo, 10px right padding after the logo.
*   **iOS:** 16px left padding before the logo, 12px right padding after the logo.

### The Google "G" Logo
*   You **cannot** alter the size or color of the Google "G" logo.
*   It must always be the **standard multi-color version**.
*   The "G" logo must always appear on a **white background** within the button.

### Color Themes
If designing custom buttons, ensure you follow these exact color specifications:
*   **Light Theme:** Fill: `#FFFFFF`, Stroke: `#747775` (1px inside), Font: `#1F1F1F`.
*   **Dark Theme:** Fill: `#131314`, Stroke: `#8E918F` (1px inside), Font: `#E3E3E3`.
*   **Neutral Theme:** Fill: `#F2F2F2`, Stroke: None, Font: `#1F1F1F`.

---

## 3. "Do's" and "Don'ts" of Button Design

**Do:**
*   Use the Google Material 3 design guidelines for button boundaries and color schemes.
*   Use the standard brand colors for the Google "G" icon across dark, light, and neutral modes.
*   Choose a button color mode that ensures accessibility and visual harmony.
*   Maintain the fixed padding and size of the Google "G".
*   Use the Google "G" by itself as an action button icon if UI space is heavily restricted.

**Don't:**
*   Do not use the Google icon/logo by itself *without* a button boundary or without text to indicate the user action (unless specifically using the icon-only format).
*   Do not use monochrome or single-color versions of the Google "G" logo.
*   Do not place the standard color Google "G" icon on a colored background other than the approved light, dark, or neutral theme backgrounds.
*   Do not create your own custom icon illustration for the button.
*   Do not use the word "Google" by itself as the button text to represent the sign-in action.

---

## 4. Best Practices & Prominence
*   **Equal Prominence:** The "Sign in with Google" button must be displayed **at least as prominently** as other third-party sign-in options on your page.
*   **Visual Weight:** Ensure the Google button is approximately the same size and carries a similar visual weight compared to other authentication methods.

---

## 5. Other Specific Guidelines
*   **Incremental Authorization:** If your app requests additional API scopes, do so via incremental authorization. Only prompt the user for additional authorization when they begin interacting with the specific feature that requires that access.
*   **YouTube Scopes:** If your app requests YouTube-specific scopes, you must use a dedicated **YouTube button** rather than the standard Google button.
*   **Google Play Games:** If you are integrating Google Play games services, you must consult and follow the separate *Google Play games services branding guidelines*.
*   **Unauthorized Use:** Any use of Google brand assets in ways not expressly covered in these guidelines is strictly prohibited without prior written consent from Google.