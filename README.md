# 🚗 Auto Industry Marketplace Platform

A comprehensive full-stack marketplace platform connecting car owners, repair shops, and spare parts vendors. Built with modern technologies demonstrating enterprise-level architecture, real-time communication, and scalable microservices design.

## 🌟 Key Features

### For Car Owners
- Submit service requests with detailed car information
- Receive and compare multiple quotes from repair shops
- Real-time notifications for new quotes
- Browse available spare parts inventory
- Track service request status

### For Repair Shops
- Browse and filter service requests
- Submit competitive quotes
- Real-time updates on quote acceptance
- Analytics dashboard for business insights

### For Spare Parts Vendors
- Manage inventory with CRUD operations
- Real-time stock updates
- Track parts compatibility
- Automated inventory notifications

## 🏗️ Architecture Highlights

- **Microservices Architecture**: Modular, scalable design
- **Real-time Communication**: WebSocket implementation for instant updates
- **Multi-Database Strategy**: MongoDB for flexibility, PostgreSQL for relational data
- **Message Queue Integration**: RabbitMQ for async processing
- **Caching Layer**: Redis for performance optimization
- **API Documentation**: Swagger/OpenAPI specification
- **GraphQL Support**: Flexible data querying alongside REST
- **Authentication**: JWT-based auth with refresh tokens
- **Monitoring**: Prometheus metrics integration

## 🛠️ Tech Stack

### Backend
- **Node.js & Express.js** - Core backend framework
- **MongoDB** - Document store for service requests
- **PostgreSQL** - Relational database for quotes and parts
- **Redis** - Caching and session management
- **RabbitMQ** - Message queue for async operations
- **Socket.io** - Real-time bidirectional communication
- **GraphQL** - Alternative API endpoint
- **JWT** - Secure authentication
- **Swagger** - API documentation

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Socket.io Client** - Real-time updates
- **React Hooks** - Modern state management

## 🚀 Quick Start with Docker

### Prerequisites
- Docker Desktop installed ([Download](https://www.docker.com/products/docker-desktop))
- Git

### Step 1: Clone and Run
```bash
# Clone repository
git clone git@github.com:arifulhoque7/auto-industry-market-platform.git
cd auto-industry-market-platform

# Start all services
docker-compose up -d

# Wait for initialization (30-60 seconds)
docker-compose logs -f api
```

### Step 2: Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | - |
| **API** | http://localhost:3001 | - |
| **API Docs** | http://localhost:3001/api-docs | - |
| **GraphQL** | http://localhost:3001/graphql | - |
| **RabbitMQ** | http://localhost:15672 | admin / password123 |
| **Kafka** | http://localhost:9092 | - |
| **Grafana** | http://localhost:3030 | admin / admin123 |
| **Prometheus** | http://localhost:9090 | - |

### Docker Commands

```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f [service-name]

# Stop all services
docker-compose down

# Reset everything (including data)
docker-compose down -v

# Rebuild after code changes
docker-compose up -d --build
```

---

## Alternative: Manual Setup (Without Docker)

### Backend Setup

#### Install Dependencies
```bash
cd backend/api
npm install
```

#### Configure Environment Variables
```bash
# Create .env file in backend/api directory
cp .env.example .env

# Edit .env with your configurations:
```

Create `.env` file with:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Connections
MONGODB_URI=mongodb://localhost:27017/auto_marketplace
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=auto_marketplace
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Optional: Google OAuth (if implementing social login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### Setup Databases

**MongoDB Setup:**
```bash
# Start MongoDB (if not running)
mongod --dbpath /path/to/your/data/directory

# Or using Homebrew on macOS
brew services start mongodb-community
```

**PostgreSQL Setup:**
```bash
# Start PostgreSQL
# On macOS with Homebrew
brew services start postgresql

# Create database
createdb auto_marketplace

# Run migrations to create tables
cd backend/api
npm run migrate
```

**Redis Setup:**
```bash
# Start Redis
redis-server

# Or using Homebrew on macOS
brew services start redis
```

**RabbitMQ Setup:**
```bash
# Using Docker (recommended)
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Or install locally and start
rabbitmq-server
```

#### Start Backend Server
```bash
cd backend/api
npm run dev

# Server will start on http://localhost:3001
# API Documentation: http://localhost:3001/api-docs
```

### Frontend Setup

#### Install Dependencies
```bash
# Open new terminal
cd frontend
npm install
```

#### Configure Environment Variables
```bash
# Create .env.local file in frontend directory
```

Create `.env.local` file with:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

#### Start Frontend Development Server
```bash
npm run dev

# Application will start on http://localhost:3000
```

## 🧪 Testing the Application

### Create Test Accounts

Open http://localhost:3000/auth/register and create accounts for:

1. **Car Owner Account**
   - Email: owner@test.com
   - Password: Test123!
   - Role: Car Owner

2. **Repair Shop Account**
   - Email: shop@test.com
   - Password: Test123!
   - Role: Repair Shop
   - Business Name: Quick Fix Auto

3. **Vendor Account**
   - Email: vendor@test.com
   - Password: Test123!
   - Role: Vendor
   - Business Name: Auto Parts Plus

### 2. Test User Flows

#### As Car Owner:
1. Login with owner credentials
2. Click "New Service Request"
3. Fill in car details (Make: Toyota, Model: Camry, Year: 2020)
4. Submit service request
5. View real-time quote notifications

#### As Repair Shop:
1. Login with shop credentials
2. View available service requests
3. Submit a quote with labor and parts cost
4. See real-time status updates

#### As Vendor:
1. Login with vendor credentials
2. Add new spare parts to inventory
3. Update stock levels
4. View inventory analytics

### 3. Test Real-time Features
1. Open two browser windows with different user accounts
2. Submit a quote from repair shop account
3. See instant notification in car owner's dashboard
4. Accept quote and observe status update in both windows

## 📊 API Documentation

### Interactive API Docs
Visit http://localhost:3001/api-docs for Swagger UI with:
- Complete endpoint documentation
- Request/Response schemas
- Try-it-out functionality
- Authentication testing

### Key API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token

#### Service Requests
- `GET /api/requests` - List service requests
- `POST /api/requests` - Create new request
- `GET /api/requests/:id` - Get request details
- `POST /api/requests/:id/accept-quote` - Accept a quote

#### Quotes
- `POST /api/quotes` - Submit a quote
- `GET /api/quotes/request/:requestId` - Get quotes for request
- `GET /api/quotes/analytics` - Quote analytics

#### Spare Parts
- `GET /api/parts` - Browse parts inventory
- `POST /api/parts` - Add new part (vendors only)
- `PATCH /api/parts/:id/stock` - Update stock

### GraphQL Endpoint
Access GraphQL playground at http://localhost:3001/graphql

## 🏗️ Project Structure

```
auto-marketplace/
├── frontend/                  # Next.js frontend application
│   ├── src/
│   │   ├── app/              # App router pages
│   │   │   ├── auth/         # Authentication pages
│   │   │   └── dashboard/    # Role-based dashboards
│   │   ├── components/       # Reusable components
│   │   ├── lib/             # Utilities and services
│   │   └── types/           # TypeScript definitions
│   └── public/              # Static assets
│
├── backend/
│   └── api/                 # Node.js backend API
│       ├── src/
│       │   ├── routes/      # API route handlers
│       │   ├── models/      # Database models
│       │   ├── middleware/  # Express middleware
│       │   ├── services/    # Business logic
│       │   ├── db/          # Database connections
│       │   ├── graphql/     # GraphQL schema
│       │   └── utils/       # Helper utilities
│       └── swagger.yaml     # API documentation
│
├── docker-compose.yml       # Docker configuration
└── README.md               # This file
```

## 🔍 Key Implementation Highlights

### 1. Scalable Architecture
- Microservices-ready design with message queue integration
- Horizontal scaling support through stateless API design
- Database connection pooling for optimal performance

### 2. Security Best Practices
- JWT authentication with refresh token rotation
- Input validation and sanitization
- Rate limiting and CORS configuration
- Helmet.js for security headers
- Environment variable management

### 3. Performance Optimizations
- Redis caching for frequently accessed data
- Database indexing for query optimization
- Lazy loading and code splitting in frontend
- WebSocket connection management

### 4. Code Quality
- TypeScript for type safety
- ESLint configuration
- Consistent coding patterns
- Comprehensive error handling
- Logging with Winston

## 🐳 Docker Deployment (Optional)

```bash
# Run all services with Docker Compose
docker-compose up -d

# Stop all services
docker-compose down
```

## 📈 Monitoring

- **Health Check**: http://localhost:3001/health
- **Metrics**: http://localhost:3001/metrics (Prometheus format)
- **Logs**: Check `backend/api/logs/` directory

## 📄 License

MIT License - Feel free to use this project for evaluation purposes.

---

**Built with ❤️ to demonstrate full-stack development expertise**
