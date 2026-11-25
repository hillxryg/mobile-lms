# Mobile LMS (Presentation & Exercise Storage App)

A cross-platform mobile Learning Management System (LMS) built with **React Native (Expo)** and **Supabase**. Designed to streamline classroom file sharing and coursework tracking, allowing instructors to distribute presentation decks and assign exercises while students enroll via join codes, submit work, and view grades.

---

## Features

### Authentication & Role Management
- **Email & Password Authentication:** Powered by Supabase Auth with persistent sessions via `AsyncStorage`.
- **Role-Based Access:** Supports distinct **Instructor** and **Student** workflows automatically provisioned via database triggers upon sign-up.

### Instructor Workflow
- **Class Creation:** Create courses with auto-generated, unique 6-character join codes.
- **Presentation Storage:** Upload `.ppt`, `.pptx`, and `.pdf` lecture slides directly to Supabase Storage (`lms-files`).
- **Exercise Management:** Create assignments with detailed instructions, max score limits, and native date/time deadline pickers.
- **Grading & Feedback:** Review student text answers and attached files, assign numeric scores, and provide written feedback.

### Student Workflow
- **Quick Enrollment:** Join classes using a 6-character course code.
- **Dashboard Overview:** View enrolled courses alongside upcoming due exercises sorted by deadline.
- **Lecture Access:** One-tap viewing and downloading of uploaded presentation files.
- **Exercise Submission:** Submit text responses and/or attach supporting files, track submission status (`Pending`, `Submitted`, `Late`, `Graded`), and view instructor feedback.

---

## Tech Stack

- **Frontend Framework:** React Native, Expo (SDK 58), Expo Router, TypeScript
- **Backend & Database:** Supabase (PostgreSQL)
- **Authentication & Storage:** Supabase Auth & Supabase Storage
- **Native Modules:** `expo-document-picker`, `expo-linking`, `@react-native-community/datetimepicker`, `@react-native-async-storage/async-storage`

---

## Project Structure

```text
lms-app/
├── schema.sql                  # PostgreSQL schema, triggers, and storage bucket setup
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login.tsx       # Sign In / Sign Up screen with role toggle
│   │   ├── (tabs)/
│   │   │   └── index.tsx       # Role-based dashboard & class management modals
│   │   ├── course/
│   │   │   └── [id].tsx        # Subject workspace (Presentations & Exercises tabs)
│   │   ├── exercise/
│   │   │   └── [id].tsx        # Exercise submission (Student) & grading (Instructor)
│   │   ├── _layout.tsx         # Root navigation stack & auth route guard
│   │   └── index.tsx           # Root redirect entry point
│   ├── lib/
│   │   └── supabase.ts         # Supabase client configuration
│   └── types/
│       └── database.ts         # Shared TypeScript interfaces
└── .env                        # Environment variables (excluded from version control)