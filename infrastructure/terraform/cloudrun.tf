# Google Cloud Run Service: Trax LRS Serverless Container Runtime

resource "google_cloud_run_v2_service" "trax_lrs" {
  name     = "${local.name_prefix}-trax-lrs"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = var.min_instances # 0 for scale-to-zero in POC
      max_instance_count = var.max_instances
    }

    containers {
      image = var.trax_image_uri

      resources {
        limits = {
          cpu    = "2000m"
          memory = "2048Mi" # Minimum recommended memory for Trax LRS PHP execution
        }
      }

      env {
        name  = "APP_ENV"
        value = "production"
      }
      env {
        name  = "APP_DEBUG"
        value = "false"
      }
      env {
        name  = "DB_CONNECTION"
        value = "pgsql"
      }
      env {
        name  = "DB_HOST"
        value = "127.0.0.1"
      }
      env {
        name  = "DB_PORT"
        value = "5432"
      }
      env {
        name  = "DB_SOCKET"
        value = "/cloudsql/${google_sql_database_instance.lrs_primary.connection_name}"
      }
      env {
        name  = "DB_DATABASE"
        value = var.db_name
      }
      env {
        name  = "DB_USERNAME"
        value = var.db_user
      }
      env {
        name  = "DB_PASSWORD"
        value = var.db_password
      }

      ports {
        container_port = 8080
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.lrs_primary.connection_name]
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_sql_database_instance.lrs_primary,
    google_sql_database.trax_db,
    google_sql_user.trax_user
  ]
}

# Phase 1: Allow public unauthenticated invocation for proof-of-concept testing
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = google_cloud_run_v2_service.trax_lrs.project
  location = google_cloud_run_v2_service.trax_lrs.location
  name     = google_cloud_run_v2_service.trax_lrs.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
