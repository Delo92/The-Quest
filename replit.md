# HiFitComp - Talent Competition & Voting Platform

## Overview
HiFitComp is a comprehensive talent competition and voting platform designed for artists, models, bodybuilders, and performers. Participants compete for public votes within a dark entertainment-themed user interface, inspired by the "One Music" HTML template. The platform supports multiple user roles with escalating privileges, from public viewers who can vote, to talents who can apply to competitions, hosts who manage their own events, and administrators with full platform control. It aims to provide a robust and engaging experience for both competitors and voters, leveraging external storage solutions for media and a secure authentication system.

## User Preferences
- Dark entertainment theme matching "One Music" HTML template exactly
- Orange/amber color scheme (#FF5A09) as accent
- Black (#000) primary background
- Uppercase headings with wide letter-spacing throughout
- Animations and parallax effects
- Template images stored in client/public/images/template/
- Firebase for all auth (NOT Replit Auth)
- Firebase Storage as primary upload destination for talent images, Google Drive as primary display source (with Firebase as fallback), Vimeo for talent videos
- Image upload flow: Firebase Storage first -> Google Drive sync -> display from Drive URL, fallback to Firebase URL
- imageBackups Firestore collection tracks primaryUrl, firebaseUrl, storagePath, driveFileId per image

## System Architecture
The platform is built with a modern web stack:
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion for dynamic UI.
- **Backend**: Express.js, secured with Firebase Authentication (JWT Bearer tokens) and Firebase Admin SDK for user management.
- **Database**: Firebase Firestore exclusively for all data storage — users, profiles, competitions, contestants, votes, livery, settings, and more. No SQL/PostgreSQL.
- **Styling**: Adheres to a dark theme with #FF5A09 as the primary accent color, using Poppins and Playfair Display fonts. UI elements are designed to mimic the "One Music" template, including distinct section headings, breadcrumb headers, event cards, rectangular buttons, full-screen heroes with animations, and parallax sections.
- **Key Features**:
    - **Multi-level User Roles**: Viewer, Talent, Host, and Admin, each with progressively more permissions and dedicated dashboards.
    - **Competition Management**: Public browsing, voting (IP-based limits), talent applications, host-specific competition creation and management, and admin-level oversight.
    - **Media Management**: Talents can upload images to Google Drive and videos to Vimeo through integrated APIs.
    - **Authentication**: Firebase Auth (email/password) with JWT Bearer tokens.
    - **Site Branding (Livery)**: Admins can manage site-wide images and text content.
    - **Dynamic Categories**: Competition categories are stored in Firestore and managed from the Livery tab. Admins can add, edit, rename, and delete categories. The landing page renders categories dynamically from the API.
    - **Invitation System**: Token-based invitations allowing higher-level users to invite lower-level users.
    - **Payment Processing**: Integrated for vote purchases, hosting packages, and join/host fees, including sales tax configuration.
    - **Reporting & Analytics**: Dashboards provide specific analytics for hosts (their own events) and comprehensive platform analytics for admins.
    - **Storage Management**: Admin interface to monitor Google Drive and Vimeo storage usage.
    - **QR Code Voting**: Hosts/admins can download QR codes for competitions that link to in-person voting pages. Votes from QR scans are tracked separately as "in_person" source. Vote breakdown (online vs in-person) displayed in host and admin dashboards with visual progress bars.
    - **Vote Source Tracking**: Votes tracked as "online" or "in_person" with separate counters. Online vote weight (1-100%) configurable per competition for weighted final scoring.
    - **Hierarchical URL Routing**: URLs follow `/:categorySlug/:compSlug` for competition detail and `/:categorySlug/:compSlug/:talentSlug` for contestant pages. Slugs are derived from category name, competition title, and contestant display name. Resolve endpoints validate both category and competition slugs for disambiguation.

## External Dependencies
- **Firebase**: Used for user authentication (Auth) and specific data storage (Firestore).
- **Google Drive**: Integrated for hosting and managing talent image uploads.
- **Vimeo**: Utilized for hosting and managing talent video uploads, supporting TUS upload protocol.
- **Authorize.Net (via Accept.js)**: For secure client-side tokenization and processing of payments.