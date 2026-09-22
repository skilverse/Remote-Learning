output "trax_lrs_url" {
  description = "Base URL for the Trax LRS Cloud Run service"
  value       = google_cloud_run_v2_service.trax_lrs.uri
}

output "trax_lrs_xapi_endpoint" {
  description = "xAPI Statement Endpoint URL to inject into Articulate 360 and Media Wrappers"
  value       = "${google_cloud_run_v2_service.trax_lrs.uri}/xapi/"
}

output "mock_nexus_url" {
  description = "Base URL for the Learning Nexus LMS Cloud Run service"
  value       = google_cloud_run_v2_service.mock_nexus.uri
}

output "mock_nexus_dashboard_url" {
  description = "Public dashboard URL for Learning Nexus LMS"
  value       = "${google_cloud_run_v2_service.mock_nexus.uri}/dashboard.html"
}

output "his_portal_url" {
  description = "Base URL for the HIS Clinical Portal Cloud Run service"
  value       = google_cloud_run_v2_service.his_portal.uri
}

output "custom_domain_his" {
  description = "Custom Domain for HIS Portal"
  value       = "https://${var.domain_his}/portal/index.html"
}

output "custom_domain_lms" {
  description = "Custom Domain for Learning Nexus LMS Dashboard"
  value       = "https://${var.domain_lms}/dashboard.html"
}

output "custom_domain_lrs" {
  description = "Custom Domain for xAPI LRS Endpoint"
  value       = "https://${var.domain_lrs}/xapi/"
}

output "portal_launch_url" {
  description = "Public URL for the Web Portal hosted on Google Cloud Storage"
  value       = "https://storage.googleapis.com/${google_storage_bucket.static_hosting.name}/portal/index.html"
}

output "cloudsql_connection_name" {
  description = "Cloud SQL primary instance connection name"
  value       = google_sql_database_instance.lrs_primary.connection_name
}

output "data_bridge_trigger_uri" {
  description = "Target URI triggered by Cloud Scheduler for the Data Bridge Cloud Function"
  value       = google_cloudfunctions2_function.data_bridge.service_config[0].uri
}
