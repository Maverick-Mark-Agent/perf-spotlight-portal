import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  console.log('=== Checking Supabase Storage for Contact Uploads ===\n');

  // List all buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  if (bucketsError) {
    console.error('Error listing buckets:', bucketsError);
    return;
  }

  console.log('Available storage buckets:');
  buckets?.forEach(bucket => {
    console.log(`  - ${bucket.name} (public: ${bucket.public})`);
  });

  // Check each bucket
  if (buckets) {
    for (const bucket of buckets) {
      console.log(`\n\n=== Bucket: ${bucket.name} ===`);

      const { data: files, error } = await supabase.storage
        .from(bucket.name)
        .list('', {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.log(`  Error: ${error.message}`);
        continue;
      }

      if (!files || files.length === 0) {
        console.log(`  (empty)`);
        continue;
      }

      console.log(`  Found ${files.length} items:\n`);

      files.slice(0, 20).forEach(file => {
        const size = file.metadata?.size ? `${(file.metadata.size / 1024).toFixed(2)} KB` : 'folder';
        const created = file.created_at || 'unknown';
        console.log(`    📄 ${file.name}`);
        console.log(`       Size: ${size}, Created: ${created}`);
      });

      // If there are folders, check inside them
      const folders = files.filter(f => !f.name.includes('.'));
      for (const folder of folders.slice(0, 5)) {
        console.log(`\n    📁 Checking folder: ${folder.name}`);
        const { data: folderFiles } = await supabase.storage
          .from(bucket.name)
          .list(folder.name, { limit: 20 });

        if (folderFiles && folderFiles.length > 0) {
          folderFiles.forEach(f => {
            const size = f.metadata?.size ? `${(f.metadata.size / 1024).toFixed(2)} KB` : '';
            console.log(`       - ${f.name} (${size})`);
          });
        }
      }
    }
  }

  // Look for Kim Wallace specifically
  console.log('\n\n=== Searching for Kim Wallace files ===');
  if (buckets) {
    for (const bucket of buckets) {
      const { data: files } = await supabase.storage
        .from(bucket.name)
        .list('', { limit: 1000 });

      if (files) {
        const kimFiles = files.filter(f =>
          f.name.toLowerCase().includes('kim') ||
          f.name.toLowerCase().includes('wallace')
        );

        if (kimFiles.length > 0) {
          console.log(`\n  Found in bucket "${bucket.name}":`);
          kimFiles.forEach(f => {
            console.log(`    - ${f.name}`);
          });
        }
      }
    }
  }
}

checkStorage().catch(console.error);
