# SyncBoard - Production Collaborative Kanban Board

SyncBoard is a high-performance, production-ready, real-time collaborative Kanban Board application built to exceed FAANG engineering standards. It utilizes React 19, Express.js, TypeScript, Prisma, Socket.IO, and Tailwind CSS to deliver an ultra-responsive experience similar to Linear or Jira.

---

## Architecture Overview

SyncBoard uses a clean architecture dividing frontend client concerns from backend API servers:

```
                          ┌──────────────────────┐
                          │    Vite React 19     │
                          │   Frontend Client    │
                          └────┬────────────┬────┘
                               │            │
                   HTTP / REST │            │ WebSockets (Socket.IO)
                               ▼            ▼
                   ┌───────────────┐    ┌───────────────┐
                   │  Express API  │    │   Socket.IO   │
                   │    Backend    │    │ WebSocket Srv │
                   └───────┬───────┘    └───────┬───────┘
                           │                    │
                           └─────────┬──────────┘
                                     │
                                 Prisma ORM
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │    SQLite / PG DB    │
                          └──────────────────────┘
```

### Key Engineering Patterns
1. **Fractional Indexing (Drag & Drop Reordering)**: Rather than updating the index positions of every element in a column upon drop, each task stores a float `position`. The client calculates a midpoint between the adjacent sibling cards, requiring only a single database `UPDATE` query.
2. **Refresh Token Rotation (Security)**: Short-lived Access Tokens (JWT - 15m) are coupled with secure HTTP-only Refresh Cookies (7d). Upon refresh, the previous refresh token is revoked and rotated, preventing replay attacks.
3. **WebSockets Presence Rooms**: When a user selects a workspace, they connect to a Socket.IO room named `workspace:<id>`. The server tracks user socket bounds, emitting cursors, online teammate avatars, and typing indicators in real-time.

---

## Detailed Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + Custom Glassmorphic tokens
- **Real-Time Client**: Socket.IO Client
- **State & Caching**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod validator
- **Drag & Drop**: @dnd-kit (Sortable context)
- **Charts**: Recharts

### Backend
- **Platform**: Node.js + Express.js + TypeScript
- **Database Engine**: SQLite (Local) / PostgreSQL (Prod) + Prisma ORM
- **Authentication**: bcrypt password hashing + JWT + rotated HTTP-only cookies
- **File Upload**: Multer + Cloudinary
- **Documentation**: Swagger OpenAPI v3

---

## Local Development Installation

### Option 1: Docker Compose (Recommended)
Spin up the database, backend Express API, and static client Nginx router instantly:
```bash
docker-compose up --build
```
- Frontend will be accessible at: `http://localhost`
- Backend API Docs are available at: `http://localhost:5000/api-docs`

---

### Option 2: Running Locally (Zero-Config SQLite)

#### Prerequisites
- Node.js (v20+)

#### Step 1: Backend Setup & Database Generation
1. Navigate to the `backend` directory.
2. Install dependencies and initialize the SQLite database:
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma db push
   ```

#### Step 2: Start the Backend Server
```bash
npm run dev
```
The server will bind on `http://localhost:5000`.

#### Step 3: Run the Frontend Client
1. Open a new terminal.
2. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
The app will run on `http://localhost:5173`.

---

## System Security Features Checklist
- [x] **JWT Access Token & Rotated Cookies**: Minimizes risk of cross-site scripting (XSS) and cookie theft.
- [x] **Helmet Headers**: Blocks clickjacking and content-sniffing vulnerabilities.
- [x] **Zod Request Validation**: Sanitizes data boundaries before hitting Prisma engines.
- [x] **Express Rate Limiting**: Mitigates DDoS and credential-stuffing threat vectors.

---

## Interview Study Notes & System Design

### 1. How does the real-time cursor sync scale?
For cursor updates, we transmit coordinate percentages over websockets directly to the workspace room subscribers, excluding the sender. This keeps the network overhead low. In a large enterprise room containing hundreds of users, we would throttle client cursor emissions (e.g. once every 50-100ms) to reduce CPU load.

### 2. Why use float positions for columns instead of standard array sorting indexes?
If you have 10,000 tasks and move one to the top, updating every item's index requires $O(N)$ operations. Midpoint fractional indexing reduces this to $O(1)$ operations, keeping updates fast and lightweight.
