#!/bin/bash

echo "Starting Auto Industry Marketplace..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env files from examples
if [ ! -f backend/api/.env ]; then
    cp backend/api/.env.example backend/api/.env
    echo "Created backend/api/.env from example"
fi

# Build and start services
echo "Building and starting services..."
docker-compose up --build -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Check service status
echo "Checking service status..."
docker-compose ps

echo ""
echo "Services are starting up!"
echo ""
echo "Access points:"
echo "  - Frontend: http://localhost:3000"
echo "  - API: http://localhost:3001"
echo "  - API Docs: http://localhost:3001/api-docs"
echo "  - GraphQL Playground: http://localhost:3001/graphql"
echo "  - RabbitMQ Management: http://localhost:15672 (admin/password123)"
echo "  - Prometheus: http://localhost:9090"
echo "  - Grafana: http://localhost:3030 (admin/admin123)"
echo ""
echo "To stop all services: docker-compose down"
echo "To view logs: docker-compose logs -f [service-name]"