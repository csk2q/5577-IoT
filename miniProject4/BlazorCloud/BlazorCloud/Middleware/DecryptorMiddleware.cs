using Microsoft.AspNetCore.Http;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using BlazorCloud.Data.DataTransferObjects;

namespace BlazorCloud.Middleware;

public class DecryptorMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        // Only act when the X‑Encrypted header is present
        if (!context.Request.Headers.ContainsKey("X-Encrypted"))
        {
            await next(context);
            return;
        }

        // Allow the request body to be read multiple times
        context.Request.EnableBuffering();

        // Read the body *as a string* (the base‑64 payload)
        context.Request.Body.Position = 0;
        using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true);
        var base64Payload = await reader.ReadToEndAsync();
        context.Request.Body.Position = 0;   // reset for next middleware
        
        if (string.IsNullOrWhiteSpace(base64Payload))
        {
            // If you want to enforce non‑empty payloads, throw here
            throw new InvalidOperationException("Encrypted payload is empty.");
        }

        base64Payload = base64Payload.Trim().Trim('"');
        
        // DEBUG LOG
        Console.WriteLine("Base64Payload=" + base64Payload);

        // Decode base‑64 → raw encrypted bytes
        byte[] encryptedBytes;
        try
        {
            encryptedBytes = Convert.FromBase64String(base64Payload);
        }
        catch (FormatException ex)
        {
            throw new InvalidOperationException("The request body was not a valid Base64 string.", ex);
        }

        // Decrypt the raw bytes → plaintext JSON
        string plainText;
        try
        {
            plainText = Helpers.AesDecryptor.DecryptAes(base64Payload);
            // plainText = Helpers.AesCbcHelper.DecryptData(base64Payload);
            // plainText = Helpers.AesHelper.Decrypt(encryptedBytes);
        }
        catch (Exception ex)
        {
            // If decryption fails, surface an HTTP 400/401 or let it bubble up
            throw new InvalidOperationException("Failed to decrypt payload.", ex);
        }
        
        // DEBUG LOG
        Console.WriteLine("PlainTextJson=" + plainText);

        // Replace the body with the decrypted JSON
        using var newBody = new MemoryStream(Encoding.UTF8.GetBytes(plainText));
        newBody.Position = 0;
        context.Request.Body = newBody;
        context.Request.ContentLength = newBody.Length;
        // context.Request.ContentType = "application/json";
        // Reset position for downstream middleware/handlers
        context.Request.Body.Position = 0;

        // Continue the pipeline
        await next(context);
    }
}