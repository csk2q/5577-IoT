using BlazorCloud.Data;
using BlazorCloud.Data.DataTransferObjects;
using BlazorCloud.Data.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BlazorCloud.Controllers;

[Route("/post-data")]
[ApiController]
public class Upload : Controller
{
    private readonly ApplicationDbContext dbContext;

    public Upload(ApplicationDbContext context)
    {
        dbContext = context;
    }

    [HttpPost]
    [ServiceFilter(typeof(Filters.DecryptRequestFilter))]
    public async Task<IActionResult> SaveData([FromBody] UploadedData uploadedData)
    {
        // ModelState is automatically validated due to [ApiController]
        // But we can still check it manually if needed:
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        // Map DTO → EF entity
        var environmentData = new EnvironmentData
        {
            TeamNumber = uploadedData.team_number,
            Temperature = uploadedData.temperature,
            Humidity = uploadedData.humidity,
            Timestamp = uploadedData.timestamp,
            // CreatedAt will be set automatically by the entity default
        };

        // Persist
        dbContext.EnvironmentData.Add(environmentData);
        await dbContext.SaveChangesAsync();

        // Return 201 Created + location header
        return CreatedAtAction(
            nameof(GetEnvDataById), // the action that can be used to retrieve the resource
            new { id = environmentData.Id }, // route values
            environmentData // body
        );
    }


    /// <summary>
    /// Helper GET to confirm resource creation (used in CreatedAtAction).
    /// </summary>
    [HttpGet("{id:int}", Name = "GetEnvDataById")]
    public async Task<ActionResult<UploadedData>> GetEnvDataById(int id)
    {
        var data = await dbContext.EnvironmentData.FindAsync(id);

        if (data == null)
            return NotFound();

        return Ok(data);
    }
}