#!/usr/bin/env node

/**
 * Script to check burned email accounts and retrieve their tags from Email Bison
 * Outputs a CSV with email address, company tag, and provider tag
 */

const fs = require('fs');
const path = require('path');

const EMAIL_BISON_BASE_URL = 'https://send.maverickmarketingllc.com/api';
const EMAIL_BISON_API_KEY = '77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d';

// Company tags to look for
const COMPANY_TAGS = ['ScaledMail', 'CheapInboxes', 'Zapmail', 'Mailr'];
// Provider tags to look for
const PROVIDER_TAGS = ['Microsoft', 'Google', 'Outlook'];

/**
 * Make API request to Email Bison
 */
async function makeRequest(endpoint) {
  const url = `${EMAIL_BISON_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${EMAIL_BISON_API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.data?.message ||
      errorData.message ||
      `Email Bison API error: ${response.status}`
    );
  }

  const data = await response.json();
  return data;
}

/**
 * Get all workspaces from Email Bison
 */
async function getAllWorkspaces() {
  console.log('Fetching all workspaces from Email Bison...');
  const response = await makeRequest('/workspaces/v1.1');
  const workspaces = response.data || response;
  console.log(`Found ${workspaces.length} workspaces`);
  return workspaces;
}

/**
 * Get all sender emails globally (not filtered by workspace)
 */
async function getAllSenderEmails() {
  console.log('Fetching ALL sender emails from Email Bison (global, not filtered by workspace)...\n');

  const allEmails = [];
  let page = 1;
  let hasMore = true;
  const perPage = 100;

  while (hasMore) {
    console.log(`  Fetching page ${page}...`);

    // DON'T filter by team_id - get ALL emails globally
    const response = await makeRequest(`/sender-emails?per_page=${perPage}&page=${page}`);
    const emails = response.data || [];

    if (!emails || emails.length === 0) {
      hasMore = false;
    } else {
      allEmails.push(...emails);

      const meta = response.meta;
      if (meta && meta.last_page) {
        console.log(`    Page ${page}/${meta.last_page} - Got ${emails.length} emails`);
        hasMore = page < meta.last_page;
      } else {
        console.log(`    Page ${page} - Got ${emails.length} emails`);
        hasMore = emails.length === perPage;
      }

      page++;
    }
  }

  console.log(`\nTotal sender emails fetched: ${allEmails.length}`);
  return allEmails;
}

/**
 * Parse the input CSV file
 */
function parseInputCSV(filePath) {
  console.log(`Reading CSV file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Extract email addresses from each line (5th column, index 4)
  const emails = [];
  for (const line of lines) {
    // Split by comma, handling quoted fields
    const fields = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    if (fields.length > 4) {
      let email = fields[4].replace(/^"|"$/g, '').trim();
      // Remove any trailing commas
      email = email.replace(/,+$/, '');
      if (email && email.includes('@')) {
        emails.push(email);
      }
    }
  }

  console.log(`Found ${emails.length} email addresses in CSV`);
  return emails;
}

/**
 * Find tags for a specific email address
 */
function findEmailTags(emailAddress, allSenderEmails) {
  const senderEmail = allSenderEmails.find(se => se.email === emailAddress);

  if (!senderEmail || !senderEmail.tags) {
    return { companyTag: '', providerTag: '' };
  }

  const tagNames = senderEmail.tags.map(tag => tag.name);

  // Find company tag
  const companyTag = tagNames.find(tag =>
    COMPANY_TAGS.some(ct => tag.toLowerCase() === ct.toLowerCase())
  ) || '';

  // Find provider tag
  const providerTag = tagNames.find(tag =>
    PROVIDER_TAGS.some(pt => tag.toLowerCase() === pt.toLowerCase())
  ) || '';

  return { companyTag, providerTag };
}

/**
 * Main function
 */
async function main() {
  try {
    const inputFile = '/Users/mac/Downloads/inbox-placement-tests-b108d2f9-4a41-41e9-b140-33f96380194a - Sheet1.csv';
    const outputFile = '/Users/mac/Downloads/perf-spotlight-portal/burned-accounts-with-tags.csv';

    // Parse input CSV
    const burnedEmails = parseInputCSV(inputFile);

    // Fetch all sender emails from Email Bison
    const allSenderEmails = await getAllSenderEmails();

    // Create a map for faster lookup
    const emailMap = new Map();
    allSenderEmails.forEach(se => {
      emailMap.set(se.email.toLowerCase(), se);
    });

    // Process each burned email
    console.log('\nProcessing burned email accounts...');
    const results = [];
    let foundCount = 0;
    let notFoundCount = 0;

    for (const email of burnedEmails) {
      const senderEmail = emailMap.get(email.toLowerCase());

      if (senderEmail && senderEmail.tags) {
        const tagNames = senderEmail.tags.map(tag => tag.name);

        // Find company tag
        const companyTag = tagNames.find(tag =>
          COMPANY_TAGS.some(ct => tag.toLowerCase() === ct.toLowerCase())
        ) || 'N/A';

        // Find provider tag
        const providerTag = tagNames.find(tag =>
          PROVIDER_TAGS.some(pt => tag.toLowerCase() === pt.toLowerCase())
        ) || 'N/A';

        results.push({
          email,
          companyTag,
          providerTag,
          allTags: tagNames.join('; ')
        });

        foundCount++;
        console.log(`✓ ${email}: Company=${companyTag}, Provider=${providerTag}`);
      } else {
        results.push({
          email,
          companyTag: 'NOT_FOUND',
          providerTag: 'NOT_FOUND',
          allTags: 'Email not found in Email Bison'
        });
        notFoundCount++;
        console.log(`✗ ${email}: NOT FOUND in Email Bison`);
      }
    }

    // Generate output CSV
    console.log('\nGenerating output CSV...');
    const csvLines = ['Email,Company Tag,Provider Tag,All Tags'];

    for (const result of results) {
      const line = `"${result.email}","${result.companyTag}","${result.providerTag}","${result.allTags}"`;
      csvLines.push(line);
    }

    fs.writeFileSync(outputFile, csvLines.join('\n'));

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total burned emails: ${burnedEmails.length}`);
    console.log(`Found in Email Bison: ${foundCount}`);
    console.log(`Not found in Email Bison: ${notFoundCount}`);
    console.log(`Output file: ${outputFile}`);
    console.log('='.repeat(80));

    // Show tag statistics
    console.log('\nTAG STATISTICS:');
    const companyTagCounts = {};
    const providerTagCounts = {};

    results.forEach(r => {
      if (r.companyTag !== 'NOT_FOUND' && r.companyTag !== 'N/A') {
        companyTagCounts[r.companyTag] = (companyTagCounts[r.companyTag] || 0) + 1;
      }
      if (r.providerTag !== 'NOT_FOUND' && r.providerTag !== 'N/A') {
        providerTagCounts[r.providerTag] = (providerTagCounts[r.providerTag] || 0) + 1;
      }
    });

    console.log('\nCompany Tags:');
    Object.entries(companyTagCounts).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count}`);
    });

    console.log('\nProvider Tags:');
    Object.entries(providerTagCounts).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count}`);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
main();