# server.py
from flask import Flask, request, render_template_string

app = Flask(__name__)

# In-memory storage for team data
team_data = {
   
}


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
    team_number = request.form['team_number']
    if team_number not in team_data:
        team_data[team_number] = {
            'temperature': request.form['temperature'],
            'humidity': request.form['humidity'],
            'timestamp': request.form['timestamp'],
            'count': 1  # Initialize count
        }
        print("Data from Team number: " + request.form['team_number'])
        print(request.form['temperature'])
    else:
        team_data[team_number]['temperature'] = request.form['temperature']
        team_data[team_number]['humidity'] = request.form['humidity']
        team_data[team_number]['timestamp'] = request.form['timestamp']
        team_data[team_number]['count'] += 1  # Increment count
        print("Data from Team number: " + request.form['team_number'])
        print(request.form['temperature'])
    return "Data Received"
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8888)
