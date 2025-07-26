# Greenhouse Jamur Tiram - Dashboard & Data Logger

Dashboard monitoring dan kontrol greenhouse jamur tiram dengan penyimpanan data otomatis ke Neon.tech database.

## Fitur

### 🌡️ **Monitoring Real-time**
- Data suhu dan kelembaban dari sensor DHT22
- Update setiap 5 detik via MQTT
- Chart trendline dinamis
- Status koneksi ESP8266

### 💾 **Penyimpanan Data**
- Auto-save ke Neon.tech database setiap 5 menit
- Data historis 24 jam di chart
- Export data ke CSV
- Statistik harian

### 🎛️ **Kontrol Sistem**
- Mode otomatis/manual
- Kontrol pompa air
- Pengaturan setpoint kelembaban
- Toleransi kelembaban

## Setup

### 1. Database Neon.tech
1. Buat akun di [Neon.tech](https://neon.tech)
2. Buat database baru
3. Copy connection string
4. Jalankan schema SQL:
```bash
psql "your-neon-connection-string" -f database/schema.sql
```

### 2. Environment Variables
Copy `.env.example` ke `.env` dan isi:
```env
NEON_DATABASE_URL=postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
HIVEMQ_HOST=f26c1dc91f934227bff8410cfeabae94.s1.eu.hivemq.cloud
HIVEMQ_PORT=8884
HIVEMQ_USERNAME=your-username
HIVEMQ_PASSWORD=your-password
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Jalankan Aplikasi

**Dashboard (Frontend):**
```bash
npm run dev
```

**API Server & Logger (Backend):**
```bash
npm run server
```

## MQTT Topics

### Dari ESP8266 ke Dashboard:
- `greenhouse/dht22/temperature` - Data suhu
- `greenhouse/dht22/humidity` - Data kelembaban
- `greenhouse/pump/status` - Status pompa (1/0)
- `greenhouse/mode` - Mode operasi (auto/manual)
- `greenhouse/setpoint` - Target kelembaban

### Dari Dashboard ke ESP8266:
- `greenhouse/pump/control` - Kontrol pompa (1/0)
- `greenhouse/mode` - Ubah mode (auto/manual)
- `greenhouse/setpoint` - Set target kelembaban
- `greenhouse/tolerance` - Set toleransi
- `greenhouse/request_data` - Request data terbaru

## API Endpoints

- `GET /api/health` - Status sistem
- `GET /api/sensor-data?hours=24` - Data sensor
- `GET /api/daily-stats?days=7` - Statistik harian
- `GET /api/export?startDate=2024-01-01&endDate=2024-01-31` - Export data
- `POST /api/save-data` - Simpan data manual
- `GET /api/logger-status` - Status MQTT logger
- `POST /api/cleanup` - Bersihkan data lama

## Struktur Database

### Tabel `sensor_readings`
- `id` - Primary key
- `temperature` - Suhu (°C)
- `humidity` - Kelembaban (%)
- `pump_status` - Status pompa
- `mode` - Mode operasi
- `setpoint` - Target kelembaban
- `recorded_at` - Waktu pencatatan
- `created_at` - Waktu dibuat

### View `daily_sensor_summary`
- Ringkasan data harian
- Rata-rata, min, max suhu & kelembaban
- Total pembacaan per hari

## Kode Arduino ESP8266

Pastikan ESP8266 mengirim data dengan format:
- Suhu: angka desimal (contoh: "25.6")
- Kelembaban: angka desimal (contoh: "75.2")
- Status pompa: "1" atau "0"
- Mode: "auto" atau "manual"
- Setpoint: angka integer (contoh: "75")

## Monitoring & Maintenance

- Data disimpan otomatis setiap 5 menit
- Data lama (>30 hari) dibersihkan otomatis
- Reconnect otomatis jika koneksi MQTT terputus
- Health check endpoint untuk monitoring

## Troubleshooting

1. **MQTT tidak terhubung**: Periksa kredensial HiveMQ
2. **Database error**: Periksa connection string Neon.tech
3. **Data tidak tersimpan**: Periksa log server untuk error
4. **Chart kosong**: Pastikan ada data di database