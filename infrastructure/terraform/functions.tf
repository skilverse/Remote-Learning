# COMPONENT_03: Data Bridge Interface - Cloud Functions & Cloud Scheduler

# Bucket for Cloud Function Source Code
resource "google_storage_bucket" "function_source" {
  name                        = "${local.name_prefix}-fn-source-${random_id.suffix.hex}"
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true
}

# Source Code Archive for Data Bridge
data "archive_file" "data_bridge_zip" {
  type        = "zip"
  output_path = "${path.module}/data-bridge.zip"
  source_dir  = "${path.module}/../../data-bridge"
}

resource "google_storage_bucket_object" "data_bridge_package" {
  name   = "data-bridge-${data.archive_file.data_bridge_zip.output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.data_bridge_zip.output_path
}

# Cloud Function (2nd Gen)
resource "google_cloudfunctions2_function" "data_bridge" {
  name        = "${local.name_prefix}-data-bridge"
  location    = var.region
  description = "COMPONENT_03: Polls Trax LRS for completed statements and syncs to Learning Nexus REST API"

  build_config {
    runtime     = "nodejs20"
    entry_point = "dataBridgeHttpEntry"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.data_bridge_package.name
      }
    }
  }

  service_config {
    max_instance_count = 3
    min_instance_count = 0
    available_memory   = "512Mi"
    timeout_seconds    = 120

    environment_variables = {
      LRS_ENDPOINT  = "${google_cloud_run_v2_service.trax_lrs.uri}/xapi/"
      LRS_AUTH      = "Basic cG9jX3VzZXI6cG9jX3Bhc3M="
      NEXUS_API_URL = "${google_cloud_run_v2_service.mock_nexus.uri}/api/v1/completions"
      NEXUS_API_KEY = var.nexus_api_key
    }
  }

  depends_on = [
    google_cloud_run_v2_service.trax_lrs,
    google_cloud_run_v2_service.mock_nexus
  ]
}

# Cloud Scheduler: Periodic Polling Trigger (Every 2 minutes)
resource "google_cloud_scheduler_job" "data_bridge_trigger" {
  name             = "${local.name_prefix}-bridge-trigger"
  description      = "Periodic trigger for Data Bridge LRS statement poller"
  schedule         = "*/2 * * * *"
  time_zone        = "Etc/UTC"
  attempt_deadline = "180s"

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions2_function.data_bridge.service_config[0].uri

    oidc_token {
      service_account_email = google_service_account.scheduler_sa.email
    }
  }
}

# Service Account for Scheduler
resource "google_service_account" "scheduler_sa" {
  account_id   = "lrs-scheduler-sa"
  display_name = "Cloud Scheduler Service Account for LRS Data Bridge"
}

resource "google_cloud_run_v2_service_iam_member" "scheduler_invoker" {
  project  = google_cloudfunctions2_function.data_bridge.project
  location = google_cloudfunctions2_function.data_bridge.location
  name     = google_cloudfunctions2_function.data_bridge.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_sa.email}"
}
