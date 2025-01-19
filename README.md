# Vigyoti

A modern web application for managing social media content and scheduling posts.

## Project Structure

- `vigyoti_frontend/` - Next.js frontend application
- `vigyoti_backend/` - Backend API server

## Setup Instructions

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd vigyoti_frontend
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment example file:
```bash
cp .env.example .env.local
```

4. Update the environment variables in `.env.local` with your actual values

5. Start the development server:
```bash
npm run dev
```

### Backend Setup

1. Navigate to the backend directory:
```bash
cd vigyoti_backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment example file:
```bash
cp .env.example .env
```

4. Update the environment variables in `.env` with your actual values

5. Start the development server:
```bash
npm run dev
```

## Environment Variables

### Frontend (.env.local)
- Firebase configuration
- NextAuth configuration
- Stripe API keys
- Firebase Admin credentials

### Backend (.env)
- Server configuration
- Firebase Admin credentials
- Database configuration

## Features

- Google Authentication
- Subscription Management with Stripe
- Firebase Integration
- Post Scheduling
- Team Collaboration
- Credit System

## Development

1. Frontend runs on http://localhost:3000
2. Backend runs on http://localhost:3001

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Submit a pull request

## Security Notes

- Never commit `.env` or `.env.local` files
- Keep API keys and secrets secure
- Use environment variables for sensitive data 