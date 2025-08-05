#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if minikube is running
check_minikube() {
    print_header "Checking Minikube status..."
    
    if ! minikube status | grep -q "Running"; then
        print_error "Minikube is not running. Please start it first with: minikube start"
        exit 1
    fi
    
    print_status "Minikube is running."
}

# Set Docker environment to use Minikube's Docker daemon
setup_docker_env() {
    print_header "Setting up Docker environment..."
    
    # Configure Docker to use Minikube's Docker daemon
    eval $(minikube docker-env)
    
    print_status "Docker environment configured to use Minikube's Docker daemon."
    print_status "Docker host: $DOCKER_HOST"
}

# Build Docker images
build_images() {
    print_header "Building Docker images for all services..."
    
    # Services to build
    services=("user-service" "email-service" "subscription-service" "people-service" "application-service" "inventory-service" "chat-service" "call-service")
    
    for service in "${services[@]}"; do
        if [ -d "$service" ]; then
            print_status "Building $service..."
            
            # Check if Dockerfile.dev exists
            if [ -f "$service/Dockerfile.dev" ]; then
                docker build -t fusion/$service:latest -f $service/Dockerfile.dev $service/
                print_status "✅ Successfully built fusion/$service:latest"
            elif [ -f "$service/Dockerfile" ]; then
                docker build -t fusion/$service:latest $service/
                print_status "✅ Successfully built fusion/$service:latest"
            else
                print_warning "⚠️  No Dockerfile found for $service. Skipping..."
            fi
        else
            print_warning "⚠️  Directory $service not found. Skipping..."
        fi
    done
    
    print_status "All Docker images built successfully."
}

# Verify images are available
verify_images() {
    print_header "Verifying built images..."
    
    services=("user-service" "email-service" "subscription-service" "people-service" "application-service" "inventory-service" "chat-service" "call-service")
    
    for service in "${services[@]}"; do
        if docker images | grep -q "fusion/$service"; then
            print_status "✅ fusion/$service:latest is available"
        else
            print_error "❌ fusion/$service:latest not found"
        fi
    done
}

# Restart deployments to pull new images
restart_deployments() {
    print_header "Restarting deployments to use new images..."
    
    services=("user-service" "email-service" "subscription-service" "people-service" "application-service" "inventory-service" "chat-service" "call-service")
    
    for service in "${services[@]}"; do
        print_status "Restarting $service deployment..."
        kubectl rollout restart deployment/$service -n fusion || print_warning "Failed to restart $service"
    done
    
    print_status "All deployments restarted."
}

# Wait for deployments to be ready
wait_for_deployments() {
    print_header "Waiting for deployments to be ready..."
    
    services=("user-service" "email-service" "subscription-service" "people-service" "application-service" "inventory-service" "chat-service" "call-service")
    
    for service in "${services[@]}"; do
        print_status "Waiting for $service to be ready..."
        kubectl wait --for=condition=available deployment/$service -n fusion --timeout=300s || print_warning "Timeout waiting for $service"
    done
    
    print_status "Checking final pod status..."
    kubectl get pods -n fusion
}

# Main execution
main() {
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  Fusion Services Image Builder       ${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo ""
    
    check_minikube
    setup_docker_env
    build_images
    verify_images
    restart_deployments
    wait_for_deployments
    
    echo ""
    print_status "Image building and deployment restart completed!"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Check pod status: kubectl get pods -n fusion"
    echo "2. View logs if needed: kubectl logs -f deployment/<service-name> -n fusion"
    echo "3. Test access: curl http://fusion.local/user/public/health"
}

# Run main function
main "$@"