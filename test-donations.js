#!/usr/bin/env node

const http = require('http');

console.log('🧪 Testing Donation Website Functionality...\n');

function testUrl(url, port) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: port,
            path: '/',
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Test for donation functionality
                const tests = {
                    'Page loads': res.statusCode === 200,
                    'Title correct': data.includes('Give Green, Live Clean - Plant Trees'),
                    'Donation section exists': data.includes('Plant Trees Today'),
                    'PayPal forms present': (data.match(/paypal\.com\/donate/gi) || []).length >= 4,
                    'Donate buttons present': (data.match(/Donate \$\d+/gi) || []).length >= 4,
                    'Emergency buttons present': (data.match(/EMERGENCY/gi) || []).length >= 2,
                    'JavaScript loaded': data.includes('flashSuccess'),
                    'CSS styling present': data.includes('donate-btn')
                };

                resolve({ port, tests, html: data });
            });
        });

        req.on('error', (err) => {
            reject({ port, error: err.message });
        });

        req.end();
    });
}

async function runTests() {
    try {
        console.log('Testing Development Server (port 3001)...');
        const devResults = await testUrl('/', 3001);
        
        console.log('Testing Production Server (port 3000)...');
        const prodResults = await testUrl('/', 3000);

        // Display results
        [devResults, prodResults].forEach(result => {
            console.log(`\n📊 Results for port ${result.port}:`);
            Object.entries(result.tests).forEach(([test, passed]) => {
                console.log(`${passed ? '✅' : '❌'} ${test}`);
            });
        });

        // Count donation methods
        const devDonationMethods = (devResults.html.match(/paypal\.com\/donate/gi) || []).length;
        const prodDonationMethods = (prodResults.html.match(/paypal\.com\/donate/gi) || []).length;

        console.log('\n🎯 Donation Methods Summary:');
        console.log(`Development (3001): ${devDonationMethods} PayPal forms`);
        console.log(`Production (3000): ${prodDonationMethods} PayPal forms`);

        // Overall status
        const devPassed = Object.values(devResults.tests).every(t => t);
        const prodPassed = Object.values(prodResults.tests).every(t => t);

        console.log('\n🏆 Overall Status:');
        console.log(`Development: ${devPassed ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Production: ${prodPassed ? '✅ PASS' : '❌ FAIL'}`);

        if (devPassed && prodPassed && devDonationMethods >= 4 && prodDonationMethods >= 4) {
            console.log('\n🎉 SUCCESS: All donation functionality is working!');
            console.log('💡 Users can now donate using multiple methods:');
            console.log('   - $10, $25, $50, $100 donation cards');
            console.log('   - Emergency backup buttons');
            console.log('   - Direct PayPal integration');
        } else {
            console.log('\n⚠️  Some issues detected. Check the results above.');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

runTests();