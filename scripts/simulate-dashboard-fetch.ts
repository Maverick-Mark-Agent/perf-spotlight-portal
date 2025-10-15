import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function simulateDashboardFetch() {
  // Test what the dashboard would fetch for different months
  const months = ['2025-10', '2025-11', '2025-12'];

  for (const month of months) {
    console.log(`\n=== Month: ${month} ===`);

    // Simulate the dashboard query (same as line 75-88 in ZipDashboard.tsx)
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("client_zipcodes")
        .select("zip,state,client_name,workspace_name,agency_color")
        .eq("month", month)
        .range(from, from + pageSize - 1);

      if (error) {
        console.error('Error:', error);
        break;
      }

      if (!data || data.length === 0) break;

      allData = allData.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    console.log(`Total ZIPs fetched: ${allData.length}`);

    // Filter for Gregg Blanchard
    const greggZips = allData.filter(z => z.client_name === 'Gregg Blanchard');
    console.log(`Gregg Blanchard ZIPs: ${greggZips.length}`);

    if (greggZips.length > 0) {
      console.log('Sample Gregg ZIP:', greggZips[0]);
      console.log('Agency color:', greggZips[0].agency_color);
    }

    // Calculate stats like the dashboard does (line 99-129)
    const agencies = new Map();
    let unassigned = 0;

    allData.forEach((zip) => {
      if (!zip.agency_color) {
        unassigned++;
        return;
      }

      const key = zip.client_name;
      if (!agencies.has(key)) {
        agencies.set(key, {
          client_name: zip.client_name,
          workspace_name: zip.workspace_name,
          agency_color: zip.agency_color,
          zipCount: 0,
        });
      }
      agencies.get(key).zipCount++;
    });

    const stats = {
      total: allData.length,
      assigned: allData.length - unassigned,
      unassigned,
      agencies: Array.from(agencies.values()).sort(
        (a, b) => b.zipCount - a.zipCount
      ),
    };

    console.log(`Stats:`, {
      total: stats.total,
      assigned: stats.assigned,
      unassigned: stats.unassigned,
      agencyCount: stats.agencies.length
    });

    // Check if Gregg Blanchard is in the agencies list
    const greggAgency = stats.agencies.find(a => a.client_name === 'Gregg Blanchard');
    if (greggAgency) {
      console.log('Gregg Blanchard in agencies list:', greggAgency);
    } else {
      console.log('Gregg Blanchard NOT in agencies list');
    }
  }
}

simulateDashboardFetch();
