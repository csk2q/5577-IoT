using BlazorCloud.Data.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace BlazorCloud.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<EnvironmentData> EnvironmentData { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        // Configure any relationships, indexes, etc. here.
        // modelBuilder.Entity<EnvironmentData>()
        //     .HasIndex(p => p.Email)
        //     .IsUnique();
    }
}