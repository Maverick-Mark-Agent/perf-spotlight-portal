import pg from 'pg';

const { Client } = pg;

async function applyMigration() {
  console.log('🔧 Applying flexible CSV migration directly to database...\n');

  const client = new Client({
    host: 'aws-0-us-west-1.pooler.supabase.com',
    port: 6543,
    user: 'postgres.gjqbbgrfhijescaouqkx',
    password: 'Maverick2024!',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const statements = [
      {
        name: 'Add extra_fields to raw_contacts',
        sql: `ALTER TABLE public.raw_contacts ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}'::jsonb;`
      },
      {
        name: 'Add csv_column_mapping to raw_contacts',
        sql: `ALTER TABLE public.raw_contacts ADD COLUMN IF NOT EXISTS csv_column_mapping JSONB;`
      },
      {
        name: 'Drop old email constraint',
        sql: `ALTER TABLE public.raw_contacts DROP CONSTRAINT IF EXISTS valid_email;`
      },
      {
        name: 'Add flexible email constraint',
        sql: `ALTER TABLE public.raw_contacts ADD CONSTRAINT valid_email_if_present CHECK (email IS NULL OR email ~ '^[^@]+@[^@]+\.[^@]+$');`
      },
      {
        name: 'Add GIN index on extra_fields',
        sql: `CREATE INDEX IF NOT EXISTS idx_raw_contacts_extra_fields ON public.raw_contacts USING GIN (extra_fields);`
      },
      {
        name: 'Add comment on extra_fields',
        sql: `COMMENT ON COLUMN public.raw_contacts.extra_fields IS 'JSONB storage for any CSV columns that don''t map to standard fields';`
      },
      {
        name: 'Add comment on csv_column_mapping',
        sql: `COMMENT ON COLUMN public.raw_contacts.csv_column_mapping IS 'Maps original CSV column names to database fields for audit trail';`
      },
      {
        name: 'Add extra_fields to verified_contacts',
        sql: `ALTER TABLE public.verified_contacts ADD COLUMN IF NOT EXISTS extra_fields JSONB DEFAULT '{}'::jsonb;`
      },
      {
        name: 'Add GIN index on verified_contacts extra_fields',
        sql: `CREATE INDEX IF NOT EXISTS idx_verified_contacts_extra_fields ON public.verified_contacts USING GIN (extra_fields);`
      },
      {
        name: 'Add comment on verified_contacts extra_fields',
        sql: `COMMENT ON COLUMN public.verified_contacts.extra_fields IS 'JSONB storage for extra CSV fields carried forward from raw_contacts';`
      }
    ];

    for (const statement of statements) {
      console.log(`⚙️  ${statement.name}...`);
      try {
        await client.query(statement.sql);
        console.log(`   ✅ Success\n`);
      } catch (error: any) {
        if (error.code === '42710') {
          console.log(`   ⚠️  Already exists (skipping)\n`);
        } else if (error.code === '42P07') {
          console.log(`   ⚠️  Already exists (skipping)\n`);
        } else {
          console.error(`   ❌ Error: ${error.message}\n`);
          throw error;
        }
      }
    }

    console.log('✅ Migration applied successfully!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

applyMigration().catch(console.error);
