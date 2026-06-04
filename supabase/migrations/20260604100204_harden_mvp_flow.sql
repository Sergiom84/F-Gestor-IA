create unique index if not exists review_tasks_active_document_reason_unique
  on public.review_tasks (document_id, coalesce(reason, ''))
  where status in ('open', 'in_review');

create unique index if not exists review_tasks_active_document_extraction_unique
  on public.review_tasks (document_id, extraction_id)
  where extraction_id is not null
    and status in ('open', 'in_review');
