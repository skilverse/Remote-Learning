output "trax_lrs_url" {
  description = "Base URL for the Trax LRS Cloud Run service"
  value       = google_cloud_run_v2_service.trax_lrs.uri
}

output "trax_lrs_xapi_endpoint" {
  description = "xAPI Statement Endpoint URL to inject into Articulate 360 and Media Wrappers"
  value       = "${google_cloud_run_v2_service.trax_lrs.uri}/xapi/"
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
