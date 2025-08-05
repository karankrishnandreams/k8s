# Fusion Microservices - Quick Start Guide

## 🚀 One-Command Deployment

```bash
./deploy-to-minikube.sh
```

## ✅ Prerequisites Check

Ensure you have these installed:
- Docker
- Minikube  
- kubectl

## 📋 What Gets Deployed

- ✅ 8 Node.js Microservices
- ✅ Kong API Gateway
- ✅ Konga Admin UI
- ✅ PostgreSQL Database
- ✅ Nginx Ingress Controller

## 🌐 Access URLs

After deployment completes:

| Service | URL | Purpose |
|---------|-----|---------|
| API Gateway | http://fusion.local | Main application access |
| Admin UI | http://admin.fusion.local | Kong management |
| API Docs | http://fusion.local/user/public/health | Health check |

## 🔧 Quick Commands

```bash
# Check deployment status
kubectl get pods -n fusion

# View service logs
kubectl logs -f deployment/user-service -n fusion

# Access Kubernetes dashboard
minikube dashboard

# Clean up everything
kubectl delete namespace fusion
```

## 🆘 Troubleshooting

### Services not accessible?
```bash
# Check if Minikube is running
minikube status

# Verify /etc/hosts entries
cat /etc/hosts | grep fusion
```

### Pods failing to start?
```bash
# Check pod details
kubectl describe pods -n fusion

# Check resource usage
kubectl top nodes
```

## 📖 Full Documentation

For detailed information, see [MINIKUBE_DEPLOYMENT.md](MINIKUBE_DEPLOYMENT.md)

---

**Need help?** Check the troubleshooting section in the full documentation.