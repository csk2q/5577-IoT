using System.Text;
using BlazorCloud.Data;
using BlazorCloud.Data.DataTransferObjects;
using BlazorCloud.Data.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace BlazorCloud.API;

public delegate void EnvironmentDataUpdatedEventHandler(EnvironmentData environmentData);


public static class PostData
{
    public static event EnvironmentDataUpdatedEventHandler? EnvironmentDataUpdated;
    
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
        
        // Call updates without blocking the http thread.
        _ = Task.Run(() => EnvironmentDataUpdated?.Invoke(environmentData));

        return Results.Ok(environmentData);
    }
}