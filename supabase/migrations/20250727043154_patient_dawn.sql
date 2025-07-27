-- =====================================================
-- GREENHOUSE JAMUR TIRAM - DATABASE SETUP NEON.TECH
-- =====================================================
-- Script ini akan membuat semua tabel, index, view, dan function
-- yang diperlukan untuk sistem monitoring greenhouse jamur tiram

-- Hapus tabel jika sudah ada (hati-hati dengan data!)
-- DROP TABLE IF EXISTS sensor_readings CASCADE;
-- DROP VIEW IF EXISTS daily_sensor_summary CASCADE;
-- DROP FUNCTION IF EXISTS cleanup_old_data() CASCADE;

-- =====================================================
-- 1. TABEL UTAMA: SENSOR READINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS sensor_readings (
    id SERIAL PRIMARY KEY,
    temperature DECIMAL(5,2) NOT NULL CHECK (temperature >= -50 AND temperature <= 100),
    humidity DECIMAL(5,2) NOT NULL CHECK (humidity >= 0 AND humidity <= 100),
    pump_status BOOLEAN DEFAULT FALSE,
    mode VARCHAR(10) DEFAULT 'auto' CHECK (mode IN ('auto', 'manual')),
    setpoint INTEGER DEFAULT 75 CHECK (setpoint >= 30 AND setpoint <= 90),
    tolerance INTEGER DEFAULT 5 CHECK (tolerance >= 1 AND tolerance <= 15),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Komentar untuk dokumentasi
COMMENT ON TABLE sensor_readings IS 'Tabel utama untuk menyimpan data sensor DHT22 dan status sistem';
COMMENT ON COLUMN sensor_readings.temperature IS 'Suhu dalam Celsius dari sensor DHT22';
COMMENT ON COLUMN sensor_readings.humidity IS 'Kelembaban dalam persen dari sensor DHT22';
COMMENT ON COLUMN sensor_readings.pump_status IS 'Status pompa air (true=hidup, false=mati)';
COMMENT ON COLUMN sensor_readings.mode IS 'Mode operasi sistem (auto/manual)';
COMMENT ON COLUMN sensor_readings.setpoint IS 'Target kelembaban yang diinginkan (%)';
COMMENT ON COLUMN sensor_readings.tolerance IS 'Toleransi kelembaban untuk mode auto (%)';
COMMENT ON COLUMN sensor_readings.recorded_at IS 'Waktu pengambilan data sensor';
COMMENT ON COLUMN sensor_readings.created_at IS 'Waktu data disimpan ke database';

-- =====================================================
-- 2. INDEXES UNTUK PERFORMA QUERY
-- =====================================================

-- Index untuk query berdasarkan waktu (paling sering digunakan)
CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at 
ON sensor_readings(recorded_at DESC);

-- Index untuk query berdasarkan tanggal
CREATE INDEX IF NOT EXISTS idx_sensor_readings_date 
ON sensor_readings(DATE(recorded_at));

-- Index untuk query berdasarkan mode dan status pompa
CREATE INDEX IF NOT EXISTS idx_sensor_readings_mode_pump 
ON sensor_readings(mode, pump_status);

-- Index composite untuk query statistik harian
CREATE INDEX IF NOT EXISTS idx_sensor_readings_date_temp_humid 
ON sensor_readings(DATE(recorded_at), temperature, humidity);

-- =====================================================
-- 3. VIEW UNTUK STATISTIK HARIAN
-- =====================================================
CREATE OR REPLACE VIEW daily_sensor_summary AS
SELECT 
    DATE(recorded_at) as date,
    COUNT(*) as total_readings,
    
    -- Statistik Suhu
    ROUND(AVG(temperature)::numeric, 2) as avg_temperature,
    MIN(temperature) as min_temperature,
    MAX(temperature) as max_temperature,
    ROUND(STDDEV(temperature)::numeric, 2) as stddev_temperature,
    
    -- Statistik Kelembaban
    ROUND(AVG(humidity)::numeric, 2) as avg_humidity,
    MIN(humidity) as min_humidity,
    MAX(humidity) as max_humidity,
    ROUND(STDDEV(humidity)::numeric, 2) as stddev_humidity,
    
    -- Statistik Pompa
    COUNT(CASE WHEN pump_status = true THEN 1 END) as pump_on_count,
    COUNT(CASE WHEN pump_status = false THEN 1 END) as pump_off_count,
    ROUND(
        (COUNT(CASE WHEN pump_status = true THEN 1 END) * 100.0 / COUNT(*))::numeric, 
        2
    ) as pump_on_percentage,
    
    -- Mode operasi dominan
    MODE() WITHIN GROUP (ORDER BY mode) as dominant_mode,
    
    -- Setpoint rata-rata
    ROUND(AVG(setpoint)::numeric, 0) as avg_setpoint,
    
    -- Waktu pertama dan terakhir
    MIN(recorded_at) as first_reading,
    MAX(recorded_at) as last_reading
    
FROM sensor_readings 
GROUP BY DATE(recorded_at)
ORDER BY date DESC;

COMMENT ON VIEW daily_sensor_summary IS 'View untuk statistik harian data sensor';

-- =====================================================
-- 4. VIEW UNTUK DATA TERBARU (REAL-TIME)
-- =====================================================
CREATE OR REPLACE VIEW latest_sensor_data AS
SELECT 
    temperature,
    humidity,
    pump_status,
    mode,
    setpoint,
    tolerance,
    recorded_at,
    EXTRACT(EPOCH FROM (NOW() - recorded_at)) as seconds_ago
FROM sensor_readings 
ORDER BY recorded_at DESC 
LIMIT 1;

COMMENT ON VIEW latest_sensor_data IS 'View untuk mendapatkan data sensor terbaru';

-- =====================================================
-- 5. VIEW UNTUK MONITORING SISTEM
-- =====================================================
CREATE OR REPLACE VIEW system_health AS
SELECT 
    -- Data terakhir
    (SELECT recorded_at FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1) as last_data_time,
    
    -- Selisih waktu dari data terakhir
    EXTRACT(EPOCH FROM (
        NOW() - (SELECT recorded_at FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1)
    )) as seconds_since_last_data,
    
    -- Total data hari ini
    (SELECT COUNT(*) FROM sensor_readings WHERE DATE(recorded_at) = CURRENT_DATE) as today_readings,
    
    -- Total data keseluruhan
    (SELECT COUNT(*) FROM sensor_readings) as total_readings,
    
    -- Ukuran database (estimasi)
    pg_size_pretty(pg_total_relation_size('sensor_readings')) as table_size,
    
    -- Status koneksi (berdasarkan data terbaru)
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - (SELECT recorded_at FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1))) < 300 
        THEN 'ONLINE'
        WHEN EXTRACT(EPOCH FROM (NOW() - (SELECT recorded_at FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1))) < 1800 
        THEN 'WARNING'
        ELSE 'OFFLINE'
    END as connection_status;

COMMENT ON VIEW system_health IS 'View untuk monitoring kesehatan sistem';

-- =====================================================
-- 6. FUNCTIONS UNTUK MAINTENANCE
-- =====================================================

-- Function untuk cleanup data lama
CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep INTEGER DEFAULT 30)
RETURNS TABLE(deleted_count BIGINT, oldest_kept_date TIMESTAMP WITH TIME ZONE) AS $$
DECLARE
    deleted_rows BIGINT;
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    cutoff_date := NOW() - INTERVAL '1 day' * days_to_keep;
    
    DELETE FROM sensor_readings 
    WHERE recorded_at < cutoff_date;
    
    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    
    RETURN QUERY SELECT 
        deleted_rows,
        (SELECT MIN(recorded_at) FROM sensor_readings);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_data IS 'Function untuk menghapus data lama, default 30 hari';

-- Function untuk mendapatkan statistik periode tertentu
CREATE OR REPLACE FUNCTION get_period_stats(
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(
    total_readings BIGINT,
    avg_temperature NUMERIC,
    avg_humidity NUMERIC,
    pump_runtime_hours NUMERIC,
    data_quality_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_readings,
        ROUND(AVG(temperature)::numeric, 2) as avg_temperature,
        ROUND(AVG(humidity)::numeric, 2) as avg_humidity,
        ROUND(
            (COUNT(CASE WHEN pump_status = true THEN 1 END) * 5.0 / 60)::numeric, 
            2
        ) as pump_runtime_hours, -- Asumsi data setiap 5 menit
        ROUND(
            (COUNT(*) * 100.0 / 
             EXTRACT(EPOCH FROM (end_date - start_date)) * 5 / 60)::numeric, 
            2
        ) as data_quality_score -- Persentase data yang tersedia
    FROM sensor_readings 
    WHERE recorded_at BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_period_stats IS 'Function untuk mendapatkan statistik dalam periode tertentu';

-- =====================================================
-- 7. TRIGGER UNTUK AUTO-UPDATE TIMESTAMPS
-- =====================================================

-- Function untuk update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk auto-update created_at (jika diperlukan)
-- CREATE TRIGGER update_sensor_readings_updated_at 
--     BEFORE UPDATE ON sensor_readings 
--     FOR EACH ROW 
--     EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. SAMPLE DATA UNTUK TESTING (OPSIONAL)
-- =====================================================

-- Uncomment untuk insert sample data
/*
INSERT INTO sensor_readings (temperature, humidity, pump_status, mode, setpoint, recorded_at) VALUES
(26.5, 78.2, false, 'auto', 75, NOW() - INTERVAL '1 hour'),
(27.1, 76.8, true, 'auto', 75, NOW() - INTERVAL '50 minutes'),
(26.8, 79.1, false, 'auto', 75, NOW() - INTERVAL '40 minutes'),
(27.3, 74.5, true, 'auto', 75, NOW() - INTERVAL '30 minutes'),
(26.9, 77.6, false, 'auto', 75, NOW() - INTERVAL '20 minutes'),
(27.0, 78.9, false, 'auto', 75, NOW() - INTERVAL '10 minutes'),
(26.7, 79.8, true, 'manual', 80, NOW() - INTERVAL '5 minutes'),
(27.2, 76.3, false, 'manual', 80, NOW());
*/

-- =====================================================
-- 9. GRANTS DAN PERMISSIONS (SESUAIKAN DENGAN KEBUTUHAN)
-- =====================================================

-- Grant permissions untuk user aplikasi (sesuaikan dengan user Neon Anda)
-- GRANT SELECT, INSERT, UPDATE ON sensor_readings TO your_app_user;
-- GRANT SELECT ON daily_sensor_summary TO your_app_user;
-- GRANT SELECT ON latest_sensor_data TO your_app_user;
-- GRANT SELECT ON system_health TO your_app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_old_data TO your_app_user;
-- GRANT EXECUTE ON FUNCTION get_period_stats TO your_app_user;

-- =====================================================
-- 10. VERIFICATION QUERIES
-- =====================================================

-- Query untuk verifikasi setup
SELECT 'Setup completed successfully!' as status;

-- Cek tabel yang dibuat
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%sensor%';

-- Cek indexes yang dibuat
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'sensor_readings';

-- Cek views yang dibuat
SELECT table_name as view_name 
FROM information_schema.views 
WHERE table_schema = 'public';

-- Cek functions yang dibuat
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%sensor%' OR routine_name LIKE '%cleanup%';

-- =====================================================
-- SELESAI - DATABASE SETUP COMPLETE
-- =====================================================