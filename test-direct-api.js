// Test if we can manually call the API with the key you added

console.log('🔍 Please run this test:\n');
console.log('1. Go to Email Bison: https://send.maverickmarketingllc.com/settings/api');
console.log('2. Copy your API key');
console.log('3. Run this command with your API key:\n');
console.log('curl -H "Authorization: Bearer YOUR_API_KEY_HERE" https://send.maverickmarketingllc.com/api/workspaces/v1.1\n');
console.log('\nReplace YOUR_API_KEY_HERE with your actual API key.\n');
console.log('If it returns JSON with workspaces, the key is good!');
console.log('If it returns 401 Unauthorized, the key is invalid.\n');
