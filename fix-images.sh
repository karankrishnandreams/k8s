#!/bin/bash

echo "🔧 Quick Fix for ErrImageNeverPull Issue"
echo "========================================"
echo ""

# Set Docker environment to use Minikube's Docker daemon
echo "📦 Setting up Docker environment..."
eval $(minikube docker-env)

# Build images for all services
services=("user-service" "email-service" "subscription-service" "people-service" "application-service" "inventory-service" "chat-service" "call-service")

echo "🏗️  Building Docker images..."
for service in "${services[@]}"; do
    if [ -d "$service" ]; then
        echo "Building $service..."
        if [ -f "$service/Dockerfile.dev" ]; then
            docker build -t fusion/$service:latest -f $service/Dockerfile.dev $service/
        elif [ -f "$service/Dockerfile" ]; then
            docker build -t fusion/$service:latest $service/
        else
            echo "⚠️  No Dockerfile found for $service"
        fi
    else
        echo "⚠️  Directory $service not found"
    fi
done

echo ""
echo "🔄 Restarting deployments..."
for service in "${services[@]}"; do
    kubectl rollout restart deployment/$service -n fusion 2>/dev/null || echo "⚠️  $service deployment not found"
done

echo ""
echo "✅ Fix applied! Check status with:"
echo "   kubectl get pods -n fusion"
echo ""
echo "🔍 If pods are still failing, check logs with:"
echo "   kubectl logs deployment/user-service -n fusion"