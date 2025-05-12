# E-Commerce Backend API

This repository contains the backend API for an e-commerce platform built with Node.js, Express, and TypeScript.

## Features

- RESTful API architecture
- User authentication and authorization
- Product catalog management
- Order processing and payment integration
- Shopping cart functionality
- Admin dashboard APIs for content management
- Analytics and reporting endpoints

## Tech Stack

- Node.js
- Express.js
- TypeScript
- MongoDB with Mongoose
- JSON Web Token (JWT) for authentication
- Stripe for payment processing
- Redis for caching (optional)

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- MongoDB (local or Atlas)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd e-commerce-backend
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server
```bash
npm run dev
# or
yarn dev
```

The API will be available at http://localhost:8000 (or the port specified in your .env file).

## API Documentation

API documentation is available at `/api/docs` when the server is running in development mode.

## Database Schema

The database includes the following main collections:
- Users
- Products
- Categories
- Orders
- Carts
- Payments

## Development

### Available Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests

## Deployment

The API can be deployed to any Node.js hosting platform such as:
- AWS Elastic Beanstalk
- Heroku
- DigitalOcean
- Vercel
- Railway

## License

This project is licensed under the MIT License. 