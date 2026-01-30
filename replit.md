# replit.md

## Overview

This is a dating app simulation called "All Matches!" - a Tinder-style application where users can swipe on profiles and chat with AI-powered matches. The app features a swipe deck interface for browsing profiles, match notifications, and real-time chat functionality with AI responses powered by OpenAI.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with a custom theme configuration via CSS variables
- **Animations**: Framer Motion for swipe animations on profile cards

### Backend Architecture
- **Framework**: Express.js running on Node.js with TypeScript
- **API Design**: RESTful API endpoints under `/api/*` prefix
- **Development Server**: Vite middleware integration for HMR during development
- **Build Output**: esbuild bundles server code for production deployment

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Validation**: Zod schemas generated from Drizzle schemas using `drizzle-zod`
- **Current Storage**: In-memory storage implementation (`MemStorage`) with mock profiles
- **Database Ready**: Drizzle config points to PostgreSQL via `DATABASE_URL` environment variable

### Key Design Patterns
- **Shared Types**: The `shared/` directory contains schema definitions used by both client and server
- **Path Aliases**: `@/` maps to client source, `@shared/` maps to shared directory
- **API Client**: Centralized `apiRequest` function in `queryClient.ts` for all HTTP requests
- **Component Structure**: Feature components in `client/src/components/`, UI primitives in `client/src/components/ui/`

### Design System (Jan 2026)
- **Location**: `client/src/styles/theme.ts` and `client/src/styles/patterns.ts`
- **Color Palettes**: 6 named palettes (hotshot, citrus, ocean, berry, tropical, sunset)
- **Patterns**: 12 CSS/SVG patterns (checker, stripes, dots, squiggle, halftone, stars, hearts, zigzag, waves, grid, confetti, diamonds)
- **Profile Theming**: Each profile gets a deterministic palette and pattern based on profile ID via `getProfileTheme(profileId)`
- **Session Theming**: `getSessionPalette()` returns a random palette for the session
- **CSS Variables**: `--eg-primary`, `--eg-secondary`, `--eg-accent`, `--eg-background`, `--eg-text`
- **Utility Classes**: `.eg-card`, `.eg-button`, `.eg-chip`, `.eg-modal`, `.eg-shadow-offset`, `.eg-outline`, `.eg-chat-bubble-*`
- **Design Preview**: Available at `/design` route for visual verification

### Database Schema
- **users**: Basic user authentication (id, username, password)
- **profiles**: Dating profiles with name, age, bio, imageUrl, and isAI flag
- **matches**: Links users to profiles they've swiped right on
- **messages**: Chat messages tied to matches with AI/human distinction

## External Dependencies

### AI Integration
- **OpenAI API**: Used for generating AI chat responses when `OPENAI_API_KEY` is set
- **Fallback**: System works without OpenAI key using simulated responses

### Database
- **Neon Serverless**: `@neondatabase/serverless` package for PostgreSQL connections
- **Session Storage**: `connect-pg-simple` available for session management
- **Migrations**: Drizzle Kit configured to output migrations to `./migrations`

### Third-Party Services
- **Unsplash**: Profile images sourced from Unsplash URLs (mock data)

### Key NPM Packages
- `drizzle-orm` / `drizzle-kit`: Database ORM and migration tooling
- `@tanstack/react-query`: Data fetching and caching
- `framer-motion`: Animation library for swipe gestures
- `lucide-react`: Icon library
- `zod`: Runtime type validation