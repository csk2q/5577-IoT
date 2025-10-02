# server.py
from flask import Flask, request, render_template_string
from Crypto.Cipher import AES       # *** CHANGED: import AES
import base64                       # *** CHANGED: import base64
import json

app = Flask(__name__)

# *** CHANGED: AES key and IV (must match ESP32)
AES_KEY = b"1234567890abcdef"
AES_IV  = b"abcdef1234567890"

# In-memory storage for team data
team_data = {
   
}

def decrypt_aes(encrypted_b64):
    encrypted_bytes = base64.b64decode(encrypted_b64)
    cipher = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
    decrypted = cipher.decrypt(encrypted_bytes)
    # Remove null padding at the end
    return decrypted.rstrip(b'\x00').decode('utf-8')

@app.route('/')
def index():
    # Sort team_data by team number
    sorted_team_data = dict(sorted(team_data.items(), key=lambda item: int(item[0])))
    
    # Debugging print to check the data
    print(sorted_team_data)

    return render_template_string('''
        <!doctype html>
        <html>
        <head>
            <title>ESP32 Sensor Readings</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    text-align: center;
                }
                table {
                    margin-left: auto;
                    margin-right: auto;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                }
                th {
                    background-color: #007bff;
                    color: white;
                }
                tr:nth-child(even){background-color: #f2f2f2;}
                tr:hover {background-color: #ddd;}
            </style>
            <script>
                setTimeout(function(){
                    location.reload();
                }, 5000); // Refresh page every 5 seconds
            </script>
        </head>
        <body>
            <h1>ESP32 Sensor Readings</h1>
            <table>
                <tr>
                    <th>Team #</th>
                    <th>Temperature</th>
                    <th>Humidity</th>
                    <th>Timestamp</th>
                    <th>Post Count</th>
                </tr>
                {% for team, data in sorted_team_data.items() %}
                    <tr>
                        <td>{{ team }}</td>
                        <td>{{ data.temperature }}°C</td>
                        <td>{{ data.humidity }}%</td>
                        <td>{{ data.timestamp }}</td>
                        <td>{{ data.count }}</td>
                    </tr>
                {% endfor %}
            </table>
        </body>
        </html>
    ''', sorted_team_data=sorted_team_data)

@app.route('/post-data', methods=['POST'])
def receive_data():
    encrypted_data = request.data
    decrypted_str = decrypt_aes(encrypted_data)   # *** CHANGED: decrypt AES
    data = json.loads(decrypted_str)             # parse JSON

    team_number = str(data.get('team_number'))
    #team_number = request.form['team_number']
    if team_number not in team_data:
        team_data[team_number] = {
            'temperature': data.get('temperature'), #data.get instead of request.form
            'humidity': data.get('humidity'),
            'timestamp': data.get('timestamp'),
            'count': 1  # Initialize count
        }
        print("Data from Team number: " + str(data.get('team_number')))
        print(data.get('temperature'))
    else:
        team_data[team_number]['temperature'] = data.get('temperature')
        team_data[team_number]['humidity'] = data.get('humidity')
        team_data[team_number]['timestamp'] = data.get('timestamp')
        team_data[team_number]['count'] += 1  # Increment count
        print("Data from Team number: " + str(data.get('team_number')))
        print(data.get('temperature'))
    return "Data Received"
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8888)
