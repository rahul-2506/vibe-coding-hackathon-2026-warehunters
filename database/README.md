# ReviewLens Database Schema Management

This folder contains all structural definitions, migrations, indices, triggers, and seed files for the ReviewLens PostgreSQL Database.

## Authoritative Schema Source of Truth

The single authoritative source of truth for the database layout is:
👉 **[master_schema.sql](file:///c:/Users/acer/Desktop/reviewlenszip1/database/master_schema.sql)**

Any structural changes should be made to `master_schema.sql` directly, and incremental schema adjustments should be placed in `database/migrations/` to retain a historical record.

## Folder Directory Structure

```text
database/
├── master_schema.sql         # Authoritative Master Database Schema
├── README.md                 # Database management documentation (this file)
└── migrations/               # Incremental change files and repair scripts
    ├── compare_schema.sql
    ├── consolidated_repair.sql
    ├── create_knowledge_base.sql
    ├── feedbacks_schema.sql
    ├── repair_supabase_schema.sql
    └── standardize_reviews.sql
```

## Migration Instructions

For new deployments or Supabase repairs:
1. Load extensions (e.g. pgvector, uuid-ossp).
2. Execute **`master_schema.sql`** to recreate the full suite of tables, triggers, indexes, and RLS policies.
3. Import seed datasets (e.g., `skincare_data.sql`, `knowledge_data.sql`, `reviews_seed.json`) to populate baseline values.
