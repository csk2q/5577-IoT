# IoT Nursing Station Dashboard - Docker Setup

This project uses Docker and Docker Compose to containerize all components.

## Quick Start

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your configuration** (optional - defaults are provided)

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - Frontend: http://localhost
   - Backend API: http://localhost:3000
   - Database: localhost:3306

## Services

### Database (MySQL 8.0)
- **Container:** `iot-dashboard-db`
- **Port:** 3306
- **Automatic schema creation** via DDL scripts in `implementation/backend/database/init/`
- **Data seeding** via scripts in `implementation/backend/database/seed/`
- **Persistent storage** via Docker volume `db-data`

### Backend API (Node.js + Express)
- **Container:** `iot-dashboard-backend`
- **Port:** 3000
- **Health check:** http://localhost:3000/health
- **Logs:** Stored in `implementation/backend/logs/`

### Frontend (React + Nginx)
- **Container:** `iot-dashboard-frontend`
- **Port:** 80
- **Nginx proxy** for API requests to backend
- **Production-optimized** build

## Docker Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database
```

### Rebuild after code changes
```bash
# Rebuild all
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
```

### Access database
```bash
docker-compose exec database mysql -u nurse_station_user -p nurse_station_db
```

### Clean up (remove volumes)
```bash
docker-compose down -v
```

## Development Workflow

1. Make code changes in `implementation/backend/` or `implementation/frontend/`
2. Rebuild the affected container: `docker-compose up -d --build [service-name]`
3. View logs to verify: `docker-compose logs -f [service-name]`

## Troubleshooting

### Database not ready
If backend fails to connect, wait for database health check:
```bash
docker-compose ps
```
Look for `healthy` status on database service.

### Port conflicts
If ports 80, 3000, or 3306 are already in use, modify the port mappings in `docker-compose.yml`.

### View container status
```bash
docker-compose ps
```

### Access container shell
```bash
docker-compose exec backend sh
docker-compose exec frontend sh
docker-compose exec database sh
```

## Environment Variables

See `.env.example` for all configurable variables:
- Database credentials
- JWT secret
- Node environment
- Session expiration

## Network

All containers communicate via the `iot-network` bridge network. Services reference each other by container name:
- Frontend → Backend: `http://backend:3000`
- Backend → Database: `mysql://database:3306`
