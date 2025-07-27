import mqtt from 'mqtt';
import DatabaseManager from './database.js';
import dotenv from 'dotenv';

dotenv.config();

class MQTTLogger {
    constructor() {
        this.db = new DatabaseManager();
        this.sensorData = {
            temperature: null,
            humidity: null,
            pumpStatus: false,
            mode: 'auto',
            setpoint: 75,
            lastSaved: null
        };
        
        // Interval untuk menyimpan data (5 menit = 300000 ms)
        this.saveInterval = 5 * 60 * 1000;
        this.saveTimer = null;
        
        this.mqttClient = null;
        this.isConnected = false;
        
        this.initializeMQTT();
        this.startPeriodicSave();
    }

    // Inisialisasi koneksi MQTT
    initializeMQTT() {
        const brokerUrl = `wss://${process.env.HIVEMQ_HOST}:${process.env.HIVEMQ_PORT}/mqtt`;
        
        this.mqttClient = mqtt.connect(brokerUrl, {
            clientId: 'greenhouse_logger_' + Math.random().toString(16).substr(2, 8),
            username: process.env.HIVEMQ_USERNAME,
            password: process.env.HIVEMQ_PASSWORD,
            clean: true,
            reconnectPeriod: 5000,
            connectTimeout: 30000,
            keepalive: 60
        });

        this.mqttClient.on('connect', () => {
            console.log('✅ MQTT Logger terhubung ke HiveMQ broker');
            this.isConnected = true;
            
            // Subscribe ke topic sensor
            const topics = [
                'greenhouse/dht22/temperature',
                'greenhouse/dht22/humidity',
                'greenhouse/pump/status',
                'greenhouse/mode',
                'greenhouse/setpoint'
            ];
            
            topics.forEach(topic => {
                this.mqttClient.subscribe(topic, (err) => {
                    if (err) {
                        console.error(`❌ Error subscribing to ${topic}:`, err);
                    } else {
                        console.log(`📡 Subscribed to ${topic}`);
                    }
                });
            });
            
            // Publish status online
            this.mqttClient.publish('greenhouse/logger/status', 'online', { retain: true });
        });

        this.mqttClient.on('message', (topic, message) => {
            const data = message.toString();
            console.log(`📨 Received: ${topic} = ${data}`);
            
            switch(topic) {
                case 'greenhouse/dht22/temperature':
                    this.sensorData.temperature = parseFloat(data);
                    break;
                case 'greenhouse/dht22/humidity':
                    this.sensorData.humidity = parseFloat(data);
                    break;
                case 'greenhouse/pump/status':
                    this.sensorData.pumpStatus = data === '1' || data.toLowerCase() === 'true';
                    break;
                case 'greenhouse/mode':
                    this.sensorData.mode = data;
                    break;
                case 'greenhouse/setpoint':
                    this.sensorData.setpoint = parseInt(data);
                    break;
            }
        });

        this.mqttClient.on('error', (error) => {
            console.error('❌ MQTT connection error:', error);
            this.isConnected = false;
        });

        this.mqttClient.on('offline', () => {
            console.log('⚠️ MQTT client offline');
            this.isConnected = false;
        });
        
        this.mqttClient.on('reconnect', () => {
            console.log('🔄 MQTT reconnecting...');
        });
    }

    // Mulai penyimpanan periodik
    startPeriodicSave() {
        this.saveTimer = setInterval(async () => {
            await this.saveCurrentData();
        }, this.saveInterval);
        
        console.log(`Penyimpanan data dimulai setiap ${this.saveInterval / 1000} detik`);
    }

    // Simpan data saat ini ke database
    async saveCurrentData() {
        if (this.sensorData.temperature !== null && this.sensorData.humidity !== null) {
            try {
                const result = await this.db.saveSensorData(
                    this.sensorData.temperature,
                    this.sensorData.humidity,
                    this.sensorData.pumpStatus,
                    this.sensorData.mode,
                    this.sensorData.setpoint
                );
                
                this.sensorData.lastSaved = new Date();
                console.log(`✅ Data tersimpan: T=${this.sensorData.temperature}°C, H=${this.sensorData.humidity}%, Pump=${this.sensorData.pumpStatus}`);
                
            } catch (error) {
                console.error('❌ Error menyimpan data:', error);
            }
        } else {
            console.log('⚠️ Data sensor belum lengkap, menunggu data dari MQTT...');
        }
    }

    // Hentikan logger
    stop() {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
        }
        
        if (this.mqttClient && this.isConnected) {
            this.mqttClient.end();
        }
        
        console.log('MQTT Logger dihentikan');
    }

    // Status logger
    getStatus() {
        return {
            mqttConnected: this.isConnected,
            lastData: this.sensorData,
            lastSaved: this.sensorData.lastSaved,
            saveInterval: this.saveInterval / 1000 + ' detik'
        };
    }
}

export default MQTTLogger;