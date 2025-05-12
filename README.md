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

### Running the Application

#### Development Mode

Start the development server with hot-reloading:

```bash
npm run dev
# or
yarn dev
```

This will start the server with nodemon, which automatically restarts when file changes are detected.

#### Production Mode

Build and start the production server:

```bash
# First, build the TypeScript files
npm run build
# or
yarn build

# Then start the server
npm start
# or
yarn start
```

#### Test Mode

To run the test suite:

```bash
npm test
# or
yarn test
```

### Accessing the API

The API will be available at http://localhost:8000 (or the port specified in your .env file).

- API Base URL: `http://localhost:8000/api/v1`
- Swagger Documentation: `http://localhost:8000/api/docs`
- Health Check: `http://localhost:8000/health`

## API Documentation

API documentation is available at `/api/docs` when the server is running in development mode. This includes:

- Endpoint descriptions
- Request/response examples
- Authentication requirements
- Schema definitions

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
- `npm run seed` - Seed the database with initial data
- `npm run migrate` - Run database migrations
- `npm run clean` - Remove build artifacts

### Debugging

To run the server in debug mode:

```bash
npm run dev:debug
```

Then connect your debugger to port 9229.

## Deployment

The API can be deployed to any Node.js hosting platform such as:
- AWS Elastic Beanstalk
- Heroku
- DigitalOcean
- Vercel
- Railway

### Deployment Steps

1. Build the project: `npm run build`
2. Set production environment variables
3. Start the server: `npm start`

## Troubleshooting

Common issues and their solutions:

- **Database connection errors**: Verify MongoDB connection string and credentials
- **Authentication issues**: Check JWT secret and expiration settings
- **CORS errors**: Ensure the client origin is added to allowed origins

## License

This project is licensed under the MIT License. 