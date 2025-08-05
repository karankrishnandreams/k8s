#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if minikube is installed
check_prerequisites() {
    print_header "Checking prerequisites..."
    
    if ! command -v minikube &> /dev/null; then
        print_error "minikube is not installed. Please install minikube first."
        exit 1
    fi
    
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "docker is not installed. Please install docker first."
        exit 1
    fi
    
    print_status "All prerequisites are installed."
}

# Start minikube if not running
start_minikube() {
    print_header "Starting Minikube..."
    
    if minikube status | grep -q "Running"; then
        print_status "Minikube is already running."
    else
        print_status "Starting Minikube with 8GB RAM and 4 CPUs..."
        minikube start --memory=8192 --cpus=4 --driver=docker
    fi
    
    # Enable required addons
    print_status "Enabling required addons..."
    minikube addons enable ingress
    minikube addons enable ingress-dns
    minikube addons enable metrics-server
    
    print_status "Minikube is ready."
}

# Build Docker images
build_images() {
    print_header "Building Docker images..."
    
    # Set docker environment to use minikube's docker daemon
    eval $(minikube docker-env)
    
    # Services to build
    services=("user-service" "email-service" "subscription-service" "people-service" "application-service" "inventory-service" "chat-service" "call-service")
    
    for service in "${services[@]}"; do
        if [ -d "$service" ]; then
            print_status "Building $service..."
            docker build -t fusion/$service:latest -f $service/Dockerfile.dev $service/
        else
            print_warning "Directory $service not found. Skipping..."
        fi
    done
    
    print_status "All Docker images built successfully."
}

# Deploy Kubernetes resources
deploy_k8s_resources() {
    print_header "Deploying Kubernetes resources..."
    
    # Create namespace
    print_status "Creating namespace..."
    kubectl apply -f k8s/namespace.yaml
    
    # Apply ConfigMaps and Secrets
    print_status "Applying ConfigMaps and Secrets..."
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/secrets.yaml
    
    # Apply Kong configuration
    print_status "Applying Kong configuration..."
    kubectl apply -f k8s/kong-config.yaml
    
    # Deploy PostgreSQL for Kong
    print_status "Deploying PostgreSQL..."
    kubectl apply -f k8s/kong-postgres.yaml
    
    # Wait for PostgreSQL to be ready
    print_status "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=kong-db -n fusion --timeout=300s
    
    # Deploy Kong
    print_status "Deploying Kong API Gateway..."
    kubectl apply -f k8s/kong.yaml
    
    # Wait for Kong to be ready
    print_status "Waiting for Kong to be ready..."
    kubectl wait --for=condition=ready pod -l app=kong -n fusion --timeout=300s
    
    # Deploy Konga
    print_status "Deploying Konga Admin UI..."
    kubectl apply -f k8s/konga.yaml
    
    # Deploy microservices
    print_status "Deploying microservices..."
    kubectl apply -f k8s/microservices.yaml
    
    # Deploy Ingress
    print_status "Deploying Ingress..."
    kubectl apply -f k8s/ingress.yaml
    
    print_status "All Kubernetes resources deployed successfully."
}

# Wait for all services to be ready
wait_for_services() {
    print_header "Waiting for all services to be ready..."
    
    services=("user-service" "email-service" "subscription-service" "people-service" "application-service" "inventory-service" "chat-service" "call-service")
    
    for service in "${services[@]}"; do
        print_status "Waiting for $service to be ready..."
        kubectl wait --for=condition=ready pod -l app=$service -n fusion --timeout=300s || true
    done
    
    print_status "Waiting for Konga to be ready..."
    kubectl wait --for=condition=ready pod -l app=konga -n fusion --timeout=300s || true
    
    print_status "All services should be ready now."
}

# Setup /etc/hosts entries
setup_hosts() {
    print_header "Setting up /etc/hosts entries..."
    
    MINIKUBE_IP=$(minikube ip)
    
    # Check if entries already exist
    if grep -q "fusion.local" /etc/hosts; then
        print_warning "/etc/hosts entries already exist. Skipping..."
    else
        print_status "Adding entries to /etc/hosts (requires sudo)..."
        echo "# Fusion Minikube entries" | sudo tee -a /etc/hosts
        echo "$MINIKUBE_IP fusion.local" | sudo tee -a /etc/hosts
        echo "$MINIKUBE_IP api.fusion.local" | sudo tee -a /etc/hosts
        echo "$MINIKUBE_IP admin.fusion.local" | sudo tee -a /etc/hosts
        print_status "/etc/hosts entries added."
    fi
}

# Display access information
display_access_info() {
    print_header "Deployment completed successfully!"
    
    MINIKUBE_IP=$(minikube ip)
    
    echo ""
    echo -e "${GREEN}=== ACCESS INFORMATION ===${NC}"
    echo ""
    echo -e "${BLUE}API Gateway (Kong):${NC}"
    echo "  - URL: http://fusion.local"
    echo "  - Admin API: http://$MINIKUBE_IP:8001"
    echo ""
    echo -e "${BLUE}Admin Interface (Konga):${NC}"
    echo "  - URL: http://admin.fusion.local"
    echo "  - Direct access: http://$MINIKUBE_IP:1337"
    echo ""
    echo -e "${BLUE}Service Endpoints (via Kong):${NC}"
    echo "  - User Service: http://fusion.local/user"
    echo "  - Email Service: http://fusion.local/email"
    echo "  - Subscription Service: http://fusion.local/subscription"
    echo "  - People Service: http://fusion.local/people"
    echo "  - Application Service: http://fusion.local/application"
    echo "  - Inventory Service: http://fusion.local/inventory"
    echo "  - Chat Service: http://fusion.local/chat"
    echo "  - Call Service: http://fusion.local/call"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  - Check pod status: kubectl get pods -n fusion"
    echo "  - Check service status: kubectl get services -n fusion"
    echo "  - View logs: kubectl logs -f deployment/<service-name> -n fusion"
    echo "  - Access Minikube dashboard: minikube dashboard"
    echo "  - Stop all services: kubectl delete namespace fusion"
    echo ""
    echo -e "${YELLOW}Note:${NC} Make sure your external MongoDB (20.26.124.89:27018) is accessible from your network."
    echo ""
}

# Main execution
main() {
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  Fusion Microservices Deployment    ${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
    
    check_prerequisites
    start_minikube
    build_images
    deploy_k8s_resources
    wait_for_services
    setup_hosts
    display_access_info
}

# Run main function
main "$@"