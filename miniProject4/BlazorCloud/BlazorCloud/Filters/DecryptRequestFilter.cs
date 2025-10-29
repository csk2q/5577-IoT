using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.Text;
using System.Threading.Tasks;

namespace BlazorCloud.Filters;

public class DecryptRequestFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var request = context.HttpContext.Request;

        // Only decrypt if a marker header exists (or always)
        if (request.Headers.ContainsKey("X-Encrypted"))
        {
            // throw new InvalidOperationException("Missing X-Encrypted header");

            request.EnableBuffering();
            var bodyBytes = await ReadStreamToEndAsync(request.Body);
            request.Body.Position = 0;

            var decrypted = Helpers.AesHelper.Decrypt(bodyBytes);
            request.Body = new MemoryStream(Encoding.UTF8.GetBytes(decrypted));
            request.ContentLength = request.Body.Length;
        }

        await next(); // proceed to controller
    }

    private static async Task<byte[]> ReadStreamToEndAsync(Stream stream)
    {
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms);
        return ms.ToArray();
    }
}