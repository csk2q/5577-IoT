using Microsoft.AspNetCore.Http;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using BlazorCloud.Data.DataTransferObjects;

namespace BlazorCloud.Middleware;

public class RequestDecrypter(RequestDelegate next)
{
    /*public async Task InvokeAsync(HttpContext context)
    {
        // Get the endpoint (after routing)
        var endpoint = context.GetEndpoint();
        if (endpoint == null)
        {
            await next(context);
            return;
        }

        // Check if the endpoint belongs to the controller we care about
        // (you can also match by attribute, route, etc.)
        var controllerName = endpoint.Metadata
            .GetMetadata<Microsoft.AspNetCore.Mvc.Controllers.ControllerActionDescriptor>()?
            .ControllerTypeInfo?.Name;

        if (controllerName == nameof(UploadedData))
        {
            // Read raw body
            context.Request.EnableBuffering();          // so we can re‑read it
            var rawBytes = await ReadBodyAsBytesAsync(context.Request);
            context.Request.Body.Position = 0;          // rewind

            // Decrypt
            var decryptedJson = Helpers.AesHelper.Decrypt(rawBytes);

            // Replace the body with the decrypted JSON
            var newStream = new MemoryStream(Encoding.UTF8.GetBytes(decryptedJson));
            context.Request.Body = newStream;
            context.Request.ContentLength = newStream.Length;
        }

        await next(context);
    }

    private static async Task<byte[]> ReadBodyAsBytesAsync(HttpRequest request)
    {
        using var ms = new MemoryStream();
        await request.Body.CopyToAsync(ms);
        return ms.ToArray();
    }*/
    
     public async Task InvokeAsync(HttpContext context)
     {
         if (context.Request.Headers.ContainsKey("X-Encrypted"))
         {
             // throw new InvalidOperationException("Missing X-Encrypted header");

             // Read raw body as bytes
             context.Request.EnableBuffering(); // allows re‑reading
             var bodyBytes = await ReadStreamToEndAsync(context.Request.Body);
             context.Request.Body.Position = 0; // reset for next middleware

             // Decrypt
             var decrypted = Helpers.AesHelper.Decrypt(bodyBytes);

             // Replace body with decrypted JSON
             var newStream = new MemoryStream(Encoding.UTF8.GetBytes(decrypted));
             context.Request.Body = newStream;
             context.Request.ContentLength = newStream.Length;
         }

         await next(context);
     }

     private static async Task<byte[]> ReadStreamToEndAsync(Stream stream)
     {
         using var ms = new MemoryStream();
         await stream.CopyToAsync(ms);
         return ms.ToArray();
     }
}