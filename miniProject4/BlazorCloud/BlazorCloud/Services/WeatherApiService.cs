using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;

namespace BlazorCloud.Services;

public class WeatherApiService(IMemoryCache cache, IHttpClientFactory httpFactory, ILogger<WeatherApiService> logger)
{
    private static readonly string weatherApiKey = Program.weatherApiKey;
    private static string baseUrl = $"https://api.weatherapi.com/v1/current.json?key={weatherApiKey}&q=";
    
    public async Task<WeatherData?> QueryAsync(string query)
    {
        // Normalise the query value – it will be our cache key
        var cacheKey = query.Trim().ToLowerInvariant();
        
        // Attempt to get the cached result
        if (cache.TryGetValue(cacheKey, out WeatherData? cachedWeather))
        {
            // The cached result is already a WeatherJson instance, return it
            return cachedWeather;
        }
        
        // Not in cache – call the upstream WeatherAPI
        var client = httpFactory.CreateClient("WeatherApi");
        
        // Build the request URL
        var requestUri = $"{baseUrl}{Uri.EscapeDataString(query)}";
        
        HttpResponseMessage response;
        try
        {
            response = await client.GetAsync(requestUri);
        }
        catch (HttpRequestException ex)
        {
            // Network/HTTP error
            logger.LogError(ex, "Failed to query WeatherApi!");
            throw;
        }
        
        Console.WriteLine("Response: "+await response.Content.ReadAsStringAsync());
        
        // Deserialize the JSON into our model
        var weatherJson = await response.Content.ReadFromJsonAsync<WeatherJson>();
        if (weatherJson == null)
            throw new ApplicationException("Failed to query WeatherApi, returned data was null!");

        var weatherData = new WeatherData(query, weatherJson);
        
        // Store in cache for 10 minutes
        cache.Set(cacheKey, weatherData, TimeSpan.FromMinutes(10));
        
        return weatherData;
    }
    
    public class WeatherData(string query, WeatherJson data, DateTime? queryTime = null)
    {
        public readonly string query = query;
        public readonly WeatherJson data = data;
        public readonly DateTime queryTime = queryTime ?? DateTime.Now;
    }
    
    public record WeatherJson(
        [property: JsonPropertyName("location")] Location location,
        [property: JsonPropertyName("current")] Current current
    );
    
// Root myDeserializedClass = JsonSerializer.Deserialize<Root>(myJsonResponse);
    public record Condition(
        [property: JsonPropertyName("text")] string text,
        [property: JsonPropertyName("icon")] string icon,
        [property: JsonPropertyName("code")] int? code
    );

    public record Current(
        [property: JsonPropertyName("last_updated_epoch")] int? last_updated_epoch,
        [property: JsonPropertyName("last_updated")] string last_updated,
        [property: JsonPropertyName("temp_c")] double? temp_c,
        [property: JsonPropertyName("temp_f")] double? temp_f,
        [property: JsonPropertyName("is_day")] int? is_day,
        [property: JsonPropertyName("condition")] Condition condition,
        [property: JsonPropertyName("wind_mph")] double? wind_mph,
        [property: JsonPropertyName("wind_kph")] double? wind_kph,
        [property: JsonPropertyName("wind_degree")] int? wind_degree,
        [property: JsonPropertyName("wind_dir")] string wind_dir,
        [property: JsonPropertyName("pressure_mb")] double? pressure_mb,
        [property: JsonPropertyName("pressure_in")] double? pressure_in,
        [property: JsonPropertyName("precip_mm")] double? precip_mm,
        [property: JsonPropertyName("precip_in")] double? precip_in,
        [property: JsonPropertyName("humidity")] int? humidity,
        [property: JsonPropertyName("cloud")] int? cloud,
        [property: JsonPropertyName("feelslike_c")] double? feelslike_c,
        [property: JsonPropertyName("feelslike_f")] double? feelslike_f,
        [property: JsonPropertyName("windchill_c")] double? windchill_c,
        [property: JsonPropertyName("windchill_f")] double? windchill_f,
        [property: JsonPropertyName("heatindex_c")] double? heatindex_c,
        [property: JsonPropertyName("heatindex_f")] double? heatindex_f,
        [property: JsonPropertyName("dewpoint_c")] double? dewpoint_c,
        [property: JsonPropertyName("dewpoint_f")] double? dewpoint_f,
        [property: JsonPropertyName("vis_km")] double? vis_km,
        [property: JsonPropertyName("vis_miles")] double? vis_miles,
        [property: JsonPropertyName("uv")] double? uv,
        [property: JsonPropertyName("gust_mph")] double? gust_mph,
        [property: JsonPropertyName("gust_kph")] double? gust_kph,
        [property: JsonPropertyName("short_rad")] int? short_rad,
        [property: JsonPropertyName("diff_rad")] int? diff_rad,
        [property: JsonPropertyName("dni")] int? dni,
        [property: JsonPropertyName("gti")] int? gti
    );

    public record Location(
        [property: JsonPropertyName("name")] string name,
        [property: JsonPropertyName("region")] string region,
        [property: JsonPropertyName("country")] string country,
        [property: JsonPropertyName("lat")] double? lat,
        [property: JsonPropertyName("lon")] double? lon,
        [property: JsonPropertyName("tz_id")] string tz_id,
        [property: JsonPropertyName("localtime_epoch")] int? localtime_epoch,
        [property: JsonPropertyName("localtime")] string localtime
    );
}