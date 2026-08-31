# Standalone Salon Loyalty & Rewards System

This is a production-ready, standalone Salon Loyalty & Rewards System built with Node.js, Express, React, Vite, Tailwind CSS, and Supabase. 

## Project Objective
The system is built as an independent module designed to manage customer loyalty accounts, reward transactions, reward management, and voucher redemption without relying on an existing booking system. A simulated API is provided for future integrations.

## Tech Stack
- **Frontend**: React.js, Vite, Tailwind CSS
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Authentication

## Setup Instructions

### Environment Variables
1. Copy `.env.example` to `.env` in the root folder, and `.env.local` inside `/client` (rename variables to match Vite requirements).
2. Set your Supabase URL, Anon Key, and Service Role Key.

### Database Setup
Apply the schema and policies defined in `docs/DATABASE.md` inside your Supabase SQL Editor.

### Running Backend
### Running the System
To run both the frontend and backend simultaneously, you can use the command from the root `salon-loyalty-system` directory:

```bash
npm run dev
```

Alternatively, you can run them separately:
**Backend**: `cd server && npm run dev`
**Frontend**: `cd client && npm run dev`
