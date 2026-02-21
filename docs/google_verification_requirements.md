This document provides a comprehensive breakdown of the **App Verification Requirements** for Google Cloud OAuth 2.0, specifically focusing on the requirements for your application's homepage, privacy policy, and branding as detailed in the Google Cloud Support documentation.

***

# Google Cloud: OAuth App Verification Requirements

## 1. Homepage Requirements
Your application’s homepage is the first point of contact for users and Google’s verification team. It must provide transparency regarding what your app does.

### Core Criteria
*   **Public Accessibility:** The homepage must be publicly accessible. It cannot be behind a login wall, a password-protected area, or a "Coming Soon" page.
*   **Domain Ownership:** The homepage must be hosted on a domain that you have verified via [Google Search Console](https://search.google.com/search-console/).
*   **Content Relevance:** The page must clearly describe the application's functionality. A user should be able to understand the app's purpose without needing to sign in.
*   **Consistency:** The branding (Name and Logo) on the homepage must match the branding submitted in the Google Cloud Console.

### Prohibited Content
*   **Login-Only Pages:** A page that only contains a "Sign in with Google" button is not an acceptable homepage.
*   **Template Content:** Using generic "Lorem Ipsum" text or placeholder templates will result in a verification rejection.

---

## 2. Privacy Policy Requirements
A robust Privacy Policy is mandatory for all apps requesting access to Google user data.

### Hosting and Accessibility
*   **Location:** The Privacy Policy must be hosted on the **same domain** as your application’s homepage.
*   **Static Link:** The URL provided in the Google Cloud Console must be a direct link to the policy.
*   **Homepage Link:** A link to the Privacy Policy must be clearly visible on your application's homepage.

### Content Disclosures
The policy must explicitly state:
1.  **Data Collection:** What Google user data your app accesses (e.g., email address, calendar events, drive files).
2.  **Data Usage:** How that data is used to provide or improve app features.
3.  **Data Storage:** How the data is stored and protected.
4.  **Data Sharing:** Whether the data is shared with third parties and for what purpose.
5.  **Limited Use Disclosure:** If you use **Restricted Scopes** (like Gmail or Drive), your policy must include a statement confirming compliance with the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy#additional-requirements-for-specific-api-scopes), including the "Limited Use" requirements.

---

## 3. App Name and Logo Requirements
Your app’s identity must be clear and distinct to avoid user confusion.

### Application Name
*   **Uniqueness:** The name should be unique to your product.
*   **Forbidden Keywords:** You cannot use "Google," "Gmail," "YouTube," or any other Google-owned trademarks in your app name.
*   **Accuracy:** The name must accurately reflect the app's purpose and match the name used in your marketing materials and homepage.

### Application Logo
*   **Format:** Must be a high-resolution image (usually a square PNG or JPG).
*   **Representation:** The logo must represent your application or company.
*   **Restrictions:** 
    *   Do not use Google’s logos or icons.
    *   The logo must not be a generic icon (like a default folder icon) if it doesn't represent your specific brand.
    *   It should not look like a system notification or a Google service.

---

## 4. Authorized Domains
To prevent phishing and unauthorized use, Google requires you to authorize specific domains.

*   **Verified Domains:** All domains used for the Homepage, Privacy Policy, Terms of Service, and Redirect URIs must be added to the "Authorized Domains" list.
*   **Ownership Check:** Google verifies that the account submitting the app for review has "Owner" or "Full Access" permissions for these domains in Google Search Console.

---

## 5. Requirements for Sensitive & Restricted Scopes
If your app requests high-level access to user data, you must provide:

1.  **Justification:** A clear explanation of why each scope is required for the app's functionality.
2.  **Demonstration Video:** A YouTube link to a video showing the "User Journey."
    *   The video must show the login process.
    *   The video must show the **OAuth Consent Screen** (showing the app name and logo).
    *   The video must show how the app uses the requested data within the interface.
3.  **Security Assessment:** (For Restricted Scopes only) Some apps may require a third-party security assessment (CASA) depending on the volume of users and the sensitivity of the data.

---

## 6. Verification Statuses
*   **Testing:** Only users explicitly added to the "Test Users" list can log in.
*   **Pending Developer Action:** Google has requested changes or more information via the developer email.
*   **Verified:** The app branding and scopes have been approved. Users will no longer see the "Unverified App" warning.

---

### Resources
*   [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
*   [OAuth 2.0 Branding Guidelines](https://developers.google.com/identity/branding-guidelines)
*   [Google Search Console](https://search.google.com/search-console/)