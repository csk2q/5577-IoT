using System.Text.Json.Serialization;

namespace BlazorCloud.Data.DataTransferObjects;

public class UploadedData
{
    [JsonPropertyName("team_number")]
    public int TeamNumber { get; set; }

    [JsonPropertyName("temperature")]
    public float Temperature { get; set; }

    [JsonPropertyName("humidity")]
    public float Humidity { get; set; }

    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; }
}