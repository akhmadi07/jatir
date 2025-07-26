-- Schema untuk tabel sensor data
CREATE TABLE IF NOT EXISTS sensor_readings (
    id SERIAL PRIMARY KEY,
    temperature DECIMAL(5,2) NOT NULL,
    humidity DECIMAL(5,2) NOT NULL,
    pump_status BOOLEAN DEFAULT FALSE,
    mode VARCHAR(10) DEFAULT 'auto',
    setpoint INTEGER DEFAULT 75,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk query berdasarkan waktu
CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at ON sensor_readings(recorded_at DESC);

-- Index untuk query berdasarkan tanggal
CREATE INDEX IF NOT EXISTS idx_sensor_readings_date ON sensor_readings(DATE(recorded_at));

-- View untuk data harian
CREATE OR REPLACE VIEW daily_sensor_summary AS
SELECT 
    DATE(recorded_at) as date,
    AVG(temperature) as avg_temperature,
    MIN(temperature) as min_temperature,
    MAX(temperature) as max_temperature,
    AVG(humidity) as avg_humidity,
    MIN(humidity) as min_humidity,
    MAX(humidity) as max_humidity,
    COUNT(*) as total_readings
FROM sensor_readings 
GROUP BY DATE(recorded_at)
ORDER BY date DESC;

-- Function untuk cleanup data lama (opsional, simpan data 30 hari)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    DELETE FROM sensor_readings 
    WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;