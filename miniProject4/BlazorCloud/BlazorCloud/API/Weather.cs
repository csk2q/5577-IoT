using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;
using BlazorCloud.Services;

namespace BlazorCloud.API;

public class Weather
{
    public static async Task<IResult> Query(HttpContext httpContext, WeatherApiService weatherApiService, string q)
    {
        WeatherApiService.WeatherData? weatherData;
        try
        {
            weatherData = await weatherApiService.QueryAsync(q);
        }
        catch (Exception e)
        {
            return Results.InternalServerError($"Failed to get weather data. \n{e.Message}");
        }

        if (weatherData is not null)
            return Results.Json(weatherData,
                new JsonSerializerOptions(JsonSerializerDefaults.Web) { IncludeFields = true });
        
        return Results.NotFound("No WeatherData found.");
    }
}



