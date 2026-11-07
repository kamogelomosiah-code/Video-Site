# Implementation Plan - Admin Account, Auth Redesign & Feature Updates

## User Review Required
> [!IMPORTANT]
> We will configure the default admin account to use email `kamogelomosiah@gmail.com` and PIN `225533`, enable admin account details editing (email, password, username), remove the bulk upload UI/routes, and redesign both the Auth (Sign In / Sign Up) and Admin Settings pages for flawless mobile and desktop responsiveness.

## Proposed Changes

### 1. Backend Admin Seeding (`server.ts`)
- Update `seedAdmin()` to set email to `kamogelomosiah@gmail.com`, username to `admin` (or `kamogeloma`), and PIN to `225533`.
- Remove bulk upload endpoints (`/api/media/bulk`) and handlers as requested (keep only JSON import).

### 2. Admin Account Editing & Universal Admin Power (`server.ts` & `AdminDashboard.tsx`)
- Ensure admin can update their own email, password, and username in Admin Settings or User Profile.
- Ensure admin has full editing capabilities across all site sections (media, users, talent, ads, settings, categories).

### 3. Responsive Auth Redesign (`Auth.tsx`)
- Refine the sign in and sign up pages with modern, touch-friendly inputs, flexible layouts, and responsive card containers that scale smoothly across mobile and desktop viewports.
- Update demo admin login to use `kamogelomosiah@gmail.com` and PIN `225533`.

### 4. Admin Settings Redesign (`AdminDashboard.tsx`)
- Refine the Site Settings and Admin Account management panels for pristine responsiveness on all devices.

## Verification Plan
- Test admin login with `kamogelomosiah@gmail.com` and PIN `225533`.
- Test editing admin email and password in Admin Settings / Profile.
- Verify Auth and Admin Settings responsiveness on mobile and desktop viewports.
- Verify bulk upload is removed.
