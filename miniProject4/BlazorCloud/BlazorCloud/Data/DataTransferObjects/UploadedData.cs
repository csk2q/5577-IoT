using System.Text.Json.Serialization;

namespace BlazorCloud.Data.DataTransferObjects;

public class UploadedData
{
    //{"team_number":2,"temperature":22.2,"humidity":44,"timestamp":1111627}
    
    [JsonPropertyName("team_number")]
    public int TeamNumber { get; set; }

    [JsonPropertyName("temperature")]
    public float Temperature { get; set; }

    [JsonPropertyName("humidity")]
    public float Humidity { get; set; }

    [JsonPropertyName("timestamp")]
    public ulong Timestamp { get; set; }
}

