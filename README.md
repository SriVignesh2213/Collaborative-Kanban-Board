# SyncBoard - Production Collaborative Kanban Board

SyncBoard is a high-performance, production-ready, real-time collaborative Kanban Board application built to exceed modern engineering standards. It utilizes React 19, Express.js, TypeScript, Prisma, Socket.IO, and Tailwind CSS to deliver an ultra-responsive experience similar to Linear or Jira.

---

## 🔗 Live Application Links
* **🌐 Production App (Frontend UI)**: [https://syncboard-frontend-i8zy.onrender.com](https://syncboard-frontend-i8zy.onrender.com)
* **🔌 Backend API Server**: [https://syncboard-api-tvmk.onrender.com](https://syncboard-api-tvmk.onrender.com)
* **📝 Interactive API Documentation (Swagger)**: [https://syncboard-api-tvmk.onrender.com/api-docs](https://syncboard-api-tvmk.onrender.com/api-docs)

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
                          │    PostgreSQL DB     │
                          └──────────────────────┘
```

### Key Engineering & Design Patterns
1. **Fractional Indexing (Drag & Drop Reordering)**: Rather than updating the index positions of every element in a column upon drop, each task stores a float `position`. The client calculates a midpoint between the adjacent sibling cards, requiring only a single database `UPDATE` query.
2. **Refresh Token Rotation (Security)**: Short-lived Access Tokens (JWT - 15m) are coupled with secure HTTP-only Refresh Cookies (7d). Upon refresh, the previous refresh token is revoked and rotated, preventing replay attacks.
3. **WebSockets Presence Rooms**: When a user selects a workspace, they connect to a Socket.IO room named `workspace:<id>`. The server tracks user socket bounds, emitting cursors, online teammate avatars, and typing indicators in real-time.
4. **React Portals for Dialog Overlays**: To prevent low z-index layout constraints (stacking context bugs) from obscuring modal screens, all dialog primitives mount directly to the document body via `createPortal`.
5. **Strict Due Date Boundaries**: Zod schema refinements protect both client forms and backend database calls to ensure task due dates cannot be assigned in the past.

---

## Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **State & Caching**: TanStack Query (React Query) with optimistic cache eviction
- **Real-Time Client**: Socket.IO Client
- **Styling**: Tailwind CSS + custom glassmorphism layers
- **Portals**: React DOM Portals (for layout-independent dialogs)
- **Forms & Validation**: React Hook Form + Zod validator
- **Drag & Drop**: @dnd-kit (Sortable context)
- **Charts**: Recharts

### Backend
- **Platform**: Node.js + Express.js + TypeScript
- **Database Engine**: PostgreSQL 15 + Prisma ORM
- **Authentication**: bcrypt password hashing + JWT + rotated HTTP-only cookies
- **File Upload**: Multer + Cloudinary
- **Documentation**: Swagger OpenAPI v3

---

## Local Development Installation

### Option 1: Docker Compose (Recommended)
Spin up the database, backend Express API, and static client Nginx router instantly:
```bash
# Start services
docker compose up --build
```
* **Frontend**: Accessible at `http://localhost`
* **Backend API Docs (Swagger)**: Available at `http://localhost:5000/api-docs`

---

### Option 2: Running Locally with Host Services

#### Prerequisites
- Node.js (v20+)
- Docker (for starting the local database)

#### Step 1: Start the Local PostgreSQL Database
The local database maps to host port `5433` to prevent port conflicts with any native PostgreSQL instances running on your computer.
```bash
docker compose up -d db
```

#### Step 2: Configure & Generate the Backend DB Schemas
1. Navigate to the `backend` directory.
2. Configure `.env` (`DATABASE_URL="postgresql://postgres:postgresPassword123@localhost:5433/kanban?schema=public"`).
3. Install dependencies and run migrations:
   ```bash
   cd backend
   npm install
   npx prisma migrate dev --name init
   ```

#### Step 3: Start the Backend Server
```bash
npm run dev
```
The server will bind on `http://localhost:5000`.

#### Step 4: Configure and Run the Frontend Client
1. Open a new terminal.
2. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   npm install
   ```
3. Configure your local API endpoints in `.env.local`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```
4. Run the development server:
   ```bash
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
