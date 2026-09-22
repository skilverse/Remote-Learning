# Google Cloud Run Services for LRS, LMS, and HIS Portal

# 1. Trax LRS (xAPI 1.0.3 Statement Ingestion Engine)
resource "google_cloud_run_v2_service" "trax_lrs" {
  name     = "${local.name_prefix}-trax-lrs"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.trax_image_uri

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
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

resource "google_cloud_run_v2_service_iam_member" "trax_lrs_public" {
  project  = google_cloud_run_v2_service.trax_lrs.project
  location = google_cloud_run_v2_service.trax_lrs.location
  name     = google_cloud_run_v2_service.trax_lrs.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 2. Learning Nexus LMS Registry & Dashboard Service
resource "google_cloud_run_v2_service" "mock_nexus" {
  name     = "${local.name_prefix}-mock-nexus"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.nexus_image_uri

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      env {
        name  = "NEXUS_API_KEY"
        value = var.nexus_api_key
      }

      ports {
        container_port = 8080
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service_iam_member" "mock_nexus_public" {
  project  = google_cloud_run_v2_service.mock_nexus.project
  location = google_cloud_run_v2_service.mock_nexus.location
  name     = google_cloud_run_v2_service.mock_nexus.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 3. HIS Web Portal & Media Wrappers Service
resource "google_cloud_run_v2_service" "his_portal" {
  name     = "${local.name_prefix}-his-portal"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.portal_image_uri

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      ports {
        container_port = 8080
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service_iam_member" "his_portal_public" {
  project  = google_cloud_run_v2_service.his_portal.project
  location = google_cloud_run_v2_service.his_portal.location
  name     = google_cloud_run_v2_service.his_portal.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 4. Custom Domain Mappings (his.lxdhq.in, lms.lxdhq.in, lrs.lxdhq.in)
resource "google_cloud_run_domain_mapping" "his_domain" {
  count    = var.enable_custom_domains ? 1 : 0
  location = var.region
  name     = var.domain_his

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.his_portal.name
  }

  depends_on = [google_cloud_run_v2_service.his_portal]
}

resource "google_cloud_run_domain_mapping" "lms_domain" {
  count    = var.enable_custom_domains ? 1 : 0
  location = var.region
  name     = var.domain_lms

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.mock_nexus.name
  }

  depends_on = [google_cloud_run_v2_service.mock_nexus]
}

resource "google_cloud_run_domain_mapping" "lrs_domain" {
  count    = var.enable_custom_domains ? 1 : 0
  location = var.region
  name     = var.domain_lrs

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.trax_lrs.name
  }

  depends_on = [google_cloud_run_v2_service.trax_lrs]
}
