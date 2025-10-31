using System.Text;
using BlazorCloud.Data;
using BlazorCloud.Data.DataTransferObjects;
using BlazorCloud.Data.Entities;
using Microsoft.AspNetCore.Mvc;

namespace BlazorCloud.API;

public class PostData
{
    public static async Task<IResult> Upload(UploadedData uploadedData, HttpContext httpContext, ApplicationDbContext dbContext)
    {
        // Map DTO → EF entity
        var environmentData = new EnvironmentData
        {
            TeamNumber = uploadedData.TeamNumber,
            Temperature = uploadedData.Temperature,
            Humidity = uploadedData.Humidity,
            Timestamp = uploadedData.Timestamp,
        };

        // Persist
        dbContext.EnvironmentData.Add(environmentData);
        await dbContext.SaveChangesAsync();

        return Results.Ok(environmentData);
    }
}