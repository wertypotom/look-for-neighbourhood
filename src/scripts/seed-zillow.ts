import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { supabase } from '../services/supabase.client';

interface ZillowRow {
  RegionName: string; // ZIP Code
  [key: string]: string; // Dynamic date columns (e.g., "2024-01-31")
}

const seedZillow = async () => {
  const csvPath = path.join(__dirname, '../../data/zillow_rent.csv');
  console.log(`[Seed] Looking for Zillow CSV at: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error('❌ Error: `data/zillow_rent.csv` not found!');
    console.error(
      'Please download the ZORI (Zip Code) CSV from Zillow Research and place it there.',
    );
    process.exit(1);
  }

  const parser = fs.createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
    }),
  );

  let processedCount = 0;
  let batch: { zip_code: string; median_rent: number }[] = [];
  const BATCH_SIZE = 500;

  console.log('[Seed] Beginning parse...');

  for await (const row of parser) {
    const record = row as ZillowRow;
    const zipCode = record.RegionName;

    // The CSV structure normally has dates as columns increasing chronologically.
    // We want the most recent data point (the last non-empty column).
    const entries = Object.entries(record);
    let mostRecentRent = 0;

    // Scan backwards from the last column looking for a valid number
    for (let i = entries.length - 1; i >= 0; i--) {
      const colName = entries[i][0];
      const val = entries[i][1];

      // Check if the column looks like a date format (e.g. YYYY-MM-DD)
      if (colName.match(/^\d{4}-\d{2}-\d{2}$/) && val && !isNaN(Number(val))) {
        mostRecentRent = Math.round(Number(val));
        break;
      }
    }

    if (mostRecentRent > 0 && zipCode) {
      batch.push({
        zip_code: zipCode,
        median_rent: mostRecentRent,
      });

      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch);
        processedCount += batch.length;
        batch = []; // reset
      }
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await flushBatch(batch);
    processedCount += batch.length;
  }

  console.log(
    `✅ [Seed] Finished! Inserted/Updated ${processedCount} ZIP codes.`,
  );
  process.exit(0);
};

const flushBatch = async (
  batch: { zip_code: string; median_rent: number }[],
) => {
  const { error } = await supabase
    .from('rent_data')
    .upsert(batch, { onConflict: 'zip_code' });
  if (error) {
    console.error(`[Seed] Error inserting batch:`, error.message);
  } else {
    console.log(`[Seed] Upserted batch of ${batch.length} rows...`);
  }
};

// Execute
seedZillow().catch((err) => {
  console.error('[Seed] Unhandled Error:', err);
  process.exit(1);
});
