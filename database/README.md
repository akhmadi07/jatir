# Database Setup untuk Neon.tech

## Cara Penggunaan

### 1. Setup Database di Neon.tech

1. Login ke [Neon.tech](https://neon.tech)
2. Buat database baru atau gunakan yang sudah ada
3. Copy connection string dari dashboard Neon
4. Jalankan script SQL setup:

```bash
# Menggunakan psql
psql "your-neon-connection-string" -f database/neon-setup.sql

# Atau menggunakan Neon SQL Editor di dashboard
# Copy-paste isi file neon-setup.sql ke SQL Editor
```

### 2. Struktur Database

#### Tabel Utama: `sensor_readings`
- `id` - Primary key auto increment
- `temperature` - Suhu dalam Celsius (DECIMAL 5,2)
- `humidity` - Kelembaban dalam persen (DECIMAL 5,2)
- `pump_status` - Status pompa (BOOLEAN)
- `mode` - Mode operasi: 'auto' atau 'manual'
- `setpoint` - Target kelembaban (INTEGER 30-90)
- `tolerance` - Toleransi kelembaban (INTEGER 1-15)
- `recorded_at` - Waktu pengambilan data
- `created_at` - Waktu penyimpanan ke database

#### Views yang Tersedia

1. **`daily_sensor_summary`** - Statistik harian
   - Rata-rata, min, max suhu & kelembaban
   - Statistik penggunaan pompa
   - Mode operasi dominan

2. **`latest_sensor_data`** - Data sensor terbaru
   - Data real-time terakhir
   - Selisih waktu dari sekarang

3. **`system_health`** - Monitoring sistem
   - Status koneksi
   - Jumlah data hari ini
   - Ukuran database

#### Functions yang Tersedia

1. **`cleanup_old_data(days)`** - Hapus data lama
   ```sql
   SELECT * FROM cleanup_old_data(30); -- Hapus data > 30 hari
   ```

2. **`get_period_stats(start, end)`** - Statistik periode
   ```sql
   SELECT * FROM get_period_stats('2024-01-01', '2024-01-31');
   ```

### 3. Query Contoh

#### Mendapatkan Data 24 Jam Terakhir
```sql
SELECT temperature, humidity, pump_status, recorded_at 
FROM sensor_readings 
WHERE recorded_at >= NOW() - INTERVAL '24 hours'
ORDER BY recorded_at DESC;
```

#### Statistik Harian Minggu Ini
```sql
SELECT * FROM daily_sensor_summary 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

#### Data Terbaru
```sql
SELECT * FROM latest_sensor_data;
```

#### Status Sistem
```sql
SELECT * FROM system_health;
```

#### Export Data Periode Tertentu
```sql
SELECT 
    recorded_at,
    temperature,
    humidity,
    pump_status,
    mode,
    setpoint
FROM sensor_readings 
WHERE recorded_at BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY recorded_at ASC;
```

### 4. Maintenance

#### Cleanup Data Lama (Otomatis)
```sql
-- Hapus data lebih dari 30 hari
SELECT * FROM cleanup_old_data(30);
```

#### Monitoring Performa
```sql
-- Cek ukuran tabel
SELECT pg_size_pretty(pg_total_relation_size('sensor_readings'));

-- Cek jumlah data per hari
SELECT DATE(recorded_at), COUNT(*) 
FROM sensor_readings 
GROUP BY DATE(recorded_at) 
ORDER BY DATE(recorded_at) DESC 
LIMIT 7;
```

### 5. Backup & Restore

#### Backup Data
```bash
pg_dump "your-neon-connection-string" -t sensor_readings > backup.sql
```

#### Restore Data
```bash
psql "your-neon-connection-string" < backup.sql
```

### 6. Environment Variables

Pastikan file `.env` sudah dikonfigurasi:

```env
NEON_DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### 7. Troubleshooting

#### Error: relation does not exist
- Pastikan script setup sudah dijalankan
- Cek apakah tabel sudah dibuat dengan: `\dt` di psql

#### Error: permission denied
- Pastikan user memiliki permission yang cukup
- Uncomment bagian GRANTS di script setup

#### Performance Issues
- Cek apakah indexes sudah dibuat
- Monitor query dengan `EXPLAIN ANALYZE`
- Pertimbangkan cleanup data lama

### 8. Monitoring

Untuk monitoring real-time, gunakan query berikut:

```sql
-- Status koneksi ESP32
SELECT 
    CASE 
        WHEN EXTRACT(EPOCH FROM (NOW() - MAX(recorded_at))) < 300 THEN 'ONLINE'
        WHEN EXTRACT(EPOCH FROM (NOW() - MAX(recorded_at))) < 1800 THEN 'WARNING'
        ELSE 'OFFLINE'
    END as status,
    MAX(recorded_at) as last_data,
    COUNT(*) as today_count
FROM sensor_readings 
WHERE DATE(recorded_at) = CURRENT_DATE;
```