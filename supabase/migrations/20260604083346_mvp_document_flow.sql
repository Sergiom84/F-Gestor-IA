create unique index processing_jobs_active_document_job_unique
  on public.processing_jobs (document_id, job_type)
  where document_id is not null
    and status in ('queued', 'running', 'retrying');

create unique index invoices_source_extraction_active_unique
  on public.invoices (source_extraction_id)
  where source_extraction_id is not null
    and deleted_at is null;
