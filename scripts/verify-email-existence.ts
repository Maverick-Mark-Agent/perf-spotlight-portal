import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const WORKSPACE_URLS: { [key: string]: string } = {
  'Maverick': 'https://send.maverickmarketingllc.com',
  'Long Run': 'https://send.longrun.agency',
};

const DAMAGED_EMAILS = [
  'a.williams@alexwilliamspro.com',
  'a.williams@goalexwilliams.com',
  'a.williams@homepolicyadvisors.info',
  'a.williams@homepolicyagency.info',
  'a.williams@homepolicyinsure.info',
  'a.williams@homepolicyservices.info',
  'a.williams@nicksakhainsuranceexperts.com',
  'a.williams@nicksakhainsurancerisk.com',
  'alex.w@alexwilliamsagency.com',
  'alex.w@awinsurancefirm.com',
  'alex.w@premierinsuregroup.com',
  'alex.w@reliablebenefitplans.com',
  'alex.williams@alexwilliamshelp.com',
  'alex.williams@alexwilliamsplans.com',
  'alex.williams@alexwilliamsserves.com',
  'alex.williams@awinsurancefirm.com',
  'alex.williams@findalexwilliams.com',
  'alex.williams@goalexwilliams.com',
  'alex.williams@homepolicyadvisors.info',
  'alex.williams@homepolicyagency.info',
  'alex.williams@homepolicyinsure.info',
  'alex.williams@homepolicyservices.info',
  'alex@suresafepolicies.com',
  'alexwilliams@alexwilliamsbiz.com',
  'alexwilliams@alexwilliamsconnect.com',
  'alexwilliams@alexwilliamsproperty.com',
  'alexwilliams@alexwilliamsserves.com',
  'alexwilliams@homepolicyagency.info',
  'alexwilliams@homepolicyservices.info',
  'alexwilliams@homepolicyusa.info',
  'alexwilliams@topalexwilliams.com',
  'alyssewilliams@therossmanmediamarketing.com',
  'amy.williams@nicksakhainsuranceportal.com',
  'amywilliams@nicksakhainsurancegroup.com',
  'david.amiri@davidamiriquotes.com',
  'davidamiri@davidamiriinsurance.com',
  'j.schroder@fastjeffschroder.com',
  'j.schroder@getjeffschroder.com',
  'j.schroder@jeffschroderexperts.com',
  'j.schroder@jeffschroderservices.com',
  'j.schroder@jeffschrodersolutions.com',
  'j.schroder@jeffschroderzone.com',
  'j.schroder@quickjeffschroder.com',
  'j.schroder@safejeffschroder.com',
  'j.schwartz@agentfarmersexpert.com',
  'j.schwartz@agentfarmersservices.com',
  'j.schwartz@agentfarmersusa.com',
  'j.schwartz@agentsfarmersco.com',
  'j.schwartz@agentsfarmerscorp.com',
  'j.schwartz@agentsfarmershelp.com',
  'j.schwartz@agentsfarmersincs.com',
  'j.schwartz@agentsfarmersllc.com',
  'j.schwartz@agentsfarmersltd.com',
  'j.schwartz@agentsfarmersltds.com',
  'j.schwartz@agentsfarmerspro.com',
  'j.schwartz@agentsfarmerssupport.com',
  'j.schwartz@agentsfarmersteam.com',
  'j.schwartz@agentsfarmersusa.com',
  'j.schwartz@theagentsfarmersinc.com',
  'jason_binyon@bestbinyonagency.com',
  'jason-binyon@bestbinyonagency.com',
  'jason.b@binyonagency.com',
  'jason.b@binyonagencyco.com',
  'jason.b@binyonagencyllc.com',
  'jason.b@binyonagencyltd.com',
  'jason.b@brilliantinsurancecorp.com',
  'jason.b@brilliantinsuranceincs.com',
  'jason.binyon@bestbinyonagency.com',
  'jason.binyon@binyonagency.com',
  'jason.binyon@binyonagencycorp.com',
  'jason.binyon@binyonagencyincs.com',
  'jason.binyon@binyonagencyllcs.com',
  'jason.binyon@binyonagencyltd.com',
  'jason.binyon@brilliantinsurancecorp.com',
  'jason.binyon@brilliantinsuranceincs.com',
  'jason.binyon@brilliantinsuranceltd.com',
  'jason.binyon@brilliantinsuranceltds.com',
  'jason.binyon@thebinyonagencyllc.com',
  'jasonbinyon@bestbinyonagency.com',
  'jasonbinyon@binyonagencyco.com',
  'jasonbinyon@binyonagencycorp.com',
  'jasonbinyon@binyonagencyincs.com',
  'jasonbinyon@binyonagencyllcs.com',
  'jasonbinyon@binyonagencyltd.com',
  'jasonbinyon@brilliantinsuranceco.com',
  'jasonbinyon@brilliantinsurancecorp.com',
  'jasonbinyon@brilliantinsuranceincs.com',
  'jasonbinyon@brilliantinsuranceltds.com',
  'jasonbinyon@thebinyonagency.com',
  'jasonbinyon@thebinyonagencyllcs.com',
  'jeff.schroder@fastjeffschroder.com',
  'jeff.schroder@getjeffschroder.com',
  'jeff.schroder@jeffschroder.com',
  'jeff.schroder@jeffschroderexperts.com',
  'jeff.schroder@jeffschrodergroup.com',
  'jeff.schroder@jeffschroderpros.com',
  'jeff.schroder@jeffschroderservices.com',
  'jeff.schroder@jeffschrodersolutions.com',
  'jeff.schroder@jeffschroderzone.com',
  'jeff.schroder@quickjeffschroder.com',
  'jeff.schroder@topjeffschroder.com',
  'jeffschroder@bestjeffschroder.com',
  'jeffschroder@fastjeffschroder.com',
  'jeffschroder@jeffschroder.com',
  'jeffschroder@jeffschroderagency.com',
  'jeffschroder@jeffschroderpros.com',
  'jeffschroder@quickjeffschroder.com',
  'jeffschroder@safejeffschroder.com',
  'jessica.schwartz@agentfarmersexpert.com',
  'jessica.schwartz@agentfarmerspros.com',
  'jessica.schwartz@agentfarmersservices.com',
  'jessica.schwartz@agentfarmersusa.com',
  'jessica.schwartz@agentsfarmershelp.com',
  'jessica.schwartz@agentsfarmershub.com',
  'jessica.schwartz@agentsfarmersinfo.com',
  'jessica.schwartz@agentsfarmersllc.com',
  'jessica.schwartz@agentsfarmersltd.com',
  'jessica.schwartz@agentsfarmerspro.com',
  'jessica.schwartz@agentsfarmerssupport.com',
  'jessica.schwartz@agentsfarmersteam.com',
  'jessica.schwartz@agentsfarmersusa.com',
  'jessica.schwartz@theagentsfarmersinc.com',
  'jessicaschwartz@agentfarmersexpert.com',
  'jessicaschwartz@agentfarmershelp.com',
  'jessicaschwartz@agentfarmersservices.com',
  'jessicaschwartz@agentfarmersusa.com',
  'jessicaschwartz@agentsfarmersco.com',
  'jessicaschwartz@agentsfarmershelp.com',
  'jessicaschwartz@agentsfarmersincs.com',
  'jessicaschwartz@agentsfarmersltd.com',
  'jessicaschwartz@agentsfarmerspro.com',
  'jessicaschwartz@agentsfarmerssupport.com',
  'jessicaschwartz@agentsfarmersteam.com',
  'jessicaschwartz@theagentsfarmersil.com',
  'jessicaschwartz@theagentsfarmersinc.com',
  'jessicaschwartz@theagentsfarmersusa.com',
  'joanroberts@johnrobertsshield.com',
  'joanroberts@lifejohnroberts.com',
  'kim.w@trykimwallace.com',
  'kim.w@wallaceagencyplus.com',
  'kim.w@wallaceagencyquick.com',
  'kim.wallace@covermyhousekim.com',
  'kim.wallace@getkimwallace.com',
  'kim.wallace@insurancebykimwallace.com',
  'kim.wallace@kimwallace-customcoverage.com',
  'kim.wallace@kimwallace-homeadvisor.com',
  'kim.wallace@kimwallace-insuranceagency.com',
  'kim.wallace@kimwallace-insureshomes.com',
  'kim.wallace@kimwallace-protection.com',
  'kim.wallace@kimwallaceagency.com',
  'kim.wallace@kimwallaceagent.com',
  'kim.wallace@kimwallaceassurance.com',
  'kim.wallace@kimwallacecoverage.com',
  'kim.wallace@kimwallacecoveragesolutions.com',
  'kim.wallace@kimwallacecoverstexas.com',
  'kim.wallace@kimwallacecoversyou.com',
  'kim.wallace@kimwallacedirect.com',
  'kim.wallace@kimwallaceguard.com',
  'kim.wallace@kimwallacehasyoucovered.com',
  'kim.wallace@kimwallacehomeshield.com',
  'kim.wallace@kimwallaceplus.com',
  'kim.wallace@kimwallacepolicygroup.com',
  'kim.wallace@kimwallacepolicyhelptx.com',
  'kim.wallace@kimwallacepro.com',
  'kim.wallace@kimwallaceprotects.com',
  'kim.wallace@kimwallacequotes.com',
  'kim.wallace@kimwallacerealinsurance.com',
  'kim.wallace@kimwallacesafety.com',
  'kim.wallace@kimwallacesolutionsgroup.com',
  'kim.wallace@kimwallacetexas.com',
  'kim.wallace@kimwallacetexasagent.com',
  'kim.wallace@kimwallacetexasquotes.com',
  'kim.wallace@kimwallaceyourpolicy.com',
  'kim.wallace@kimwallaceyourtxagent.com',
  'kim.wallace@meetkimwallace.com',
  'kim.wallace@myhomeplan-withkim.com',
  'kim.wallace@mykimwallace.com',
  'kim.wallace@trustedbykimwallace.com',
  'kim.wallace@trykimwallace.com',
  'kim.wallace@wallaceagencyeasy.com',
  'kim.wallace@wallaceagencyquick.com',
  'kimwallace@covermyhousekim.com',
  'kimwallace@getkimwallace.com',
  'kimwallace@insurancebykimwallace.com',
  'kimwallace@kimwallace-customcoverage.com',
  'kimwallace@kimwallace-homeadvisor.com',
  'kimwallace@kimwallace-insuranceagency.com',
  'kimwallace@kimwallace-insureshomes.com',
  'kimwallace@kimwallace-protection.com',
  'kimwallace@kimwallaceadvisors.com',
  'kimwallace@kimwallaceagency.com',
  'kimwallace@kimwallaceagent.com',
  'kimwallace@kimwallaceassurance.com',
  'kimwallace@kimwallaceclaims.com',
  'kimwallace@kimwallacecorp.com',
  'kimwallace@kimwallacecoverage.com',
  'kimwallace@kimwallacecoverstexas.com',
  'kimwallace@kimwallacecoversyou.com',
  'kimwallace@kimwallacedirect.com',
  'kimwallace@kimwallaceeasy.com',
  'kimwallace@kimwallaceguard.com',
  'kimwallace@kimwallacehasyoucovered.com',
  'kimwallace@kimwallacehomeshield.com',
  'kimwallace@kimwallaceinsurancegroup.com',
  'kimwallace@kimwallacellc.com',
  'kimwallace@kimwallaceplus.com',
  'kimwallace@kimwallacepolicygroup.com',
  'kimwallace@kimwallacepolicyhelptx.com',
  'kimwallace@kimwallacepro.com',
  'kimwallace@kimwallaceprotects.com',
  'kimwallace@kimwallacequotes.com',
  'kimwallace@kimwallacesolutionsgroup.com',
  'kimwallace@kimwallacetexas.com',
  'kimwallace@kimwallacetexasagent.com',
  'kimwallace@kimwallacetexasquotes.com',
  'kimwallace@kimwallaceyourpolicy.com',
  'kimwallace@kimwallaceyourtxagent.com',
  'kimwallace@meetkimwallace.com',
  'kimwallace@myhomeplan-withkim.com',
  'kimwallace@mykimwallace.com',
  'kimwallace@trustedbykimwallace.com',
  'kimwallace@trykimwallace.com',
  'kimwallace@usekimwallace.com',
  'kimwallace@wallaceagencycorp.com',
  'kimwallace@wallaceagencyplus.com',
  'l.lewis@devinagencycorp.com',
  'l.lewis@devinagencyhelp.com',
  'l.lewis@devinagencyinfo.com',
  'l.lewis@devinagencyinsurance.com',
  'l.lewis@devinagencyllc.com',
  'l.lewis@devinagencyservices.com',
  'l.lewis@thedevinagencyllcs.com',
  'l.lewis@thedevinagencyltd.com',
  'l.lewis@thedevinagencypros.com',
  'l.lewis@thedevinagencyservices.com',
  'lindsay.lewis@devinagencyincs.com',
  'lindsay.lewis@devinagencyinfo.com',
  'lindsay.lewis@devinagencyinsurance.com',
  'lindsay.lewis@devinagencyllcs.com',
  'lindsay.lewis@thedevinagencyco.com',
  'lindsay.lewis@thedevinagencyltd.com',
  'lindsay.lewis@thedevinagencyltds.com',
  'lindsay.lewis@thedevinagencyservices.com',
  'lindsaylewis@devinagencyinfo.com',
  'lindsaylewis@devinagencyinsurance.com',
  'lindsaylewis@devinagencyllc.com',
  'lindsaylewis@thedevinagencyllcs.com',
  'lindsaylewis@thedevinagencyltd.com',
  'lindsaylewis@thedevinagencyltds.com',
  'lindsaylewis@thedevinagencypros.com',
  'lindsaylewis@thedevinagencyservices.com',
  'r.russell@askrobrussell.com',
  'r.russell@getrobrussell.com',
  'r.russell@hellorobrussell.com',
  'r.russell@nowrobrussell.com',
  'r.russell@prorobrussell.com',
  'r.russell@robrussellagency.com',
  'r.russell@robrussellcovers.com',
  'r.russell@robrussellprime.com',
  'r.russell@robrussellrates.com',
  'robin.russell@askrobrussell.com',
  'robin.russell@getrobrussell.com',
  'robin.russell@robrussellbiz.com',
  'robin.russell@robrussellcovers.com',
  'robin.russell@robrussellprime.com',
  'robin.russell@robrussellteam.com',
  'robin.russell@saverobrussell.com',
  'robinrussell@askrobrussell.com',
  'robinrussell@robrussellrates.com',
  'robinrussell@robrussellteam.com',
  'sarah_doubles@radiantenergypartners-tx.com',
  'sarah_doubles@radiantenergypartnersincs.com',
  'sarah_doubles@radiantenergypartnersllcs.com',
  'sarah_doubles@radiantenergypartnersltds.com',
  'sarah_doubles@theradiantenergypartners.com',
  'sarah_doubles@theradiantenergypartnersinc.com',
  'sarah_doubles@theradiantenergypartnersincs.com',
  'sarah_doubles@theradiantenergypartnersllc.com',
  'sarah_doubles@theradiantenergypartnersllcs.com',
  'sarah_doubles@theradiantenergypartnersltds.com',
  'sarah_doubles@theradiantenergypartnerstx.com',
  'sarah-doubles@radiantenergypartners-tx.com',
  'sarah-doubles@radiantenergypartnersincs.com',
  'sarah-doubles@radiantenergypartnersllcs.com',
  'sarah-doubles@radiantenergypartnersltds.com',
  'sarah-doubles@theradiantenergypartners.com',
  'sarah-doubles@theradiantenergypartnersinc.com',
  'sarah-doubles@theradiantenergypartnersincs.com',
  'sarah-doubles@theradiantenergypartnersllc.com',
  'sarah-doubles@theradiantenergypartnersllcs.com',
  'sarah-doubles@theradiantenergypartnersltd.com',
  'sarah-doubles@theradiantenergypartnersltds.com',
  'sarah-doubles@theradiantenergypartnerstx.com',
  'sarah.doubles@radiantenergypartners-tx.com',
  'sarah.doubles@radiantenergypartnersincs.com',
  'sarah.doubles@radiantenergypartnersllcs.com',
  'sarah.doubles@radiantenergypartnersltds.com',
  'sarah.doubles@theradiantenergypartners.com',
  'sarah.doubles@theradiantenergypartnersinc.com',
  'sarah.doubles@theradiantenergypartnersincs.com',
  'sarah.doubles@theradiantenergypartnersllc.com',
  'sarah.doubles@theradiantenergypartnersllcs.com',
  'sarah.doubles@theradiantenergypartnersltd.com',
  'sarah.doubles@theradiantenergypartnersltds.com',
  'sarah.doubles@theradiantenergypartnerstx.com',
  'sarahdoubles@radiantenergypartners-tx.com',
  'sarahdoubles@radiantenergypartnersincs.com',
  'sarahdoubles@radiantenergypartnersllcs.com',
  'sarahdoubles@radiantenergypartnersltds.com',
  'sarahdoubles@theradiantenergypartners.com',
  'sarahdoubles@theradiantenergypartnersinc.com',
  'sarahdoubles@theradiantenergypartnersincs.com',
  'sarahdoubles@theradiantenergypartnersllc.com',
  'sarahdoubles@theradiantenergypartnersllcs.com',
  'sarahdoubles@theradiantenergypartnersltd.com',
  'sarahdoubles@theradiantenergypartnersltds.com',
  'sarahdoubles@theradiantenergypartnerstx.com',
  'victor_lauersdorf@smaagencyusa.com',
  'victor-lauersdorf@smaagencyusa.com',
  'victor.lauersdorf@smaagencyusa.com',
  'victorlauersdorf@smaagencyusa.com',
];

interface SenderEmail {
  id: number;
  email: string;
  name?: string;
  status?: string;
}

async function getAllSenderEmails(apiKey: string, baseUrl: string): Promise<SenderEmail[]> {
  try {
    let allEmails: SenderEmail[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await axios.get(`${baseUrl}/api/sender-emails?page=${page}&per_page=100`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });

      const emails = response.data.data;
      allEmails = allEmails.concat(emails);

      if (!emails || emails.length < 100) {
        hasMorePages = false;
      } else {
        page++;
      }
    }

    return allEmails;
  } catch (error: any) {
    console.error('Error fetching sender emails:', error.response?.data || error.message);
    return [];
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('EMAIL EXISTENCE VERIFICATION');
  console.log('='.repeat(80));
  console.log(`Total emails to verify: ${DAMAGED_EMAILS.length}\n`);

  // Get all workspaces
  const { data: workspaces, error } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_api_key, bison_instance')
    .in('bison_instance', ['Maverick', 'Long Run'])
    .not('bison_api_key', 'is', null);

  if (error || !workspaces) {
    console.error('Error fetching workspaces:', error);
    process.exit(1);
  }

  console.log(`Fetching emails from ${workspaces.length} workspaces...\n`);

  // Collect all emails from all workspaces
  const allSystemEmails: Map<string, { workspace: string; id: number; name?: string; status?: string }[]> = new Map();

  for (const workspace of workspaces) {
    let baseUrl: string;
    if (workspace.bison_instance === 'Maverick') {
      baseUrl = WORKSPACE_URLS['Maverick'];
    } else if (workspace.bison_instance === 'Long Run') {
      baseUrl = WORKSPACE_URLS['Long Run'];
    } else {
      continue;
    }

    console.log(`  Fetching from ${workspace.workspace_name}...`);
    const emails = await getAllSenderEmails(workspace.bison_api_key, baseUrl);

    for (const email of emails) {
      const emailLower = email.email.toLowerCase();
      if (!allSystemEmails.has(emailLower)) {
        allSystemEmails.set(emailLower, []);
      }
      allSystemEmails.get(emailLower)!.push({
        workspace: workspace.workspace_name,
        id: email.id,
        name: email.name,
        status: email.status,
      });
    }
  }

  console.log(`\nTotal unique emails in system: ${allSystemEmails.size}`);
  console.log('='.repeat(80));

  // Check which emails from the list exist
  const foundEmails: string[] = [];
  const notFoundEmails: string[] = [];

  for (const email of DAMAGED_EMAILS) {
    const emailLower = email.toLowerCase();
    if (allSystemEmails.has(emailLower)) {
      foundEmails.push(email);
    } else {
      notFoundEmails.push(email);
    }
  }

  // Print results
  console.log(`\n${'='.repeat(80)}`);
  console.log('FOUND EMAILS (exist in system)');
  console.log('='.repeat(80));
  console.log(`Count: ${foundEmails.length}\n`);

  for (const email of foundEmails) {
    const emailLower = email.toLowerCase();
    const occurrences = allSystemEmails.get(emailLower)!;
    console.log(`✓ ${email}`);
    for (const occ of occurrences) {
      console.log(`    - Workspace: ${occ.workspace} | ID: ${occ.id} | Name: ${occ.name || 'N/A'} | Status: ${occ.status || 'N/A'}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('NOT FOUND EMAILS (do not exist in system)');
  console.log('='.repeat(80));
  console.log(`Count: ${notFoundEmails.length}\n`);

  // Group not found emails by pattern
  const groupedNotFound: { [key: string]: string[] } = {};
  for (const email of notFoundEmails) {
    const domain = email.split('@')[1];
    if (!groupedNotFound[domain]) {
      groupedNotFound[domain] = [];
    }
    groupedNotFound[domain].push(email);
  }

  // Print not found emails grouped by domain
  for (const [domain, emails] of Object.entries(groupedNotFound)) {
    console.log(`\nDomain: ${domain} (${emails.length} emails)`);
    for (const email of emails) {
      console.log(`  ✗ ${email}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total emails in list: ${DAMAGED_EMAILS.length}`);
  console.log(`Found in system: ${foundEmails.length} (${((foundEmails.length / DAMAGED_EMAILS.length) * 100).toFixed(2)}%)`);
  console.log(`Not found in system: ${notFoundEmails.length} (${((notFoundEmails.length / DAMAGED_EMAILS.length) * 100).toFixed(2)}%)`);
  console.log(`Total workspaces scanned: ${workspaces.length}`);
  console.log(`Total unique emails in system: ${allSystemEmails.size}`);
  console.log('='.repeat(80));
}

main().catch(console.error);
