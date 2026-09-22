variable "project_id" {
  description = "The GCP Project ID for the LRS Pipeline deployment"
  type        = string
  default     = "diesel-cat-509409-e5"
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
  description = "Cloud SQL machine tier (db-f1-micro for low-cost POC)"
  type        = string
  default     = "db-f1-micro"
}

variable "db_disk_size_gb" {
  description = "Initial storage disk size in GB"
  type        = number
  default     = 10
}

variable "db_disk_autoresize_limit_gb" {
  description = "Maximum storage limit for Cloud SQL auto-resizing"
  type        = number
  default     = 50
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
  description = "Artifact Registry URI for the Trax LRS image"
  type        = string
  default     = "us-central1-docker.pkg.dev/diesel-cat-509409-e5/lrs-containers/trax-lrs:latest"
}

variable "nexus_image_uri" {
  description = "Artifact Registry URI for the Learning Nexus LMS image"
  type        = string
  default     = "us-central1-docker.pkg.dev/diesel-cat-509409-e5/lrs-containers/mock-nexus:latest"
}

variable "portal_image_uri" {
  description = "Artifact Registry URI for the HIS Web Portal image"
  type        = string
  default     = "us-central1-docker.pkg.dev/diesel-cat-509409-e5/lrs-containers/his-portal:latest"
}

variable "min_instances" {
  description = "Minimum instances for Cloud Run (0 for scale-to-zero cost optimization in POC)"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum instances for Cloud Run"
  type        = number
  default     = 5
}

# Learning Nexus Integration
variable "nexus_api_key" {
  description = "API authentication bearer token for Learning Nexus"
  type        = string
  sensitive   = true
  default     = "nexus_sec_key_poc_2026"
}

# Custom Domains for lxdhq.in
variable "domain_his" {
  description = "Custom domain for HIS Portal"
  type        = string
  default     = "his.lxdhq.in"
}

variable "domain_lms" {
  description = "Custom domain for LMS Registry & Dashboard"
  type        = string
  default     = "lms.lxdhq.in"
}

variable "domain_lrs" {
  description = "Custom domain for xAPI LRS Endpoint"
  type        = string
  default     = "lrs.lxdhq.in"
}

variable "enable_custom_domains" {
  description = "Whether to provision Cloud Run Domain Mappings for lxdhq.in"
  type        = bool
  default     = true
}
