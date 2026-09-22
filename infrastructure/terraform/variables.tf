variable "project_id" {
  description = "The GCP Project ID for the LRS Pipeline deployment"
  type        = string
  default     = "lrs-pipeline-poc"
}

variable "region" {
  description = "GCP primary region for serverless compute and databases"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment stage (poc, staging, prod)"
  type        = string
  default     = "poc"
}

# Cloud SQL PostgreSQL Configuration
variable "db_instance_tier" {
  description = "Cloud SQL machine tier (db-custom-1-3840 for standard, or db-f1-micro for low-cost POC)"
  type        = string
  default     = "db-custom-1-3840"
}

variable "db_disk_size_gb" {
  description = "Initial storage disk size in GB"
  type        = number
  default     = 20
}

variable "db_disk_autoresize_limit_gb" {
  description = "Maximum storage limit for Cloud SQL auto-resizing"
  type        = number
  default     = 1000
}

variable "db_name" {
  description = "Trax LRS PostgreSQL database name"
  type        = string
  default     = "trax_lrs"
}

variable "db_user" {
  description = "Database username for Trax LRS application"
  type        = string
  default     = "trax_app"
}

variable "db_password" {
  description = "Database password for Trax LRS (recommend managing via Secret Manager in prod)"
  type        = string
  sensitive   = true
  default     = "ChangeMeInGCPSecretManager2026!"
}

variable "enable_read_replica" {
  description = "Phase 2 architecture flag: toggle horizontal read-replica for high concurrency"
  type        = bool
  default     = false
}

# Cloud Run Configuration
variable "trax_image_uri" {
  description = "Artifact Registry or Container Registry URI for the Trax LRS image"
  type        = string
  default     = "gcr.io/cloudrun/hello" # Placeholder to be overridden with custom build
}

variable "min_instances" {
  description = "Minimum instances for Cloud Run (0 for scale-to-zero cost optimization in POC)"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum instances for Cloud Run"
  type        = number
  default     = 10
}

# Learning Nexus Integration
variable "nexus_api_url" {
  description = "Target REST API endpoint for Learning Nexus completions"
  type        = string
  default     = "https://nexus.hospital.org/api/v1/completions"
}

variable "nexus_api_key" {
  description = "API authentication bearer token for Learning Nexus"
  type        = string
  sensitive   = true
  default     = "nexus_sec_key_poc_2026"
}
