import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Base URLs will be determined per workspace
const WORKSPACE_URLS: { [key: string]: string } = {
  'Maverick': 'https://send.maverickmarketingllc.com',
  'Long Run': 'https://send.longrun.agency',
};

// List of emails to tag as Damaged - LIST 2
const DAMAGED_EMAILS = [
  's.reese@meetlofiincs.com',
  'summerreese@meetlofiincs.com',
  'summer.reese@meetlofiincs.com',
  'summerreese@meetlofiagency.com',
  's.reese@meetlofipro.com',
  'summerreese@meetlofionline.com',
  'summerreese@meetlofipro.com',
  's.reese@meetlofionline.com',
  's.reese@meetlofiagency.com',
  's.reese@meetlofiltd.com',
  'summer.reese@meetlofionline.com',
  'summerreese@meetlofiltds.com',
  's.reese@meetlofillc.com',
  'summer.reese@meetlofiltd.com',
  'harriman.don@thebizpowerbenefitsllc.com',
  'summerreese@meetlofillc.com',
  'summerreese@meetlofiltd.com',
  'summer.reese@meetlofillc.com',
  'summer.reese@meetlofiltds.com',
  'summer.reese@meetlofiagency.com',
  'sarah.doubles@theradiantenergypartners-llc.com',
  'harriman.d@thebizpowerbenefitsllc.com',
  's.reese@meetlofillcs.com',
  's.doubles@theradiantenergypartners-llc.com',
  'a.asaro@rossmanmediahub.com',
  'sarahdoubles@theradiantenergypartners-llc.com',
  'summer.reese@meetlofillcs.com',
  'summerreese@meetlofillcs.com',
  'alysse.a@rossmanmediahub.com',
  's.reese@meetlofiinc.com',
  'alysse.williams@rossmanmediastudio.com',
  'summerreese@meetlofiinc.com',
  'summer.reese@meetlofiinc.com',
  'a.williams@rossmanmediastudio.com',
  'summerreese@meetlofipros.com',
  's.reese@meetlofipros.com',
  'sarah.doubles@radiantenergypartnersllc.agency',
  's.doubles@radiantenergypartners-ltd.com',
  'alysse.williams@rossmanmediaservices.com',
  's.doubles@theradiantenergypartnersonline.agency',
  'sarahdoubles@radiantenergypartners-ltd.com',
  'alysse.williams@rossmanmediasolution.com',
  'alysse.williams@rossmanmediasupport.com',
  'a.williams@rossmanmediablog.com',
  'victor.lauersdorf@smainsurancellcs.com',
  'alyssewilliams@rossmanmediaplus.com',
  'victor.lauersdorf@thesmainsuranceincs.com',
  'victorlauersdorf@smainsurancellc.com',
  'dan@onlongrun.com',
  'kirkhodgson@assuredpartnersplus.com',
  'a.williams@rossmanmediainsights.com',
  'alysse.williams@rossmanmediaplus.com',
  'alyssewilliams@rossmanmediablog.com',
  'alyssewilliams@rossmanmediasupport.com',
  'dewindtravis@thesavantyincs.com',
  's.doubles@radiantenergypartnersllc.agency',
  's.doubles@radiantenergypartnersltds.agency',
  'sarah.doubles@radiantenergypartners-ltd.com',
  'victor.lauersdorf@smainsurancellc.com',
  'a.williams@rossmanmediaservices.com',
  'k.hodgson@assuredpartnersshield.com',
  'sarah.doubles@radiantenergypartnersltds.agency',
  'sarahdoubles@radiantenergypartnersllc.agency',
  'sarahdoubles@theradiantenergypartnersonline.agency',
  'daniel@onlongrun.com',
  's.doubles@radiantenergypartners.agency',
  'sarah.doubles@radiantenergypartners-inc.com',
  'victorlauersdorf@smainsurancellcs.com',
  'a.williams@therossmanmediaagency.com',
  'alyssewilliams@rossmanmediateam.com',
  'danielk@onlongrun.com',
  'kirk.hodgson@assuredpartnersshield.com',
  'sarahdoubles@radiantenergypartnerstx.agency',
  'a.williams@rossmanmediasupport.com',
  'alyssewilliams@rossmanmediaservices.com',
  'k.hodgson@trustassuredpartners.com',
  'kirkhodgson@hiassuredpartners.com',
  'kirkhodgson@secureassuredpartners.com',
  's.doubles@radiantenergypartnersinc.agency',
  'sarah.doubles@theradiantenergypartnersonline.agency',
  'travisdewind@thesavantyllcs.com',
  'v.lauersdorf@smainsurancellcs.com',
  'a.williams@rossmanmediaplus.com',
  'alysse.williams@therossmanmediaagency.com',
  'kirkhodgson@quickassuredpartners.com',
  'sarahdoubles@radiantenergypartnersinc.agency',
  'a.williams@rossmanmediacreatives.com',
  'donharriman@bizpowerbenefitsltds.com',
  'haley.k@rossmanmedianext.com',
  'kirk.hodgson@assuredpartnersplus.com',
  'sarah.doubles@theradiantenergypartnerspro.agency',
  'z.siegel@thesmallbizheroesco.com',
  'alysse.williams@rossmanmediaconnect.com',
  'alysse.williams@rossmanmediaportal.com',
  'alyssewilliams@rossmanmediaconnect.com',
  'alyssewilliams@rossmanmediaportal.com',
  'alyssewilliams@rossmanmediasolution.com',
  'kirkhodgson@assuredpartnersshield.com',
  'v.lauersdorf@smainsurancellc.com',
  'z.siegel@smallbizheroesltdsnc.com',
  'a.williams@rossmanmedianetwork.com',
  'alysse.williams@rossmanmediablog.com',
  'alyssewilliams@rossmanmediainsights.com',
  'k.hodgson@secureassuredpartners.com',
  'kirk.hodgson@primeassuredpartners.com',
  'kirkhodgson@assuredpartnersservices.com',
  'kirkhodgson@primeassuredpartners.com',
  'kirkhodgson@smartassuredpartners.com',
  'kirkhodgson@trustassuredpartners.com',
  's.doubles@theradiantenergypartnersltds.agency',
  'z.siegel@smallbizheroesincnc.com',
  'z.siegel@smallbizheroesnetwork.com',
  'zach.s@smallbizheroesltdsnc.com',
  'alysse.williams@rossmanmediateam.com',
  'dan@tolongrun.com',
  'kirk.hodgson@secureassuredpartners.com',
  'z.siegel@smallbiz-heroesllc.com',
  'z.siegel@thesmallbizheroesllcs.com',
  'a.williams@rossmanmediaportal.com',
  'a.williams@rossmanmediateam.com',
  'alysse.williams@rossmanmediacreatives.com',
  'dewindtravis@savantycorp.com',
  'donharriman@bizpowerbenefitltd.com',
  'sarah.doubles@radiantenergypartnersinc.agency',
  'victor.lauersdorf@smainsuranceonline.com',
  'z.siegel@smallbiz-heroesinc.com',
  'z.siegel@smallbizheroesinc.com',
  'z.siegel@thesmallbizheroesonline.com',
  'zach.s@smallbizheroesincs.com',
  'zach.s@smallbizheroesllcsnc.com',
  'zach.s@thesmallbizheroesco.com',
  'zach.s@thesmallbizheroesltds.com',
  'zach.s@thesmallbizheroesonline.com',
  'alyssewilliams@rossmanmediacorp.com',
  'alyssewilliams@rossmanmediapartners.com',
  'jakeferrara@chatstreetsmart.com',
  'michael@joinati.com',
  's.doubles@radiantenergypartners-llc.agency',
  'sarahdoubles@radiantenergypartners-llcs.agency',
  'sarahdoubles@radiantenergypartnersltd.agency',
  'z.siegel@smallbizheroesincs.com',
  'z.siegel@smallbizheroesllcs.com',
  'z.siegel@thesmallbizheroescorp.com',
  'z.siegel@thesmallbizheroesincnc.com',
  'z.siegel@thesmallbizheroesltdnc.com',
  'z.siegel@thesmallbizheroesltdsnc.com',
  'z.siegel@thesmallbizheroesnetwork.com',
  'zach.s@smallbizheroesnetwork.com',
  'zach.s@thesmallbizheroesltdnc.com',
  'zach.s@thesmallbizheroesltdsnc.com',
  'sarah.doubles@radiantenergypartnersincs.agency',
  'ted.handler@tribeandtrustdtx.com',
  'z.siegel@smallbizheroeshq.com',
  'z.siegel@smallbizheroesltdnc.com',
  'z.siegel@smallbizheroesservices.com',
  'z.siegel@thesmallbizheroeshq.com',
  'zach.s@smallbizheroesllcs.com',
  'zach.s@smallbizheroesltd.com',
  'zach.s@smallbizheroesnc.com',
  'zach.s@smallbizheroesteam.com',
  'zach.s@thesmallbizheroesllc.com',
  'alicia.summers@boringbookkeepingservices.com',
  'alyssewilliams@rossmanmedialab.com',
  'justinwaggoner@getifoam.com',
  'kirkhodgson@bestassuredpartners.com',
  'v.lauersdorf@smainsurancepro.com',
  'z.siegel@smallbizheroesllcsnc.com',
  'z.siegel@smallbizheroesltd.com',
  'z.siegel@smallbizheroesworks.com',
  'z.siegel@thesmallbizheroesltd.com',
  'zach.s@smallbizheroesltdnc.com',
  'zach.s@smallbizheroesltds.com',
  'zach.s@smallbizheroesworks.com',
  'zach.s@thesmallbizheroeshq.com',
  'j.ferrara@streetsmartfirm.com',
  'jake.ferrara@streetsmartfirm.com',
  'z.siegel@smallbizheroesllcnc.com',
  'z.siegel@smallbizheroesltds.com',
  'z.siegel@thesmallbizheroesltds.com',
  'z.siegel@thesmallbizheroesusa.com',
  'zach.s@smallbizheroesincnc.com',
  'zach.s@thesmallbizheroescorp.com',
  'zach.s@thesmallbizheroesinc.com',
  'zach.s@thesmallbizheroesincs.com',
  'zach.s@thesmallbizheroesnetwork.com',
  'j.ferrara@knowstreetsmart.com',
  'jake.ferrara@primestreetsmart.com',
  'z.siegel@smallbiz-heroesllcs.com',
  'zach.s@smallbiz-heroesllc.com',
  'zach.s@smallbizheroesllcnc.com',
  'zach.s@thesmallbizheroesllcs.com',
  'alyssewilliams@rossmanmediaconsulting.com',
  'alyssewilliams@rossmanmediateams.com',
  'tedhandler@tribentrust.com',
  'z.siegel@smallbiz-heroesnc.com',
  'zach.s@smallbizheroeshq.com',
  'zach.s@smallbizheroesinc.com',
  'zach.s@thesmallbizheroesltd.com',
  'z.siegel@smallbizheroesusa.com',
  'z.siegel@thesmallbizheroesincsnc.com',
  'z.siegel@thesmallbizheroesllcsnc.com',
  'z.siegel@thesmallbizheroesteam.com',
  'zach.s@smallbizheroesonline.com',
  'zach.s@thesmallbizheroesincsnc.com',
  'z.siegel@smallbizheroesonline.com',
  'z.siegel@thesmallbizheroesllcnc.com',
  'zach.s@smallbiz-heroes.com',
  'zach.s@smallbiz-heroesincs.com',
  'zach.s@smallbiz-heroesltds.com',
  'zach.s@smallbizheroescorp.com',
  'zach.s@smallbizheroesincsnc.com',
  'zach.s@smallbizheroesusa.com',
  'zach.s@thesmallbizheroesllcnc.com',
  'zach.s@thesmallbizheroesllcsnc.com',
  'zach.s@thesmallbizheroesteam.com',
  'summer.reese@meetlofipro.com',
  's.reese@meetlofiltds.com',
  'alyssewilliams@rossmanmediastudio.com',
  'alysse.williams@rossmanmedianetwork.com',
  'sarahdoubles@radiantenergypartnersltds.agency',
  'kirkhodgson@lifeassuredpartners.com',
  'k.hodgson@assuredpartnersplus.com',
  'k.hodgson@bestassuredpartners.com',
  'a.williams@rossmanmediasolution.com',
  'sarah.doubles@theradiantenergypartnersinc.agency',
  'z.siegel@smallbizheroesnc.com',
  's.doubles@radiantenergypartnersltd.agency',
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

interface Tag {
  id: number;
  name: string;
}

interface SenderEmail {
  id: number;
  email: string;
}

async function getOrCreateDamagedTag(apiKey: string, baseUrl: string): Promise<number> {
  try {
    // Get all tags
    const response = await axios.get(`${baseUrl}/api/tags`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    const tags: Tag[] = response.data.data;
    const damagedTag = tags.find((tag: Tag) => tag.name === 'Damaged');

    if (damagedTag) {
      console.log(`Found existing "Damaged" tag with ID: ${damagedTag.id}`);
      return damagedTag.id;
    }

    // Create the tag if it doesn't exist
    console.log('Creating "Damaged" tag...');
    const createResponse = await axios.post(
      `${baseUrl}/api/tags`,
      { name: 'Damaged', default: false },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    const newTag = createResponse.data.data;
    console.log(`Created "Damaged" tag with ID: ${newTag.id}`);
    return newTag.id;
  } catch (error: any) {
    console.error('Error getting/creating Damaged tag:', error.response?.data || error.message);
    throw error;
  }
}

async function getSenderEmails(apiKey: string, baseUrl: string): Promise<SenderEmail[]> {
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

      // Check if there are more pages
      // Most APIs return empty array or less than per_page when done
      if (!emails || emails.length < 100) {
        hasMorePages = false;
      } else {
        page++;
      }
    }

    return allEmails;
  } catch (error: any) {
    console.error('Error fetching sender emails:', error.response?.data || error.message);
    throw error;
  }
}

async function tagEmails(apiKey: string, baseUrl: string, tagId: number, senderEmailIds: number[]): Promise<void> {
  try {
    console.log(`Tagging ${senderEmailIds.length} emails with tag ID ${tagId}...`);

    const response = await axios.post(
      `${baseUrl}/api/tags/attach-to-sender-emails`,
      {
        tag_ids: [tagId],
        sender_email_ids: senderEmailIds,
        skip_webhooks: false,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Response:', response.data);
  } catch (error: any) {
    console.error('Error tagging emails:', error.response?.data || error.message);
    throw error;
  }
}

async function processWorkspace(workspaceName: string, apiKey: string, baseUrl: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing workspace: ${workspaceName}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log('='.repeat(60));

  // Get or create the Damaged tag
  const damagedTagId = await getOrCreateDamagedTag(apiKey, baseUrl);

  // Get all sender emails for this workspace
  console.log('Fetching sender emails...');
  const senderEmails = await getSenderEmails(apiKey, baseUrl);
  console.log(`Found ${senderEmails.length} total sender emails in workspace`);

  // Filter to only the emails we want to tag
  const emailsToTag = senderEmails.filter((sender) =>
    DAMAGED_EMAILS.includes(sender.email.toLowerCase())
  );

  console.log(`Found ${emailsToTag.length} emails to tag as Damaged:`);
  emailsToTag.forEach((email) => {
    console.log(`  - ${email.email} (ID: ${email.id})`);
  });

  if (emailsToTag.length === 0) {
    console.log('No emails found to tag in this workspace');
    return { found: 0, tagged: 0 };
  }

  // Tag the emails
  const senderEmailIds = emailsToTag.map((email) => email.id);
  await tagEmails(apiKey, baseUrl, damagedTagId, senderEmailIds);

  console.log(`\n✓ Successfully tagged ${emailsToTag.length} emails in ${workspaceName}`);

  return { found: emailsToTag.length, tagged: emailsToTag.length };
}

async function main() {
  console.log('Starting email tagging process...');
  console.log(`Total emails to tag: ${DAMAGED_EMAILS.length}\n`);

  // Get API keys from Supabase - query all workspaces first
  const { data: allWorkspaces, error: allError } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_api_key, bison_instance')
    .order('workspace_name');

  if (allError) {
    console.error('Error fetching workspaces:', allError);
    process.exit(1);
  }

  console.log('All workspaces in database:');
  allWorkspaces?.forEach(w => {
    console.log(`  - ${w.workspace_name}: ${w.bison_api_key ? 'Has API Key' : 'No API Key'} (Instance: ${w.bison_instance || 'N/A'})`);
  });

  // Get API keys from Supabase - filter by bison_instance instead of workspace_name
  const { data: workspaces, error } = await supabase
    .from('client_registry')
    .select('workspace_name, bison_api_key, bison_instance')
    .in('bison_instance', ['Maverick', 'Long Run'])
    .not('bison_api_key', 'is', null);

  if (error) {
    console.error('Error fetching API keys:', error);
    process.exit(1);
  }

  if (!workspaces || workspaces.length === 0) {
    console.error('No workspaces found with Maverick or Long Run instances');
    process.exit(1);
  }

  console.log(`\nFound ${workspaces.length} workspaces to process\n`);

  const results = {
    maverick: { found: 0, tagged: 0, workspaces: [] as string[] },
    longRun: { found: 0, tagged: 0, workspaces: [] as string[] },
  };

  // Process each workspace
  for (const workspace of workspaces) {
    if (!workspace.bison_api_key) {
      console.log(`⚠ Skipping ${workspace.workspace_name} - no API key found`);
      continue;
    }

    // Determine base URL based on instance
    let baseUrl: string;
    if (workspace.bison_instance === 'Maverick') {
      baseUrl = WORKSPACE_URLS['Maverick'];
    } else if (workspace.bison_instance === 'Long Run') {
      baseUrl = WORKSPACE_URLS['Long Run'];
    } else {
      console.log(`⚠ Skipping ${workspace.workspace_name} - unknown instance: ${workspace.bison_instance}`);
      continue;
    }

    try {
      const result = await processWorkspace(workspace.workspace_name, workspace.bison_api_key, baseUrl);

      if (workspace.bison_instance === 'Maverick') {
        results.maverick.found += result.found;
        results.maverick.tagged += result.tagged;
        if (result.found > 0) {
          results.maverick.workspaces.push(workspace.workspace_name);
        }
      } else if (workspace.bison_instance === 'Long Run') {
        results.longRun.found += result.found;
        results.longRun.tagged += result.tagged;
        if (result.found > 0) {
          results.longRun.workspaces.push(workspace.workspace_name);
        }
      }
    } catch (error: any) {
      console.error(`\n✗ Failed to process ${workspace.workspace_name}:`, error.message);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total emails in list: ${DAMAGED_EMAILS.length}`);
  console.log(`\nMaverick instance:`);
  console.log(`  - Found: ${results.maverick.found}`);
  console.log(`  - Tagged: ${results.maverick.tagged}`);
  console.log(`  - Workspaces with matches: ${results.maverick.workspaces.join(', ') || 'None'}`);
  console.log(`\nLong Run instance:`);
  console.log(`  - Found: ${results.longRun.found}`);
  console.log(`  - Tagged: ${results.longRun.tagged}`);
  console.log(`  - Workspaces with matches: ${results.longRun.workspaces.join(', ') || 'None'}`);
  console.log(`\nTotal tagged: ${results.maverick.tagged + results.longRun.tagged}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
