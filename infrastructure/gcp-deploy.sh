#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# LRS Deployment Pipeline on GCP - Automated Shell Deployment Script
# ==============================================================================

PROJECT_ID="${1:-lrs-pipeline-poc}"
REGION="${2:-us-central1}"
REPO_NAME="lrs-containers"

echo "=========================================================="
echo "  Deploying LRS Pipeline to GCP Project: ${PROJECT_ID}"
echo "=========================================================="

# 1. Authentication Check
echo "[1/5] Checking gcloud auth..."
gcloud config set project "${PROJECT_ID}"

# 2. Artifact Registry Setup
echo "[2/5] Setting up Artifact Registry..."
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" >/dev/null 2>&1; then
    gcloud artifacts repositories create "${REPO_NAME}" \
        --repository-format=docker \
        --location="${REGION}" \
        --description="LRS Docker images"
fi
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# 3. Build and Push Container
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/trax-lrs:latest"
echo "[3/5] Building & pushing container: ${IMAGE_URI}..."
docker build -t "${IMAGE_URI}" -f infrastructure/docker/Dockerfile.lrs .
docker push "${IMAGE_URI}"

# 4. Terraform Apply
echo "[4/5] Running Terraform..."
cd infrastructure/terraform
terraform init
terraform apply \
    -var="project_id=${PROJECT_ID}" \
    -var="region=${REGION}" \
    -var="trax_image_uri=${IMAGE_URI}" \
    -auto-approve

PORTAL_URL=$(terraform output -raw portal_launch_url)
LRS_ENDPOINT=$(terraform output -raw trax_lrs_xapi_endpoint)
cd ../..

# 5. Sync Static Assets
echo "[5/5] Uploading static assets to Cloud Storage..."
BUCKET_NAME=$(echo "${PORTAL_URL}" | sed -e 's|https://storage.googleapis.com/||' -e 's|/portal/index.html||')
gcloud storage rsync -r portal "gs://${BUCKET_NAME}/portal"
gcloud storage rsync -r media-wrappers "gs://${BUCKET_NAME}/media-wrappers"

echo "=========================================================="
echo "  DEPLOYMENT COMPLETE!"
echo "  Portal URL:    ${PORTAL_URL}"
echo "  LRS Endpoint:  ${LRS_ENDPOINT}"
echo "=========================================================="
