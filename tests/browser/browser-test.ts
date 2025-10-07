import { BrowserController, AuthManager, ErrorHandler } from '@agents/browser';

async function testBrowserLaunch() {
  const browser = new BrowserController({ headless: false, slowMo: 100 });

  try {
    console.log('\n🚀 Testing browser launch...\n');

    await browser.launch();
    await browser.navigate('https://example.com');

    const page = browser.getPage();
    const title = await page.title();

    console.log('✅ Browser launched successfully');
    console.log(`   Page title: ${title}`);

    await browser.screenshot('test-screenshot.png');
    console.log('✅ Screenshot captured: test-screenshot.png');

    await browser.close();
    console.log('✅ Browser closed cleanly\n');

    console.log('✅ All browser tests passed!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    await browser.close();
    process.exit(1);
  }
}

testBrowserLaunch();
