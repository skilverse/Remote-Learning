<#
.SYNOPSIS
    Automated GCP Deployment Pipeline Script for LRS POC with Custom Domains
.DESCRIPTION
    Builds Trax LRS, Mock Nexus LMS, and HIS Portal containers, provisions Cloud SQL,
    Cloud Run, GCS Static Hosting, and deploys the Data Bridge Cloud Function via Terraform.
#>
param (
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "diesel-cat-509409-e5",

    [Parameter(Mandatory=$false)]
    [string]$Region = "us-central1",

    [Parameter(Mandatory=$false)]
    [switch]$AutoApprove = $true
)

$ErrorActionPreference = "Stop"

# Refresh PATH to pick up newly installed gcloud and terraform
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";$env:Path"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  LRS & LMS Deployment Pipeline on GCP: $ProjectId " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify gcloud credentials
Write-Host "`n[1/6] Checking Google Cloud Authentication..." -ForegroundColor Yellow
$activeAccount = & gcloud.cmd auth list --filter=status:ACTIVE --format="value(account)" 2>$null
if (-not $activeAccount) {
    Write-Host "No active gcloud session detected. Running 'gcloud auth login --update-adc'..." -ForegroundColor Red
    & gcloud.cmd auth login --update-adc
    $activeAccount = & gcloud.cmd auth list --filter=status:ACTIVE --format="value(account)"
}
Write-Host "Authenticated as: $activeAccount" -ForegroundColor Green

# 2. Set Project Configuration & Enable Required APIs
Write-Host "`n[2/6] Setting Project Context to '$ProjectId'..." -ForegroundColor Yellow
& gcloud.cmd config set project $ProjectId

Write-Host "Ensuring core Google Cloud APIs are enabled..." -ForegroundColor Gray
& gcloud.cmd services enable artifactregistry.googleapis.com run.googleapis.com sqladmin.googleapis.com cloudfunctions.googleapis.com cloudscheduler.googleapis.com storage.googleapis.com --project $ProjectId

# 3. Create Artifact Registry repository if needed
$repoName = "lrs-containers"
Write-Host "`n[3/6] Ensuring Artifact Registry repository '$repoName' exists..." -ForegroundColor Yellow
$repoExists = & gcloud.cmd artifacts repositories describe $repoName --location=$Region --format="value(name)" 2>$null
if (-not $repoExists) {
    Write-Host "Creating Artifact Registry repository '$repoName'..." -ForegroundColor Gray
    & gcloud.cmd artifacts repositories create $repoName --repository-format=docker --location=$Region --description="LRS Docker images"
}

# Configure Docker auth for Google Artifact Registry
& gcloud.cmd auth configure-docker "$Region-docker.pkg.dev" --quiet

# 4. Build & Push All 3 Container Images
Write-Host "`n[4/6] Building & Pushing Container Images..." -ForegroundColor Yellow

$lrsImageUri = "$Region-docker.pkg.dev/$ProjectId/$repoName/trax-lrs:latest"
Write-Host "Building Trax LRS container image: $lrsImageUri..." -ForegroundColor Gray
docker build -t $lrsImageUri -f infrastructure/docker/Dockerfile.lrs .
docker push $lrsImageUri

$nexusImageUri = "$Region-docker.pkg.dev/$ProjectId/$repoName/mock-nexus:latest"
Write-Host "Building Mock Nexus LMS container image: $nexusImageUri..." -ForegroundColor Gray
docker build -t $nexusImageUri -f infrastructure/docker/Dockerfile.nexus .
docker push $nexusImageUri

$portalImageUri = "$Region-docker.pkg.dev/$ProjectId/$repoName/his-portal:latest"
Write-Host "Building HIS Web Portal container image: $portalImageUri..." -ForegroundColor Gray
docker build -t $portalImageUri -f infrastructure/docker/Dockerfile.portal .
docker push $portalImageUri

# 5. Terraform Provisioning
Write-Host "`n[5/6] Executing Terraform Infrastructure Provisioning..." -ForegroundColor Yellow
Push-Location infrastructure/terraform
try {
    terraform init -upgrade
    $tfArgs = @(
        "-var=project_id=$ProjectId",
        "-var=region=$Region",
        "-var=trax_image_uri=$lrsImageUri",
        "-var=nexus_image_uri=$nexusImageUri",
        "-var=portal_image_uri=$portalImageUri"
    )
    if ($AutoApprove) {
        $tfArgs += "-auto-approve"
    }
    terraform apply @tfArgs

    $lrsUrl = terraform output -raw trax_lrs_url
    $lrsEndpoint = terraform output -raw trax_lrs_xapi_endpoint
    $nexusDashboard = terraform output -raw mock_nexus_dashboard_url
    $portalUrl = terraform output -raw his_portal_url
    $gcsPortalUrl = terraform output -raw portal_launch_url
    $customHis = terraform output -raw custom_domain_his
    $customLms = terraform output -raw custom_domain_lms
    $customLrs = terraform output -raw custom_domain_lrs
} finally {
    Pop-Location
}

# 6. Upload Static Assets to GCS
Write-Host "`n[6/6] Synchronizing Frontend Portal & Media Wrappers to GCS..." -ForegroundColor Yellow
$bucketName = (terraform -chdir=infrastructure/terraform output -raw portal_launch_url) -replace "https://storage.googleapis.com/","" -replace "/portal/index.html",""
& gcloud.cmd storage rsync -r portal "gs://$bucketName/portal"
& gcloud.cmd storage rsync -r media-wrappers "gs://$bucketName/media-wrappers"

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!                                    " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "HIS Portal (Custom Domain):   $customHis" -ForegroundColor Cyan
Write-Host "LMS Dashboard (Custom Domain):$customLms" -ForegroundColor Cyan
Write-Host "LRS xAPI (Custom Domain):     $customLrs" -ForegroundColor Cyan
Write-Host "`nDirect Cloud Run Services:" -ForegroundColor White
Write-Host "HIS Portal:                   $portalUrl" -ForegroundColor Gray
Write-Host "LMS Dashboard:                $nexusDashboard" -ForegroundColor Gray
Write-Host "LRS Endpoint:                 $lrsEndpoint" -ForegroundColor Gray
Write-Host "GCS Static Hosting Backup:    $gcsPortalUrl" -ForegroundColor Gray
