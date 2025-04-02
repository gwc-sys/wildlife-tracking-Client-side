# wildlife-tracking-

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/gwc-sys/wildlife-tracking-)


import network
import urequests
import utime
from machine import Pin
import ujson  # For JSON parsing

# WiFi Credentials
SSID = "Wokwi-GUEST"  # Replace with your WiFi SSID
PASSWORD = ""  # Replace with your WiFi password

# Firebase Credentials
FIREBASE_URL = "https://te-project-d9e53-default-rtdb.firebaseio.com/"  # Replace with your Firebase database URL

# Twilio Credentials
TWILIO_SID = "AC715623333962d6046aac01be89657de7"
TWILIO_AUTH_TOKEN = "790092bafa468e3b29ffc8e43e7366e0"
TWILIO_PHONE_NUMBER = "+14123575093"  # Your Twilio phone number
RECIPIENT_PHONE_NUMBER = "+919021329710"  # Recipient's phone number

# PIR Sensor and LED Pin Configuration
PIR_SENSOR_PIN = 13  # GPIO13 (D13 on most ESP32 boards)
LED_PIN = 12  # LED connected to # GPIO12 (D12)

pir_sensor = Pin(PIR_SENSOR_PIN, Pin.IN)
led = Pin(LED_PIN, Pin.OUT)

# Connect to WiFi
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(SSID, PASSWORD)

    timeout = 10  # 10-second timeout
    while not wlan.isconnected() and timeout > 0:
        utime.sleep(1)
        print("Connecting to WiFi...")
        timeout -= 1

    if wlan.isconnected():
        print("✅ Connected to WiFi:", wlan.ifconfig())
    else:
        print("❌ Failed to connect to WiFi")

# Send SMS via Twilio
def send_twilio_sms():
    try:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = f"To={RECIPIENT_PHONE_NUMBER}&From={TWILIO_PHONE_NUMBER}&Body=🚨 Motion Detected!"
        auth = (TWILIO_SID, TWILIO_AUTH_TOKEN)

        response = urequests.post(url, data=data, auth=auth, headers=headers)
        response_json = ujson.loads(response.text)
        status = response_json.get('status')

        if status in ['queued', 'sent']:
            print(f"✅ SMS sent to {RECIPIENT_PHONE_NUMBER} (SID: {response_json.get('sid')})")
        else:
            print(f"❌ Failed to send SMS. Status: {status}")

        response.close()
    except Exception as e:
        print("❌ Error sending SMS:", e)

# Send data to Firebase using POST method
def send_to_firebase():
    try:
        url = f"{FIREBASE_URL}/motion_status.json"  # Correct Firebase URL
        data = {"status": "Motion Detected"}  # Data to send (use a dictionary)
        headers = {"Content-Type": "application/json"}

        # Use json parameter instead of data for proper formatting
        response = urequests.post(url, json=data, headers=headers)  # Use POST instead of PUT
        print("✅ Data posted to Firebase:", response.text)

        response.close()  # Optional, but it doesn't hurt to close the response
    except Exception as e:
        print("❌ Error posting to Firebase:", e)


# Main Logic
connect_wifi()

last_triggered = 0  # Variable to store the last motion detection time

while True:
    if pir_sensor.value() == 1:  # PIR sensor detects motion
        current_time = utime.time()

        # Avoid repeated triggers within 10 seconds
        if current_time - last_triggered > 10:
            print("🚨 Motion Detected bro!")

            # Turn ON LED
            led.value(1)

            # Send notifications
            send_twilio_sms()  
            send_to_firebase()  

            # Keep LED ON for 10 seconds
            utime.sleep(10)

            # Turn OFF LED
            led.value(0)

            # Update last triggered time
            last_triggered = current_time

    utime.sleep(1)  # Small delay to prevent excessive checking
