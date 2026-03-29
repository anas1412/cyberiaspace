# Compliance Report: Business Model & Technical Audit (MCC Verification)
**Product Name:** [Cyberia Space](https://cyberiaspace.app)

**Nature of Business:** AI-Powered Spatial Thinking & Knowledge Management SaaS

**Date:** March 29, 2026

## Executive Summary
Cyberia Space is a productivity Software-as-a-Service (SaaS) platform designed for researchers, developers, creative workers and project managers. It provides a visual "spatial canvas" where users can organize information. Unlike a "Cyberlocker" (which focuses on hosting and distributing files for high-volume downloads), Cyberia is a private workspace where files are used as **contextual knowledge** for Artificial Intelligence (AI) processing and personal file management.

---

## 1. Purpose of File Storage & AI Generation
In Cyberia Space, file storage is not the product; it is a **dependency for AI analysis** and personal file storage.

*   **Contextual Knowledge:** Users upload documents (PDFs, research papers, diagrams) to provide the AI ("Oracle") with specific information needed to answer complex queries.
*   **AI Processing:** Our AI includes a `read_file_content` tool. This tool allows the AI to "read" a user's private PDF or image to generate summaries, extract data tables, or suggest connections between ideas.
*   **Content Generation:** The AI generates text, tasks, and tables based on these files. This content is stored in the user's private database as a "Thought" or "Stack" to help them organize their projects.

## 2. Access Restrictions & Data Privacy
Access to files is strictly governed by **User-Level Isolation**.

*   **Private by Design:** Every file is stored in a private Supabase storage bucket under a strict path hierarchy: `user-files/{userId}/{thoughtId}/{fileName}`.
*   **Authentication:** Access requires a valid JWT (JSON Web Token) issued via Google OAuth. Anonymous users have NO access to cloud storage or AI processing.
*   **System Guardrails:** Our backend logic explicitly verifies ownership:
*   **No Global Search:** There is no public directory, search engine, or "index" that allows one user to find or access files uploaded by another.

## 3. Security Measures & Abuse Prevention
We have implemented several technical "anti-piracy" and "anti-sharing" measures to ensure the platform cannot be misused as a Cyberlocker:

*   **Strict File Size Limit:** We enforce a **50MB maximum file size**. This effectively blocks the distribution of high-definition movies, large software archives, or pirated game files, which are the hallmarks of illegal file-sharing sites.
*   **No Direct Link Sharing:** Files are not accessible via shareable direct URLs. Access to uploaded files is restricted to authenticated sessions within the application. There is no public-facing index, no direct download endpoint, and no ability for a user to generate a link that can be shared outside their authenticated session. File paths use strict user-scoped isolation and are never exposed in a way that enables public access.
*   **Auth-Gated Uploads:** All uploads are tied to a verified user account. We do not allow anonymous or guest uploads to our cloud storage.
*   **Snapshots vs. Files:** Our "Publish" feature (`api/publish.ts`) shares a **visual snapshot** of the workspace, not the raw files themselves. The raw files remain protected behind the user's authentication.

### 3b. Prohibited Uses & Service Classification

Cyberia Space is **NOT** and does not function as:

*   **Cyberlocker / File-Sharing Site:** We do not permit use of our storage for distributing files to the public. Our storage is user-scoped with strict path isolation (`userId/thoughtId/fileName`), tied to authenticated sessions, and the application provides no "download page," no public folder view, and no ability to mass-distribute files through the UI.
*   **Content Delivery Network (CDN):** We do not operate as a public CDN. Our storage is not designed or marketed for high-volume public file distribution.
*   **Piracy Hosting Platform:** While storage URLs are technically accessible, our platform is not designed for piracy. Key limiting factors include: 50MB file size cap, no public directory or search index, all activity tied to authenticated user accounts, and no ability to share files through the application UI.
*   **Anonymous File Hosting:** Every uploaded file is tied to an authenticated, verified user account. All activity is logged and attributable.
*   **Public File Archive or Index:** There is no public directory, search engine, or browsing capability that would allow users to discover or access files uploaded by others.

**Acceptable Uses (MCC 7372 — Data Processing):**
*   Personal knowledge management and note organization
*   AI-assisted analysis of privately uploaded research documents and PDFs
*   Team collaboration within private, authenticated workspaces
*   Storing files as contextual attachments to thoughts and projects

**Prohibited Uses:**
*   Uploading files for the purpose of sharing them with the public or third parties
*   Using the storage layer as a direct file distribution mechanism
*   Attempting to bypass our access controls or extract files for unauthorized sharing
*   Hosting any content that violates our Terms of Service or applicable law

Violations of this policy may result in immediate account suspension, deletion of content, and referral to appropriate authorities.

## 4. Practical Example: A Day in the Life of a Cyberia User
**User Persona:** *Sarah, a Software Architect.*

1.  **Upload:** Sarah uploads a 5MB PDF of a new cloud architecture proposal to her "Project Alpha" space in Cyberia.
2.  **Analysis:** She uses the "Oracle" AI to analyze the PDF. She asks: *"What are the security risks mentioned in section 4 of this document?"*
3.  **Generation:** The AI reads the file, identifies the risks, and creates three "Nodes" on her visual canvas representing the risks.
4.  **Privacy:** The PDF is stored under Sarah's authenticated session with user-scoped path isolation. The application provides no public sharing mechanism for files. If she decides to delete the project, the system wipes the files from the storage bucket (`supabaseStorage.ts`, `deleteAllUserFiles`).
5.  **Outcome:** Sarah has saved 2 hours of reading time. No file was ever shared publicly, and the storage was used purely for "Data Processing" (MCC 7372).

---

---

## 5. Administrative Oversight & Content Moderation
Cyberia maintains robust internal systems for oversight and content moderation to prevent misuse:

*   **Administrative Dashboard:** Administrators maintain a private, password-protected dashboard to monitor system statistics, data health, and identify abnormal patterns, which could indicate account misuse.
*   **Snapshot Revocation:** Administrators have the power to manually revoke or delete any public "Snapshot" that is found to violate our Terms of Service.
*   **Automatic Expiration:** All public snapshots are configured with a **30-day expiration period**. This prevents the platform from being used for long-term hosting of illicit content.
*   **Reporting System:** Users have a direct reporting channel via the built-in "Feedback" system. All reports are logged in the `feedback` database and reviewed manually by our development team for immediate action against violations.
*   **No Anonymous Hosting:** Every shared workspace is permanently linked to a verified user account. This "Audit Trail" ensures that all activities are attributable and discourages the use of the platform for anonymous illegal distribution.

## Conclusion
Cyberia is an **Integrated Systems Design and Data Processing tool**. Our architecture, file size restrictions, and strict authentication protocols demonstrate that we are not a high-risk file-sharing site. We request the lifting of the MCC restriction to continue providing these productivity services to our users.

**Technical Lead, Cyberia Development Team**
