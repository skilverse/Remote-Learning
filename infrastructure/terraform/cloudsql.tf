# COMPONENT_02: Cloud SQL Auto-scaling & PostgreSQL Persistence
# Primary Instance with Auto-resizing Storage & Phase 2 Read-Replica Pathway

resource "google_sql_database_instance" "lrs_primary" {
  name             = "${local.name_prefix}-pg-primary-${random_id.suffix.hex}"
  database_version = "POSTGRES_16"
  region           = var.region
  deletion_protection = false # Set to true for production

  settings {
    tier = var.db_instance_tier # Low-tier for Phase 1 testing (e.g. db-custom-1-3840)
    
    # Auto-scaling Storage Configuration
    disk_type             = "PD_SSD"
    disk_size             = var.db_disk_size_gb
    disk_autoresize       = true
    disk_autoresize_limit = var.db_disk_autoresize_limit_gb

    availability_type = "ZONAL" # Zonal for POC cost savings, REGIONAL for Phase 2 HA

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
      record_client_address   = false # Compliant with privacy goals
    }

    ip_configuration {
      ipv4_enabled    = true # Direct or Cloud SQL Auth Proxy access
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    database_flags {
      name  = "max_connections"
      value = "50"
    }
  }

  depends_on = [google_project_service.services]
}

# Trax LRS PostgreSQL Database
resource "google_sql_database" "trax_db" {
  name     = var.db_name
  instance = google_sql_database_instance.lrs_primary.name
}

# Database User
resource "google_sql_user" "trax_user" {
  name     = var.db_user
  instance = google_sql_database_instance.lrs_primary.name
  password = var.db_password
}

# ---------------------------------------------------------------------------------
# PHASE 2 ARCHITECTURE PATHWAY: Horizontal Read-Replica
# Activated via enable_read_replica = true to offload high-concurrency read queries
# ---------------------------------------------------------------------------------
resource "google_sql_database_instance" "lrs_read_replica" {
  count                = var.enable_read_replica ? 1 : 0
  name                 = "${local.name_prefix}-pg-replica-${random_id.suffix.hex}"
  master_instance_name = google_sql_database_instance.lrs_primary.name
  database_version     = "POSTGRES_16"
  region               = var.region
  deletion_protection  = false

  settings {
    tier                  = var.db_instance_tier
    disk_type             = "PD_SSD"
    disk_size             = var.db_disk_size_gb
    disk_autoresize       = true
    disk_autoresize_limit = var.db_disk_autoresize_limit_gb

    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }
  }
}
