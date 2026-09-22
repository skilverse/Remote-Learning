# Frontend Distribution: Google Cloud Storage (GCS Static Web Hosting)

resource "google_storage_bucket" "static_hosting" {
  name          = "${local.name_prefix}-frontend-${random_id.suffix.hex}"
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true

  website {
    main_page_suffix = "portal/index.html"
    not_found_page   = "portal/index.html"
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "POST", "OPTIONS"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# Grant public read access to static assets for Phase 1 distribution
resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.static_hosting.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
