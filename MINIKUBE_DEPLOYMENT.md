# Fusion Microservices - Minikube Deployment Guide

This guide provides step-by-step instructions to deploy the Fusion microservices application on Minikube.

## Architecture Overview

The Fusion application consists of:
- **8 Node.js Microservices**: user, email, subscription, people, application, inventory, chat, call
- **API Gateway**: Kong (v3.6) with declarative configuration
- **Admin UI**: Konga for Kong management
- **Database**: PostgreSQL for Kong, External MongoDB for application data
- **Load Balancer**: Nginx Ingress Controller

## Prerequisites

Before starting, ensure you have the following installed:

1. **Docker**: For building container images
2. **Minikube**: Local Kubernetes cluster
3. **kubectl**: Kubernetes command-line tool
4. **Git**: For cloning the repository

### Installation Commands

```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update && sudo apt install docker-ce docker-ce-cli containerd.io

# Install Minikube
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

```bash
# Make the deployment script executable
chmod +x deploy-to-minikube.sh

# Run the deployment script
./deploy-to-minikube.sh
```

### Option 2: Manual Deployment

If you prefer to deploy manually or need to troubleshoot:

#### Step 1: Start Minikube

```bash
# Start Minikube with adequate resources
minikube start --memory=8192 --cpus=4 --driver=docker

# Enable required addons
minikube addons enable ingress
minikube addons enable ingress-dns
minikube addons enable metrics-server
```

#### Step 2: Build Docker Images

```bash
# Set Docker environment to use Minikube's Docker daemon
eval $(minikube docker-env)

# Build all service images
docker build -t fusion/user-service:latest -f user-service/Dockerfile.dev user-service/
docker build -t fusion/email-service:latest -f email-service/Dockerfile.dev email-service/
docker build -t fusion/subscription-service:latest -f subscription-service/Dockerfile.dev subscription-service/
docker build -t fusion/people-service:latest -f people-service/Dockerfile.dev people-service/
docker build -t fusion/application-service:latest -f application-service/Dockerfile.dev application-service/
docker build -t fusion/inventory-service:latest -f inventory-service/Dockerfile.dev inventory-service/
docker build -t fusion/chat-service:latest -f chat-service/Dockerfile.dev chat-service/
docker build -t fusion/call-service:latest -f call-service/Dockerfile.dev call-service/
```

#### Step 3: Deploy Kubernetes Resources

```bash
# Deploy in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/kong-config.yaml
kubectl apply -f k8s/kong-postgres.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l app=kong-db -n fusion --timeout=300s

# Deploy Kong and services
kubectl apply -f k8s/kong.yaml
kubectl apply -f k8s/konga.yaml
kubectl apply -f k8s/microservices.yaml
kubectl apply -f k8s/ingress.yaml
```

#### Step 4: Setup Local DNS

```bash
# Get Minikube IP
MINIKUBE_IP=$(minikube ip)

# Add entries to /etc/hosts
echo "$MINIKUBE_IP fusion.local" | sudo tee -a /etc/hosts
echo "$MINIKUBE_IP api.fusion.local" | sudo tee -a /etc/hosts
echo "$MINIKUBE_IP admin.fusion.local" | sudo tee -a /etc/hosts
```

## Access Information

After successful deployment, you can access:

### API Gateway (Kong)
- **Main URL**: http://fusion.local
- **Admin API**: http://$(minikube ip):8001
- **Health Check**: http://fusion.local/user/public/health

### Admin Interface (Konga)
- **URL**: http://admin.fusion.local
- **Direct Access**: http://$(minikube ip):1337

### Service Endpoints (via Kong)
All services are accessible through the Kong API Gateway:

- **User Service**: http://fusion.local/user
- **Email Service**: http://fusion.local/email
- **Subscription Service**: http://fusion.local/subscription
- **People Service**: http://fusion.local/people
- **Application Service**: http://fusion.local/application
- **Inventory Service**: http://fusion.local/inventory
- **Chat Service**: http://fusion.local/chat
- **Call Service**: http://fusion.local/call

## Environment Configuration

The application uses the following key configurations:

### Database Connections
- **MongoDB**: External server at `20.26.124.89:27018`
- **PostgreSQL**: Internal Kong database

### External Services
- **SendGrid**: Email service integration
- **Stripe**: Payment processing
- **Twilio**: Communication services
- **AWS S3**: File storage

### Security
- **JWT Authentication**: Configured with Kong JWT plugin
- **CORS**: Enabled for cross-origin requests
- **API Rate Limiting**: Configured in Kong

## Monitoring and Troubleshooting

### Useful Commands

```bash
# Check all pods status
kubectl get pods -n fusion

# Check services
kubectl get services -n fusion

# View logs for a specific service
kubectl logs -f deployment/user-service -n fusion

# Access Minikube dashboard
minikube dashboard

# Check ingress status
kubectl get ingress -n fusion

# Port forward to access services directly
kubectl port-forward service/kong 8000:8000 -n fusion
```

### Common Issues and Solutions

#### 1. Pods not starting
```bash
# Check pod details
kubectl describe pod <pod-name> -n fusion

# Check resource usage
kubectl top pods -n fusion
```

#### 2. Services not accessible
```bash
# Check if ingress controller is running
kubectl get pods -n ingress-nginx

# Verify /etc/hosts entries
cat /etc/hosts | grep fusion
```

#### 3. Database connection issues
```bash
# Check if external MongoDB is accessible
telnet 20.26.124.89 27018

# Check PostgreSQL logs
kubectl logs -f deployment/kong-db -n fusion
```

#### 4. Kong configuration issues
```bash
# Check Kong admin API
curl http://$(minikube ip):8001/status

# Reload Kong configuration
kubectl rollout restart deployment/kong -n fusion
```

## Scaling and Performance

### Horizontal Scaling
```bash
# Scale a specific service
kubectl scale deployment user-service --replicas=3 -n fusion

# Scale multiple services
kubectl scale deployment user-service email-service --replicas=2 -n fusion
```

### Resource Monitoring
```bash
# Check resource usage
kubectl top pods -n fusion
kubectl top nodes

# Set resource limits (edit deployment)
kubectl edit deployment user-service -n fusion
```

## Development Workflow

### Making Changes
1. Modify your service code
2. Rebuild the Docker image:
   ```bash
   eval $(minikube docker-env)
   docker build -t fusion/user-service:latest -f user-service/Dockerfile.dev user-service/
   ```
3. Restart the deployment:
   ```bash
   kubectl rollout restart deployment/user-service -n fusion
   ```

### Hot Reloading
For development, you can mount your local code:
```bash
# Add volume mount to deployment
kubectl patch deployment user-service -n fusion -p '{"spec":{"template":{"spec":{"containers":[{"name":"user-service","volumeMounts":[{"name":"code","mountPath":"/usr/src/app"}]}],"volumes":[{"name":"code","hostPath":{"path":"'$(pwd)'/user-service"}}]}}}}'
```

## Cleanup

### Remove Everything
```bash
# Delete the entire namespace
kubectl delete namespace fusion

# Remove /etc/hosts entries
sudo sed -i '/fusion.local/d' /etc/hosts
sudo sed -i '/api.fusion.local/d' /etc/hosts
sudo sed -i '/admin.fusion.local/d' /etc/hosts

# Stop Minikube (optional)
minikube stop
```

### Remove Specific Services
```bash
# Remove specific deployments
kubectl delete deployment user-service -n fusion
kubectl delete service user-service -n fusion
```

## Security Considerations

1. **Secrets Management**: All sensitive data is stored in Kubernetes Secrets
2. **Network Policies**: Consider implementing network policies for production
3. **RBAC**: Set up proper role-based access control
4. **Image Security**: Scan images for vulnerabilities before deployment

## Production Considerations

When moving to production:

1. **Use managed databases** instead of external connections
2. **Implement proper logging** with centralized log management
3. **Set up monitoring** with Prometheus and Grafana
4. **Configure backup strategies** for persistent data
5. **Implement CI/CD pipelines** for automated deployments
6. **Use Helm charts** for better configuration management

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review Kubernetes and application logs
3. Verify external service connectivity
4. Check resource limits and availability

## File Structure

```
.
├── k8s/
│   ├── namespace.yaml          # Kubernetes namespace
│   ├── configmap.yaml          # Non-sensitive configuration
│   ├── secrets.yaml            # Sensitive configuration
│   ├── kong-config.yaml        # Kong declarative configuration
│   ├── kong-postgres.yaml      # PostgreSQL for Kong
│   ├── kong.yaml               # Kong API Gateway
│   ├── konga.yaml              # Kong Admin UI
│   ├── microservices.yaml      # All microservice deployments
│   └── ingress.yaml            # Ingress configuration
├── deploy-to-minikube.sh       # Automated deployment script
└── MINIKUBE_DEPLOYMENT.md      # This documentation
```

This setup provides a complete local development environment that mirrors production architecture while being easily manageable on a local machine.