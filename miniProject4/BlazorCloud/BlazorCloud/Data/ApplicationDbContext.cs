using BlazorCloud.Data.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace BlazorCloud.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<EnvironmentData> EnvironmentData { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configure any relationships, indexes, etc. here.
        // modelBuilder.Entity<EnvironmentData>()
        //     .HasIndex(p => p.Email)
        //     .IsUnique();

        var floatConverter = new EncryptedFloatConverter();
        var stringConverter = new EncryptedStringConverter();

        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        foreach (var property in entity.GetProperties())
        {
            var propertyInfo = property.PropertyInfo;
            if (propertyInfo is null)
                continue;

            // Apply Float converter if marked – it will store the value as binary in the DB
            if (propertyInfo.IsDefined(typeof(EncryptedFloatAttribute), inherit: false))
                property.SetValueConverter(floatConverter);
            // Apply String converter if marked – it will store the value as binary in the DB
            else if (propertyInfo.IsDefined(typeof(EncryptedStringAttribute), inherit: false))
                property.SetValueConverter(stringConverter);
        }


        base.OnModelCreating(modelBuilder);
    }
}