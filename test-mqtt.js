import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 MQTT Connection Diagnostics');
console.log('================================');

// Tampilkan konfigurasi (tanpa password lengkap)
console.log('📋 Configuration:');
console.log('   Host:', process.env.HIVEMQ_HOST);
console.log('   Port:', process.env.HIVEMQ_PORT);
console.log('   Username:', process.env.HIVEMQ_USERNAME);
console.log('   Password:', process.env.HIVEMQ_PASSWORD ? `${process.env.HIVEMQ_PASSWORD.substring(0, 3)}***` : 'NOT SET');

// Test berbagai format URL
const testUrls = [
    `wss://${process.env.HIVEMQ_HOST}:${process.env.HIVEMQ_PORT}/mqtt`,
    `wss://${process.env.HIVEMQ_HOST}:${process.env.HIVEMQ_PORT}`,
    `mqtts://${process.env.HIVEMQ_HOST}:${process.env.HIVEMQ_PORT}`,
    `mqtt://${process.env.HIVEMQ_HOST}:1883`
];

console.log('\n🧪 Testing different connection URLs:');

async function testConnection(url, index) {
    return new Promise((resolve) => {
        console.log(`\n${index + 1}. Testing: ${url}`);
        
        const client = mqtt.connect(url, {
            clientId: `test_client_${Date.now()}_${index}`,
            username: process.env.HIVEMQ_USERNAME,
            password: process.env.HIVEMQ_PASSWORD,
            clean: true,
            connectTimeout: 10000,
            keepalive: 60,
            protocolVersion: 4,
            rejectUnauthorized: false
        });

        const timeout = setTimeout(() => {
            console.log(`   ❌ Timeout after 10 seconds`);
            client.end(true);
            resolve(false);
        }, 10000);

        client.on('connect', () => {
            clearTimeout(timeout);
            console.log(`   ✅ SUCCESS! Connected with client ID: ${client.options.clientId}`);
            
            // Test publish/subscribe
            client.subscribe('test/connection', (err) => {
                if (!err) {
                    console.log(`   📡 Subscribed to test topic`);
                    client.publish('test/connection', 'Hello from test!');
                }
            });
            
            setTimeout(() => {
                client.end();
                resolve(true);
            }, 2000);
        });

        client.on('message', (topic, message) => {
            console.log(`   📨 Received message: ${message.toString()}`);
        });

        client.on('error', (error) => {
            clearTimeout(timeout);
            console.log(`   ❌ Error: ${error.message}`);
            console.log(`   🔍 Error code: ${error.code || 'N/A'}`);
            console.log(`   🔍 Error errno: ${error.errno || 'N/A'}`);
            client.end(true);
            resolve(false);
        });

        client.on('offline', () => {
            console.log(`   ⚠️ Client went offline`);
        });

        client.on('close', () => {
            console.log(`   🔌 Connection closed`);
        });
    });
}

// Test semua URL secara berurutan
async function runTests() {
    console.log('\n🚀 Starting connection tests...\n');
    
    for (let i = 0; i < testUrls.length; i++) {
        const success = await testConnection(testUrls[i], i);
        if (success) {
            console.log(`\n🎉 WORKING URL FOUND: ${testUrls[i]}`);
            break;
        }
        
        // Delay antar test
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✅ Diagnostics complete!');
    console.log('\n💡 Recommendations:');
    console.log('   1. Check if HiveMQ cluster is online');
    console.log('   2. Verify credentials in HiveMQ dashboard');
    console.log('   3. Check if your IP is whitelisted');
    console.log('   4. Try different ports (8883, 1883, 8884)');
    console.log('   5. Check HiveMQ cluster status page');
    
    process.exit(0);
}

runTests().catch(console.error);