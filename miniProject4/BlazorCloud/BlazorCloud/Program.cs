using System.Text;
using BlazorCloud.API;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using BlazorCloud.Components;
using BlazorCloud.Components.Account;
using BlazorCloud.Data;
using BlazorCloud.Middleware;
using BlazorCloud.Services;
using MudBlazor.Services;

namespace BlazorCloud;

public class Program
{
    public static string weatherApiKey { get; private set;}

    public static void Main(string[] args)
    {
        weatherApiKey = File.ReadAllText(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WeatherApi.key.txt"));
        
        
        var builder = WebApplication.CreateBuilder(args);
        
        builder.WebHost.ConfigureKestrel(serverOptions =>
        {
            serverOptions.ListenAnyIP(5250);
        });

        // Add services to the container.
        builder.Services.AddRazorComponents()
            .AddInteractiveServerComponents();

        builder.Services.AddCascadingAuthenticationState();
        builder.Services.AddScoped<IdentityUserAccessor>();
        builder.Services.AddScoped<IdentityRedirectManager>();
        builder.Services.AddScoped<AuthenticationStateProvider, IdentityRevalidatingAuthenticationStateProvider>();
        
        builder.Services.AddMemoryCache();
        builder.Services.AddHttpClient();
        builder.Services.AddScoped<WeatherApiService>();
        
        builder.Services.AddMudServices();
        builder.Services.AddMudPopoverService();
        builder.Services.AddMudBlazorDialog();

        builder.Services.AddControllers();
        // builder.Services.AddScoped<DecryptRequestFilter>();
        
        builder.Services.AddAuthentication(options =>
            {
                options.DefaultScheme = IdentityConstants.ApplicationScheme;
                options.DefaultSignInScheme = IdentityConstants.ExternalScheme;
            })
            .AddIdentityCookies();

        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ??
                               throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlite(connectionString));
        builder.Services.AddDatabaseDeveloperPageExceptionFilter();

        builder.Services.AddIdentityCore<ApplicationUser>(options => options.SignIn.RequireConfirmedAccount = true)
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();

        builder.Services.AddSingleton<IEmailSender<ApplicationUser>, IdentityNoOpEmailSender>();

        var app = builder.Build();

        // Configure the HTTP request pipeline.
        if (app.Environment.IsDevelopment())
        {
            app.UseMigrationsEndPoint();
        }
        else
        {
            app.UseExceptionHandler("/Error");
            // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
            app.UseHsts();
        }

        app.UseHttpsRedirection();

        app.UseAntiforgery();
        
        app.UseMiddleware<DecryptorMiddleware>(); 

        app.MapStaticAssets();
        app.MapRazorComponents<App>()
            .AddInteractiveServerRenderMode();

        // Add additional endpoints required by the Identity /Account Razor components.
        app.MapAdditionalIdentityEndpoints();
        
        app.MapControllers();

        /*app.MapPost("post-data-test", async context =>
        {
            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "text/plain";
            await context.Response.WriteAsync("Hello World!\n" + context.Request.Path);

        });*/
        app.MapPost("post-data", PostData.Upload);
        app.MapGet("api/weather", Weather.Query);
        app.MapPost("test", async httpContext =>
        {
            Console.WriteLine("Payload=" + await new StreamReader(httpContext.Request.Body, Encoding.UTF8).ReadToEndAsync());
        });

        app.Run();
    }
}