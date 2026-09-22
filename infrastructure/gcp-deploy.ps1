<#
.SYNOPSIS
    Automated GCP Deployment Pipeline Script for LRS POC (Phase 1)
.DESCRIPTION
    Builds the Trax LRS container, provisions Cloud SQL, Cloud Run, GCS Static Hosting,
    and deploys the Data Bridge Cloud Function via Terraform.
#>
param (
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "lrs-pipeline-poc",

    [Parameter(Mandatory=$false)]
    [string]$Region = "us-central1",

    [Parameter(Mandatory=$false)]
    [switch]$AutoApprove = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  LRS Deployment Pipeline on GCP - Phase 1 Active Runtime " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify gcloud credentials
Write-Host "`n[1/5] Checking Google Cloud Authentication..." -ForegroundColor Yellow
$activeAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)"
if (-not $activeAccount) {
    Write-Host "No active gcloud session detected. Running 'gcloud auth login'..." -ForegroundColor Red
    gcloud auth login
}
Write-Host "Authenticated as: $activeAccount" -ForegroundColor Green

# 2. Set Project Configuration
Write-Host "`n[2/5] Setting Project Context to '$ProjectId'..." -ForegroundColor Yellow
gcloud config set project $ProjectId

# 3. Create Artifact Registry repository if needed
$repoName = "lrs-containers"
Write-Host "`n[3/5] Ensuring Artifact Registry repository '$repoName' exists..." -ForegroundColor Yellow
$repoExists = gcloud artifacts repositories describe $repoName --location=$Region --format="value(name)" 2>$null
if (-not $repoExists) {
    Write-Host "Creating Artifact Registry repository '$repoName'..." -ForegroundColor Gray
    gcloud artifacts repositories create $repoName --repository-format=docker --location=$Region --description="LRS Docker images"
}

# Configure Docker auth for Google Artifact Registry
gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet

# Build & Push Trax LRS Image
$imageUri = "$Region-docker.pkg.dev/$ProjectId/$repoName/trax-lrs:latest"
Write-Host "Building Trax LRS container image: $imageUri..." -ForegroundColor Yellow
docker build -t $imageUri -f infrastructure/docker/Dockerfile.lrs .
docker push $imageUri

# 4. Terraform Provisioning
Write-Host "`n[4/5] Executing Terraform Infrastructure Provisioning..." -ForegroundColor Yellow
Push-Location infrastructure/terraform
try {
    terraform init
    $tfArgs = @(
        "-var=project_id=$ProjectId",
        "-var=region=$Region",
        "-var=trax_image_uri=$imageUri"
    )
    if ($AutoApprove) {
        $tfArgs += "-auto-approve"
    }
    terraform apply @tfArgs

    $bucketUrl = terraform output -raw portal_launch_url
    $lrsEndpoint = terraform output -raw trax_lrs_xapi_endpoint
} finally {
    Pop-Location
}

# 5. Upload Static Assets to GCS
Write-Host "`n[5/5] Synchronizing Frontend Portal & Media Wrappers to GCS..." -ForegroundColor Yellow
$bucketName = (terraform -chdir=infrastructure/terraform output -raw portal_launch_url) -replace "https://storage.googleapis.com/","" -replace "/portal/index.html",""
gcloud storage rsync -r portal "gs://$bucketName/portal"
gcloud storage rsync -r media-wrappers "gs://$bucketName/media-wrappers"

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!                                    " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Web Portal URL:       $bucketUrl" -ForegroundColor Cyan
Write-Host "Trax LRS Endpoint:    $lrsEndpoint" -ForegroundColor Cyan
Write-Host "Downstream Dashboard: http://localhost:4000/dashboard.html" -ForegroundColor Cyan
