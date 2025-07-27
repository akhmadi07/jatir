import express from 'express';
import cors from 'cors';
import DatabaseManager from './database.js';
import MQTTLogger from './mqtt-logger.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Inisialisasi database dan logger
const db = new DatabaseManager();
const mqttLogger = new MQTTLogger();

// Test koneksi database saat startup
async function initializeServer() {
    console.log('🚀 Memulai server API...');
    
    // Test koneksi database
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
        console.error('❌ Gagal terhubung ke database!');
        process.exit(1);
    }
    
    console.log('✅ Server siap menerima koneksi');
}

initializeServer();

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        logger: mqttLogger.getStatus()
    });
});

// Ambil data sensor terbaru untuk chart
app.get('/api/sensor-data', async (req, res) => {
    try {
        // Batasi maksimal 24 jam untuk performa
        const hours = Math.min(parseInt(req.query.hours) || 24, 24);
        const data = await db.getRecentSensorData(hours);
        
        res.json({
            success: true,
            data: data,
            count: data.length,
            hours: hours
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ambil statistik harian
app.get('/api/daily-stats', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const stats = await db.getDailyStats(days);
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Export data dalam rentang tanggal
app.get('/api/export', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Parameter startDate dan endDate diperlukan'
            });
        }
        
        const data = await db.getDataForExport(startDate, endDate);
        
        res.json({
            success: true,
            data: data,
            count: data.length,
            period: { startDate, endDate }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Manual save data (untuk testing)
app.post('/api/save-data', async (req, res) => {
    try {
        const { temperature, humidity, pumpStatus, mode, setpoint } = req.body;
        
        if (temperature === undefined || humidity === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Temperature dan humidity diperlukan'
            });
        }
        
        const result = await db.saveSensorData(temperature, humidity, pumpStatus, mode, setpoint);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Status logger MQTT
app.get('/api/logger-status', (req, res) => {
    res.json({
        success: true,
        status: mqttLogger.getStatus()
    });
});

// Cleanup data lama
app.post('/api/cleanup', async (req, res) => {
    try {
        await db.cleanupOldData();
        res.json({
            success: true,
            message: 'Data lama berhasil dibersihkan'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handler
app.use((error, req, res, next) => {
    console.error('API Error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 API Server berjalan di port ${port}`);
    console.log(`📊 Database logging aktif setiap 5 menit`);
    console.log(`🔗 Health check: http://localhost:${port}/api/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Menghentikan server...');
    mqttLogger.stop();
    process.exit(0);
});

export default app;