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
        if (httpContext.Request.Headers.ContainsKey("X-Encrypted"))
        {
            // throw new InvalidOperationException("Missing X-Encrypted header");

            // Read raw body as bytes
            httpContext.Request.EnableBuffering(); // allows re‑reading
            using var ms = new MemoryStream();
            await httpContext.Request.Body.CopyToAsync(ms);
            var bodyBytes = ms.ToArray();
            httpContext.Request.Body.Position = 0; // reset for next middleware

            // Decrypt
            var decrypted = Helpers.AesHelper.Decrypt(bodyBytes);

            // Replace body with decrypted JSON
            var newStream = new MemoryStream(Encoding.UTF8.GetBytes(decrypted));
            httpContext.Request.Body = newStream;
            httpContext.Request.ContentLength = newStream.Length;
        }
        
        
        // if(!DateTime.TryParse(uploadedData.Timestamp, out DateTime timestamp))
        //     timestamp = DateTime.UtcNow;
        
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
        
        
        httpContext.Response.StatusCode = StatusCodes.Status200OK;
        httpContext.Response.ContentType = "text/plain";
        httpContext.Response.ContentLength = 12;
        await httpContext.Response.WriteAsync("Hello World!");
        await httpContext.Response.CompleteAsync();
    }
}