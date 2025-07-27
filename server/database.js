import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

// Inisialisasi koneksi Neon
const sql = neon(process.env.NEON_DATABASE_URL);

class DatabaseManager {
    constructor() {
        this.sql = sql;
    }

    // Simpan data sensor ke database
    async saveSensorData(temperature, humidity, pumpStatus = false, mode = 'auto', setpoint = 75) {
        try {
            const result = await this.sql`
                INSERT INTO sensor_readings (temperature, humidity, pump_status, mode, setpoint, recorded_at)
                VALUES (${temperature}, ${humidity}, ${pumpStatus}, ${mode}, ${setpoint}, NOW())
                RETURNING id, recorded_at
            `;
            
            console.log(`Data tersimpan dengan ID: ${result[0].id} pada ${result[0].recorded_at}`);
            return result[0];
        } catch (error) {
            console.error('Error menyimpan data sensor:', error);
            throw error;
        }
    }

    // Ambil data sensor terbaru (untuk chart)
    async getRecentSensorData(hours = 24) {
        try {
            // Batasi maksimal 24 jam dan ambil data dengan interval yang sesuai
            const limitedHours = Math.min(hours, 24);
            
            const result = await this.sql`
                SELECT 
                    temperature,
                    humidity,
                    pump_status,
                    mode,
                    setpoint,
                    recorded_at
                FROM sensor_readings 
                WHERE recorded_at >= NOW() - INTERVAL '${limitedHours} hours'
                ORDER BY recorded_at ASC
                LIMIT 500
            `;
            
            return result;
        } catch (error) {
            console.error('Error mengambil data sensor:', error);
            throw error;
        }
    }

    // Ambil statistik harian
    async getDailyStats(days = 7) {
        try {
            const result = await this.sql`
                SELECT * FROM daily_sensor_summary 
                WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
                ORDER BY date DESC
            `;
            
            return result;
        } catch (error) {
            console.error('Error mengambil statistik harian:', error);
            throw error;
        }
    }

    // Ambil data untuk export
    async getDataForExport(startDate, endDate) {
        try {
            const result = await this.sql`
                SELECT 
                    temperature,
                    humidity,
                    pump_status,
                    mode,
                    setpoint,
                    recorded_at
                FROM sensor_readings 
                WHERE recorded_at BETWEEN ${startDate} AND ${endDate}
                ORDER BY recorded_at ASC
            `;
            
            return result;
        } catch (error) {
            console.error('Error mengambil data untuk export:', error);
            throw error;
        }
    }

    // Test koneksi database
    async testConnection() {
        try {
            const result = await this.sql`SELECT NOW() as current_time`;
            console.log('Koneksi database berhasil:', result[0].current_time);
            return true;
        } catch (error) {
            console.error('Error koneksi database:', error);
            return false;
        }
    }

    // Cleanup data lama
    async cleanupOldData() {
        try {
            const result = await this.sql`SELECT cleanup_old_data()`;
            console.log('Cleanup data lama berhasil');
            return result;
        } catch (error) {
            console.error('Error cleanup data lama:', error);
            throw error;
        }
    }
}

export default DatabaseManager;