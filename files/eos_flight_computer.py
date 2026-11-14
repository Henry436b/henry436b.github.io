# =========================================================
# EOS FLIGHT COMPUTER — FLIGHT DATA LOGGER
# =========================================================
# Target:       Raspberry Pi Pico (CircuitPython)
# Sensors:      BNO055 IMU  (I2C: GP12/GP13)
#               BMP3XX Baro (I2C: GP14/GP15)
# Output:       Flight_log.csv  (SD or onboard flash)
#
# Behavior:
#   1. 90 s silent wait  (pre-arm delay)
#   2. 5 s barometric calibration at rest
#   3. Armed state — polls sensors, awaits launch trigger
#   4. Launch detected when vertical acceleration exceeds
#      2.5 m/s² for 5 consecutive samples
#   5. Logs sensor data for 2 minutes post-launch, then halts
#
# Logged Channels (CSV):
#   time_s           — mission elapsed time (s)
#   pressure_hpa     — barometric pressure (hPa)
#   temp_c           — temperature (°C)
#   altitude_m       — pressure-derived altitude (m AGL)
#   baro_altitude_m  — raw barometric altitude (m AGL)
#   comp_altitude_m  — complementary-filter altitude (m AGL)
#   ax, ay, az       — linear acceleration (m/s²)
#   gx, gy, gz       — gyroscope (rad/s)
#   mx, my, mz       — magnetometer (µT)
#
# Altitude Filter:
#   Complementary filter blends IMU-integrated altitude
#   (α = 0.9) with barometric altitude (1 − α = 0.1)
#   to suppress baro noise while tracking fast dynamics.
#
# LED Indicators:
#   Slow blink  (0.8 s)  — armed, awaiting launch
#   Fast blink  (0.2 s)  — logging in progress
#   10× rapid flash      — launch confirmed
#   Solid off            — logging complete
# =========================================================


import storage
import time
import board
import busio
import adafruit_bno055
import adafruit_bmp3xx
import digitalio

# =========================================================
# LED SETUP
# =========================================================
led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT

# =========================================================
# FILE SETUP
# =========================================================
f = open("Flight_log.csv", "w")
f.write(
    "time_s,"
    "pressure_hpa,temp_c,baro_altitude_m,comp_altitude_m,"
    "ax,ay,az,"
    "gx,gy,gz,"
    "mx,my,mz\n"
)
f.flush()

# =========================================================
# I2C SETUP
# =========================================================
i2c_bno = busio.I2C(scl=board.GP13, sda=board.GP12)
i2c_bmp = busio.I2C(scl=board.GP15, sda=board.GP14)

bno = adafruit_bno055.BNO055_I2C(i2c_bno)
bmp = adafruit_bmp3xx.BMP3XX_I2C(i2c_bmp, address=0x76)

# =========================================================
# SETTINGS
# =========================================================
LOG_DURATION = .5 * 60
alpha = 0.92

# IMU state
velocity = 0.0
imu_altitude = 0.0
last_time = time.monotonic()

# =========================================================
# ALTITUDE FUNCTION
# =========================================================
def pressure_to_altitude(p_hpa, baseline_p):
    return 44330.0 * (1.0 - (p_hpa / baseline_p) ** 0.1903)

# =========================================================
# STARTUP
# =========================================================
print("Waiting...")
led.value = False
time.sleep(5)

print("Calibrating...")
led.value = True

cal_time = 5.0
start = time.monotonic()

pressure_sum = 0.0
count = 0

while time.monotonic() - start < cal_time:
    p = bmp.pressure
    if p is None:
        continue
    pressure_sum += p
    count += 1
    time.sleep(0.01)

baseline_pressure = pressure_sum / count

print("Calibration complete")

# =========================================================
# STATE
# =========================================================
start_time = None
launched = False
confirm = 0

launch_threshold = 2.5
confirm_needed = 5

# =========================================================
# LED TIMING
# =========================================================
led_timer = time.monotonic()
armed_interval = 0.8
logging_interval = 0.2

print("Armed... waiting for launch")

# =========================================================
# MAIN LOOP
# =========================================================
while True:

    now = time.monotonic()

    # -----------------------------------------------------
    # LED: ARMED BLINK
    # -----------------------------------------------------
    if not launched:
        if now - led_timer > armed_interval:
            led_timer = now
            led.value = not led.value

    # -----------------------------------------------------
    # SENSOR READS
    # -----------------------------------------------------
    lin_accel = bno.linear_acceleration
    gyro = bno.gyro
    mag = bno.magnetic

    pressure = bmp.pressure
    temperature = bmp.temperature

    if lin_accel is None or gyro is None or mag is None:
        continue

    ax, ay, az = lin_accel
    gx, gy, gz = gyro
    mx, my, mz = mag

    if pressure is None:
        pressure = baseline_pressure

    if temperature is None:
        temperature = 0.0

    baro_altitude = pressure_to_altitude(pressure, baseline_pressure)

    # -----------------------------------------------------
    # COMPLEMENTARY FILTER — Y is vertical axis
    # -----------------------------------------------------
    dt = now - last_time
    last_time = now

    motion_threshold = 0.35
    if abs(ax) < motion_threshold:
        ax = 0.0

    velocity += ax * dt
    velocity *= 0.995

    if abs(velocity) < 0.03:
        velocity = 0.0

    imu_altitude += velocity * dt

    comp_altitude = alpha * imu_altitude + (1.0 - alpha) * baro_altitude
    imu_altitude = comp_altitude
    
    # -----------------------------------------------------
    # LAUNCH DETECTION
    # -----------------------------------------------------
    if not launched:

        if abs(ax) > launch_threshold:
            confirm += 1
        else:
            confirm = 0

        if confirm >= confirm_needed:

            launched = True
            start_time = time.monotonic()

            print("LAUNCH DETECTED")

            for _ in range(10):
                led.value = True
                time.sleep(0.05)
                led.value = False
                time.sleep(0.05)

            led_timer = now

    # -----------------------------------------------------
    # LOGGING
    # -----------------------------------------------------
    else:

        t = time.monotonic() - start_time

        if t > LOG_DURATION:
            break

        if now - led_timer > logging_interval:
            led_timer = now
            led.value = not led.value

        f.write(
            "{:.2f},{:.3f},{:.2f},{:.3f},{:.3f},"
            "{:.3f},{:.3f},{:.3f},"
            "{:.3f},{:.3f},{:.3f},"
            "{:.3f},{:.3f},{:.3f}\n"
            .format(
                t,
                pressure,
                temperature,
                baro_altitude,
                comp_altitude,
                ax, ay, az,
                gx, gy, gz,
                mx, my, mz
            )
        )

        f.flush()
        time.sleep(0.01)

# =========================================================
# FINISH
# =========================================================
f.close()
led.value = False
print("Flight log saved")
