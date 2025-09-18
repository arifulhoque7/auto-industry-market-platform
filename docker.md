# Auto-Marketplace Docker Setup Guide

## Overview
Auto-Marketplace is a microservices-based application that uses Docker containers for all its services. This guide will help you set up and run the entire application stack.

## Prerequisites
- Docker Desktop installed and running
- Docker Compose installed
- At least 8GB of RAM allocated to Docker
- Ports 3000, 3001, 5432, 6379, 8080, 9090, 15672, 27017, 50051, and 3030 available

## Services Architecture

| Service | Container Name | Port | Description |
|---------|---------------|------|-------------|
| Frontend | marketplace_frontend | 3000 | Next.js/React frontend application |
| API | marketplace_api | 3001 | Node.js backend API |
| Nginx | marketplace_nginx | 8080 | Reverse proxy server |
| gRPC Service | marketplace_grpc | 50051 | gRPC microservice |
| PostgreSQL | marketplace_postgres | 5432 | Primary relational database |
| MongoDB | marketplace_mongo | 27017 | NoSQL database |
| Redis | marketplace_redis | 6379 | Caching and session storage |
| RabbitMQ | marketplace_rabbitmq | 5672, 15672 | Message queue (15672 for management UI) |
| Prometheus | marketplace_prometheus | 9090 | Metrics collection |
| Grafana | marketplace_grafana | 3030 | Monitoring dashboard |

## Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd auto-marketplace
```

### 2. Build and Start All Services
```bash
# Build all Docker images
docker-compose build

# Start all services in detached mode
docker-compose up -d
```

### 3. Verify All Services Are Running
```bash
# Check container status
docker ps

# Or view all containers (including stopped ones)
docker ps -a
```

### 4. Access the Application
- **Frontend Application**: http://localhost:3000
- **API Documentation**: http://localhost:3001/api-docs
- **Nginx Proxy**: http://localhost:8080
- **RabbitMQ Management**: http://localhost:15672 (default: guest/guest)
- **Grafana Dashboard**: http://localhost:3030 (default: admin/admin)
- **Prometheus Metrics**: http://localhost:9090

## Common Docker Commands

### Starting Services
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d marketplace_api

# Start with build (rebuild images)
docker-compose up -d --build
```

### Stopping Services
```bash
# Stop all services
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove containers, volumes, and networks
docker-compose down -v
```

### Viewing Logs
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs marketplace_api

# Follow logs in real-time
docker-compose logs -f marketplace_api

# View last 100 lines
docker-compose logs --tail=100 marketplace_api
```

### Managing Individual Containers
```bash
# Restart a service
docker-compose restart marketplace_api

# Execute command in running container
docker exec -it marketplace_api sh

# View container details
docker inspect marketplace_api
```

## Database Management

### PostgreSQL
```bash
# Connect to PostgreSQL
docker exec -it marketplace_postgres psql -U postgres -d marketplace

# Backup database
docker exec marketplace_postgres pg_dump -U postgres marketplace > backup.sql

# Restore database
docker exec -i marketplace_postgres psql -U postgres marketplace < backup.sql
```

### MongoDB
```bash
# Connect to MongoDB
docker exec -it marketplace_mongo mongosh

# Backup MongoDB
docker exec marketplace_mongo mongodump --out /backup

# Restore MongoDB
docker exec marketplace_mongo mongorestore /backup
```

### Redis
```bash
# Connect to Redis CLI
docker exec -it marketplace_redis redis-cli

# Clear Redis cache
docker exec marketplace_redis redis-cli FLUSHALL
```

## Troubleshooting

### Check Service Health
```bash
# Check container health status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check resource usage
docker stats
```

### Common Issues and Solutions

#### Port Already in Use
```bash
# Find process using port (example for port 3000)
lsof -i :3000

# Kill process
kill -9 <PID>
```

#### Container Won't Start
```bash
# Check logs for errors
docker-compose logs <service-name>

# Rebuild the specific service
docker-compose build --no-cache <service-name>
docker-compose up -d <service-name>
```

#### Database Connection Issues
```bash
# Verify network connectivity
docker network ls
docker network inspect auto-marketplace_default

# Restart database services
docker-compose restart marketplace_postgres marketplace_mongo marketplace_redis
```

#### Out of Disk Space
```bash
# Clean up unused Docker resources
docker system prune -a --volumes

# Remove specific unused volumes
docker volume prune
```

## Development Workflow

### Hot Reload Development
```bash
# Run services with live reload
docker-compose -f docker-compose.dev.yml up

# Watch logs during development
docker-compose logs -f marketplace_api marketplace_frontend
```

### Running Tests
```bash
# Run API tests
docker exec marketplace_api npm test

# Run frontend tests
docker exec marketplace_frontend npm test

# Run integration tests
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Debugging
```bash
# Attach to Node.js debugger (API)
docker-compose -f docker-compose.debug.yml up marketplace_api

# View detailed container logs
docker logs marketplace_api --details
```

## Production Deployment

### Building for Production
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy with production configuration
docker-compose -f docker-compose.prod.yml up -d
```

### Scaling Services
```bash
# Scale specific service
docker-compose up -d --scale marketplace_api=3

# Check scaled instances
docker ps --filter name=marketplace_api
```

### Health Monitoring
```bash
# Check all services health
for container in $(docker ps --format "{{.Names}}"); do
  echo "Checking $container..."
  docker exec $container echo "Service is responding" || echo "Service $container is not responding"
done
```

## Backup and Restore

### Full System Backup
```bash
# Stop all services
docker-compose stop

# Backup volumes
docker run --rm -v auto-marketplace_postgres_data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/postgres_data.tar.gz /data
docker run --rm -v auto-marketplace_mongo_data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/mongo_data.tar.gz /data

# Backup configurations
tar czf backup/configs.tar.gz docker-compose.yml .env
```

### Restore from Backup
```bash
# Restore volumes
docker run --rm -v auto-marketplace_postgres_data:/data -v $(pwd)/backup:/backup alpine tar xzf /backup/postgres_data.tar.gz -C /
docker run --rm -v auto-marketplace_mongo_data:/data -v $(pwd)/backup:/backup alpine tar xzf /backup/mongo_data.tar.gz -C /

# Start services
docker-compose up -d
```

## Security Best Practices

1. **Never commit `.env` files** with sensitive data to version control
2. **Use Docker secrets** for production deployments
3. **Regularly update base images** for security patches
4. **Limit container capabilities** using security options
5. **Use non-root users** in Dockerfiles where possible
6. **Implement network segmentation** using Docker networks
7. **Enable Docker Content Trust** for image verification

## Useful Aliases

Add these to your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
# Docker Compose shortcuts
alias dcup='docker-compose up -d'
alias dcdown='docker-compose down'
alias dclogs='docker-compose logs -f'
alias dcps='docker-compose ps'
alias dcrestart='docker-compose restart'
alias dcbuild='docker-compose build'

# Marketplace specific
alias mp-api-logs='docker logs -f marketplace_api'
alias mp-frontend-logs='docker logs -f marketplace_frontend'
alias mp-db='docker exec -it marketplace_postgres psql -U postgres -d marketplace'
alias mp-redis='docker exec -it marketplace_redis redis-cli'
alias mp-mongo='docker exec -it marketplace_mongo mongosh'
```

## Support and Resources

- Docker Documentation: https://docs.docker.com/
- Docker Compose Documentation: https://docs.docker.com/compose/
- Application Issues: Check logs with `docker-compose logs <service-name>`
- Performance Issues: Monitor with Grafana at http://localhost:3030

## License

[Your License Information]